"""
Pure-Python pcap/pcapng parser and CIC-IDS2017-style flow feature extractor.

No third-party packet libraries required. Supports classic .pcap captures
(little/big endian, micro- and nanosecond precision) and modern .pcapng
(Section Header, Interface Description, Enhanced Packed Block) files over
Ethernet, RAW IP, NULL/loopback and Linux SLL/SLL2 link layers.

Parsed packets are grouped into bidirectional flows keyed on the 5-tuple.
The forward direction follows the first packet seen (the CIC-IDS2017
convention). Flow dictionaries use the snake_case keys consumed by
`ml.feature_mapping.FeatureMapper`, so the exact trained IsolationForest and
XGBoost models can score traffic uploaded by the red team.
"""

import socket
import statistics
import struct
from dataclasses import dataclass
from typing import Any, Dict, List, Optional, Sequence, Tuple

# --- capture formats ----------------------------------------------------- #
# Classic pcap stores the same magic number in the writer's native byte order.
PCAP_MAGIC_USEC_LE = 0xA1B2C3D4
PCAP_MAGIC_NSEC_LE = 0xA1B23C4D

PCAPNG_SHB = 0x0A0D0D0A
PCAPNG_IDB = 0x00000001
PCAPNG_PB = 0x00000002
PCAPNG_SPB = 0x00000003
PCAPNG_OB = 0x00000005
PCAPNG_EPB = 0x00000006

# --- link types ----------------------------------------------------------- #
DLT_NULL = 0
DLT_EN10MB = 1
DLT_RAW = 101
DLT_LINUX_SLL = 113
DLT_LINUX_SLL2 = 276

# --- ethertypes / protocols ------------------------------------------------ #
ETH_IPV4 = 0x0800
ETH_IPV6 = 0x86DD
ETH_VLAN = 0x8100
ETH_QINQ = 0x88A8

PROTO_ICMP = 1
PROTO_TCP = 6
PROTO_UDP = 17

_PROTO_LABEL = {PROTO_ICMP: "ICMP", PROTO_TCP: "TCP", PROTO_UDP: "UDP"}

TCP_FLAG_FIN = 0x01
TCP_FLAG_SYN = 0x02
TCP_FLAG_RST = 0x04
TCP_FLAG_PSH = 0x08
TCP_FLAG_ACK = 0x10
TCP_FLAG_URG = 0x20
TCP_FLAG_ECE = 0x40
TCP_FLAG_CWR = 0x80

MAX_PACKETS = 200_000
MAX_FILE_BYTES = 25 * 1024 * 1024

_HTTP_PORTS = {80, 443, 8080, 8000, 3128, 8888, 8443}


class PcapParseError(ValueError):
    """Raised when the capture file cannot be parsed."""


@dataclass
class Packet:
    ts: float  # absolute timestamp in seconds
    src_ip: str
    dst_ip: str
    src_port: int
    dst_port: int
    protocol: str
    ip_len: int
    payload_len: int
    tcp_flags: int = 0
    tcp_window: int = 0


# -------------------------------------------------------------------------- #
# packet decoders
# -------------------------------------------------------------------------- #
def _fmt_ipv4(data: bytes) -> Optional[Tuple[str, str]]:
    if len(data) < 20:
        return None
    try:
        return (
            socket.inet_ntop(socket.AF_INET, data[12:16]),
            socket.inet_ntop(socket.AF_INET, data[16:20]),
        )
    except OSError:
        return None


def _fmt_ipv6(data: bytes) -> Optional[Tuple[str, str]]:
    if len(data) < 40:
        return None
    try:
        return (
            socket.inet_ntop(socket.AF_INET6, data[8:24]),
            socket.inet_ntop(socket.AF_INET6, data[24:40]),
        )
    except OSError:
        return None


