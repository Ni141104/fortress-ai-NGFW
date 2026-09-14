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
import { liveSimulationService } from "@/services/live-simulation";
import type { SocAlert, ThreatRow } from "@/types/soc";
import type { AttackKind } from "@/types/simulation";
import { environmentFor, stageLabel } from "@/lib/soc-selectors";

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
  const liveMode = platform?.settings.demoModeEnabled === false;

  const persistedAttacks = useLiveData(
    () => ngfw.threats.getActiveAttacks("blue"),
    [liveMode],
    widgetRefreshInterval,
  );

  // PREVIOUS IMPLEMENTATION — none.
  // Added: in live mode the backend WS room is owner-only so a second browser
  // (e.g. Blue Team) cannot stream Red's attack directly. This poller replays
  // the real /history rows and /dashboard recent_events into the local engine
  // so the live timeline, journey steps and alert centre work for other tabs
  // without fabricating any data.
  useLiveData(
    () => (liveMode ? liveSimulationService.observeBackend() : Promise.resolve(false)),
    [liveMode],
    widgetRefreshInterval,
  );

  const liveRows = useMemo<ThreatRow[]>(
    () =>
      (persistedAttacks.data ?? []).map((attack) => ({
        id: attack.id,
        name: attack.technique,
        kind: (attack.kind ?? "zero-day") as AttackKind,
        state: attack.state ?? "completed",
        stage: attack.stage as ThreatRow["stage"],
        stageLabel: stageLabel(attack.stage as ThreatRow["stage"]),
        severity: attack.severity,
        mitreTechniqueId: attack.techniqueId,
        mitreTactic: "Backend detection",
        confidence: attack.confidence,
        target: attack.targetIp,
        sourceIp: attack.sourceIp,
        environment: environmentFor(attack.targetIp),
        startedAt: attack.startedAt,
        updatedAt: attack.startedAt,
        packetsSent: 0,
        packetsBlocked: attack.state === "blocked" ? 1 : 0,
        // PREVIOUS IMPLEMENTATION — always 100%:
        //   progress: 1,
        // Reason replaced: running live attacks had no progress signal so the
        // grid defaulted to 100% (complete) before the backend finished.
        // Now 100% is reserved for terminal verdicts; running rows stay at 0
        // until the backend reports a final state.
        progress: attack.state === "completed" || attack.state === "blocked" ? 1 : 0,
        verdict: attack.verdict ?? attack.action,
      })),
    [persistedAttacks.data],
  );

  const allRows = useMemo(
    () => (liveMode && persistedAttacks.data ? liveRows : deriveThreatRows(snapshot)),
    [liveMode, liveRows, persistedAttacks.data, snapshot],
  );
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
