import type { JourneyStageDefinition, JourneyStageId } from "@/types/platform";
import type { QueuedAttack, SimStageId, SimulationSnapshot } from "@/types/simulation";

/** Unified attack journey — extends the engine pipeline with honeypot, final decision and blue-team alert. */
export const JOURNEY_STAGES: JourneyStageDefinition[] = [
  {
    id: "attacker",
    name: "Attacker",
    subtitle: "Threat origin identified",
    short: "ATK",
    explanation:
      "The adversary initiates the operation from an external or internal source. Source IP, target asset and attack kind are registered by the perimeter sensor mesh.",
  },
  {
    id: "packetgen",
    name: "Packet Generation",
    subtitle: "Synthetic traffic injected",
    short: "GEN",
    explanation:
      "The simulation engine synthesizes malicious packets at the configured rate and intensity. Each packet carries protocol metadata, payload signatures and timing fingerprints.",
  },
  {
    id: "tier0",
    name: "Tier-0 Firewall",
    subtitle: "Adaptive rule matching",
    short: "T0",
    explanation:
      "The Tier-0 adaptive firewall evaluates signature rules and heuristic patterns. Known exploit signatures may be dropped immediately; novel traffic escalates to ML tiers.",
  },
  {
    id: "tier1",
    name: "Tier-1 Isolation Forest",
    subtitle: "Unsupervised anomaly scoring",
    short: "T1",
    explanation:
      "Isolation Forest computes an anomaly score by measuring how quickly each packet can be isolated from normal traffic clusters. Elevated scores trigger escalation.",
  },
  {
    id: "tier2",
    name: "Tier-2 XGBoost",
    subtitle: "Supervised threat classification",
    short: "T2",
    explanation:
      "The XGBoost ensemble classifies traffic against labelled attack families. Output confidence feeds the reinforcement-learning policy agent for enforcement decisions.",
  },
  {
    id: "mitre",
    name: "MITRE Mapping",
    subtitle: "ATT&CK technique correlation",
    short: "TTP",
    explanation:
      "Detected behaviour is mapped to MITRE ATT&CK tactics and techniques, enriching the incident with standardized threat intelligence for analyst triage.",
  },
  {
    id: "rl",
    name: "RL Decision",
    subtitle: "Policy optimization agent",
    short: "RL",
    explanation:
      "The reinforcement-learning agent selects an enforcement action — allow, redirect, quarantine or block — based on confidence thresholds and expected reward.",
  },
  {
    id: "peo",
    name: "Policy Update",
    subtitle: "Policy enforcement orchestrator",
    short: "PEO",
    explanation:
      "The Policy Enforcement Orchestrator installs drop rules, updates the Tier-0 ruleset and synchronizes the RL-optimized policy bundle across edge nodes.",
  },
  {
    id: "honeypot",
    name: "Honeypot",
    subtitle: "Decoy engagement",
    short: "HP",
    conditional: true,
    explanation:
      "When the RL agent selects redirect, traffic is steered to a high-interaction honeypot. Attacker commands and payloads are captured for threat intelligence.",
  },
  {
    id: "final",
    name: "Final Decision",
    subtitle: "Containment verdict",
    short: "VER",
    explanation:
      "The pipeline renders a final verdict: blocked, quarantined, redirected or allowed. Packet counters and confidence scores are finalized for the incident record.",
  },
  {
    id: "blue-team",
    name: "Blue Team Alert",
    subtitle: "SOC analyst notification",
    short: "SOC",
    explanation:
      "The Security Operations Center receives a prioritized alert with MITRE context, recommended actions and a link to the full incident investigation surface.",
  },
];

const ENGINE_STAGE_MAP: Record<JourneyStageId, SimStageId | null> = {
  attacker: "attacker",
  packetgen: "packetgen",
  tier0: "tier0",
  tier1: "tier1",
  tier2: "tier2",
  mitre: "mitre",
  rl: "rl",
  peo: "peo",
  honeypot: null,
  final: "server",
  "blue-team": null,
};

/** Resolve which journey stages apply to a given attack. */
export function journeyStagesForAttack(attack: QueuedAttack | null): JourneyStageDefinition[] {
  if (!attack) return JOURNEY_STAGES.filter((s) => !s.conditional);
  const showHoneypot = attack.verdict === "redirect";
  return JOURNEY_STAGES.filter((s) => !s.conditional || (s.id === "honeypot" && showHoneypot));
}