def _decode_ip(data: bytes, ts: float) -> Optional[Packet]:
    if not data or data[0] >> 4 not in (4, 6):
        return None
    version = data[0] >> 4
    if version == 4:
        ihl = (data[0] & 0x0F) * 4
        if ihl < 20 or len(data) < ihl:
            return None
        total_len = int.from_bytes(data[2:4], "big")
        proto = data[9]
        addresses = _fmt_ipv4(data)
        src, dst = addresses if addresses else ("0.0.0.0", "0.0.0.0")
        ip_len = total_len if total_len >= 20 else len(data)
    else:
        total_len = 40 + int.from_bytes(data[4:6], "big")
        proto = data[6]
        addresses = _fmt_ipv6(data)
        src, dst = addresses if addresses else ("::", "::")
        ip_len = total_len if total_len >= 40 else len(data)
        # hop-by-hop / routing extension: walk to the real L4 header
        offset = 40
        for _ in range(8):
            if proto not in (0, 43, 60, 135):
                break
            if offset + 8 > len(data):
                break
            nxt = data[offset]
            step = (data[offset + 1] + 1) * 8
            proto = nxt if nxt in (6, 17, 1) else (data[offset] if proto in (0, 43, 60, 135) else proto)
            offset += step
        if proto in (PROTO_TCP, PROTO_UDP, PROTO_ICMP):
            proto = data[offset] if offset + 1 <= len(data) else proto

    label = _PROTO_LABEL.get(proto, "OTHER")
    src_port = dst_port = 0
    payload_len = 0
    tcp_flags = 0
    tcp_window = 0

    if proto == PROTO_TCP:
        if len(data) >= ihl + 20 if version == 4 else len(data) >= 20:
            l4 = data[ihl:] if version == 4 else data[offset : offset + 20]
            if len(l4) >= 20:
                src_port = int.from_bytes(l4[0:2], "big")
                dst_port = int.from_bytes(l4[2:4], "big")
                tcp_flags = l4[13]
                tcp_window = int.from_bytes(l4[14:16], "big")
                tcp_hdr_len = (l4[12] >> 4) * 4
                if tcp_hdr_len < 20 or tcp_hdr_len > len(l4):
                    tcp_hdr_len = 20
                payload_len = max(0, min(ip_len, len(data)) - ihl - tcp_hdr_len if version == 4 else len(data) - offset - tcp_hdr_len)
    elif proto == PROTO_UDP:
        l4 = data[ihl:] if version == 4 else data[offset : offset + 8]
        if len(l4) >= 8:
            src_port = int.from_bytes(l4[0:2], "big")
            dst_port = int.from_bytes(l4[2:4], "big")
            udp_len = int.from_bytes(l4[4:6], "big")
            payload_len = max(0, udp_len - 8)
    elif proto == PROTO_ICMP:
        payload_len = max(0, min(ip_len, len(data)) - ihl - 8 if version == 4 else len(data) - offset - 8)

    return Packet(
        ts=ts,
        src_ip=src,
        dst_ip=dst,
        src_port=src_port,
        dst_port=dst_port,
        protocol=label,
        ip_len=min(ip_len, 65535),
        payload_len=payload_len,
        tcp_flags=tcp_flags,
        tcp_window=tcp_window,
    )


def _parse_ethernet(data: bytes, ts: float) -> Optional[Packet]:
    off = 0
    for _ in range(2):  # up to two (QinQ) VLAN tags
        if len(data) < off + 14:
            return None
        etype = int.from_bytes(data[off + 12 : off + 14], "big")
        if etype in (ETH_VLAN, ETH_QINQ):
            off += 4
            continue
        return _decode_ip(data[off + 14 :], ts) if etype in (ETH_IPV4, ETH_IPV6) else None
    return None


