import type { MITRETechnique, Severity } from "@/types";
import type {
  QueuedAttack,
  SimStageId,
  SimulationEvent,
  SimulationSnapshot,
} from "@/types/simulation";
import type {
  HealthMetric,
  IntelCategory,
  IntelEvent,
  OverviewMetric,
  SearchHit,
  ServiceStatus,
  SocAlert,
  SocEnvironment,
  SocFilters,
  ThreatRow,
} from "@/types/soc";
import { pipelineService } from "@/services";

/**
 * Phase 3 selectors — the ONLY place SOC view models are produced.
 *
 * Everything is a pure function of the centralized simulation snapshot, so
 * every Blue Team widget renders the same event stream with zero local mocks.
 * Values that a real deployment would read from hardware telemetry (CPU,
 * memory) are deterministic functions of the engine tick + live packet load —
 * never `Math.random()` — so widgets stay in lockstep with each other.
 */

const STAGE_LABELS: Record<SimStageId, string> = Object.fromEntries(
  pipelineService.getStageDefinitions().map((s) => [s.id, s.name]),
) as Record<SimStageId, string>;

const STAGE_ORDER: SimStageId[] = pipelineService.getStageDefinitions().map((s) => s.id);

/** Deterministic oscillator — replaces random jitter with reproducible motion. */
const osc = (tick: number, seed: number, amplitude: number) =>
  Math.sin((tick + seed * 13) * 0.21 + seed) * amplitude;

const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));

export const SEVERITY_RANK: Record<Severity, number> = {
  low: 0,
  medium: 1,
  high: 2,
  critical: 3,
};

export function environmentFor(target: string): SocEnvironment {
  const octet = Number(target.split(".")[2] ?? 0);
  if (Number.isNaN(octet)) return "production";
  const mod = octet % 4;
  return mod === 0 ? "production" : mod === 1 ? "staging" : mod === 2 ? "dmz" : "lab";
}

export function stageForAttack(snapshot: SimulationSnapshot, attack: QueuedAttack): SimStageId {
  const packets = snapshot.packets.filter((p) => p.attackId === attack.id);
  if (packets.length) {
    return packets.reduce<SimStageId>((furthest, p) => {
      return STAGE_ORDER.indexOf(p.stage) > STAGE_ORDER.indexOf(furthest) ? p.stage : furthest;
    }, packets[0]!.stage);
  }
  if (attack.state === "queued") return "attacker";
  if (attack.state === "running") return "packetgen";
  return attack.state === "blocked" ? "peo" : "server";
}

export const stageLabel = (stage: SimStageId) => STAGE_LABELS[stage] ?? stage;

/* ------------------------------------------------------------------ */
/* Threat rows                                                         */
/* ------------------------------------------------------------------ */

export function deriveThreatRows(snapshot: SimulationSnapshot): ThreatRow[] {
  return snapshot.queue.map((attack) => {
    const stage = stageForAttack(snapshot, attack);
    return {
      id: attack.id,
      name: attack.name,
      kind: attack.kind,
      state: attack.state,
      stage,
      stageLabel: stageLabel(stage),
      severity: attack.severity,
      mitreTechniqueId: attack.mitreTechniqueId,
      mitreTactic: attack.mitreTactic,
      confidence: attack.confidence,
      target: attack.config.target,
      sourceIp: attack.sourceIp,
      environment: environmentFor(attack.config.target),
      startedAt: attack.startedAt ?? attack.createdAt,
      updatedAt: attack.finishedAt ?? attack.startedAt ?? attack.createdAt,
      packetsSent: attack.packetsSent,
      packetsBlocked: attack.packetsBlocked,
      progress: attack.progress,
      verdict: attack.verdict ?? "pending",
    };
  });
}

const rangeMs: Record<SocFilters["timeRange"], number> = {
  "5m": 5 * 60_000,
  "15m": 15 * 60_000,
  "1h": 60 * 60_000,
  "24h": 24 * 60 * 60_000,
  all: Number.POSITIVE_INFINITY,
};

const withinRange = (timestamp: string, range: SocFilters["timeRange"]) =>
  range === "all" || Date.now() - new Date(timestamp).getTime() <= rangeMs[range];

export function filterThreatRows(rows: ThreatRow[], filters: SocFilters): ThreatRow[] {
  const target = filters.target.trim().toLowerCase();
  return rows.filter((row) => {
    if (filters.severity !== "all" && row.severity !== filters.severity) return false;
    if (filters.attackType !== "all" && row.kind !== filters.attackType) return false;
    if (filters.status !== "all" && row.state !== filters.status) return false;
    if (filters.environment !== "all" && row.environment !== filters.environment) return false;
    if (target && !row.target.toLowerCase().includes(target)) return false;
    if (!withinRange(row.startedAt, filters.timeRange)) return false;
    return true;
  });
}

