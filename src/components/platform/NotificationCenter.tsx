import { useMemo, useState } from "react";
import { Bell, BellOff, BellRing, CheckCheck, Shield, Swords, Workflow, X } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { EmptyState, SeverityChip, Tag } from "@/components/ui/cyber";
import { usePlatform } from "@/lib/platform-store";
import { cn } from "@/lib/utils";
import type { NotificationType } from "@/types/platform";

const FILTERS: Array<{ id: NotificationType | "all"; label: string }> = [
  { id: "all", label: "All" },
  { id: "attack-started", label: "Attack Started" },
  { id: "threat-detected", label: "Threat Detected" },
  { id: "policy-updated", label: "Policy Updated" },
  { id: "rl-decision", label: "RL Decision" },
  { id: "honeypot-triggered", label: "Honeypot" },
  { id: "simulation-completed", label: "Completed" },
];

const typeIcon: Record<NotificationType, typeof Bell> = {
  "attack-started": Swords,
  "threat-detected": Shield,
  "policy-updated": Workflow,
  "rl-decision": Workflow,
  "honeypot-triggered": BellRing,
  "simulation-completed": CheckCheck,
};

/** Enterprise notification center — derived from simulation engine events. */
export function NotificationCenter() {
  const {
    notifications,
    unreadCount,
    notificationPanelOpen,
    setNotificationPanelOpen,
    markRead,
    markAllRead,
    dismissNotification,
    clearDismissed,
    openJourney,
  } = usePlatform();

  const [filter, setFilter] = useState<NotificationType | "all">("all");
  const [readFilter, setReadFilter] = useState<"all" | "read" | "unread">("all");
  const [showDismissed, setShowDismissed] = useState(false);

  const visible = useMemo(() => {
    return notifications.filter((n) => {
      if (!showDismissed && n.dismissed) return false;
      if (filter !== "all" && n.type !== filter) return false;
      if (readFilter === "read" && !n.read) return false;
      if (readFilter === "unread" && (n.read || n.dismissed)) return false;
      return true;
    });
  }, [notifications, filter, readFilter, showDismissed]);

  return (
    <Sheet open={notificationPanelOpen} onOpenChange={setNotificationPanelOpen}>
      <SheetContent
        side="right"
        className="glass-panel w-full overflow-y-auto border-cyber-blue/25 sm:max-w-md"
      >
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2 text-base">
            <Bell className="h-4 w-4 text-cyber-blue" />
            Notification Center
            {unreadCount > 0 && <Tag>{unreadCount} unread</Tag>}
          </SheetTitle>
          <SheetDescription>
            Real-time alerts from the simulation engine — attacks, detections, policy changes and RL
            decisions.
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-3 px-4 pb-8">
          <div className="flex flex-wrap gap-1">
            {FILTERS.map((f) => (
              <button
                key={f.id}
                onClick={() => setFilter(f.id)}
                className={cn(
                  "rounded px-2 py-1 text-[10px] font-semibold transition-colors",
                  filter === f.id
                    ? "bg-cyber-blue/20 text-cyber-blue"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {f.label}
              </button>
            ))}
          </div>

          <div className="flex flex-wrap gap-1">
            {(["all", "unread", "read"] as const).map((state) => (
              <button
                key={state}
                onClick={() => setReadFilter(state)}
                className={cn(
                  "rounded px-2 py-1 text-[10px] font-semibold uppercase tracking-wider transition-colors",
                  readFilter === state
                    ? "bg-cyber-green/20 text-cyber-green"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {state}
              </button>
            ))}
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              onClick={markAllRead}
              className="rounded border border-cyber-blue/30 px-2 py-1 text-[10px] font-semibold text-cyber-blue hover:bg-cyber-blue/10"
            >
              Mark all read
            </button>
            <button
              onClick={() => setShowDismissed((v) => !v)}
              className="rounded border border-border px-2 py-1 text-[10px] font-semibold text-muted-foreground hover:text-foreground"
            >
              {showDismissed ? "Hide dismissed" : "Show dismissed"}
            </button>
            <button
              onClick={clearDismissed}
              className="rounded border border-border px-2 py-1 text-[10px] font-semibold text-muted-foreground hover:text-foreground"
            >
              Clear dismissed
            </button>
          </div>

          {visible.length === 0 ? (
            <EmptyState
              icon={<BellOff className="h-6 w-6" />}
              title="No notifications"
              description="Start a simulation or launch Demo Mode to receive engine-driven alerts."
            />
          ) : (
            <ul className="max-h-[32rem] space-y-2 overflow-y-auto pr-1">
              {visible.map((notif) => {
                const Icon = typeIcon[notif.type];
                return (
                  <li
                    key={notif.id}
                    className={cn(
                      "rounded-lg border px-3 py-2.5 transition-colors",
                      notif.read
                        ? "border-border/60 bg-slate-950/20 opacity-75"
                        : "border-cyber-blue/25 bg-slate-950/50",
                      notif.dismissed && "opacity-50",
                    )}
                  >
                    <div className="flex items-start gap-2">
                      <Icon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-cyber-blue" />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <SeverityChip severity={notif.severity} size="sm" showIcon={false} />
                          {!notif.read && (
                            <span className="h-1.5 w-1.5 rounded-full bg-cyber-pink" />
                          )}
                          <time className="ml-auto font-mono text-[10px] text-muted-foreground">
                            {new Date(notif.timestamp).toLocaleTimeString()}
                          </time>
                        </div>
                        <p className="mt-1 text-xs font-medium text-foreground">{notif.title}</p>
                        <p className="mt-0.5 text-[11px] text-muted-foreground">
                          {notif.description}
                        </p>
                        <div className="mt-2 flex flex-wrap gap-1">
                          {!notif.read && (
                            <button
                              onClick={() => markRead(notif.id)}
                              className="rounded border border-cyber-blue/30 px-1.5 py-0.5 text-[10px] font-semibold text-cyber-blue hover:bg-cyber-blue/10"
                            >
                              Mark read
                            </button>
                          )}
                          {notif.attackId && (
                            <button
                              onClick={() => {
                                openJourney(notif.attackId!);
                                markRead(notif.id);
                                setNotificationPanelOpen(false);
                              }}
                              className="rounded border border-cyber-purple/30 px-1.5 py-0.5 text-[10px] font-semibold text-cyber-purple hover:bg-cyber-purple/10"
                            >
                              View journey
                            </button>
                          )}
                          <button
                            onClick={() => dismissNotification(notif.id)}
                            className="rounded border border-border px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground hover:bg-white/5"
                          >
                            <X className="inline h-3 w-3" /> Dismiss
                          </button>
                        </div>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

/** Bell icon trigger for the nav bar. */
export function NotificationBell() {
  const { unreadCount, setNotificationPanelOpen } = usePlatform();

  return (
    <button
      onClick={() => setNotificationPanelOpen(true)}
      className="relative rounded-md border border-cyber-blue/30 p-2 text-cyber-blue transition-colors hover:bg-cyber-blue/10"
      aria-label={`Notifications${unreadCount ? `, ${unreadCount} unread` : ""}`}
    >
      <Bell className="h-4 w-4" />
      {unreadCount > 0 && (
        <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-cyber-pink text-[9px] font-bold text-white">
          {unreadCount > 9 ? "9+" : unreadCount}
        </span>
      )}
    </button>
  );
}