def _parse_packet(data: bytes, ts: float, linktype: int) -> Optional[Packet]:
    if linktype == DLT_EN10MB:
        return _parse_ethernet(data, ts)
    if linktype == DLT_RAW:
        return _decode_ip(data, ts)
    if linktype == DLT_NULL:
        if len(data) < 4:
            return None
        family = int.from_bytes(data[:4], "little")
        if family not in (2, 10, 24, 28, 30):
            family = int.from_bytes(data[:4], "big")
        return _decode_ip(data[4:], ts) if family in (2, 10, 24, 28, 30) else None
    if linktype == DLT_LINUX_SLL:
        if len(data) < 16:
            return None
        ptype = int.from_bytes(data[14:16], "big")
        return _decode_ip(data[16:], ts) if ptype in (ETH_IPV4, ETH_IPV6) else None
    if linktype == DLT_LINUX_SLL2:
        if len(data) < 20:
            return None
        ptype = int.from_bytes(data[0:2], "big")
        return _decode_ip(data[20:], ts) if ptype in (ETH_IPV4, ETH_IPV6) else None
    return None


# -------------------------------------------------------------------------- #
# capture readers
# -------------------------------------------------------------------------- #
def _read_packets_classic(data: bytes) -> List[Packet]:
    if len(data) < 24:
        raise PcapParseError("File too short to be a pcap capture")
    first_le = int.from_bytes(data[0:4], "little")
    first_be = int.from_bytes(data[0:4], "big")
    if first_le == PCAP_MAGIC_USEC_LE or first_le == PCAP_MAGIC_NSEC_LE:
        endian = "little"
        ns = first_le == PCAP_MAGIC_NSEC_LE
    elif first_be == PCAP_MAGIC_USEC_LE or first_be == PCAP_MAGIC_NSEC_LE:
        endian = "big"
        ns = first_be == PCAP_MAGIC_NSEC_LE
    else:
        raise PcapParseError("Unrecognized pcap magic")

    linktype = int.from_bytes(data[20:24], endian)
    ts_unit = 1e-9 if ns else 1e-6
    packets: List[Packet] = []
    offset = 24
    total = len(data)
    while offset + 16 <= total and len(packets) < MAX_PACKETS:
        ts_sec = int.from_bytes(data[offset : offset + 4], endian)
        ts_frac = int.from_bytes(data[offset + 4 : offset + 8], endian)
        incl_len = int.from_bytes(data[offset + 8 : offset + 12], endian)
        offset += 16
        if offset + incl_len > total or incl_len > 65535:
            break
        pkt_data = data[offset : offset + incl_len]
        offset += incl_len
        if not pkt_data:
            continue
        pkt = _parse_packet(pkt_data, ts_sec + ts_frac * ts_unit, linktype)
        if pkt:
            packets.append(pkt)
    return packets


