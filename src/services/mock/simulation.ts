import type { ActiveAttack } from "@/types";
import { getSimulationCatalog } from "./mitre";
import { id, internalIP, pick } from "./utils";

/**
 * In-memory simulation queue. Replaced by a real orchestrator endpoint later;
 * consumers only ever touch the `simulation` slice of the service interface.
 */
let queue: ActiveAttack[] = [];

export const launch = (techniqueId: string, targetIp: string): ActiveAttack => {
  const technique =
    getSimulationCatalog().find((t) => t.id === techniqueId) ??
    getSimulationCatalog()[0]!;

  const attack: ActiveAttack = {
    id: id("SIM"),
    startedAt: new Date().toISOString(),
    sourceIp: internalIP(),
    targetIp: targetIp || internalIP(),
    technique: technique.name,
    techniqueId: technique.id,
    severity: technique.severity,
    confidence: 0.5,
    stage: "tier0",
    action: pick(["allow", "block", "quarantine", "redirect"] as const),
    campaign: "MANUAL LAUNCH",
    origin: "simulated",
  };

  queue = [attack, ...queue].slice(0, 25);
  return attack;
};

export const getQueue = (): ActiveAttack[] => queue;

export const abort = (attackId: string): void => {
  queue = queue.filter((a) => a.id !== attackId);
};
