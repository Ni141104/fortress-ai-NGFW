import type { NgfwService } from "./types";
import type { SimulationSnapshot } from "@/types/simulation";
import * as traffic from "./mock/traffic";
import * as threats from "./mock/threats";
import * as mitre from "./mock/mitre";
import * as rl from "./mock/rl";
import * as honeypot from "./mock/honeypot";
import * as federated from "./mock/federated";
import * as policy from "./mock/policy";
import * as system from "./mock/system";
import * as simulation from "./mock/simulation";
import { apiRequest, getToken } from "./api-client";
import { liveNgfw } from "./live-ngfw";
import {
  liveAttackService,
  livePipelineService,
  liveSimulationService,
  liveTimelineService,
} from "./live-simulation";

import {
  attackService as demoAttackService,
  pipelineService as demoPipelineService,
  simulationService as demoSimulationService,
  timelineService as demoTimelineService,
} from "./simulation-services";
import type {
  AttackService,
  PipelineService,
  SimulationService,
  TimelineService,
} from "./simulation-types";

/**
 * Single provider export. Swap `mockService` for a live HTTP/WS implementation
 * of `NgfwService` and every widget follows without edits.
 */
export const mockService: NgfwService = {
  traffic,
  threats,
  mitre,
  rl,
  honeypot,
  federated,
  policy,
  system,
  simulation,
};

const SETTINGS_KEY = "ngfw.platform.settings";

function demoModeEnabled(): boolean {
  if (typeof window === "undefined") return true;
  try {
    const settings = JSON.parse(window.localStorage.getItem(SETTINGS_KEY) ?? "{}");
    return settings.demoModeEnabled !== false;
  } catch {
    return true;
  }
}

/** Runtime source switch used by every read model and the simulation controls. */
export const ngfw: NgfwService = new Proxy(mockService, {
  get(_target, property: string) {
    const source = demoModeEnabled() ? mockService : liveNgfw;
    return source[property as keyof NgfwService];
  },
});

export const live = {
  simulation: liveSimulationService,
  attacks: liveAttackService,
  pipeline: livePipelineService,
  timeline: liveTimelineService,
};

export const simulationService: SimulationService = new Proxy(demoSimulationService, {
  get(target, property: string) {
    return (demoModeEnabled() ? target : liveSimulationService)[
      property as keyof SimulationService
    ];
  },
});
export const attackService: AttackService = new Proxy(demoAttackService, {
  get(target, property: string) {
    return (demoModeEnabled() ? target : liveAttackService)[property as keyof AttackService];
  },
});
export const pipelineService: PipelineService = new Proxy(demoPipelineService, {
  get(target, property: string) {
    return (demoModeEnabled() ? target : livePipelineService)[property as keyof PipelineService];
  },
});
export const timelineService: TimelineService = new Proxy(demoTimelineService, {
  get(target, property: string) {
    return (demoModeEnabled() ? target : liveTimelineService)[property as keyof TimelineService];
  },
});

/* ------------------------------------------------------------------ */
/* Simulation stream router                                            */
/* ------------------------------------------------------------------ */
/* useSimulation previously subscribed once at mount to whichever engine
 * was active then, so toggling demo/live mid-session left every widget bound
 * to the wrong engine. This router keeps one subscriber set and re-binds it
 * to the active engine whenever mode changes (see rebindSimulationStreamNow,
 * invoked from the "ngfw:settings-changed" event fired by PlatformProvider). */

const simulationListeners = new Set<(snapshot: SimulationSnapshot) => void>();
let boundStreamEngine: SimulationService | null = null;
let boundStreamUnsubscribe: (() => void) | null = null;
let boundStreamMode: "demo" | "live" | null = null;

function currentSimulationEngine(): SimulationService {
  return demoModeEnabled() ? demoSimulationService : liveSimulationService;
}

function rebindSimulationStream(force: boolean): void {
  const mode = demoModeEnabled() ? "demo" : "live";
  if (boundStreamEngine && boundStreamMode === mode && !force) return;
  if (boundStreamUnsubscribe) {
    boundStreamUnsubscribe();
    boundStreamUnsubscribe = null;
  }
  const engine = currentSimulationEngine();
  boundStreamEngine = engine;
  boundStreamMode = mode;
  boundStreamUnsubscribe = engine.subscribe((next) => {
    simulationListeners.forEach((listener) => listener(next));
  });
}

/** Snapshot of the engine currently active (demo or live). */
export function getSimulationSnapshot(): SimulationSnapshot {
  return currentSimulationEngine().getSnapshot();
}

/**
 * Subscribe to whichever engine is active; the subscription follows demo/live
 * mode switches transparently (the listener is stored here, only the engine
 * binding changes).
 */
export function subscribeSimulationStream(
  listener: (snapshot: SimulationSnapshot) => void,
): () => void {
  simulationListeners.add(listener);
  rebindSimulationStream(false);
  return () => {
    simulationListeners.delete(listener);
  };
}

/** Re-bind the shared stream to the current engine after a mode toggle. */
export function rebindSimulationStreamNow(): void {
  rebindSimulationStream(true);
}

export async function resetLearnedDefense(): Promise<{ removed_rules: number; message: string }> {
  if (!getToken()) throw new Error("Log in before resetting learned defense");
  return apiRequest("/learning/reset", { method: "POST" });
}

export async function rollbackPolicy(): Promise<{
  rolled_back_rules: number;
  rule_id: string | number | null;
  version: number;
  message: string;
}> {
  if (!getToken()) throw new Error("Log in before rolling back the policy");
  return apiRequest("/policy/rollback", { method: "POST" });
}

/**
 * Phase 2 services — the centralized simulation engine and everything that
 * reads from it. Replacing these four objects with FastAPI clients is the only
 * change required to go live.
 */
export const sim = new Proxy(
  {
    simulation: simulationService,
    attacks: attackService,
    pipeline: pipelineService,
    timeline: timelineService,
  },
  {
    get(target, property: string) {
      const source = demoModeEnabled() ? target : live;
      return source[property as keyof typeof target];
    },
  },
);

export type { NgfwService };
export type {
  AttackService,
  PipelineService,
  SimulationService,
  TimelineService,
} from "./simulation-types";