/** Infer the furthest journey step reached for an attack from the live snapshot. */
export function inferJourneyStep(
  snapshot: SimulationSnapshot,
  attack: QueuedAttack,
  stages: JourneyStageDefinition[],
): number {
  const packets = snapshot.packets.filter((p) => p.attackId === attack.id);
  if (packets.length) {
    const furthestEngine = packets.reduce<SimStageId>((best, p) => {
      const order = ["attacker", "packetgen", "tier0", "tier1", "tier2", "mitre", "rl", "peo", "server"];
      return order.indexOf(p.stage) > order.indexOf(best) ? p.stage : best;
    }, packets[0]!.stage);

    const idx = stages.findIndex((s) => ENGINE_STAGE_MAP[s.id] === furthestEngine);
    if (idx >= 0) return idx;
  }

  // PREVIOUS IMPLEMENTATION — only fell through to the static state checks.
  // Added: infer from "Backend pipeline:" events so live attacks advance the
  // journey without needing in-browser packets (the WS stream is owner-only).
  const BACKEND_STAGE_POSITION: Record<string, JourneyStageDefinition["id"]> = {
    start: "attacker",
    flow_scan: "packetgen",
    tier0: "tier0",
    tier1: "tier1",
    tier2: "tier2",
    classify: "mitre",
    avoid: "mitre",
    rl_decision: "rl",
    honeypot: "honeypot",
    behaviour: "peo",
    contain: "peo",
    policy_update: "peo",
    end: "final",
  };
  const reachedBackend = snapshot.events
    .filter((e) => e.attackId === attack.id)
    .map((e) => e.title.match(/^Backend pipeline: (\w+)/)?.[1] ?? "")
    .map((stage) => BACKEND_STAGE_POSITION[stage])
    .filter((s): s is JourneyStageDefinition["id"] => Boolean(s));
  if (reachedBackend.length) {
    const positions = reachedBackend.map((s) =>
      stages.findIndex((step) => step.id === s),
    );
    const furthest = Math.max(...positions, 0);
    if (furthest > 0) return furthest;
  }

  if (attack.state === "queued") return 0;
  if (attack.state === "running") return Math.min(1, stages.length - 1);
  if (attack.verdict === "redirect") {
    const hpIdx = stages.findIndex((s) => s.id === "honeypot");
    if (hpIdx >= 0) return hpIdx;
  }
  if (attack.state === "blocked") {
    const finalIdx = stages.findIndex((s) => s.id === "final");
    return finalIdx >= 0 ? finalIdx : stages.length - 2;
  }
  if (attack.state === "completed" || attack.state === "unknown") {
    return stages.length - 1;
  }
  return 0;
}

/** Build a contextual description for the current journey step. */
export function describeJourneyStep(
  stage: JourneyStageDefinition,
  attack: QueuedAttack,
  snapshot: SimulationSnapshot,
): string {
  const engineId = ENGINE_STAGE_MAP[stage.id];
  const stageState = engineId ? snapshot.stages.find((s) => s.id === engineId) : null;
  const events = snapshot.events.filter((e) => e.attackId === attack.id);

  switch (stage.id) {
    case "attacker":
      return `${attack.sourceIp} targeting ${attack.config.target} · ${attack.name} (${attack.mitreTechniqueId})`;
    case "packetgen":
      return `${attack.packetsSent.toLocaleString()} packets generated at ${attack.config.packetRate} pkt/s · ${attack.config.intensity} intensity`;
    case "tier0":
      return stageState
        ? `Inspected ${stageState.packetCount} packets · ${stageState.blockedCount} signature drops · ${(stageState.confidence * 100).toFixed(0)}% match confidence`
        : stage.explanation;
    case "tier1":
      return stageState
        ? `Anomaly score ${(stageState.confidence * 100).toFixed(0)}% · latency ${stageState.latencyMs.toFixed(1)}ms`
        : stage.explanation;
    case "tier2":
      return `XGBoost classified as ${attack.name} with ${(attack.confidence * 100).toFixed(0)}% confidence`;
    case "mitre":
      return `${attack.mitreTechniqueId} · ${attack.mitreTactic} — ${events.filter((e) => e.type === "threat").length} threat event(s) mapped`;
    case "rl":
      return attack.verdict
        ? `RL agent selected "${attack.verdict}" based on ${(attack.confidence * 100).toFixed(0)}% classification confidence`
        : "Policy agent evaluating expected reward for each enforcement action…";
    case "peo":
      return `${snapshot.metrics.policyUpdates} policy update(s) this run · ${events.filter((e) => e.type === "policy").length} rule(s) for this attack`;
    case "honeypot":
      return "Traffic redirected to ssh-decoy honeypot · attacker commands and payloads captured for intelligence";
    case "final":
      return `${attack.packetsBlocked.toLocaleString()} of ${attack.packetsSent.toLocaleString()} packets contained · verdict: ${attack.verdict ?? attack.state}`;
    case "blue-team":
      return `SOC alert raised · severity ${attack.severity} · recommended: isolate source ${attack.sourceIp}, review MITRE ${attack.mitreTechniqueId}`;
    default:
      return stage.explanation;
  }
}