/* ------------------------------------------------------------------ */
/* Threat intelligence feed                                            */
/* ------------------------------------------------------------------ */

function categorize(event: SimulationEvent): { category: IntelCategory; source: string } {
  const title = event.title.toLowerCase();
  if (title.includes("isolation forest"))
    return { category: "Isolation Forest", source: "Tier-1 Anomaly Engine" };
  if (title.includes("xgboost") || title.includes("classification"))
    return { category: "XGBoost Classified", source: "Tier-2 Classifier" };
  if (title.includes("mitre")) return { category: "MITRE Mapped", source: "ATT&CK Mapper" };
  if (title.includes("rl decision")) return { category: "RL Decision", source: "RL Policy Agent" };
  if (title.includes("firewall") || title.includes("tier-0"))
    return { category: "Firewall Triggered", source: "Tier-0 Adaptive Firewall" };
  if (event.type === "policy" || title.includes("policy"))
    return { category: "Policy Updated", source: "Policy Enforcement Orchestrator" };
  if (event.type === "threat") return { category: "New Threat", source: "Threat Correlator" };
  if (event.type === "packet") return { category: "Packet Capture", source: "Packet Generator" };
  if (event.type === "attack" && title.includes("unknown"))
    return { category: "Unknown Behaviour", source: "Zero-Day Sentinel" };
  if (event.type === "attack") return { category: "New Threat", source: "Perimeter Sensor" };
  return { category: "Operations", source: "Simulation Engine" };
}

export function deriveIntelFeed(snapshot: SimulationSnapshot): IntelEvent[] {
  return snapshot.events.map((event) => {
    const { category, source } = categorize(event);
    const confidence =
      "confidence" in event && typeof event.confidence === "number"
        ? event.confidence
        : event.type === "packet"
          ? event.packet.confidence
          : snapshot.metrics.avgConfidence;
    return {
      id: event.id,
      timestamp: event.timestamp,
      title: event.title,
      description: event.description,
      severity: event.severity,
      confidence,
      source,
      category,
      attackId: event.attackId,
    } satisfies IntelEvent;
  });
}

export function filterIntelFeed(
  feed: IntelEvent[],
  filters: SocFilters,
  rows: ThreatRow[],
): IntelEvent[] {
  const allowed = new Set(rows.map((r) => r.id));
  return feed.filter((event) => {
    if (filters.severity !== "all" && event.severity !== filters.severity) return false;
    if (!withinRange(event.timestamp, filters.timeRange)) return false;
    if (event.attackId && !allowed.has(event.attackId)) return false;
    return true;
  });
}

/* ------------------------------------------------------------------ */
/* Alerts                                                              */
/* ------------------------------------------------------------------ */

/** Alert-worthy events: high/critical signal plus every terminal verdict. */
export function deriveAlertSeeds(snapshot: SimulationSnapshot): Omit<SocAlert, "state">[] {
  return snapshot.events
    .filter(
      (e) =>
        e.type === "policy" ||
        e.type === "threat" ||
        (e.type === "attack" && e.state !== "queued") ||
        SEVERITY_RANK[e.severity] >= SEVERITY_RANK.high,
    )
    .slice(0, 60)
    .map((event) => {
      const { source } = categorize(event);
      return {
        id: event.id,
        timestamp: event.timestamp,
        title: event.title,
        description: event.description,
        severity: event.severity,
        source,
        attackId: event.attackId,
      };
    });
}

/* ------------------------------------------------------------------ */
/* System health                                                       */
/* ------------------------------------------------------------------ */

const statusFor = (value: number, warn: number, crit: number, invert = false) => {
  const breach = invert ? (v: number, t: number) => v <= t : (v: number, t: number) => v >= t;
  if (breach(value, crit)) return "critical" as const;
  if (breach(value, warn)) return "warning" as const;
  return "normal" as const;
};

