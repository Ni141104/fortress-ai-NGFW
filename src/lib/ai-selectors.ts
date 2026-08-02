import type {
  FederatedClient,
  FederatedRound,
  HoneypotSession,
  MITRETechnique,
  PolicyVersion,
  RLAction,
  RLDecision,
  Severity,
} from "@/types";
import type {
  AttackKind,
  PolicyEvent,
  QueuedAttack,
  SimStageId,
  SimulationEvent,
  SimulationPacket,
  SimulationSnapshot,
  ThreatEvent,
} from "@/types/simulation";
import type {
  FlNode,
  FlPipelineStep,
  FlSummary,
  FlSyncStatus,
  HoneypotSummary,
  MitreKillChainStep,
  MitreSummary,
  MitreTacticSummary,
  PolicyDiffEntry,
  PolicyRule,
  PolicySummary,
  RLAgentSummary,
  RLStageStat,
  XaiExplanation,
  ZeroDayCandidate,
  ZeroDaySummary,
} from "@/types/ai";
import { environmentFor, stageLabel } from "./soc-selectors";
import { attackService, pipelineService } from "@/services";
import { ATTACK_CATALOG } from "@/services/mock/attack-catalog";

/**
 * Phase 4 selectors — the ONLY place AI Intelligence view models are produced.
 *
 * Everything is a pure function of the centralized simulation snapshot, so
 * every AI widget renders the same event stream with zero local mocks.
 * The FastAPI backend will emit exactly these shapes, so swapping in a live
 * implementation requires no UI changes.
 */

const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));
const osc = (tick: number, seed: number, amplitude: number) =>
  Math.sin((tick + seed * 13) * 0.21 + seed) * amplitude;

const RL_ACTIONS: RLAction[] = ["allow", "block", "quarantine", "redirect"];

const KILL_CHAIN_PHASES = [
  "Reconnaissance",
  "Initial Access",
  "Execution",
  "Credential Access",
  "Lateral Movement",
  "Command and Control",
  "Exfiltration",
  "Impact",
];

/* ================================================================== */
/* Reinforcement Learning                                              */
/* ================================================================== */

function deriveRLDecisions(snapshot: SimulationSnapshot): RLDecision[] {
  return snapshot.events
    .filter((e) => e.type === "timeline" && e.title.toLowerCase().includes("rl decision"))
    .slice(0, 12)
    .map((event) => {
      const attack = event.attackId
        ? snapshot.queue.find((a) => a.id === event.attackId)
        : undefined;
      const verdict = attack?.verdict ?? "block";
      return {
        id: event.id,
        timestamp: event.timestamp,
        sourceIp: attack?.sourceIp ?? "unknown",
        destinationIp: attack?.config.target ?? "unknown",
        confidence: attack?.confidence ?? snapshot.metrics.avgConfidence,
        decision: verdict,
        tier1Score: clamp(0.4 + osc(event.tick, 2, 0.3), 0, 1),
        tier2Score: clamp(0.5 + osc(event.tick, 3, 0.35), 0, 1),
        reason: event.description,
        protocol: "TCP",
      } satisfies RLDecision;
    });
}

function deriveActionDistribution(
  snapshot: SimulationSnapshot,
): Array<{ action: RLAction; count: number; share: number }> {
  const counts: Record<RLAction, number> = { allow: 0, block: 0, quarantine: 0, redirect: 0 };
  snapshot.queue.forEach((a) => {
    if (a.verdict) counts[a.verdict] += 1;
  });
  // seed with policy events so the chart is never empty
  snapshot.events
    .filter((e): e is PolicyEvent => e.type === "policy")
    .forEach((e) => {
      counts[e.action] += 1;
    });

  const total = Object.values(counts).reduce((s, c) => s + c, 0) || 1;
  return RL_ACTIONS.map((action) => ({
    action,
    count: counts[action],
    share: counts[action] / total,
  }));
}

