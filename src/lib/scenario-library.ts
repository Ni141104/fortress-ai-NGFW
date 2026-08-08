import { attackService, simulationService } from "@/services";
import type { ScenarioDefinition } from "@/types/platform";
import type { AttackKind } from "@/types/simulation";

/**
 * Predefined scenarios for the Scenario Library and Demo Mode.
 * Each scenario enqueues through attackService — never bypasses the engine.
 */
export const SCENARIO_LIBRARY: ScenarioDefinition[] = [
  {
    id: "scenario-sql-injection",
    kind: "sql-injection",
    name: "SQL Injection",
    description: "Crafted SQL fragments bypass authentication and probe backend tables.",
    mitreTechniqueId: "T1190",
    severity: "critical",
    tagline: "Initial Access · Database exfiltration",
  },
  {
    id: "scenario-xss",
    kind: "xss",
    name: "Cross Site Scripting",
    description: "Attacker-controlled script injected into rendered pages for session hijacking.",
    mitreTechniqueId: "T1059",
    severity: "high",
    tagline: "Execution · Session takeover",
  },
  {
    id: "scenario-port-scan",
    kind: "port-scan",
    name: "Port Scan",
    description: "Reconnaissance sweep mapping externally exposed services.",
    mitreTechniqueId: "T1595",
    severity: "low",
    tagline: "Reconnaissance · Surface mapping",
  },
  {
    id: "scenario-ssh-brute",
    kind: "ssh-brute-force",
    name: "SSH Brute Force",
    description: "Automated credential spraying against SSH endpoints.",
    mitreTechniqueId: "T1110",
    severity: "high",
    tagline: "Credential Access · Remote shell",
  },
  {
    id: "scenario-malware",
    kind: "malware-download",
    name: "Malware",
    description: "Second-stage payload retrieval over an application-layer channel.",
    mitreTechniqueId: "T1071",
    severity: "critical",
    tagline: "Command and Control · Implant delivery",
  },
  {
    id: "scenario-dns-tunnel",
    kind: "dns-tunneling",
    name: "DNS Tunneling",
    description: "Covert data exfiltration encoded in DNS queries.",
    mitreTechniqueId: "T1041",
    severity: "high",
    tagline: "Exfiltration · Covert channel",
  },
  {
    id: "scenario-insider",
    kind: "insider-threat",
    name: "Insider Threat",
    description: "Authenticated internal account performing abnormal bulk access.",
    mitreTechniqueId: "T1021",
    severity: "medium",
    tagline: "Lateral Movement · Data abuse",
  },
  {
    id: "scenario-zero-day",
    kind: "zero-day",
    name: "Zero-Day",
    description: "Novel obfuscated exploit with no signature coverage.",
    mitreTechniqueId: "T1027",
    severity: "critical",
    tagline: "Defense Evasion · Undetected compromise",
  },
];

/** Launch a single scenario through the simulation engine. */
export function launchScenario(kind: AttackKind, overrides?: { stealthMode?: boolean; intensity?: "low" | "medium" | "high" | "extreme" }) {
  const config = attackService.defaultConfig(kind);
  if (overrides?.stealthMode !== undefined) config.stealthMode = overrides.stealthMode;
  if (overrides?.intensity) config.intensity = overrides.intensity;
  return attackService.enqueue(kind, config);
}

/** Demo Mode — queues a representative attack sequence and starts the engine. */
export function startDemoSimulation(speed: 1 | 2 | 5 = 2) {
  simulationService.reset();
  simulationService.setSpeed(speed);

  const demoKinds: AttackKind[] = [
    "port-scan",
    "sql-injection",
    "dns-tunneling",
    "zero-day",
  ];

  demoKinds.forEach((kind) => launchScenario(kind));
  simulationService.start();
}

/** Find a scenario definition by attack kind. */
export function getScenarioByKind(kind: AttackKind): ScenarioDefinition | undefined {
  return SCENARIO_LIBRARY.find((s) => s.kind === kind);
}
