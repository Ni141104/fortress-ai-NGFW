import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import type { AlertState, SocFilters, WidgetPref } from "@/types/soc";
import type { XaiSubjectKind } from "@/types/ai";

/**
 * Phase 3 SOC UI state: global dashboard filters, per-widget personalization
 * and analyst alert dispositions. Persisted to localStorage; never holds
 * telemetry — that always comes from the simulation engine.
 */

const FILTER_KEY = "ngfw.soc.filters";
const PREF_KEY = "ngfw.soc.widgets";
const ALERT_KEY = "ngfw.soc.alerts";

export const DEFAULT_FILTERS: SocFilters = {
  timeRange: "all",
  severity: "all",
  attackType: "all",
  status: "all",
  environment: "all",
  target: "",
};

export const SOC_WIDGETS: Array<{ id: string; name: string; defaultSpan: 1 | 2 | 3 }> = [
  { id: "overview", name: "Threat Overview", defaultSpan: 3 },
  { id: "monitor", name: "Active Threat Monitor", defaultSpan: 3 },
  { id: "health", name: "Live System Health", defaultSpan: 2 },
  { id: "services", name: "Service Status", defaultSpan: 1 },
  { id: "intel", name: "Threat Intelligence Feed", defaultSpan: 2 },
  { id: "alerts", name: "Alert Center", defaultSpan: 1 },
  { id: "rl", name: "Reinforcement Learning", defaultSpan: 2 },
  { id: "fl", name: "Federated Learning", defaultSpan: 1 },
  { id: "honeypot", name: "Honeypot Intelligence", defaultSpan: 1 },
  { id: "mitre", name: "MITRE ATT&CK", defaultSpan: 1 },
  { id: "zeroday", name: "Zero-Day Intelligence", defaultSpan: 2 },
  { id: "policy", name: "Tier-0 Policy Repository", defaultSpan: 1 },
];

const defaultPrefs = (): WidgetPref[] =>
  SOC_WIDGETS.map((w, i) => ({
    id: w.id,
    visible: true,
    collapsed: false,
    span: w.defaultSpan,
    order: i,
  }));

interface SocContextValue {
  filters: SocFilters;
  setFilter: <K extends keyof SocFilters>(key: K, value: SocFilters[K]) => void;
  resetFilters: () => void;
  activeFilterCount: number;

  prefs: WidgetPref[];
  setPref: (id: string, patch: Partial<WidgetPref>) => void;
  moveWidget: (id: string, direction: -1 | 1) => void;
  resetPrefs: () => void;

  alertStates: Record<string, AlertState>;
  setAlertState: (id: string, state: AlertState) => void;

  selectedIncidentId: string | null;
  openIncident: (id: string) => void;
  closeIncident: () => void;

  searchOpen: boolean;
  setSearchOpen: (open: boolean) => void;

  xaiSubjectId: string | null;
  xaiSubjectKind: XaiSubjectKind;
  openXai: (id: string, kind: XaiSubjectKind) => void;
  closeXai: () => void;
}

const SocContext = createContext<SocContextValue | null>(null);

function readJSON<T>(key: string, fallback: T): T {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? ({ ...fallback, ...(JSON.parse(raw) as T) } as T) : fallback;
  } catch {
    return fallback;
  }
}

export function SocProvider({ children }: { children: ReactNode }) {
  const [filters, setFilters] = useState<SocFilters>(DEFAULT_FILTERS);
  const [prefs, setPrefs] = useState<WidgetPref[]>(defaultPrefs);
  const [alertStates, setAlertStates] = useState<Record<string, AlertState>>({});
  const [selectedIncidentId, setSelectedIncidentId] = useState<string | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [xaiSubjectId, setXaiSubjectId] = useState<string | null>(null);
  const [xaiSubjectKind, setXaiSubjectKind] = useState<XaiSubjectKind>("attack");
  const [hydrated, setHydrated] = useState(false);

  // Hydrate after mount so SSR markup stays stable.
  useEffect(() => {
    setFilters(readJSON(FILTER_KEY, DEFAULT_FILTERS));
    setAlertStates(readJSON<Record<string, AlertState>>(ALERT_KEY, {}));
    try {
      const raw = window.localStorage.getItem(PREF_KEY);
      if (raw) {
        const stored = JSON.parse(raw) as WidgetPref[];
        setPrefs(
          defaultPrefs().map((base) => ({
            ...base,
            ...(stored.find((s) => s.id === base.id) ?? {}),
          })),
        );
      }
    } catch {
      /* keep defaults */
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (hydrated) window.localStorage.setItem(FILTER_KEY, JSON.stringify(filters));
  }, [filters, hydrated]);
  useEffect(() => {
    if (hydrated) window.localStorage.setItem(PREF_KEY, JSON.stringify(prefs));
  }, [prefs, hydrated]);
  useEffect(() => {
    if (hydrated) window.localStorage.setItem(ALERT_KEY, JSON.stringify(alertStates));
  }, [alertStates, hydrated]);

  const setFilter = useCallback(
    <K extends keyof SocFilters>(key: K, value: SocFilters[K]) =>
      setFilters((prev) => ({ ...prev, [key]: value })),
    [],
  );

  const setPref = useCallback(
    (id: string, patch: Partial<WidgetPref>) =>
      setPrefs((prev) => prev.map((p) => (p.id === id ? { ...p, ...patch } : p))),
    [],
  );

  const moveWidget = useCallback((id: string, direction: -1 | 1) => {
    setPrefs((prev) => {
      const sorted = [...prev].sort((a, b) => a.order - b.order);
      const index = sorted.findIndex((p) => p.id === id);
      const swapWith = index + direction;
      if (index < 0 || swapWith < 0 || swapWith >= sorted.length) return prev;
      const next = [...sorted];
      const a = next[index]!;
      const b = next[swapWith]!;
      next[index] = b;
      next[swapWith] = a;
      return next.map((p, i) => ({ ...p, order: i }));
    });
  }, []);

  const value = useMemo<SocContextValue>(
    () => ({
      filters,
      setFilter,
      resetFilters: () => setFilters(DEFAULT_FILTERS),
      activeFilterCount: (Object.keys(DEFAULT_FILTERS) as Array<keyof SocFilters>).filter(
        (k) => filters[k] !== DEFAULT_FILTERS[k],
      ).length,
      prefs,
      setPref,
      moveWidget,
      resetPrefs: () => setPrefs(defaultPrefs()),
      alertStates,
      setAlertState: (id, state) => setAlertStates((prev) => ({ ...prev, [id]: state })),
      selectedIncidentId,
      openIncident: (id) => setSelectedIncidentId(id),
      closeIncident: () => setSelectedIncidentId(null),
      searchOpen,
      setSearchOpen,
      xaiSubjectId,
      xaiSubjectKind,
      openXai: (id, kind) => {
        setXaiSubjectId(id);
        setXaiSubjectKind(kind);
      },
      closeXai: () => setXaiSubjectId(null),
    }),
    [
      filters,
      setFilter,
      prefs,
      setPref,
      moveWidget,
      alertStates,
      selectedIncidentId,
      searchOpen,
      xaiSubjectId,
      xaiSubjectKind,
    ],
  );

  return <SocContext.Provider value={value}>{children}</SocContext.Provider>;
}

export function useSoc(): SocContextValue {
  const ctx = useContext(SocContext);
  if (!ctx) throw new Error("useSoc must be used within a SocProvider");
  return ctx;
}