function deriveRewardCurve(
  snapshot: SimulationSnapshot,
): Array<{ episode: number; reward: number; cumulative: number }> {
  const episodes = Math.min(30, Math.max(8, snapshot.tick));
  let cumulative = 0;
  return Array.from({ length: episodes }, (_, i) => {
    const base = snapshot.metrics.avgConfidence * 0.6 - 0.1;
    const reward = clamp(base + osc(snapshot.tick + i, i + 1, 0.35) + i * 0.012, -0.5, 1.1);
    cumulative += reward;
    return {
      episode: i + 1,
      reward: Number(reward.toFixed(3)),
      cumulative: Number(cumulative.toFixed(2)),
    };
  });
}

function deriveLearningTimeline(
  snapshot: SimulationSnapshot,
): Array<{ tick: number; reward: number; label: string }> {
  const policyEvents = snapshot.events
    .filter((e) => e.type === "policy" || e.title.toLowerCase().includes("rl decision"))
    .slice(0, 20)
    .reverse();
  return policyEvents.map((e, i) => ({
    tick: e.tick,
    reward: Number(clamp(0.4 + osc(e.tick, i + 1, 0.3), 0, 1).toFixed(3)),
    label: e.title,
  }));
}

function deriveRLStageStats(snapshot: SimulationSnapshot): RLStageStat[] {
  return snapshot.stages
    .filter(
      (s) =>
        s.id === "rl" || s.id === "tier0" || s.id === "tier1" || s.id === "tier2" || s.id === "peo",
    )
    .map((s) => ({
      id: s.id,
      name: stageLabel(s.id),
      packets: s.packetCount,
      blocked: s.blockedCount,
      latencyMs: s.latencyMs,
      confidence: s.confidence,
    }));
}

function deriveVersionHistory(
  snapshot: SimulationSnapshot,
): Array<{ version: string; reward: number; accuracy: number; tick: number }> {
  const patches = snapshot.metrics.policyUpdates;
  const base = Math.max(0, patches);
  return Array.from({ length: Math.min(6, base + 1) }, (_, i) => {
    const v = base - i;
    return {
      version: `v4.12.${Math.max(0, v)}`,
      reward: Number(clamp(0.45 + v * 0.04 + osc(v, i + 1, 0.12), 0, 1).toFixed(3)),
      accuracy: Number(clamp(0.78 + v * 0.018 + osc(v, i + 2, 0.08), 0, 0.999).toFixed(3)),
      tick: snapshot.tick - v * 4,
    };
  }).sort((a, b) => b.version.localeCompare(a.version));
}

export function deriveRLAgent(snapshot: SimulationSnapshot): RLAgentSummary {
  const decisions = deriveRLDecisions(snapshot);
  const actionDistribution = deriveActionDistribution(snapshot);
  const rewardCurve = deriveRewardCurve(snapshot);
  const learningTimeline = deriveLearningTimeline(snapshot);
  const stageStats = deriveRLStageStats(snapshot);
  const versionHistory = deriveVersionHistory(snapshot);

  const rewardCurveLast = rewardCurve[rewardCurve.length - 1];
  const cumulativeReward = rewardCurveLast?.cumulative ?? 0;
  const currentReward = rewardCurveLast?.reward ?? 0;
  const episodes = rewardCurve.length;

  const blocked = actionDistribution.find((a) => a.action === "block")?.count ?? 0;
  const total = actionDistribution.reduce((s, a) => s + a.count, 0) || 1;
  const policyAccuracy = clamp(
    0.86 + snapshot.metrics.avgConfidence * 0.1 + (blocked / total) * 0.04,
    0,
    0.999,
  );

  const learningProgress = clamp(
    (snapshot.metrics.policyUpdates / Math.max(1, snapshot.queue.length + 4)) * 100 +
      snapshot.metrics.avgConfidence * 30,
    0,
    100,
  );

  return {
    policyVersion: `v4.12.${snapshot.metrics.policyUpdates}`,
    learningProgress: Number(learningProgress.toFixed(1)),
    reward: Number(currentReward.toFixed(3)),
    confidence: Number(snapshot.metrics.avgConfidence.toFixed(3)),
    policyAccuracy: Number((policyAccuracy * 100).toFixed(1)),
    cumulativeReward: Number(cumulativeReward.toFixed(2)),
    episodes,
    decisions,
    actionDistribution,
    rewardCurve,
    learningTimeline,
    stageStats,
    versionHistory,
  };
}

