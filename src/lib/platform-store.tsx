import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { ReactNode } from "react";
import { simulationService } from "@/services";
import type { NotificationType, PlatformNotification, PlatformSettings } from "@/types/platform";
import type { SimulationEvent, SimulationSnapshot } from "@/types/simulation";
const SETTINGS_KEY = "ngfw.platform.settings";
const NOTIF_KEY = "ngfw.platform.notifications";

export const DEFAULT_PLATFORM_SETTINGS: PlatformSettings = {
  simulationSpeed: 1,
  autoReplay: false,
  demoModeEnabled: true,
  widgetRefreshInterval: 5000,
  notificationsEnabled: true,
  notificationSound: false,
  themeAccent: "blue",
};

interface PlatformContextValue {
  settings: PlatformSettings;
  updateSettings: (patch: Partial<PlatformSettings>) => void;
  resetSettings: () => void;

  notifications: PlatformNotification[];
  unreadCount: number;
  markRead: (id: string) => void;
  markAllRead: () => void;
  dismissNotification: (id: string) => void;
  clearDismissed: () => void;

  journeyAttackId: string | null;
  journeyStep: number;
  openJourney: (attackId: string, step?: number) => void;
  closeJourney: () => void;
  setJourneyStep: (step: number) => void;

  reportAttackId: string | null;
  openReport: (attackId: string) => void;
  closeReport: () => void;

  commandCenterOpen: boolean;
  setCommandCenterOpen: (open: boolean) => void;
  notificationPanelOpen: boolean;
  setNotificationPanelOpen: (open: boolean) => void;

  demoRunning: boolean;
  setDemoRunning: (running: boolean) => void;
}

const PlatformContext = createContext<PlatformContextValue | null>(null);

function readJSON<T>(key: string, fallback: T): T {
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return fallback;

    const parsed = JSON.parse(raw) as unknown;

    if (Array.isArray(fallback)) {
      return Array.isArray(parsed) ? (parsed as T) : fallback;
    }

    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return { ...fallback, ...(parsed as object) } as T;
    }

    return fallback;
  } catch {
    return fallback;
  }
}

const EVENT_TO_NOTIF: Partial<Record<SimulationEvent["type"], NotificationType>> = {
  attack: "attack-started",
  threat: "threat-detected",
  policy: "policy-updated",
  timeline: "rl-decision",
};

function eventToNotification(event: SimulationEvent): PlatformNotification | null {
  if (event.type === "attack" && "state" in event) {
    if (event.state === "running") {
      return {
        id: event.id,
        type: "attack-started",
        title: event.title,
        description: event.description,
        timestamp: event.timestamp,
        severity: event.severity,
        attackId: event.attackId,
        read: false,
        dismissed: false,
      };
    }
    if (event.state === "blocked" || event.state === "completed") {
      return {
        id: `${event.id}-done`,
        type: "simulation-completed",
        title: event.title,
        description: event.description,
        timestamp: event.timestamp,
        severity: event.severity,
        attackId: event.attackId,
        read: false,
        dismissed: false,
      };
    }
    return null;
  }

  if (event.type === "threat") {
    return {
      id: event.id,
      type: "threat-detected",
      title: event.title,
      description: event.description,
      timestamp: event.timestamp,
      severity: event.severity,
      attackId: event.attackId,
      read: false,
      dismissed: false,
    };
  }

  if (event.type === "policy") {
    return {
      id: event.id,
      type: "policy-updated",
      title: event.title,
      description: event.description,
      timestamp: event.timestamp,
      severity: event.severity,
      attackId: event.attackId,
      read: false,
      dismissed: false,
    };
  }

  if (event.type === "timeline" && event.title.toLowerCase().includes("rl")) {
    return {
      id: event.id,
      type: "rl-decision",
      title: event.title,
      description: event.description,
      timestamp: event.timestamp,
      severity: event.severity,
      attackId: event.attackId,
      read: false,
      dismissed: false,
    };
  }

  if (event.type === "timeline" && event.title.toLowerCase().includes("honeypot")) {
    return {
      id: event.id,
      type: "honeypot-triggered",
      title: event.title,
      description: event.description,
      timestamp: event.timestamp,
      severity: event.severity,
      attackId: event.attackId,
      read: false,
      dismissed: false,
    };
  }

  if (event.type === "timeline" && event.title.toLowerCase().includes("simulation completed")) {
    return {
      id: event.id,
      type: "simulation-completed",
      title: event.title,
      description: event.description,
      timestamp: event.timestamp,
      severity: event.severity,
      read: false,
      dismissed: false,
    };
  }

  return null;
}

/** Bridge simulation snapshot events into the notification center. */
export function useNotificationBridge(
  snapshot: SimulationSnapshot,
  enabled: boolean,
  onNew?: (notification: PlatformNotification) => void,
) {
  const seenRef = useRef(new Set<string>());
  const [notifications, setNotifications] = useState<PlatformNotification[]>([]);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setNotifications(readJSON<PlatformNotification[]>(NOTIF_KEY, []));
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated || !enabled) return;
    const fresh: PlatformNotification[] = [];
    for (const event of snapshot.events.slice(0, 20)) {
      if (seenRef.current.has(event.id)) continue;
      const notif = eventToNotification(event);
      if (notif) {
        seenRef.current.add(event.id);
        fresh.push(notif);
      }
    }
    if (fresh.length) {
      setNotifications((prev) => {
        const merged = [...fresh, ...prev].slice(0, 100);
        return merged;
      });
      fresh.forEach((n) => onNew?.(n));
    }
  }, [snapshot.events, snapshot.tick, enabled, hydrated, onNew]);

  useEffect(() => {
    if (hydrated) window.localStorage.setItem(NOTIF_KEY, JSON.stringify(notifications));
  }, [notifications, hydrated]);

  return { notifications, setNotifications, hydrated };
}

