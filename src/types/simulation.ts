/**
 * Phase 2 domain types — centralized simulation engine.
 *
 * These types are the contract between the engine, the service layer and every
 * widget. The FastAPI backend will emit exactly these shapes over REST/WS, so
 * no UI component changes when the mock implementation is swapped out.
 */

import type { RLAction, Severity } from "./index";

/* ------------------------------------------------------------------ */
/* Pipeline                                                            */
/* ------------------------------------------------------------------ */

export type SimStageId =
  | "attacker"
  | "packetgen"
  | "tier0"
  | "tier1"
  | "tier2"
  | "mitre"
  | "rl"
  | "peo"
  | "server";

export type SimStageStatus = "idle" | "processing" | "escalating" | "blocked" | "clear";

export interface SimStageDefinition {
  id: SimStageId;
  name: string;
  subtitle: string;
  /** Short label used inside the animated flow diagram. */
  short: string;
}

export interface SimStageState {
  id: SimStageId;
  name: string;
  subtitle: string;
  short: string;
  status: SimStageStatus;
  latencyMs: number;
  confidence: number;
  packetCount: number;
  blockedCount: number;
}

/* ------------------------------------------------------------------ */
/* Attacks                                                             */
/* ------------------------------------------------------------------ */

export type AttackKind =
  | "sql-injection"
  | "xss"
  | "port-scan"
  | "ssh-brute-force"
  | "ddos"
  | "malware-download"
  | "dns-tunneling"
  | "insider-threat"
  | "zero-day";

export interface AttackCatalogEntry {
  id: AttackKind;
  name: string;
  mitreTactic: string;
  mitreTechniqueId: string;
  severity: Severity;
  description: string;
  /** 0..100 estimated residual risk if undetected. */
  estimatedRisk: number;
  expectedImpact: string;
  defaultPacketRate: number;
  defaultDurationSec: number;
  payloadVariants: string[];
}

export type AttackIntensity = "low" | "medium" | "high" | "extreme";

export interface AttackConfig {
  target: string;
  intensity: AttackIntensity;
  durationSec: number;
  packetRate: number;
  payloadVariant: string;
  stealthMode: boolean;
  notes: string;
}

export type AttackRunState =
  | "queued"
  | "running"
  | "paused"
  | "completed"
  | "blocked"
  | "unknown"
  | "cancelled";

export interface QueuedAttack {
  id: string;
  kind: AttackKind;
  name: string;
  mitreTactic: string;
  mitreTechniqueId: string;
  severity: Severity;
  config: AttackConfig;
  state: AttackRunState;
  progress: number;
  sourceIp: string;
  packetsSent: number;
  packetsBlocked: number;
  createdAt: string;
  startedAt?: string | undefined;
  finishedAt?: string | undefined;
  verdict?: RLAction | undefined;
  confidence: number;
}

/* ------------------------------------------------------------------ */
/* Engine                                                              */
/* ------------------------------------------------------------------ */

export type SimulationStatus = "idle" | "running" | "paused" | "completed" | "cancelled";
export type SimulationSpeed = 1 | 2 | 5;

export interface SimulationPacket {
  id: string;
  attackId: string;
  kind: AttackKind;
  severity: Severity;
  stage: SimStageId;
  sourceIp: string;
  targetIp: string;
  protocol: string;
  bytes: number;
  malicious: boolean;
  blocked: boolean;
  confidence: number;
  createdAt: number;
}

export type SimEventType =
  | "attack"
  | "packet"
  | "stage"
  | "timeline"
  | "policy"
  | "threat";

export interface SimEventBase {
  id: string;
  type: SimEventType;
  timestamp: string;
  tick: number;
  attackId?: string | undefined;
  title: string;
  description: string;
  severity: Severity;
}

export interface AttackEvent extends SimEventBase {
  type: "attack";
  state: AttackRunState;
}

export interface PacketEvent extends SimEventBase {
  type: "packet";
  packet: SimulationPacket;
}

export interface StageEvent extends SimEventBase {
  type: "stage";
  stage: SimStageId;
  status: SimStageStatus;
  latencyMs: number;
  confidence: number;
}

export interface TimelineEvent extends SimEventBase {
  type: "timeline";
  stage?: SimStageId | undefined;
}

export interface PolicyEvent extends SimEventBase {
  type: "policy";
  action: RLAction;
  rule: string;
}

export interface ThreatEvent extends SimEventBase {
  type: "threat";
  kind: AttackKind;
  mitreTechniqueId: string;
  confidence: number;
}

export type SimulationEvent =
  | AttackEvent
  | PacketEvent
  | StageEvent
  | TimelineEvent
  | PolicyEvent
  | ThreatEvent;

export interface SimulationMetrics {
  packetsGenerated: number;
  packetsInspected: number;
  packetsBlocked: number;
  packetsAllowed: number;
  threatsDetected: number;
  policyUpdates: number;
  avgConfidence: number;
  elapsedSec: number;
}

export interface SimulationSnapshot {
  status: SimulationStatus;
  speed: SimulationSpeed;
  tick: number;
  startedAt: string | null;
  queue: QueuedAttack[];
  activeAttackId: string | null;
  stages: SimStageState[];
  packets: SimulationPacket[];
  events: SimulationEvent[];
  metrics: SimulationMetrics;
}