/* ================================================================== */
/* Federated Learning                                                  */
/* ================================================================== */

// Stable edge-node roster — the FastAPI backend will replace this with live nodes.
const FL_NODE_ROSTER: Array<{ id: string; name: string; region: string }> = [
  { id: "FL-01", name: "Mumbai Edge", region: "ap-south" },
  { id: "FL-02", name: "Frankfurt Core", region: "eu-central" },
  { id: "FL-03", name: "Virginia DC", region: "us-east" },
  { id: "FL-04", name: "Singapore POP", region: "ap-southeast" },
  { id: "FL-05", name: "Sao Paulo Edge", region: "sa-east" },
  { id: "FL-06", name: "London Core", region: "eu-west" },
  { id: "FL-07", name: "Tokyo POP", region: "ap-northeast" },
  { id: "FL-08", name: "Sydney Edge", region: "ap-southeast-2" },
];

function flSyncForSnapshot(snapshot: SimulationSnapshot): FlSyncStatus {
  if (snapshot.status !== "running") return "idle";
  const phase = snapshot.tick % 20;
  if (phase < 5) return "collecting";
  if (phase < 10) return "aggregating";
  if (phase < 15) return "distributing";
  return "complete";
}

export function deriveFlSummary(
  snapshot: SimulationSnapshot,
  clients: FederatedClient[],
  rounds: FederatedRound[],
): FlSummary {
  const nodes: FlNode[] = FL_NODE_ROSTER.map((roster, i) => {
    const live = clients[i];
    const status = live?.status ?? "idle";
    const syncBase = clamp(snapshot.tick * 4 + i * 11, 0, 100);
    return {
      id: roster.id,
      name: roster.name,
      region: roster.region,
      status,
      samples: live?.samples ?? 0,
      lastRound: live?.lastRound ?? 0,
      accuracy: Number(
        clamp(0.72 + osc(snapshot.tick, i + 1, 0.08) + i * 0.004, 0, 0.999).toFixed(3),
      ),
      syncProgress: syncBase % 100,
    };
  });

  const syncStatus = flSyncForSnapshot(snapshot);
  const currentRound = (rounds[0]?.round ?? 0) + Math.floor(snapshot.tick / 20);
  const participatingNodes = nodes.filter((n) => n.status !== "offline").length;
  const globalAccuracy = Number(
    clamp(
      0.82 + snapshot.metrics.avgConfidence * 0.12 + osc(snapshot.tick, 5, 0.05),
      0,
      0.999,
    ).toFixed(3),
  );

  const pipeline: FlPipelineStep[] = [
    {
      id: "node-a",
      label: "Node A · Local Training",
      status: syncStatus === "idle" ? "idle" : "complete",
    },
    {
      id: "node-b",
      label: "Node B · Gradient Upload",
      status: ["collecting", "aggregating", "distributing", "complete"].includes(syncStatus)
        ? "complete"
        : syncStatus === "idle"
          ? "idle"
          : "collecting",
    },
    {
      id: "node-c",
      label: "Node C · Gradient Upload",
      status: ["aggregating", "distributing", "complete"].includes(syncStatus)
        ? "complete"
        : syncStatus === "idle"
          ? "idle"
          : "collecting",
    },
    {
      id: "aggregator",
      label: "Aggregator · Secure Aggregation",
      status: ["aggregating", "distributing", "complete"].includes(syncStatus)
        ? "complete"
        : syncStatus === "idle"
          ? "idle"
          : "aggregating",
    },
    {
      id: "global-policy",
      label: "Global Policy · Merge",
      status: ["distributing", "complete"].includes(syncStatus)
        ? "complete"
        : syncStatus === "idle"
          ? "idle"
          : "distributing",
    },
    {
      id: "redistribution",
      label: "Redistribution · Push to Nodes",
      status:
        syncStatus === "complete" ? "complete" : syncStatus === "idle" ? "idle" : "distributing",
    },
  ];

  const syncProgress =
    (pipeline.filter((p) => p.status === "complete").length / pipeline.length) * 100;

  const accuracyTrend = rounds
    .slice(0, 24)
    .reverse()
    .map((r) => ({
      round: r.round,
      accuracy: r.accuracy,
      loss: r.loss,
    }));

  return {
    currentRound,
    participatingNodes,
    syncStatus,
    globalAccuracy,
    globalModelVersion: `global-v${currentRound}`,
    syncProgress: Number(syncProgress.toFixed(0)),
    nodes,
    pipeline,
    accuracyTrend,
    roundHistory: rounds,
  };
}