def _read_packets_pcapng(data: bytes) -> List[Packet]:
    if len(data) < 12:
        raise PcapParseError("File too short to be a pcapng capture")

    def _endian_for_shb(block_type: int) -> str:
        magic = int.from_bytes(data[8:12], "little")
        return "little" if magic == 0x1A2B3C4D else "big"

    offset = 0
    total = len(data)
    endian = "little"
    linktype: Optional[int] = None
    ts_resol: float = 1e-6  # default: 10^-6 s per pcapng spec
    packets: List[Packet] = []

    while offset + 12 <= total and len(packets) < MAX_PACKETS:
        block_type = int.from_bytes(data[offset : offset + 4], endian)
        block_len = int.from_bytes(data[offset + 4 : offset + 8], endian)
        if block_len < 12 or offset + block_len > total:
            break
        body = data[offset + 8 : offset + block_len - 4]

        if block_type == PCAPNG_SHB:
            endian = _endian_for_shb(block_type)
            if endian == "big":  # re-evaluate sizes with correct endianness
                block_type = int.from_bytes(data[offset : offset + 4], endian)
                block_len = int.from_bytes(data[offset + 4 : offset + 8], endian)
                if offset + block_len > total:
                    break
                body = data[offset + 8 : offset + block_len - 4]

        elif block_type == PCAPNG_IDB:
            if endian == "big":
                block_type = int.from_bytes(data[offset : offset + 4], endian)
                block_len = int.from_bytes(data[offset + 4 : offset + 8], endian)
                if offset + block_len > total:
                    break
                body = data[offset + 8 : offset + block_len - 4]
            if len(body) >= 4:
                linktype = int.from_bytes(body[0:2], endian)
                options = body[4:]
                pos = 0
                while pos + 4 <= len(options):
                    code = int.from_bytes(options[pos : pos + 2], endian)
                    opt_len = int.from_bytes(options[pos + 2 : pos + 4], endian)
                    pos += 4
                    if code == 0:  # opt_endofopt
                        break
                    if pos + opt_len > len(options):
                        break
                    if code == 9 and opt_len >= 1:  # tsresol
                        value = options[pos]
                        if value & 0x80:
                            ts_resol = 10 ** -(value & 0x7F)
                        else:
                            ts_resol = 2 ** -value
                    pos += (opt_len + 3) & ~3

        elif block_type == PCAPNG_EPB:
            if endian == "big":
                block_type = int.from_bytes(data[offset : offset + 4], endian)
                block_len = int.from_bytes(data[offset + 4 : offset + 8], endian)
                if offset + block_len > total:
                    break
                body = data[offset + 8 : offset + block_len - 4]
            if len(body) < 20 or linktype is None:
                break
            ts_high = int.from_bytes(body[4:8], endian)
            ts_low = int.from_bytes(body[8:12], endian)
            caplen = int.from_bytes(body[12:16], endian)
            ts = (ts_high << 32 | ts_low) * ts_resol
            pkt = _parse_packet(body[20 : 20 + caplen], ts, linktype)
            if pkt:
                packets.append(pkt)

        elif block_type in (PCAPNG_PB, PCAPNG_OB):
            if endian == "big":
                block_type = int.from_bytes(data[offset : offset + 4], endian)
                block_len = int.from_bytes(data[offset + 4 : offset + 8], endian)
                if offset + block_len > total:
                    break
                body = data[offset + 8 : offset + block_len - 4]
            if block_type in (PCAPNG_OB, PCAPNG_PB) and len(body) >= 4:
                orig_len = int.from_bytes(body[0:4], endian)
                pkt = _parse_packet(body[4 : 4 + min(orig_len, len(body) - 4)], 0.0, linktype) if linktype is not None else None
                if pkt:
                    packets.append(pkt)

        offset += block_len
    return packets


def parse_traffic(data: bytes) -> List[Packet]:
    """Parse pcap or pcapng bytes into a list of decodable IP packets."""
    if len(data) > MAX_FILE_BYTES:
        raise PcapParseError("Capture file exceeds the 25MB limit")
    if len(data) < 12:
        raise PcapParseError("File too short to be a packet capture")
    first = int.from_bytes(data[0:4], "little")
    if first == PCAP_MAGIC_USEC_LE or first == PCAP_MAGIC_NSEC_LE or int.from_bytes(
        data[0:4], "big"
    ) in (PCAP_MAGIC_USEC_LE, PCAP_MAGIC_NSEC_LE):
        return _read_packets_classic(data)
    if data[0:4] == struct.pack(">I", PCAPNG_SHB) or data[0:4] == struct.pack("<I", PCAPNG_SHB):
        return _read_packets_pcapng(data)
    raise PcapParseError("Unrecognized capture format (expected .pcap or .pcapng)")


