import type { Severity } from "./index";
import type { AttackKind, AttackRunState, SimStageId } from "./simulation";

/**
 * Phase 3 — Blue Team SOC view models.
 *
 * Every shape here is DERIVED from the centralized simulation engine snapshot
 * (see `lib/soc-selectors.ts`). No SOC widget generates its own data.
 */

export type SocEnvironment = "production" | "staging" | "dmz" | "lab";

export interface ThreatRow {
  id: string;
  name: string;
  kind: AttackKind;
  state: AttackRunState;
  stage: SimStageId;
  stageLabel: string;
  severity: Severity;
  mitreTechniqueId: string;
  mitreTactic: string;
  confidence: number;
  target: string;
  sourceIp: string;
  environment: SocEnvironment;
  startedAt: string;
  updatedAt: string;
  packetsSent: number;
  packetsBlocked: number;
  progress: number;
  verdict: string;
}

export type HealthTone = "blue" | "green" | "pink" | "purple" | "amber";

export interface HealthMetric {
  id: string;
  label: string;
  value: number;
  unit: string;
  status: "normal" | "warning" | "critical";
  tone: HealthTone;
  /** Lower is better. */
  invert?: boolean;
}

export interface ServiceStatus {
  id: string;
  label: string;
  status: "healthy" | "degraded" | "offline";
  detail: string;
}

export type IntelCategory =
  | "New Threat"
  | "Policy Updated"
  | "Unknown Behaviour"
  | "Firewall Triggered"
  | "Isolation Forest"
  | "XGBoost Classified"
  | "MITRE Mapped"
  | "RL Decision"
  | "Packet Capture"
  | "Operations";

export interface IntelEvent {
  id: string;
  timestamp: string;
  title: string;
  description: string;
  severity: Severity;
  confidence: number;
  source: string;
  category: IntelCategory;
  attackId?: string | undefined;
}

export type AlertState = "open" | "acknowledged" | "resolved" | "muted" | "dismissed";

export interface SocAlert {
  id: string;
  timestamp: string;
  title: string;
  description: string;
  severity: Severity;
  source: string;
  attackId?: string | undefined;
  state: AlertState;
}

export interface OverviewMetric {
  id: string;
  label: string;
  value: number;
  display: string;
  unit?: string | undefined;
  hint: string;
  tone: HealthTone;
  invert?: boolean | undefined;
}

export interface SocFilters {
  timeRange: "5m" | "15m" | "1h" | "24h" | "all";
  severity: Severity | "all";
  attackType: AttackKind | "all";
  status: AttackRunState | "all";
  environment: SocEnvironment | "all";
  target: string;
}

export interface SearchHit {
  id: string;
  group: "Attacks" | "Policies" | "MITRE" | "Threats" | "Timeline" | "Alerts" | "Rules";
  title: string;
  subtitle: string;
  severity?: Severity | undefined;
  attackId?: string | undefined;
}

export interface WidgetPref {
  id: string;
  visible: boolean;
  collapsed: boolean;
  /** Grid span on xl screens: 1, 2 or 3 columns. */
  span: 1 | 2 | 3;
  order: number;
}