/* ================================================================== */
/* Honeypot Intelligence                                               */
/* ================================================================== */

export function deriveHoneypotSummary(
  snapshot: SimulationSnapshot,
  sessions: HoneypotSession[],
): HoneypotSummary {
  const activeSessions = sessions.length;
  const commandsExecuted = sessions.reduce((s, sess) => s + sess.commands.length, 0);
  const capturedPayloads = sessions.reduce((s, sess) => s + sess.payloadsCaptured, 0);

  // Threat score is a deterministic function of captures + engine load.
  const load = snapshot.packets.length;
  const threatScore = clamp(
    40 + capturedPayloads * 1.2 + commandsExecuted * 0.4 + load * 0.3,
    0,
    99,
  );

  const behaviourTimeline = sessions.slice(0, 8).map((sess) => ({
    id: sess.id,
    timestamp: sess.startedAt,
    title: `${sess.service} session captured`,
    description: `${sess.attackerIp} executed ${sess.commands.length} command(s)`,
    severity: sess.severity,
  }));

  return {
    activeSessions,
    commandsExecuted,
    capturedPayloads,
    threatScore: Number(threatScore.toFixed(1)),
    sessions,
    behaviourTimeline,
  };
}

/* ================================================================== */
/* MITRE Intelligence                                                  */
/* ================================================================== */

function techniqueForKind(kind: AttackKind): { id: string; tactic: string } {
  const def = ATTACK_CATALOG.find((a) => a.id === kind);
  return def
    ? { id: def.mitreTechniqueId, tactic: def.mitreTactic }
    : { id: "T0000", tactic: "Unknown" };
}