# -------------------------------------------------------------------------- #
# flow aggregation
# -------------------------------------------------------------------------- #
class _FlowBuf:
    __slots__ = (
        "src_ip", "dst_ip", "src_port", "dst_port", "protocol",
        "fwd_len", "bwd_len", "fwd_ts", "bwd_ts", "fwd_payload", "bwd_payload",
        "flag_counts", "fwd_win", "bwd_win",
        "fwd_pkts", "bwd_pkts", "first_ts", "last_ts",
    )

    def __init__(self, first: Packet) -> None:
        self.src_ip = first.src_ip
        self.dst_ip = first.dst_ip
        self.src_port = first.src_port
        self.dst_port = first.dst_port
        self.protocol = first.protocol
        self.fwd_len: List[int] = []
        self.bwd_len: List[int] = []
        self.fwd_ts: List[float] = []
        self.bwd_ts: List[float] = []
        self.fwd_payload: List[int] = []
        self.bwd_payload: List[int] = []
        self.flag_counts = {
            TCP_FLAG_FIN: 0,
            TCP_FLAG_SYN: 0,
            TCP_FLAG_RST: 0,
            TCP_FLAG_PSH: 0,
            TCP_FLAG_ACK: 0,
            TCP_FLAG_URG: 0,
            TCP_FLAG_ECE: 0,
            TCP_FLAG_CWR: 0,
        }
        self.fwd_win: List[int] = []
        self.bwd_win: List[int] = []
        self.fwd_pkts = 0
        self.bwd_pkts = 0
        self.first_ts = first.ts
        self.last_ts = first.ts
        self.add(first)

    def add(self, packet: Packet) -> None:
        is_fwd = (
            packet.src_ip == self.src_ip
            and packet.dst_ip == self.dst_ip
            and packet.src_port == self.src_port
            and packet.dst_port == self.dst_port
        )
        if is_fwd:
            self.fwd_pkts += 1
            self.fwd_len.append(packet.ip_len)
            self.fwd_ts.append(packet.ts)
            self.fwd_payload.append(packet.payload_len)
            if packet.tcp_window:
                self.fwd_win.append(packet.tcp_window)
        else:
            self.bwd_pkts += 1
            self.bwd_len.append(packet.ip_len)
            self.bwd_ts.append(packet.ts)
            self.bwd_payload.append(packet.payload_len)
            if packet.tcp_window:
                self.bwd_win.append(packet.tcp_window)
        for bit in self.flag_counts:
            if packet.tcp_flags & bit:
                self.flag_counts[bit] += 1
        if packet.ts < self.first_ts:
            self.first_ts = packet.ts
        if packet.ts > self.last_ts:
            self.last_ts = packet.ts


def _gap_stats(ts: Sequence[float]) -> Tuple[float, float, float, float, float]:
    """Return (total, mean, stddev, max, min) inter-arrival gaps in µs."""
    if len(ts) < 2:
        return 0.0, 0.0, 0.0, 0.0, 0.0
    gaps = [(b - a) * 1e6 for a, b in zip(ts, ts[1:])]
    if not gaps:
        return 0.0, 0.0, 0.0, 0.0, 0.0
    return (
        sum(gaps),
        statistics.fmean(gaps),
        statistics.pstdev(gaps) if len(gaps) > 1 else 0.0,
        max(gaps),
        min(gaps),
    )


def _safe_div(num: float, den: float, default: float = 0.0) -> float:
    return round(num / den, 6) if den else default


def _mean_of(values: Sequence[float]) -> float:
    return statistics.fmean(values) if values else 0.0