export function deriveHealth(snapshot: SimulationSnapshot): HealthMetric[] {
  const { tick, metrics, packets, status } = snapshot;
  const load = packets.length;
  const running = status === "running";
  const speed = snapshot.speed;

  const cpu = clamp(16 + load * 2.4 + osc(tick, 1, 6) + (running ? 12 : 0), 4, 99);
  const memory = clamp(34 + load * 1.1 + osc(tick, 2, 4) + metrics.policyUpdates * 0.4, 20, 96);
  const packetRate = Math.round(
    clamp(load * 120 * speed + (running ? 480 : 40) + osc(tick, 3, 90), 0, 100_000),
  );
  const trafficVolume = Number(
    (metrics.packetsGenerated * 0.0009 + load * 0.4 + Math.abs(osc(tick, 4, 1.2))).toFixed(2),
  );
  const throughput = Number(clamp(packetRate * 0.0011 + osc(tick, 5, 0.4), 0, 100).toFixed(2));
  const blockedConnections = metrics.packetsBlocked;
  const detectionLatency = Number(
    clamp(
      snapshot.stages.reduce((sum, s) => sum + s.latencyMs, 0) / Math.max(1, snapshot.stages.length) +
        load * 0.05,
      0.2,
      60,
    ).toFixed(2),
  );

  return [
    { id: "cpu", label: "CPU", value: Number(cpu.toFixed(1)), unit: "%", tone: "blue", status: statusFor(cpu, 70, 88) },
    { id: "memory", label: "Memory", value: Number(memory.toFixed(1)), unit: "%", tone: "purple", status: statusFor(memory, 75, 90) },
    { id: "packet-rate", label: "Packet Rate", value: packetRate, unit: "pkt/s", tone: "green", status: statusFor(packetRate, 40_000, 80_000) },
    { id: "traffic", label: "Traffic Volume", value: trafficVolume, unit: "GB", tone: "blue", status: "normal" },
    { id: "throughput", label: "Network Throughput", value: throughput, unit: "Gbps", tone: "green", status: statusFor(throughput, 40, 80) },
    { id: "blocked", label: "Blocked Connections", value: blockedConnections, unit: "", tone: "pink", status: statusFor(blockedConnections, 400, 1200) },
    { id: "latency", label: "Detection Latency", value: detectionLatency, unit: "ms", tone: "amber", status: statusFor(detectionLatency, 20, 35), invert: true },
  ];
}

export function deriveServices(snapshot: SimulationSnapshot): ServiceStatus[] {
  const running = snapshot.status === "running";
  const load = snapshot.packets.length;
  return [
    {
      id: "ws",
      label: "WebSocket Stream",
      status: running ? "healthy" : snapshot.status === "paused" ? "degraded" : "healthy",
      detail: running ? `streaming · tick ${snapshot.tick}` : `idle · last tick ${snapshot.tick}`,
    },
    {
      id: "db",
      label: "Database",
      status: load > 45 ? "degraded" : "healthy",
      detail: `${(snapshot.metrics.packetsInspected + snapshot.metrics.threatsDetected).toLocaleString()} rows written`,
    },
    {
      id: "api",
      label: "FastAPI Gateway",
      status: "healthy",
      detail: `p95 ${(6 + Math.abs(osc(snapshot.tick, 7, 4))).toFixed(1)} ms`,
    },
    {
      id: "ml",
      label: "ML Engine",
      status: snapshot.metrics.avgConfidence > 0 || running ? "healthy" : "healthy",
      detail: `avg confidence ${(snapshot.metrics.avgConfidence * 100).toFixed(0)}%`,
    },
  ];
}

/* ------------------------------------------------------------------ */
/* Executive overview                                                  */
/* ------------------------------------------------------------------ */

