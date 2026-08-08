import { useMemo } from "react";
import { useSimulation } from "@/hooks/useSimulation";
import { useLiveData } from "@/hooks/useLiveData";
import { useMetricSeries } from "@/hooks/useMetricSeries";
import { useSoc } from "@/lib/soc-store";
import { usePlatformOptional } from "@/lib/platform-store";
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
import {
  deriveFlSummary,
  deriveHoneypotSummary,
  deriveMitreSummary,
  derivePolicySummary,
  deriveRLAgent,
  deriveZeroDaySummary,
} from "@/lib/ai-selectors";
import { ngfw } from "@/services";
import type { SocAlert } from "@/types/soc";

/**
 * The single SOC read model. Every Blue Team widget consumes this hook, so the
 * whole dashboard renders one consistent slice of the simulation engine and
 * reacts to the global filters together.
 */
export function useSocData() {
  const snapshot = useSimulation();
  const { filters, alertStates } = useSoc();
  const platform = usePlatformOptional();
  const widgetRefreshInterval = platform?.settings.widgetRefreshInterval ?? 5000;

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
  const scopedIntel = useMemo(() => filterIntelFeed(intel, filters, rows), [intel, filters, rows]);

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

  // ---- Phase 4: AI Intelligence view models (derived from the same snapshot) ----
  const techniques = useLiveData(() => ngfw.mitre.getTechniques(), [], widgetRefreshInterval);
  const honeypotSessions = useLiveData(
    () => ngfw.honeypot.getSessions(12),
    [],
    widgetRefreshInterval,
  );
  const flClients = useLiveData(() => ngfw.federated.getClients(), [], widgetRefreshInterval);
  const flRounds = useLiveData(() => ngfw.federated.getRounds(24), [], widgetRefreshInterval);
  const policyHistory = useLiveData(() => ngfw.policy.getHistory(), [], widgetRefreshInterval);
  const currentPolicy = useLiveData(
    () => ngfw.policy.getCurrentVersion(),
    [],
    widgetRefreshInterval,
  );

  const rlAgent = useMemo(() => deriveRLAgent(snapshot), [snapshot]);
  const flSummary = useMemo(
    () => deriveFlSummary(snapshot, flClients.data ?? [], flRounds.data ?? []),
    [snapshot, flClients.data, flRounds.data],
  );
  const honeypot = useMemo(
    () => deriveHoneypotSummary(snapshot, honeypotSessions.data ?? []),
    [snapshot, honeypotSessions.data],
  );
  const mitre = useMemo(
    () => deriveMitreSummary(snapshot, techniques.data ?? []),
    [snapshot, techniques.data],
  );
  const zeroDay = useMemo(() => deriveZeroDaySummary(snapshot), [snapshot]);
  const policy = useMemo(
    () =>
      derivePolicySummary(
        snapshot,
        currentPolicy.data ?? {
          version: "v4.12.0",
          publishedAt: new Date().toISOString(),
          ruleCount: 1240,
          added: 0,
          removed: 0,
          modified: 0,
          author: "rl-optimizer",
          rolloutPercent: 100,
        },
        policyHistory.data ?? [],
      ),
    [snapshot, currentPolicy.data, policyHistory.data],
  );

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
    rlAgent,
    flSummary,
    honeypot,
    mitre,
    zeroDay,
    policy,
  };
}
