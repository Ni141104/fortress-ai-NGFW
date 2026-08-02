import type {
  ActiveAttack,
  Alert,
  AttackTechniqueOption,
  FederatedClient,
  FederatedRound,
  HoneypotSession,
  MITRETechnique,
  PipelineStage,
  PolicyVersion,
  RLActionShare,
  RLDecision,
  RLRewardPoint,
  Role,
  SystemMetric,
  ThreatDataPoint,
  ThreatIntelIndicator,
  TimelineEventItem,
  TrafficStat,
  ZeroDayDetection,
} from "@/types";

/**
 * Phase 1 service contract. Widgets consume this interface — never the mock
 * modules directly — so a FastAPI-backed implementation drops in unchanged.
 */
export interface NgfwService {
  traffic: {
    getStats(role: Role): TrafficStat[];
    getPipeline(): PipelineStage[];
  };
  threats: {
    getTimeline(rangeHours: number): ThreatDataPoint[];
    getActiveAttacks(role: Role): ActiveAttack[];
    getAlerts(): Alert[];
    getZeroDay(): ZeroDayDetection[];
    getIntel(): ThreatIntelIndicator[];
    getTimelineFeed(role: Role): TimelineEventItem[];
  };
  mitre: {
    getTechniques(): MITRETechnique[];
    getSimulationCatalog(): AttackTechniqueOption[];
  };
  rl: {
    getDecisions(count?: number): RLDecision[];
    getRewardCurve(count?: number): RLRewardPoint[];
    getActionDistribution(): RLActionShare[];
  };
  honeypot: {
    getSessions(count?: number): HoneypotSession[];
  };
  federated: {
    getClients(): FederatedClient[];
    getRounds(count?: number): FederatedRound[];
  };
  policy: {
    getCurrentVersion(): PolicyVersion;
    getHistory(): PolicyVersion[];
  };
  system: {
    getHealth(): SystemMetric[];
  };
  simulation: {
    launch(techniqueId: string, targetIp: string): ActiveAttack;
    getQueue(): ActiveAttack[];
    abort(attackId: string): void;
  };
}