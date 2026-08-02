import type {
  AttackCatalogEntry,
  AttackConfig,
  AttackKind,
  QueuedAttack,
  SimStageDefinition,
  SimStageState,
  SimulationEvent,
  SimulationPacket,
  SimulationSnapshot,
  SimulationSpeed,
} from "@/types/simulation";

/**
 * Phase 2 service contracts.
 *
 * Every widget consumes these interfaces — never the engine or mock modules
 * directly. Swapping in FastAPI-backed implementations means replacing the
 * objects exported from `services/index.ts`, nothing else.
 */

export interface SimulationService {
  subscribe(listener: (snapshot: SimulationSnapshot) => void): () => void;
  getSnapshot(): SimulationSnapshot;
  start(): void;
  pause(): void;
  resume(): void;
  cancel(): void;
  replay(): void;
  reset(): void;
  setSpeed(speed: SimulationSpeed): void;
}

export interface AttackService {
  getCatalog(): AttackCatalogEntry[];
  getDefinition(kind: AttackKind): AttackCatalogEntry;
  defaultConfig(kind: AttackKind): AttackConfig;
  enqueue(kind: AttackKind, config: AttackConfig): QueuedAttack;
  getQueue(): QueuedAttack[];
  launch(): void;
  pauseAttack(id: string): void;
  resumeAttack(id: string): void;
  cancelAttack(id: string): void;
  replayAttack(id: string): void;
  duplicate(id: string): QueuedAttack | null;
  remove(id: string): void;
  clearQueue(): void;
}

export interface PipelineService {
  getStageDefinitions(): SimStageDefinition[];
  getStages(): SimStageState[];
  getPacketsInFlight(): SimulationPacket[];
}

export interface TimelineService {
  getEvents(limit?: number): SimulationEvent[];
  getEventsByType(type: SimulationEvent["type"], limit?: number): SimulationEvent[];
}
