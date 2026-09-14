import { useEffect, useState } from "react";
import {
  getSimulationSnapshot,
  rebindSimulationStreamNow,
  subscribeSimulationStream,
} from "@/services";
import type { SimulationSnapshot } from "@/types/simulation";

/**
 * The one subscription every Phase 2 widget uses.
 * Widgets never poll and never generate their own data — they render whatever
 * the centralized simulation engine last published.
 *
 * PREVIOUS IMPLEMENTATION — subscribed once at mount (`[]`), so the stream was
 * bound to whichever engine (demo/live) was active on first render and never
 * followed mode toggles. The stream now re-binds through the module-level
 * router whenever "ngfw:settings-changed" is dispatched.
 */
export function useSimulation(): SimulationSnapshot {
  const [snapshot, setSnapshot] = useState<SimulationSnapshot>(() =>
    getSimulationSnapshot(),
  );

  useEffect(() => {
    const unsubscribe = subscribeSimulationStream(setSnapshot);
    const onSettingsChanged = () => {
      setSnapshot(getSimulationSnapshot());
      rebindSimulationStreamNow();
    };
    window.addEventListener("ngfw:settings-changed", onSettingsChanged);
    return () => {
      unsubscribe();
      window.removeEventListener("ngfw:settings-changed", onSettingsChanged);
    };
  }, []);

  return snapshot;
}