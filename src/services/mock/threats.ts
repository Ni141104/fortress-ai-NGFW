import type {
  ActiveAttack,
  Alert,
  Role,
  Severity,
  ThreatDataPoint,
  ThreatIntelIndicator,
  TimelineEventItem,
  ZeroDayDetection,
} from "@/types";
import {
  PROTOCOLS,
  generateIP,
  id,
  internalIP,
  minutesAgo,
  pick,
  randomBetween,
  randomFloat,
} from "./utils";

const SEVERITIES: Severity[] = ["low", "medium", "high", "critical"];

export const getTimeline = (rangeHours: number): ThreatDataPoint[] => {
  const points: ThreatDataPoint[] = [];
  const steps = 32;
  const stepMs = (rangeHours * 3_600_000) / steps;
  const now = Date.now();

  for (let i = steps; i >= 0; i--) {
    const t = new Date(now - i * stepMs);
    points.push({
      timestamp: t.toISOString(),
      normal: randomBetween(4000, 9000),
      suspicious: randomBetween(200, 1400),
      malicious: randomBetween(20, 420),
    });
  }
  return points;
};

const TECHNIQUES: Array<[string, string]> = [
  ["T1071", "Application Layer Protocol"],
  ["T1046", "Network Service Discovery"],
  ["T1110", "Brute Force"],
  ["T1190", "Exploit Public-Facing Application"],
  ["T1059", "Command and Scripting Interpreter"],
  ["T1499", "Endpoint Denial of Service"],
  ["T1041", "Exfiltration Over C2 Channel"],
  ["T1021", "Remote Services"],
];

const CAMPAIGNS = ["OPERATION HYDRA", "NIGHTFALL", "CRIMSON TIDE", "BLACKOUT"];

export const getActiveAttacks = (role: Role): ActiveAttack[] => {
  const count = randomBetween(6, 12);
  return Array.from({ length: count }, () => {
    const [tid, tname] = pick(TECHNIQUES);
    const simulated = role === "red" ? Math.random() < 0.75 : Math.random() < 0.3;
    return {
      id: id("ATK"),
      startedAt: minutesAgo(randomBetween(0, 180)),
      sourceIp: simulated ? internalIP() : generateIP(),
      targetIp: internalIP(),
      technique: tname,
      techniqueId: tid,
      severity: pick(SEVERITIES),
      confidence: randomFloat(0.55, 0.99),
      stage: pick(["tier1", "tier2", "rl", "peo"] as const),
      action: pick(["allow", "block", "quarantine", "redirect"] as const),
      campaign: simulated ? pick(CAMPAIGNS) : undefined,
      origin: simulated ? "simulated" : "external",
    } satisfies ActiveAttack;
  }).sort((a, b) => b.startedAt.localeCompare(a.startedAt));
};

const RULES: Array<[number, string, Severity]> = [
  [5710, "Attempt to login using a non-existent user", "medium"],
  [31151, "Multiple web server 400 error codes from same source", "high"],
  [87102, "Suricata: potential C2 beacon detected", "critical"],
  [5503, "PAM: user login failed", "low"],
  [40111, "Multiple authentication failures followed by success", "critical"],
  [92011, "Isolation Forest: entropy spike on egress flow", "high"],
  [18107, "Windows logon failure: unknown username", "medium"],
];

export const getAlerts = (): Alert[] =>
  Array.from({ length: randomBetween(10, 18) }, () => {
    const [ruleId, rule, severity] = pick(RULES);
    return {
      id: id("ALR"),
      timestamp: minutesAgo(randomBetween(0, 240)),
      rule,
      ruleId,
      agent: `edge-node-${randomBetween(1, 24).toString().padStart(2, "0")}`,
      severity,
      description: `${rule} — source ${generateIP()}`,
      acknowledged: Math.random() < 0.25,
    } satisfies Alert;
  }).sort((a, b) => b.timestamp.localeCompare(a.timestamp));

export const getZeroDay = (): ZeroDayDetection[] =>
  Array.from({ length: randomBetween(6, 12) }, () => ({
    id: id("ZD"),
    timestamp: minutesAgo(randomBetween(0, 300)),
    sourceIp: generateIP(),
    destinationIp: internalIP(),
    protocol: pick(PROTOCOLS),
    entropyScore: randomFloat(6.2, 7.99),
    isolationForestScore: randomFloat(0.62, 0.99),
    xgboostConfidence: randomFloat(0.4, 0.98),
    severity: pick(SEVERITIES),
  })).sort((a, b) => b.isolationForestScore - a.isolationForestScore);

const INTEL_TAGS = [
  "c2",
  "ransomware",
  "phishing",
  "botnet",
  "apt29",
  "cobalt-strike",
  "tor-exit",
  "scanner",
];

export const getIntel = (): ThreatIntelIndicator[] =>
  Array.from({ length: randomBetween(8, 14) }, () => {
    const type = pick(["ip", "domain", "hash", "url"] as const);
    const value =
      type === "ip"
        ? generateIP()
        : type === "domain"
          ? `${Math.random().toString(36).slice(2, 10)}.badhost.net`
          : type === "hash"
            ? Math.random().toString(16).slice(2).padEnd(40, "a").slice(0, 40)
            : `http://${Math.random().toString(36).slice(2, 8)}.cdn-delivery.io/p`;

    return {
      id: id("IOC"),
      value,
      type,
      source: pick(["MISP", "AlienVault OTX", "Internal Honeynet", "CIRCL", "Abuse.ch"]),
      confidence: randomFloat(0.45, 0.99),
      tags: Array.from(
        new Set(Array.from({ length: randomBetween(1, 3) }, () => pick(INTEL_TAGS))),
      ),
      firstSeen: minutesAgo(randomBetween(30, 20_000)),
    } satisfies ThreatIntelIndicator;
  });

export const getTimelineFeed = (role: Role): TimelineEventItem[] => {
  const blue: Array<[TimelineEventItem["kind"], string, string]> = [
    ["detection", "Tier-1 anomaly escalated", "Isolation Forest score 0.94 on egress flow"],
    ["rl", "RL policy selected QUARANTINE", "Expected reward +0.42 over BLOCK"],
    ["policy", "Tier-0 policy v migrated", "12 rules added, 3 retired"],
    ["honeypot", "Honeypot session captured", "Attacker executed 14 shell commands"],
    ["federated", "Federated round completed", "9 clients aggregated, accuracy +0.6%"],
    ["analyst", "Analyst acknowledged alert", "Case escalated to Tier-2 review"],
  ];
  const red: Array<[TimelineEventItem["kind"], string, string]> = [
    ["detection", "Payload flagged at Tier-2", "XGBoost matched T1059 with 0.91 confidence"],
    ["honeypot", "Redirected into honeynet", "Session mirrored to decoy SSH service"],
    ["rl", "Defense adapted mid-campaign", "RL agent switched from ALLOW to REDIRECT"],
    ["policy", "New blocking rule deployed", "Source subnet added to Tier-0 denylist"],
    ["analyst", "Campaign step queued", "Lateral movement scheduled in 90s"],
    ["federated", "Signature shared globally", "Technique fingerprint pushed to 9 nodes"],
  ];

  const source = role === "red" ? red : blue;

  return Array.from({ length: randomBetween(8, 14) }, () => {
    const [kind, title, description] = pick(source);
    return {
      id: id("EVT"),
      timestamp: minutesAgo(randomBetween(0, 200)),
      title,
      description,
      kind,
      severity: pick(SEVERITIES),
    } satisfies TimelineEventItem;
  }).sort((a, b) => b.timestamp.localeCompare(a.timestamp));
};
