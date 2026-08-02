import { useEffect, useState } from "react";
import { simulationService } from "@/services";
import type { SimulationSnapshot } from "@/types/simulation";

/**
 * The one subscription every Phase 2 widget uses.
 * Widgets never poll and never generate their own data — they render whatever
 * the centralized simulation engine last published.
 */
export function useSimulation(): SimulationSnapshot {
  const [snapshot, setSnapshot] = useState<SimulationSnapshot>(() =>
    simulationService.getSnapshot(),
  );

  useEffect(() => simulationService.subscribe(setSnapshot), []);

  return snapshot;
}
