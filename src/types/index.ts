/**
 * Core domain types for the AI-NGFW platform.
 * Ported from the reference project so later phases drop in unchanged.
 */

export type Role = "red" | "blue";

export type Severity = "low" | "medium" | "high" | "critical";
export type HealthStatus = "normal" | "warning" | "critical";
export type StatStatus = "success" | "warning" | "danger";

export interface TrafficStat {
  label: string;
  value: number;
  change: number;
  status: StatStatus;
  icon: string;
  sparklineData: number[];
}

export interface ThreatDataPoint {
  timestamp: string;
  normal: number;
  suspicious: number;
  malicious: number;
}

export interface MITRETechnique {
  id: string;
  name: string;
  description: string;
  tactic: string;
  count: number;
  severity: number;
}

export type RLAction = "allow" | "block" | "quarantine" | "redirect";

export interface RLDecision {
  id: string;
  timestamp: string;
  sourceIp: string;
  destinationIp: string;
  confidence: number;
  decision: RLAction;
  tier1Score: number;
  tier2Score: number;
  reason: string;
  protocol: string;
}

export interface RLRewardPoint {
  episode: number;
  reward: number;
  cumulative: number;
}

export interface RLActionShare {
  action: RLAction;
  share: number;
}

export interface ZeroDayDetection {
  id: string;
  timestamp: string;
  sourceIp: string;
  destinationIp: string;
  protocol: string;
  entropyScore: number;
  isolationForestScore: number;
  xgboostConfidence: number;
  severity: Severity;
}

export interface LogEntry {
  id: string;
  timestamp: string;
  eventType: string;
  sourceIp: string;
  destinationIp: string;
  action: string;
  confidence: number;
  mitreTTP?: string;
}

export interface SystemMetric {
  name: string;
  value: number;
  unit: string;
  status: HealthStatus;
  history: number[];
}

export type PipelineStageId =
  | "tier0"
  | "tier1"
  | "tier2"
  | "rl"
  | "peo";

export interface PipelineStage {
  id: PipelineStageId;
  name: string;
  subtitle: string;
  throughput: number;
  latencyMs: number;
  escalated: number;
  status: "healthy" | "degraded" | "saturated";
}

export interface ActiveAttack {
  id: string;
  startedAt: string;
  sourceIp: string;
  targetIp: string;
  technique: string;
  techniqueId: string;
  severity: Severity;
  confidence: number;
  stage: PipelineStageId;
  action: RLAction;
  campaign?: string;
  origin: "external" | "simulated";
}

export interface Alert {
  id: string;
  timestamp: string;
  rule: string;
  ruleId: number;
  agent: string;
  severity: Severity;
  description: string;
  acknowledged: boolean;
}

export interface TimelineEventItem {
  id: string;
  timestamp: string;
  title: string;
  description: string;
  kind: "detection" | "policy" | "rl" | "honeypot" | "federated" | "analyst";
  severity: Severity;
}

export interface PolicyVersion {
  version: string;
  publishedAt: string;
  ruleCount: number;
  added: number;
  removed: number;
  modified: number;
  author: string;
  rolloutPercent: number;
}

export interface ThreatIntelIndicator {
  id: string;
  value: string;
  type: "ip" | "domain" | "hash" | "url";
  source: string;
  confidence: number;
  tags: string[];
  firstSeen: string;
}

export interface HoneypotSession {
  id: string;
  attackerIp: string;
  service: string;
  startedAt: string;
  durationSec: number;
  commands: string[];
  severity: Severity;
  payloadsCaptured: number;
}

export interface FederatedClient {
  id: string;
  name: string;
  region: string;
  status: "training" | "idle" | "aggregating" | "offline";
  samples: number;
  lastRound: number;
}

export interface FederatedRound {
  round: number;
  accuracy: number;
  loss: number;
  participants: number;
}

export interface AttackTechniqueOption {
  id: string;
  name: string;
  tactic: string;
  severity: Severity;
  description: string;
}