export function deriveMitreSummary(
  snapshot: SimulationSnapshot,
  techniques: MITRETechnique[],
): MitreSummary {
  const tacticCounts = new Map<
    string,
    { count: number; techniques: Set<string>; severity: number }
  >();

  // Count from threat events + queue attacks.
  const threatEvents = snapshot.events.filter((e): e is ThreatEvent => e.type === "threat");
  threatEvents.forEach((e) => {
    const entry = tacticCounts.get(e.kind) ?? {
      count: 0,
      techniques: new Set<string>(),
      severity: 0,
    };
    const tech = techniqueForKind(e.kind);
    entry.count += 1;
    entry.techniques.add(tech.id);
    entry.severity = Math.max(entry.severity, SEVERITY_RANK_VALUE[e.severity]);
    tacticCounts.set(e.kind, entry);
  });
  snapshot.queue.forEach((a) => {
    const entry = tacticCounts.get(a.kind) ?? {
      count: 0,
      techniques: new Set<string>(),
      severity: 0,
    };
    const tech = techniqueForKind(a.kind);
    entry.count += 1;
    entry.techniques.add(tech.id);
    entry.severity = Math.max(entry.severity, SEVERITY_RANK_VALUE[a.severity]);
    tacticCounts.set(a.kind, entry);
  });

  const tacticDistribution: MitreTacticSummary[] = Array.from(tacticCounts.entries())
    .map(([kind, entry]) => {
      const tech = techniqueForKind(kind as AttackKind);
      return {
        tactic: tech.tactic,
        count: entry.count,
        techniques: entry.techniques.size,
        severity: entry.severity,
      };
    })
    .sort((a, b) => b.count - a.count);

  // Enrich static technique catalog with live detection counts.
  const liveCounts = new Map<string, number>();
  threatEvents.forEach((e) => {
    const tech = techniqueForKind(e.kind);
    liveCounts.set(tech.id, (liveCounts.get(tech.id) ?? 0) + 1);
  });

  const enrichedTechniques: MITRETechnique[] = techniques.map((t) => ({
    ...t,
    count: liveCounts.get(t.id) ?? t.count,
  }));

  const topTechniques = [...enrichedTechniques].sort((a, b) => b.count - a.count).slice(0, 8);

  // Kill chain progress from tactic distribution.
  const reachedTactics = new Set(tacticDistribution.map((t) => t.tactic));
  const killChain: MitreKillChainStep[] = KILL_CHAIN_PHASES.map((phase) => ({
    phase,
    reached: reachedTactics.has(phase),
    techniqueCount: tacticDistribution
      .filter((t) => t.tactic === phase)
      .reduce((s, t) => s + t.techniques, 0),
  }));

  const totalDetections = threatEvents.length + snapshot.queue.length;

  return {
    techniques: enrichedTechniques,
    topTechniques,
    tacticDistribution,
    killChain,
    totalDetections,
  };
}

const SEVERITY_RANK_VALUE: Record<Severity, number> = {
  low: 1,
  medium: 2,
  high: 3,
  critical: 4,
};

/* ================================================================== */
/* Zero-Day Intelligence                                               */
/* ================================================================== */

const SUSPICIOUS_BEHAVIOURS: Record<AttackKind, string> = {
  "sql-injection": "Anomalous SQL token entropy in HTTP parameters",
  xss: "Out-of-distribution script payload in request body",
  "port-scan": "High-rate sequential port probing pattern",
  "ssh-brute-force": "Credential spray velocity exceeds baseline",
  ddos: "Volumetric flow spike with no legitimate session fingerprint",
  "malware-download": "Second-stage retrieval from uncategorised host",
  "dns-tunneling": "DNS query entropy exceeds covert-channel threshold",
  "insider-threat": "Authenticated bulk access outside behavioural baseline",
  "zero-day": "No signature match — novel obfuscated exploit payload",
};

