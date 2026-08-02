import { simulationEngine } from "./simulation-engine";
import { getAttackCatalog, getAttackDefinition } from "./mock/attack-catalog";
import type {
  AttackService,
  PipelineService,
  SimulationService,
  TimelineService,
} from "./simulation-types";
import type { AttackConfig, AttackKind } from "@/types/simulation";

/**
 * Mock (in-browser) implementations of the Phase 2 services.
 * Each one is a thin adapter over the centralized simulation engine.
 */

export const simulationService: SimulationService = {
  subscribe: (listener) => simulationEngine.subscribe(listener),
  getSnapshot: () => simulationEngine.getSnapshot(),
  start: () => simulationEngine.start(),
  pause: () => simulationEngine.pause(),
  resume: () => simulationEngine.resume(),
  cancel: () => simulationEngine.cancel(),
  replay: () => simulationEngine.replay(),
  reset: () => simulationEngine.reset(),
  setSpeed: (speed) => simulationEngine.setSpeed(speed),
};

export const attackService: AttackService = {
  getCatalog: () => getAttackCatalog(),
  getDefinition: (kind: AttackKind) => getAttackDefinition(kind),
  defaultConfig: (kind: AttackKind): AttackConfig => {
    const def = getAttackDefinition(kind);
    return {
      target: "10.0.4.22",
      intensity: "medium",
      durationSec: def.defaultDurationSec,
      packetRate: def.defaultPacketRate,
      payloadVariant: def.payloadVariants[0] ?? "default",
      stealthMode: false,
      notes: "",
    };
  },
  enqueue: (kind, config) => simulationEngine.enqueue(kind, config),
  getQueue: () => simulationEngine.getSnapshot().queue,
  launch: () => simulationEngine.start(),
  pauseAttack: (id) => simulationEngine.pauseAttack(id),
  resumeAttack: (id) => simulationEngine.resumeAttack(id),
  cancelAttack: (id) => simulationEngine.cancelAttack(id),
  replayAttack: (id) => simulationEngine.replayAttack(id),
  duplicate: (id) => simulationEngine.duplicate(id),
  remove: (id) => simulationEngine.removeFromQueue(id),
  clearQueue: () => simulationEngine.clearQueue(),
};

export const pipelineService: PipelineService = {
  getStageDefinitions: () => simulationEngine.getStageDefinitions(),
  getStages: () => simulationEngine.getSnapshot().stages,
  getPacketsInFlight: () => simulationEngine.getSnapshot().packets,
};

export const timelineService: TimelineService = {
  getEvents: (limit = 60) => simulationEngine.getSnapshot().events.slice(0, limit),
  getEventsByType: (type, limit = 60) =>
    simulationEngine
      .getSnapshot()
      .events.filter((e) => e.type === type)
      .slice(0, limit),
};