def _flow_from_buf(buf: _FlowBuf) -> Dict[str, Any]:
    fwd_ts = sorted(buf.fwd_ts)
    bwd_ts = sorted(buf.bwd_ts)
    all_ts = sorted(fwd_ts + bwd_ts)
    duration_us = (all_ts[-1] - all_ts[0]) * 1e6 if len(all_ts) >= 2 else 0.0
    duration_s = duration_us / 1e6 if duration_us > 0 else 1e-6

    all_len = buf.fwd_len + buf.bwd_len
    fwd_len = buf.fwd_len or [0]
    bwd_len = buf.bwd_len or [0]
    fwd_iats = _gap_stats(fwd_ts)
    bwd_iats = _gap_stats(bwd_ts)
    flow_iats = _gap_stats(all_ts)

    fwd_bytes = sum(buf.fwd_len)
    bwd_bytes = sum(buf.bwd_len)
    tot_fwd = buf.fwd_pkts
    tot_bwd = buf.bwd_pkts
    tot_pkts = tot_fwd + tot_bwd

    flow: Dict[str, Any] = {
        "src_ip": buf.src_ip,
        "dst_ip": buf.dst_ip,
        "src_port": buf.src_port,
        "dst_port": buf.dst_port,
        "protocol": buf.protocol,
        "flow_duration": round(duration_us, 3),
        "tot_fwd_pkts": tot_fwd,
        "tot_bwd_pkts": tot_bwd,
        "totlen_fwd_pkts": fwd_bytes,
        "totlen_bwd_pkts": bwd_bytes,
        "fwd_pkt_len_max": max(fwd_len),
        "fwd_pkt_len_min": min(fwd_len),
        "fwd_pkt_len_mean": round(_mean_of(fwd_len), 6),
        "fwd_pkt_len_std": round(statistics.pstdev(fwd_len), 6) if len(fwd_len) > 1 else 0.0,
        "bwd_pkt_len_max": max(bwd_len),
        "bwd_pkt_len_min": min(bwd_len),
        "bwd_pkt_len_mean": round(_mean_of(bwd_len), 6),
        "bwd_pkt_len_std": round(statistics.pstdev(bwd_len), 6) if len(bwd_len) > 1 else 0.0,
        "flow_byts_per_s": _safe_div(fwd_bytes + bwd_bytes, duration_s),
        "flow_pkts_per_s": _safe_div(tot_pkts, duration_s),
        "flow_iat_mean": round(flow_iats[1], 6),
        "flow_iat_std": round(flow_iats[2], 6),
        "flow_iat_max": round(flow_iats[3], 6),
        "flow_iat_min": round(flow_iats[4], 6),
        "fwd_iat_tot": round(fwd_iats[0], 6),
        "fwd_iat_mean": round(fwd_iats[1], 6),
        "fwd_iat_std": round(fwd_iats[2], 6),
        "fwd_iat_max": round(fwd_iats[3], 6),
        "fwd_iat_min": round(fwd_iats[4], 6),
        "bwd_iat_tot": round(bwd_iats[0], 6),
        "bwd_iat_mean": round(bwd_iats[1], 6),
        "bwd_iat_std": round(bwd_iats[2], 6),
        "bwd_iat_max": round(bwd_iats[3], 6),
        "bwd_iat_min": round(bwd_iats[4], 6),
        "fwd_header_len": round(fwd_bytes * 0.4 if buf.protocol != "ICMP" else fwd_bytes * 0.35, 3),
        "bwd_header_len": round(bwd_bytes * 0.4 if buf.protocol != "ICMP" else bwd_bytes * 0.35, 3),
        "fwd_pkts_per_s": _safe_div(tot_fwd, duration_s),
        "bwd_pkts_per_s": _safe_div(tot_bwd, duration_s),
        "pkt_len_min": min(all_len),
        "pkt_len_max": max(all_len),
        "pkt_len_mean": round(_mean_of(all_len), 6),
        "pkt_len_std": round(statistics.pstdev(all_len), 6) if len(all_len) > 1 else 0.0,
        "pkt_len_var": round(statistics.pvariance(all_len), 6) if len(all_len) > 1 else 0.0,
        "pkt_size_avg": round(_mean_of(all_len), 6),
        "fin_flag_cnt": buf.flag_counts[TCP_FLAG_FIN],
        "syn_flag_cnt": buf.flag_counts[TCP_FLAG_SYN],
        "rst_flag_cnt": buf.flag_counts[TCP_FLAG_RST],
        "psh_flag_cnt": buf.flag_counts[TCP_FLAG_PSH],
        "ack_flag_cnt": buf.flag_counts[TCP_FLAG_ACK],
        "urg_flag_cnt": buf.flag_counts[TCP_FLAG_URG],
        "cwe_flag_count": buf.flag_counts[TCP_FLAG_CWR],
        "ece_flag_cnt": buf.flag_counts[TCP_FLAG_ECE],
        "fwd_psh_flags": buf.flag_counts[TCP_FLAG_PSH],
        "fwd_urg_flags": buf.flag_counts[TCP_FLAG_URG],
        "bwd_psh_flags": buf.flag_counts[TCP_FLAG_PSH],
        "bwd_urg_flags": buf.flag_counts[TCP_FLAG_URG],
        "down_up_ratio": _safe_div(tot_bwd, tot_fwd),
        "fwd_seg_size_avg": round(_mean_of(buf.fwd_payload or fwd_len), 6),
        "fwd_seg_size_min": min(buf.fwd_payload or fwd_len),
        "bwd_seg_size_avg": round(_mean_of(buf.bwd_payload or bwd_len), 6),
        "fwd_byts_b_avg": 0.0,
        "fwd_pkts_b_avg": 0.0,
        "fwd_blk_rate_avg": 0.0,
        "bwd_byts_b_avg": 0.0,
        "bwd_pkts_b_avg": 0.0,
        "bwd_blk_rate_avg": 0.0,
        "subflow_fwd_pkts": tot_fwd,
        "subflow_fwd_byts": fwd_bytes,
        "subflow_bwd_pkts": tot_bwd,
        "subflow_bwd_byts": bwd_bytes,
        "init_fwd_win_byts": buf.fwd_win[0] if buf.fwd_win else 0.0,
        "init_bwd_win_byts": buf.bwd_win[0] if buf.bwd_win else 0.0,
        "fwd_act_data_pkts": sum(1 for p in buf.fwd_payload if p > 0),
        "active_mean": round(_same_or_zero(fwd_iats, duration_us / 2), 6),
        "active_std": round(fwd_iats[2] / 2 if fwd_iats[1] else 0.0, 6),
        "active_max": round(max(fwd_iats[3], duration_us / 2) if fwd_iats[1] else 0.0, 6),
        "active_min": round(fwd_iats[4] / 2 if fwd_iats[4] else 0.0, 6),
        "idle_mean": 0.0,
        "idle_std": 0.0,
        "idle_max": 0.0,
        "idle_min": 0.0,
        "simillar_http": 1 if buf.dst_port in _HTTP_PORTS or buf.src_port in _HTTP_PORTS else 0,
        "inbound": 1,
        "pkt_count": tot_pkts,
        "bytes": fwd_bytes + bwd_bytes,
        "timestamp": round(all_ts[0]),
        "attack_label": "Captured Traffic",
    }
    return flow


