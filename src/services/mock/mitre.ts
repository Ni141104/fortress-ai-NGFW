import type { AttackTechniqueOption, MITRETechnique } from "@/types";
import { randomBetween, randomFloat } from "./utils";

const CATALOG: Array<{
  id: string;
  name: string;
  tactic: string;
  description: string;
}> = [
  { id: "T1595", name: "Active Scanning", tactic: "Reconnaissance", description: "Probe target infrastructure for exposed services." },
  { id: "T1190", name: "Exploit Public-Facing Application", tactic: "Initial Access", description: "Weaponize a known CVE against an edge service." },
  { id: "T1110", name: "Brute Force", tactic: "Credential Access", description: "Password spraying against authentication endpoints." },
  { id: "T1059", name: "Command and Scripting Interpreter", tactic: "Execution", description: "Execute attacker-controlled shell payloads." },
  { id: "T1021", name: "Remote Services", tactic: "Lateral Movement", description: "Pivot across hosts using valid remote sessions." },
  { id: "T1071", name: "Application Layer Protocol", tactic: "Command and Control", description: "Beacon over HTTPS to blend with normal traffic." },
  { id: "T1041", name: "Exfiltration Over C2 Channel", tactic: "Exfiltration", description: "Stage and extract data through the C2 channel." },
  { id: "T1499", name: "Endpoint Denial of Service", tactic: "Impact", description: "Exhaust target resources to degrade availability." },
  { id: "T1046", name: "Network Service Discovery", tactic: "Discovery", description: "Enumerate reachable internal services." },
  { id: "T1027", name: "Obfuscated Files or Information", tactic: "Defense Evasion", description: "Pack payloads to evade static signatures." },
];

export const getTechniques = (): MITRETechnique[] =>
  CATALOG.map((t) => ({
    id: t.id,
    name: t.name,
    description: t.description,
    tactic: t.tactic,
    count: randomBetween(3, 180),
    severity: Number(randomFloat(0.3, 1).toFixed(2)),
  })).sort((a, b) => b.count - a.count);

export const getSimulationCatalog = (): AttackTechniqueOption[] =>
  CATALOG.map((t, i) => ({
    id: t.id,
    name: t.name,
    tactic: t.tactic,
    description: t.description,
    severity: i % 4 === 0 ? "critical" : i % 3 === 0 ? "high" : i % 2 === 0 ? "medium" : "low",
  }));
