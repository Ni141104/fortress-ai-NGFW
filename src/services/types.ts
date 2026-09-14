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
    getStats(role: Role): TrafficStat[] | Promise<TrafficStat[]>;
    getPipeline(): PipelineStage[] | Promise<PipelineStage[]>;
  };
  threats: {
    getTimeline(rangeHours: number): ThreatDataPoint[] | Promise<ThreatDataPoint[]>;
    getActiveAttacks(role: Role): ActiveAttack[] | Promise<ActiveAttack[]>;
    getAlerts(): Alert[] | Promise<Alert[]>;
    getZeroDay(): ZeroDayDetection[] | Promise<ZeroDayDetection[]>;
    getIntel(): ThreatIntelIndicator[] | Promise<ThreatIntelIndicator[]>;
    getTimelineFeed(role: Role): TimelineEventItem[] | Promise<TimelineEventItem[]>;
  };
  mitre: {
    getTechniques(): MITRETechnique[] | Promise<MITRETechnique[]>;
    getSimulationCatalog(): AttackTechniqueOption[] | Promise<AttackTechniqueOption[]>;
  };
  rl: {
    getDecisions(count?: number): RLDecision[] | Promise<RLDecision[]>;
    getRewardCurve(count?: number): RLRewardPoint[] | Promise<RLRewardPoint[]>;
    getActionDistribution(): RLActionShare[] | Promise<RLActionShare[]>;
  };
  honeypot: {
    getSessions(count?: number): HoneypotSession[] | Promise<HoneypotSession[]>;
  };
  federated: {
    getClients(): FederatedClient[] | Promise<FederatedClient[]>;
    getRounds(count?: number): FederatedRound[] | Promise<FederatedRound[]>;
  };
  policy: {
    getCurrentVersion(): PolicyVersion | Promise<PolicyVersion>;
    getHistory(): PolicyVersion[] | Promise<PolicyVersion[]>;
  };
  system: {
    getHealth(): SystemMetric[] | Promise<SystemMetric[]>;
  };
  simulation: {
    launch(techniqueId: string, targetIp: string): ActiveAttack;
    getQueue(): ActiveAttack[];
    abort(attackId: string): void;
  };
}