export function PlatformProvider({
  children,
  snapshot,
}: {
  children: ReactNode;
  snapshot: SimulationSnapshot;
}) {
  const [settings, setSettings] = useState<PlatformSettings>(DEFAULT_PLATFORM_SETTINGS);
  const [hydrated, setHydrated] = useState(false);
  const [journeyAttackId, setJourneyAttackId] = useState<string | null>(null);
  const [journeyStep, setJourneyStepState] = useState(0);
  const [reportAttackId, setReportAttackId] = useState<string | null>(null);
  const [commandCenterOpen, setCommandCenterOpen] = useState(true);
  const [notificationPanelOpen, setNotificationPanelOpen] = useState(false);
  const [demoRunning, setDemoRunning] = useState(false);

  const bridge = useNotificationBridge(snapshot, settings.notificationsEnabled);

  useEffect(() => {
    const stored = readJSON(SETTINGS_KEY, DEFAULT_PLATFORM_SETTINGS);
    setSettings(stored);
    simulationService.setSpeed(stored.simulationSpeed);
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (hydrated) window.localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  }, [settings, hydrated]);

  // Auto-replay when simulation completes
  useEffect(() => {
    if (!settings.autoReplay || snapshot.status !== "completed") return;
    const timer = setTimeout(() => simulationService.replay(), 1500);
    return () => clearTimeout(timer);
  }, [snapshot.status, settings.autoReplay]);

  useEffect(() => {
    if (!hydrated) return;
    document.documentElement.dataset.themeAccent = settings.themeAccent;
  }, [settings.themeAccent, hydrated]);

  useEffect(() => {
    if (snapshot.status === "completed" || snapshot.status === "cancelled") {
      setDemoRunning(false);
    }
  }, [snapshot.status]);

  const updateSettings = useCallback((patch: Partial<PlatformSettings>) => {
    setSettings((prev) => {
      const next = { ...prev, ...patch };
      if (patch.simulationSpeed) simulationService.setSpeed(patch.simulationSpeed);
      return next;
    });
  }, []);

  const markRead = useCallback(
    (id: string) => {
      bridge.setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
    },
    [bridge],
  );

  const markAllRead = useCallback(() => {
    bridge.setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  }, [bridge]);

  const dismissNotification = useCallback(
    (id: string) => {
      bridge.setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, dismissed: true, read: true } : n)),
      );
    },
    [bridge],
  );

  const clearDismissed = useCallback(() => {
    bridge.setNotifications((prev) => prev.filter((n) => !n.dismissed));
  }, [bridge]);

  const openJourney = useCallback((attackId: string, step?: number) => {
    setJourneyAttackId(attackId);
    setJourneyStepState(step ?? 0);
  }, []);

  const closeJourney = useCallback(() => {
    setJourneyAttackId(null);
    setJourneyStepState(0);
  }, []);

  const setJourneyStep = useCallback((step: number) => {
    setJourneyStepState(step);
  }, []);

  const value = useMemo<PlatformContextValue>(
    () => ({
      settings,
      updateSettings,
      resetSettings: () => {
        setSettings(DEFAULT_PLATFORM_SETTINGS);
        simulationService.setSpeed(DEFAULT_PLATFORM_SETTINGS.simulationSpeed);
      },
      notifications: bridge.notifications,
      unreadCount: bridge.notifications.filter((n) => !n.read && !n.dismissed).length,
      markRead,
      markAllRead,
      dismissNotification,
      clearDismissed,
      journeyAttackId,
      journeyStep,
      openJourney,
      closeJourney,
      setJourneyStep,
      reportAttackId,
      openReport: setReportAttackId,
      closeReport: () => setReportAttackId(null),
      commandCenterOpen,
      setCommandCenterOpen,
      notificationPanelOpen,
      setNotificationPanelOpen,
      demoRunning,
      setDemoRunning,
    }),
    [
      settings,
      updateSettings,
      bridge.notifications,
      markRead,
      markAllRead,
      dismissNotification,
      clearDismissed,
      journeyAttackId,
      journeyStep,
      openJourney,
      closeJourney,
      setJourneyStep,
      reportAttackId,
      commandCenterOpen,
      notificationPanelOpen,
      demoRunning,
    ],
  );

  return <PlatformContext.Provider value={value}>{children}</PlatformContext.Provider>;
}

export function usePlatform(): PlatformContextValue {
  const ctx = useContext(PlatformContext);
  if (!ctx) throw new Error("usePlatform must be used within a PlatformProvider");
  return ctx;
}

/** Safe hook for components that may render outside PlatformProvider. */
export function usePlatformOptional(): PlatformContextValue | null {
  return useContext(PlatformContext);
}
