import type { AttackCatalogEntry, SimStageDefinition } from "@/types/simulation";

/**
 * Static catalog data for the simulation engine.
 * Mirrors what the FastAPI `/catalog` endpoint will return.
 */

export const ATTACK_CATALOG: AttackCatalogEntry[] = [
  {
    id: "sql-injection",
    name: "SQL Injection",
    mitreTactic: "Initial Access",
    mitreTechniqueId: "T1190",
    severity: "critical",
    description:
      "Injects crafted SQL fragments into request parameters to bypass authentication and read backend tables.",
    estimatedRisk: 92,
    expectedImpact: "Database exfiltration and credential theft",
    defaultPacketRate: 120,
    defaultDurationSec: 45,
    payloadVariants: ["union-select", "boolean-blind", "time-blind", "stacked-queries"],
  },
  {
    id: "xss",
    name: "Cross Site Scripting",
    mitreTactic: "Execution",
    mitreTechniqueId: "T1059",
    severity: "high",
    description:
      "Delivers attacker-controlled script into rendered pages to hijack sessions of authenticated users.",
    estimatedRisk: 74,
    expectedImpact: "Session hijacking and account takeover",
    defaultPacketRate: 80,
    defaultDurationSec: 30,
    payloadVariants: ["reflected", "stored", "dom-based", "polyglot"],
  },
  {
    id: "port-scan",
    name: "Port Scan",
    mitreTactic: "Reconnaissance",
    mitreTechniqueId: "T1595",
    severity: "low",
    description:
      "Sweeps the target range for reachable services to map the externally exposed attack surface.",
    estimatedRisk: 34,
    expectedImpact: "Attack surface disclosure",
    defaultPacketRate: 400,
    defaultDurationSec: 25,
    payloadVariants: ["syn-scan", "fin-scan", "xmas-scan", "udp-sweep"],
  },
  {
    id: "ssh-brute-force",
    name: "SSH Brute Force",
    mitreTactic: "Credential Access",
    mitreTechniqueId: "T1110",
    severity: "high",
    description:
      "Automated credential spraying against SSH endpoints using leaked password dictionaries.",
    estimatedRisk: 78,
    expectedImpact: "Remote shell access with valid credentials",
    defaultPacketRate: 200,
    defaultDurationSec: 60,
    payloadVariants: ["dictionary", "credential-stuffing", "password-spray", "key-fuzzing"],
  },
  {
    id: "ddos",
    name: "DDoS",
    mitreTactic: "Impact",
    mitreTechniqueId: "T1499",
    severity: "critical",
    description:
      "Volumetric flood from a distributed botnet designed to exhaust connection tables and bandwidth.",
    estimatedRisk: 88,
    expectedImpact: "Service outage and degraded availability",
    defaultPacketRate: 2500,
    defaultDurationSec: 40,
    payloadVariants: ["syn-flood", "udp-amplification", "http-flood", "slowloris"],
  },
  {
    id: "malware-download",
    name: "Malware Download",
    mitreTactic: "Command and Control",
    mitreTechniqueId: "T1071",
    severity: "critical",
    description:
      "Second-stage payload retrieval from an attacker-controlled host over an application-layer channel.",
    estimatedRisk: 90,
    expectedImpact: "Persistent implant on internal host",
    defaultPacketRate: 150,
    defaultDurationSec: 35,
    payloadVariants: ["dropper", "packed-loader", "living-off-the-land", "signed-binary-proxy"],
  },
  {
    id: "dns-tunneling",
    name: "DNS Tunneling",
    mitreTactic: "Exfiltration",
    mitreTechniqueId: "T1041",
    severity: "high",
    description:
      "Encodes exfiltrated data in DNS queries to slip past perimeter controls that trust name resolution.",
    estimatedRisk: 81,
    expectedImpact: "Covert data exfiltration channel",
    defaultPacketRate: 90,
    defaultDurationSec: 50,
    payloadVariants: ["base32-txt", "cname-chain", "null-record", "slow-drip"],
  },
  {
    id: "insider-threat",
    name: "Insider Threat",
    mitreTactic: "Lateral Movement",
    mitreTechniqueId: "T1021",
    severity: "medium",
    description:
      "Authenticated internal account performing abnormal bulk access across sensitive file shares.",
    estimatedRisk: 66,
    expectedImpact: "Mass unauthorized access to sensitive data",
    defaultPacketRate: 60,
    defaultDurationSec: 55,
    payloadVariants: ["bulk-read", "off-hours-access", "privilege-abuse", "share-enumeration"],
  },
  {
    id: "zero-day",
    name: "Zero-Day Simulation",
    mitreTactic: "Defense Evasion",
    mitreTechniqueId: "T1027",
    severity: "critical",
    description:
      "Novel obfuscated exploit with no signature coverage — detection depends entirely on anomaly scoring.",
    estimatedRisk: 96,
    expectedImpact: "Undetected compromise of production workloads",
    defaultPacketRate: 110,
    defaultDurationSec: 45,
    payloadVariants: ["polymorphic", "encrypted-stager", "memory-only", "protocol-abuse"],
  },
];

export const PIPELINE_STAGES: SimStageDefinition[] = [
  { id: "attacker", name: "Attacker", subtitle: "Threat origin", short: "ATK" },
  { id: "packetgen", name: "Packet Generation", subtitle: "Traffic synthesis", short: "GEN" },
  { id: "tier0", name: "Tier-0 Firewall", subtitle: "Adaptive rule match", short: "T0" },
  { id: "tier1", name: "Tier-1 Isolation Forest", subtitle: "Anomaly scoring", short: "T1" },
  { id: "tier2", name: "Tier-2 XGBoost", subtitle: "Threat classification", short: "T2" },
  { id: "mitre", name: "MITRE ATT&CK", subtitle: "Technique mapping", short: "TTP" },
  { id: "rl", name: "RL Decision", subtitle: "Policy optimization", short: "RL" },
  { id: "peo", name: "PEO", subtitle: "Policy enforcement", short: "PEO" },
  { id: "server", name: "Production Server", subtitle: "Protected asset", short: "SRV" },
];

export const getAttackCatalog = (): AttackCatalogEntry[] => ATTACK_CATALOG;

export const getAttackDefinition = (id: string): AttackCatalogEntry =>
  ATTACK_CATALOG.find((a) => a.id === id) ?? ATTACK_CATALOG[0]!;

export const INTENSITY_MULTIPLIER: Record<string, number> = {
  low: 0.5,
  medium: 1,
  high: 2,
  extreme: 4,
};