export function deriveOverview(
  snapshot: SimulationSnapshot,
  rows: ThreatRow[],
  alerts: SocAlert[],
): OverviewMetric[] {
  const active = rows.filter((r) => r.state === "running" || r.state === "queued" || r.state === "paused").length;
  const blocked = rows.filter((r) => r.state === "blocked").length;
  const unknown = rows.filter((r) => r.state === "unknown").length;
  const critical = alerts.filter(
    (a) => a.severity === "critical" && (a.state === "open" || a.state === "acknowledged"),
  ).length;

  const health = deriveHealth(snapshot);
  const packetRate = health.find((h) => h.id === "packet-rate")?.value ?? 0;
  const detectionLatency = health.find((h) => h.id === "latency")?.value ?? 0;

  const inspected = snapshot.metrics.packetsInspected;
  const accuracy = inspected
    ? clamp(88 + snapshot.metrics.avgConfidence * 10 - unknown * 1.5, 60, 99.4)
    : 0;
  const responseTime = Number(
    (detectionLatency + snapshot.stages.filter((s) => s.id === "peo" || s.id === "rl").reduce((a, s) => a + s.latencyMs, 0)).toFixed(2),
  );

  return [
    { id: "active", label: "Active Threats", value: active, display: String(active), hint: `${rows.length} operations tracked`, tone: "pink" },
    { id: "blocked", label: "Blocked Threats", value: blocked, display: String(blocked), hint: `${snapshot.metrics.packetsBlocked.toLocaleString()} packets contained`, tone: "green" },
    { id: "unknown", label: "Unknown Threats", value: unknown, display: String(unknown), hint: "Awaiting analyst triage", tone: "amber" },
    { id: "critical", label: "Critical Alerts", value: critical, display: String(critical), hint: `${alerts.length} alerts in window`, tone: "pink" },
    { id: "accuracy", label: "AI Detection Accuracy", value: Number(accuracy.toFixed(1)), display: `${accuracy.toFixed(1)}`, unit: "%", hint: `${inspected.toLocaleString()} packets inspected`, tone: "purple" },
    { id: "policy", label: "Policy Version", value: snapshot.metrics.policyUpdates, display: `v4.12.${snapshot.metrics.policyUpdates}`, hint: `${snapshot.metrics.policyUpdates} enforcement updates`, tone: "blue" },
    { id: "detection-time", label: "Avg Detection Time", value: detectionLatency, display: detectionLatency.toFixed(2), unit: "ms", hint: "Tier-0 → Tier-2 mean", tone: "amber", invert: true },
    { id: "throughput", label: "Current Throughput", value: packetRate, display: packetRate.toLocaleString(), unit: "pkt/s", hint: `${snapshot.packets.length} packets in flight`, tone: "green" },
    { id: "response", label: "Avg Response Time", value: responseTime, display: responseTime.toFixed(2), unit: "ms", hint: "RL decision → PEO enforcement", tone: "blue", invert: true },
  ];
}

/* ------------------------------------------------------------------ */
/* Unified search                                                      */
/* ------------------------------------------------------------------ */

export function searchEverything(
  query: string,
  snapshot: SimulationSnapshot,
  rows: ThreatRow[],
  alerts: SocAlert[],
  techniques: MITRETechnique[],
): SearchHit[] {
  const q = query.trim().toLowerCase();
  if (q.length < 2) return [];
  const match = (...parts: Array<string | undefined>) =>
    parts.some((p) => (p ?? "").toLowerCase().includes(q));

  const hits: SearchHit[] = [];

  rows.forEach((row) => {
    if (match(row.name, row.kind, row.target, row.sourceIp, row.mitreTechniqueId, row.state))
      hits.push({
        id: `atk-${row.id}`,
        group: "Attacks",
        title: row.name,
        subtitle: `${row.id} · ${row.state} · ${row.sourceIp} → ${row.target}`,
        severity: row.severity,
        attackId: row.id,
      });
  });

  snapshot.events.forEach((event) => {
    if (event.type === "policy") {
      if (match(event.title, event.description, event.rule)) {
        hits.push({
          id: `pol-${event.id}`,
          group: "Policies",
          title: event.title,
          subtitle: event.description,
          severity: event.severity,
          attackId: event.attackId,
        });
        hits.push({
          id: `rule-${event.id}`,
          group: "Rules",
          title: event.rule,
          subtitle: `${event.action.toUpperCase()} rule installed at ${new Date(event.timestamp).toLocaleTimeString()}`,
          severity: event.severity,
          attackId: event.attackId,
        });
      }
    } else if (event.type === "threat") {
      if (match(event.title, event.description, event.mitreTechniqueId, event.kind))
        hits.push({
          id: `thr-${event.id}`,
          group: "Threats",
          title: event.title,
          subtitle: `${event.mitreTechniqueId} · ${event.description}`,
          severity: event.severity,
          attackId: event.attackId,
        });
    } else if (match(event.title, event.description)) {
      hits.push({
        id: `tl-${event.id}`,
        group: "Timeline",
        title: event.title,
        subtitle: `${new Date(event.timestamp).toLocaleTimeString()} · ${event.description}`,
        severity: event.severity,
        attackId: event.attackId,
      });
    }
  });

  techniques.forEach((t) => {
    if (match(t.id, t.name, t.tactic, t.description))
      hits.push({
        id: `mitre-${t.id}`,
        group: "MITRE",
        title: `${t.id} — ${t.name}`,
        subtitle: `${t.tactic} · ${t.description}`,
      });
  });

  alerts.forEach((a) => {
    if (match(a.title, a.description, a.source, a.state))
      hits.push({
        id: `alert-${a.id}`,
        group: "Alerts",
        title: a.title,
        subtitle: `${a.state.toUpperCase()} · ${a.source}`,
        severity: a.severity,
        attackId: a.attackId,
      });
  });

  return hits.slice(0, 60);
}