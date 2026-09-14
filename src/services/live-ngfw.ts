import type { NgfwService } from "./types";
import { apiRequest } from "./api-client";
import { BACKEND_ATTACK_REVERSE } from "./live-simulation";
import type {
  ActiveAttack,
  Alert,
  FederatedClient,
  FederatedRound,
  HoneypotSession,
  MITRETechnique,
  PipelineStage,
  PolicyVersion,
  RLActionShare,
  RLDecision,
  RLRewardPoint,
  SystemMetric,
  ThreatDataPoint,
  ThreatIntelIndicator,
  TimelineEventItem,
  TrafficStat,
  ZeroDayDetection,
} from "@/types";

interface AttackRow {
  id: string;
  attack_type: string;
  status: string;
  verdict: string;
  action: string;
  confidence: number;
  anomaly_score: number;
  xgb_confidence: number;
  attack_class: string;
  severity: string;
  mitre_techniques: string[];
  summary?: string;
  created_at?: string;
  flow?: { src_ip?: string; dst_ip?: string; protocol?: string };
}

interface DashboardResponse {
  total_attacks: number;
  attacks_blocked: number;
  attacks_redirected: number;
  attacks_allowed: number;
  active_rules: number;
  policy_version: number;
  model_status: Record<string, unknown>;
  recent_attacks: AttackRow[];
  recent_events: Array<{ id: number; attack_id: string; stage: string; payload: Record<string, unknown>; created_at: string }>;
}

const severity = (value: string): "low" | "medium" | "high" | "critical" =>
  value === "critical" || value === "high" || value === "low" ? value : "medium";

const dashboard = () => apiRequest<DashboardResponse>("/dashboard");
const history = () => apiRequest<AttackRow[]>("/history?limit=100");

/** Verdicts the backend treats as contained — surfaced as "blocked" on the SOC grid. */
const BLOCKED_VERDICTS = new Set(["blocked", "quarantined", "redirected"]);

const toActive = (row: AttackRow): ActiveAttack => ({
  id: row.id,
  startedAt: row.created_at ?? new Date().toISOString(),
  sourceIp: row.flow?.src_ip ?? "backend",
  targetIp: row.flow?.dst_ip ?? "unknown",
  technique: row.attack_class || row.attack_type,
  techniqueId: row.mitre_techniques?.[0] ?? "",
  severity: severity(row.severity),
  confidence: row.confidence,
  stage: row.status === "completed" ? "peo" : "tier2",
  action: (BLOCKED_VERDICTS.has(row.verdict) ? "block" : (row.action || "allow")) as ActiveAttack["action"],
  origin: "simulated",
  kind:
    BACKEND_ATTACK_REVERSE[String(row.attack_type ?? "")] ??
    BACKEND_ATTACK_REVERSE[String(row.attack_class ?? "")] ??
    row.attack_type.replaceAll("_", "-"),
  state: BLOCKED_VERDICTS.has(row.verdict)
    ? "blocked"
    : row.status === "completed"
      ? "completed"
      : "running",
  verdict: row.verdict,
});