export function deriveZeroDaySummary(snapshot: SimulationSnapshot): ZeroDaySummary {
  // Candidates are attacks that reached Tier-1+ without a Tier-0 signature hit,
  // i.e. zero-day-style detections driven by anomaly scoring.
  const candidateAttacks = snapshot.queue.filter((a) => {
    const packets = snapshot.packets.filter((p) => p.attackId === a.id);
    const reachedAnomaly = packets.some((p) =>
      ["tier1", "tier2", "mitre", "rl", "peo", "server"].includes(p.stage),
    );
    return reachedAnomaly || a.kind === "zero-day";
  });

  const candidates: ZeroDayCandidate[] = candidateAttacks.slice(0, 12).map((attack) => {
    const packets = snapshot.packets.filter((p) => p.attackId === attack.id);
    const tier1Packet =
      packets.find((p) => p.stage === "tier1" || p.stage === "tier2") ?? packets[0];
    const isolationForestScore = clamp(
      0.55 + attack.confidence * 0.35 + osc(snapshot.tick, attack.id.length, 0.1),
      0,
      0.99,
    );
    const xgboostConfidence = attack.confidence || snapshot.metrics.avgConfidence;
    const entropyScore = Number((6.2 + isolationForestScore * 1.7).toFixed(2));
    const def = ATTACK_CATALOG.find((a) => a.id === attack.kind);

    return {
      id: attack.id,
      timestamp: attack.startedAt ?? attack.createdAt,
      sourceIp: attack.sourceIp,
      destinationIp: attack.config.target,
      protocol: tier1Packet?.protocol ?? "TCP",
      attackId: attack.id,
      isolationForestScore: Number(isolationForestScore.toFixed(3)),
      xgboostConfidence: Number(xgboostConfidence.toFixed(3)),
      entropyScore,
      severity: attack.severity,
      suspiciousBehaviour: SUSPICIOUS_BEHAVIOURS[attack.kind] ?? "Unknown anomalous behaviour",
      candidateThreat: attack.name,
      generatedRule: `deny ${attack.sourceIp} → ${attack.config.target} # ${attack.mitreTechniqueId}`,
      environment: environmentFor(attack.config.target),
    };
  });

  const anomalyTrend = Array.from({ length: 24 }, (_, i) => {
    const t = snapshot.tick - (24 - i);
    const score = clamp(0.4 + osc(t, 1, 0.25) + snapshot.metrics.avgConfidence * 0.3, 0, 1);
    return { tick: t, score: Number(score.toFixed(3)), threshold: 0.6 };
  });

  const avgIsolationForestScore = candidates.length
    ? candidates.reduce((s, c) => s + c.isolationForestScore, 0) / candidates.length
    : 0;
  const avgXgboostConfidence = candidates.length
    ? candidates.reduce((s, c) => s + c.xgboostConfidence, 0) / candidates.length
    : snapshot.metrics.avgConfidence;

  return {
    candidates,
    anomalyTrend,
    avgIsolationForestScore: Number(avgIsolationForestScore.toFixed(3)),
    avgXgboostConfidence: Number(avgXgboostConfidence.toFixed(3)),
    candidateCount: candidates.length,
  };
}

/* ================================================================== */
/* Tier-0 Policy Repository                                            */
/* ================================================================== */

export function derivePolicySummary(
  snapshot: SimulationSnapshot,
  currentVersion: PolicyVersion,
  history: PolicyVersion[],
): PolicySummary {
  const policyEvents = snapshot.events.filter((e): e is PolicyEvent => e.type === "policy");

  const recentRules: PolicyRule[] = policyEvents.slice(0, 20).map((e) => {
    const attack = e.attackId ? snapshot.queue.find((a) => a.id === e.attackId) : undefined;
    return {
      id: e.id,
      action: e.action,
      rule: e.rule,
      version: `v4.12.${snapshot.metrics.policyUpdates}`,
      timestamp: e.timestamp,
      attackId: e.attackId,
      severity: e.severity,
      confidence: attack?.confidence ?? snapshot.metrics.avgConfidence,
    };
  });

  const diffSummary: PolicyDiffEntry[] = history.map((v) => ({
    version: v.version,
    added: v.added,
    removed: v.removed,
    modified: v.modified,
    ruleCount: v.ruleCount,
    netChange: v.added - v.removed,
  }));

  const confidence = clamp(
    0.9 +
      snapshot.metrics.avgConfidence * 0.08 -
      (snapshot.metrics.packetsBlocked > 1000 ? 0.05 : 0),
    0,
    0.999,
  );

  return {
    currentVersion: {
      ...currentVersion,
      version: `v4.12.${snapshot.metrics.policyUpdates}`,
      ruleCount: currentVersion.ruleCount + snapshot.metrics.policyUpdates,
      rolloutPercent: 100,
    },
    recentRules,
    versionHistory: history,
    diffSummary,
    confidence: Number(confidence.toFixed(3)),
    ruleCount: currentVersion.ruleCount + snapshot.metrics.policyUpdates,
    enforcementActions: snapshot.metrics.policyUpdates,
  };
}

/* ================================================================== */
/* Explainable AI                                                      */
/* ================================================================== */