def _same_or_zero(fwd_iats: Tuple[float, float, float, float, float], fallback: float) -> float:
    if fwd_iats[1]:
        return fwd_iats[1]
    return fallback if fallback > 0 else 0.0


def flows_from_packets(packets: List[Packet], max_flows: int = 50) -> List[Dict[str, Any]]:
    """Group packets into bidirectional flows, sorted by total bytes desc."""
    groups: Dict[Tuple[str, str, int, int, str], _FlowBuf] = {}
    for packet in packets:
        if packet.src_ip == packet.dst_ip and packet.src_port == packet.dst_port:
            # loopback packets / symmetric flows: keep direction by 5-tuple as-is
            pass
        host_a = (packet.src_ip, packet.src_port)
        host_b = (packet.dst_ip, packet.dst_port)
        key_first = (packet.src_ip, packet.dst_ip, packet.src_port, packet.dst_port, packet.protocol)
        key_rev = (packet.dst_ip, packet.src_ip, packet.dst_port, packet.src_port, packet.protocol)
        key = key_first if key_first in groups or key_rev not in groups else key_rev
        buf = groups.get(key)
        if buf is None:
            buf = _FlowBuf(packet)
            groups[key] = buf
        else:
            buf.add(packet)

    flows = [_flow_from_buf(buf) for buf in groups.values()]
    flows.sort(key=lambda f: f["bytes"], reverse=True)
    return flows[:max_flows] if max_flows else flows


def summarize_flows(flows: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """Compact per-flow summary for UI tables and pipeline events."""
    return [
        {
            "index": i,
            "src_ip": f.get("src_ip", ""),
            "dst_ip": f.get("dst_ip", ""),
            "dst_port": f.get("dst_port", 0),
            "protocol": f.get("protocol", "TCP"),
            "packets": f.get("pkt_count", 0),
            "bytes": f.get("bytes", 0),
        }
        for i, f in enumerate(flows)
    ]