import { useMemo } from "react";
import { useSimulation } from "@/hooks/useSimulation";
import { useMetricSeries } from "@/hooks/useMetricSeries";
import { useSoc } from "@/lib/soc-store";
import {
  deriveAlertSeeds,
  deriveHealth,
  deriveIntelFeed,
  deriveOverview,
  deriveServices,
  deriveThreatRows,
  filterIntelFeed,
  filterThreatRows,
} from "@/lib/soc-selectors";
import type { SocAlert } from "@/types/soc";

/**
 * The single SOC read model. Every Blue Team widget consumes this hook, so the
 * whole dashboard renders one consistent slice of the simulation engine and
 * reacts to the global filters together.
 */
export function useSocData() {
  const snapshot = useSimulation();
  const { filters, alertStates } = useSoc();

  const allRows = useMemo(() => deriveThreatRows(snapshot), [snapshot]);
  const rows = useMemo(() => filterThreatRows(allRows, filters), [allRows, filters]);

  const alerts = useMemo<SocAlert[]>(
    () =>
      deriveAlertSeeds(snapshot).map((seed) => ({
        ...seed,
        state: alertStates[seed.id] ?? "open",
      })),
    [snapshot, alertStates],
  );

  const scopedAlerts = useMemo(
    () =>
      alerts.filter((a) => {
        if (filters.severity !== "all" && a.severity !== filters.severity) return false;
        if (a.attackId && !rows.some((r) => r.id === a.attackId)) return false;
        return true;
      }),
    [alerts, filters.severity, rows],
  );

  const intel = useMemo(() => deriveIntelFeed(snapshot), [snapshot]);
  const scopedIntel = useMemo(
    () => filterIntelFeed(intel, filters, rows),
    [intel, filters, rows],
  );

  const health = useMemo(() => deriveHealth(snapshot), [snapshot]);
  const services = useMemo(() => deriveServices(snapshot), [snapshot]);
  const overview = useMemo(
    () => deriveOverview(snapshot, rows, scopedAlerts),
    [snapshot, rows, scopedAlerts],
  );

  const seriesInput = useMemo(() => {
    const values: Record<string, number> = {};
    overview.forEach((m) => (values[`ov:${m.id}`] = m.value));
    health.forEach((m) => (values[`hl:${m.id}`] = m.value));
    return values;
  }, [overview, health]);

  const series = useMetricSeries(seriesInput);

  return {
    snapshot,
    allRows,
    rows,
    alerts,
    scopedAlerts,
    intel,
    scopedIntel,
    health,
    services,
    overview,
    series,
  };
}