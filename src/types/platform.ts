import type { Severity } from "./index";
import type { AttackKind, SimulationSpeed } from "./simulation";

/** Application settings persisted to localStorage. */
export interface PlatformSettings {
  simulationSpeed: SimulationSpeed;
  autoReplay: boolean;
  demoModeEnabled: boolean;
  widgetRefreshInterval: number;
  notificationsEnabled: boolean;
  notificationSound: boolean;
  themeAccent: "blue" | "purple" | "pink" | "green";
}

export type NotificationType =
  | "attack-started"
  | "threat-detected"
  | "policy-updated"
  | "rl-decision"
  | "honeypot-triggered"
  | "simulation-completed";

export interface PlatformNotification {
  id: string;
  type: NotificationType;
  title: string;
  description: string;
  timestamp: string;
  severity: Severity;
  attackId?: string | undefined;
  read: boolean;
  dismissed: boolean;
}

/** Predefined scenario for the Scenario Library. */
export interface ScenarioDefinition {
  id: string;
  kind: AttackKind;
  name: string;
  description: string;
  mitreTechniqueId: string;
  severity: Severity;
  /** Short label for demo / command center display. */
  tagline: string;
}

/** Extended journey stage beyond the engine pipeline stages. */
export type JourneyStageId =
  | "attacker"
  | "packetgen"
  | "tier0"
  | "tier1"
  | "tier2"
  | "mitre"
  | "rl"
  | "peo"
  | "honeypot"
  | "final"
  | "blue-team";

export interface JourneyStageDefinition {
  id: JourneyStageId;
  name: string;
  subtitle: string;
  short: string;
  /** Static explanation shown in the step-through viewer. */
  explanation: string;
  /** Whether this stage only appears for redirect/honeypot flows. */
  conditional?: boolean;
}
