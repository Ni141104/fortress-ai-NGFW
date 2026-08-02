import type {
  FederatedClient,
  FederatedRound,
  HoneypotSession,
  MITRETechnique,
  PolicyVersion,
  RLAction,
  RLDecision,
  Severity,
} from "./index";
import type { AttackKind, SimStageId, SimulationSnapshot } from "./simulation";
import type { SocEnvironment } from "./soc";

/**
 * Phase 4 — AI Intelligence view models.
 *
 * Every shape here is DERIVED from the centralized simulation engine snapshot
 * (see `lib/ai-selectors.ts`). No AI widget generates its own data — the
 * FastAPI backend will emit exactly these shapes, so no UI component changes
 * when the mock implementation is swapped out.
 */

/* ------------------------------------------------------------------ */
/* Reinforcement Learning                                              */
/* ------------------------------------------------------------------ */

export interface RLStageStat {
  id: SimStageId;
  name: string;
  packets: number;
  blocked: number;
  latencyMs: number;
  confidence: number;
}

export interface RLAgentSummary {
  policyVersion: string;
  learningProgress: number;
  reward: number;
  confidence: number;
  policyAccuracy: number;
  cumulativeReward: number;
  episodes: number;
  decisions: RLDecision[];
  actionDistribution: Array<{ action: RLAction; count: number; share: number }>;
  rewardCurve: Array<{ episode: number; reward: number; cumulative: number }>;
  learningTimeline: Array<{ tick: number; reward: number; label: string }>;
  stageStats: RLStageStat[];
  versionHistory: Array<{ version: string; reward: number; accuracy: number; tick: number }>;
}

/* ------------------------------------------------------------------ */
/* Federated Learning                                                  */
/* ------------------------------------------------------------------ */

export type FlSyncStatus = "idle" | "collecting" | "aggregating" | "distributing" | "complete";

export interface FlNode {
  id: string;
  name: string;
  region: string;
  status: FederatedClient["status"];
  samples: number;
  lastRound: number;
  accuracy: number;
  syncProgress: number;
}

export interface FlPipelineStep {
  id: string;
  label: string;
  status: FlSyncStatus;
}

export interface FlSummary {
  currentRound: number;
  participatingNodes: number;
  syncStatus: FlSyncStatus;
  globalAccuracy: number;
  globalModelVersion: string;
  syncProgress: number;
  nodes: FlNode[];
  pipeline: FlPipelineStep[];
  accuracyTrend: Array<{ round: number; accuracy: number; loss: number }>;
  roundHistory: FederatedRound[];
}

/* ------------------------------------------------------------------ */
/* Honeypot Intelligence                                               */
/* ------------------------------------------------------------------ */

export interface HoneypotSummary {
  activeSessions: number;
  commandsExecuted: number;
  capturedPayloads: number;
  threatScore: number;
  sessions: HoneypotSession[];
  behaviourTimeline: Array<{
    id: string;
    timestamp: string;
    title: string;
    description: string;
    severity: Severity;
  }>;
}

/* ------------------------------------------------------------------ */
/* MITRE Intelligence                                                  */
/* ------------------------------------------------------------------ */

export interface MitreTacticSummary {
  tactic: string;
  count: number;
  techniques: number;
  severity: number;
}

export interface MitreKillChainStep {
  phase: string;
  reached: boolean;
  techniqueCount: number;
}

export interface MitreSummary {
  techniques: MITRETechnique[];
  topTechniques: MITRETechnique[];
  tacticDistribution: MitreTacticSummary[];
  killChain: MitreKillChainStep[];
  totalDetections: number;
}

/* ------------------------------------------------------------------ */
/* Zero-Day Intelligence                                               */
/* ------------------------------------------------------------------ */

export interface ZeroDayCandidate {
  id: string;
  timestamp: string;
  sourceIp: string;
  destinationIp: string;
  protocol: string;
  attackId?: string | undefined;
  isolationForestScore: number;
  xgboostConfidence: number;
  entropyScore: number;
  severity: Severity;
  suspiciousBehaviour: string;
  candidateThreat: string;
  generatedRule: string;
  environment: SocEnvironment;
}

export interface ZeroDaySummary {
  candidates: ZeroDayCandidate[];
  anomalyTrend: Array<{ tick: number; score: number; threshold: number }>;
  avgIsolationForestScore: number;
  avgXgboostConfidence: number;
  candidateCount: number;
}

/* ------------------------------------------------------------------ */
/* Tier-0 Policy Repository                                            */
/* ------------------------------------------------------------------ */

export interface PolicyRule {
  id: string;
  action: RLAction;
  rule: string;
  version: string;
  timestamp: string;
  attackId?: string | undefined;
  severity: Severity;
  confidence: number;
}

export interface PolicyDiffEntry {
  version: string;
  added: number;
  removed: number;
  modified: number;
  ruleCount: number;
  netChange: number;
}

export interface PolicySummary {
  currentVersion: PolicyVersion;
  recentRules: PolicyRule[];
  versionHistory: PolicyVersion[];
  diffSummary: PolicyDiffEntry[];
  confidence: number;
  ruleCount: number;
  enforcementActions: number;
}

/* ------------------------------------------------------------------ */
/* Explainable AI                                                      */
/* ------------------------------------------------------------------ */

export type XaiSubjectKind = "attack" | "policy" | "threat";

export interface XaiExplanation {
  subjectId: string;
  subjectKind: XaiSubjectKind;
  title: string;
  subtitle: string;
  severity: Severity;
  whyDetected: string;
  whyBlocked: string;
  isolationForestScore: number;
  xgboostConfidence: number;
  mitreMapping: string;
  rlDecision: RLAction;
  policyVersion: string;
  recommendedAction: string;
  attackKind?: AttackKind | undefined;
  sourceIp?: string | undefined;
  target?: string | undefined;
  confidence: number;
  pipelinePath: SimStageId[];
}