export const liveNgfw: NgfwService = {
  traffic: {
    getStats: async () => {
      const data = await dashboard();
      return [
        { label: "Total attacks", value: data.total_attacks, change: 0, status: "warning", icon: "activity", sparklineData: [] },
        { label: "Blocked", value: data.attacks_blocked, change: 0, status: "success", icon: "shield", sparklineData: [] },
        { label: "Active rules", value: data.active_rules, change: 0, status: "success", icon: "lock", sparklineData: [] },
      ] satisfies TrafficStat[];
    },
    getPipeline: async () => {
      const data = await dashboard();
      return ["tier0", "tier1", "tier2", "rl"].map((id) => ({ id, name: id.toUpperCase(), subtitle: "FastAPI pipeline", throughput: data.total_attacks, latencyMs: 0, escalated: data.attacks_blocked, status: "healthy" })) as PipelineStage[];
    },
  },
  threats: {
    getTimeline: async () => {
      const rows = await history();
      return rows.slice(0, 24).map((row, index) => ({ timestamp: row.created_at ?? new Date().toISOString(), normal: 0, suspicious: row.anomaly_score, malicious: row.xgb_confidence + index * 0 })) satisfies ThreatDataPoint[];
    },
    getActiveAttacks: async () => (await history()).map(toActive),
    getAlerts: async () => (await history()).filter((row) => row.verdict !== "allowed").map((row) => ({ id: row.id, timestamp: row.created_at ?? new Date().toISOString(), rule: row.attack_class || row.attack_type, ruleId: row.id.length, agent: row.action || "pipeline", severity: severity(row.severity), description: row.summary ?? "Backend detection", acknowledged: false })) satisfies Alert[],
    getZeroDay: async () => (await history()).filter((row) => row.attack_type === "zero_day").map((row) => ({ id: row.id, timestamp: row.created_at ?? new Date().toISOString(), sourceIp: row.flow?.src_ip ?? "", destinationIp: row.flow?.dst_ip ?? "", protocol: row.flow?.protocol ?? "TCP", entropyScore: row.anomaly_score, isolationForestScore: row.anomaly_score, xgboostConfidence: row.xgb_confidence, severity: severity(row.severity) })) satisfies ZeroDayDetection[],
    getIntel: async () => (await history()).map((row) => ({ id: row.id, value: row.flow?.src_ip ?? "", type: "ip", source: "FastAPI ML pipeline", confidence: row.confidence, tags: row.mitre_techniques ?? [], firstSeen: row.created_at ?? new Date().toISOString() })) satisfies ThreatIntelIndicator[],
    getTimelineFeed: async () => (await history()).map((row) => ({ id: row.id, timestamp: row.created_at ?? new Date().toISOString(), title: `${row.attack_type} ${row.verdict}`, description: row.summary ?? "Backend persisted attack", kind: "detection", severity: severity(row.severity) })) satisfies TimelineEventItem[],
  },
  mitre: {
    getTechniques: () => apiRequest<MITRETechnique[]>("/mitre/techniques"),
    getSimulationCatalog: async () => (await apiRequest<MITRETechnique[]>("/mitre/techniques")).map((item) => ({ id: item.id, name: item.name, tactic: item.tactic, severity: severity(item.severity >= 0.8 ? "critical" : item.severity >= 0.6 ? "high" : "medium"), description: item.description })),
  },
  rl: {
    getDecisions: async (count = 20) => (await history()).slice(0, count).map((row) => ({ id: row.id, timestamp: row.created_at ?? new Date().toISOString(), sourceIp: row.flow?.src_ip ?? "", destinationIp: row.flow?.dst_ip ?? "", confidence: row.confidence, decision: (row.action || "allow") as RLDecision["decision"], tier1Score: row.anomaly_score, tier2Score: row.xgb_confidence, reason: row.summary ?? "Backend RL decision", protocol: row.flow?.protocol ?? "TCP" })) satisfies RLDecision[],
    getRewardCurve: async (count = 40) => (await history()).slice(0, count).reverse().map((row, index) => ({ episode: index + 1, reward: row.verdict === "allowed" ? 0.9 : 1, cumulative: index + 1 })) satisfies RLRewardPoint[],
    getActionDistribution: async () => {
      const rows = await history();
      const counts = new Map<string, number>();
      rows.forEach((row) => counts.set(row.action || "allow", (counts.get(row.action || "allow") ?? 0) + 1));
      const total = rows.length || 1;
      return [...counts.entries()].map(([action, count]) => ({ action, share: count / total })) as RLActionShare[];
    },
  },
  honeypot: {
    getSessions: async (count = 12) => (await history()).filter((row) => row.verdict === "redirected").slice(0, count).map((row) => ({ id: row.id, attackerIp: row.flow?.src_ip ?? "", service: "backend honeypot", startedAt: row.created_at ?? new Date().toISOString(), durationSec: row.flow ? 1 : 0, commands: [], severity: severity(row.severity), payloadsCaptured: 1 })) satisfies HoneypotSession[],
  },
  federated: {
    getClients: async () => {
      const data = await apiRequest<{ clients: Array<Record<string, unknown>> }>("/federated");
      return data.clients.map((client) => ({ id: String(client["id"] ?? "client"), name: String(client["name"] ?? client["id"] ?? "client"), region: String(client["region"] ?? "global"), status: "idle", samples: Number(client["samples"] ?? 0), lastRound: Number(client["last_round"] ?? 0) })) satisfies FederatedClient[];
    },
    getRounds: async (count = 24) => (await apiRequest<{ history: Array<Record<string, unknown>> }>(`/federated?limit=${count}`)).history.map((row) => ({ round: Number(row["round_no"] ?? 0), accuracy: Number(((row["metrics"] as Record<string, unknown> | undefined)?.["accuracy"]) ?? 0), loss: Number(((row["metrics"] as Record<string, unknown> | undefined)?.["loss"]) ?? 0), participants: Array.isArray(row["clients"]) ? (row["clients"] as unknown[]).length : 0 })) satisfies FederatedRound[],
  },
  policy: {
    getCurrentVersion: async () => {
      const item = await apiRequest<{ version: number; source: string; created_at: string; params: Record<string, unknown> }>("/policy/current");
      return { version: `v${item.version}`, publishedAt: item.created_at, ruleCount: Number(item.params["rule_count"] ?? 0), added: 0, removed: 0, modified: 0, author: item.source, rolloutPercent: 100 } satisfies PolicyVersion;
    },
    getHistory: async () => (await apiRequest<Array<{ version: number; source: string; created_at: string; params: Record<string, unknown> }>>("/policy/history")).map((item) => ({ version: `v${item.version}`, publishedAt: item.created_at, ruleCount: Number(item.params["rule_count"] ?? 0), added: 0, removed: 0, modified: 0, author: item.source, rolloutPercent: 100 })) satisfies PolicyVersion[],
  },
  system: {
    getHealth: async () => {
      const data = await apiRequest<{ models: Record<string, unknown>; models_ready: boolean }>("/health");
      return [{ name: "FastAPI / ML", value: data.models_ready ? 100 : 0, unit: "%", status: data.models_ready ? "normal" : "critical", history: [] }] satisfies SystemMetric[];
    },
  },
  simulation: {
    launch: () => { throw new Error("Use the Red Team attack service to launch a backend simulation"); },
    getQueue: () => [],
    abort: () => {},
  },
};
