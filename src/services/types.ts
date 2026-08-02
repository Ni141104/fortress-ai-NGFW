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
 * Service interfaces consumed by every widget.
 * The mock implementation lives in `services/mock`; swapping in a live
 * HTTP/websocket client is a one-line change in `services/index.ts`.
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
    abort(id: string): void;
  };
}