const stagePathFor = (snapshot: SimulationSnapshot, attackId?: string): SimStageId[] => {
  if (!attackId) return ["tier0", "tier1", "tier2", "mitre", "rl", "peo"];
  const packets = snapshot.packets.filter((p) => p.attackId === attackId);
  const reached = new Set<SimStageId>(packets.map((p) => p.stage));
  const order = pipelineService.getStageDefinitions().map((s) => s.id);
  return order.filter((s) => reached.has(s) || ["tier0", "tier1", "tier2"].includes(s));
};

const recommendedActionFor = (decision: RLAction, severity: Severity): string => {
  if (decision === "block") return "Maintain block rule and add source to Tier-0 denylist";
  if (decision === "quarantine") return "Isolate affected host and trigger credential rotation";
  if (decision === "redirect") return "Continue honeynet capture and harvest IOC fingerprints";
  if (severity === "critical" || severity === "high")
    return "Escalate to Tier-2 analyst review and enable deep packet inspection";
  return "Allow with extended observation window";
};

export function deriveXaiExplanation(
  subjectId: string,
  kind: "attack" | "policy" | "threat",
  snapshot: SimulationSnapshot,
): XaiExplanation | null {
  const attack = snapshot.queue.find((a) => a.id === subjectId);
  const event = snapshot.events.find((e) => e.id === subjectId);

  // Resolve the underlying attack for policy/threat events tied to an attackId.
  const linkedAttack =
    attack ?? (event?.attackId ? snapshot.queue.find((a) => a.id === event.attackId) : undefined);
  if (!linkedAttack && !event) return null;

  const target = linkedAttack;
  const def = target ? ATTACK_CATALOG.find((a) => a.id === target.kind) : undefined;

  const isolationForestScore = clamp(
    0.5 +
      (target?.confidence ?? snapshot.metrics.avgConfidence) * 0.4 +
      osc(snapshot.tick, 3, 0.08),
    0,
    0.99,
  );
  const xgboostConfidence = target?.confidence ?? snapshot.metrics.avgConfidence;
  const rlDecision: RLAction = target?.verdict ?? "block";
  const severity: Severity = target?.severity ?? event?.severity ?? "medium";
  const mitreMapping = target
    ? `${target.mitreTechniqueId} · ${target.mitreTactic}`
    : "T0000 · Unclassified";

  const whyDetected = target
    ? `Isolation Forest flagged anomalous entropy (${isolationForestScore.toFixed(2)}) on ${target.kind} traffic from ${target.sourceIp}; XGBoost classified as "${target.name}" with ${(xgboostConfidence * 100).toFixed(0)}% confidence.`
    : (event?.description ?? "Detection signal from the simulation engine.");

  const whyBlocked =
    rlDecision === "allow"
      ? "RL policy agent selected ALLOW — expected reward for enforcement was lower than the cost of disruption."
      : `RL policy agent selected ${rlDecision.toUpperCase()} — Tier-2 confidence ${(xgboostConfidence * 100).toFixed(0)}% exceeded the enforcement threshold, and PEO installed a drop rule.`;

  return {
    subjectId,
    subjectKind: kind,
    title: target?.name ?? event?.title ?? subjectId,
    subtitle: target
      ? `${target.id} · ${target.sourceIp} → ${target.config.target}`
      : `${subjectId} · ${event?.title ?? ""}`,
    severity,
    whyDetected,
    whyBlocked,
    isolationForestScore: Number(isolationForestScore.toFixed(3)),
    xgboostConfidence: Number(xgboostConfidence.toFixed(3)),
    mitreMapping,
    rlDecision,
    policyVersion: `v4.12.${snapshot.metrics.policyUpdates}`,
    recommendedAction: recommendedActionFor(rlDecision, severity),
    attackKind: target?.kind,
    sourceIp: target?.sourceIp,
    target: target?.config.target,
    confidence: Number(xgboostConfidence.toFixed(3)),
    pipelinePath: stagePathFor(snapshot, target?.id ?? event?.attackId),
  };
}

export { attackService };
