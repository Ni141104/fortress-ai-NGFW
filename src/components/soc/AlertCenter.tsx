import { useMemo, useState } from "react";
import { BellOff, BellRing, Check, CheckCheck, ExternalLink, X } from "lucide-react";
import { EmptyState, SeverityChip, StatusBadge } from "@/components/ui/cyber";
import { cn } from "@/lib/utils";
import { useSoc } from "@/lib/soc-store";
import type { AlertState, SocAlert } from "@/types/soc";

type Bucket = "critical" | "high" | "medium" | "low" | "acknowledged" | "resolved" | "muted";

const BUCKETS: Bucket[] = [
  "critical",
  "high",
  "medium",
  "low",
  "acknowledged",
  "resolved",
  "muted",
];

const actionClass =
  "inline-flex items-center gap-1 rounded border border-cyber-blue/30 px-1.5 py-0.5 text-[10px] font-semibold text-cyber-blue transition-colors hover:bg-cyber-blue/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyber-blue/60";

/** Analyst alert queue with acknowledge / resolve / mute / dismiss dispositions. */
export function AlertCenter({ alerts }: { alerts: SocAlert[] }) {
  const { setAlertState, openIncident } = useSoc();
  const [bucket, setBucket] = useState<Bucket>("critical");

  const live = useMemo(() => alerts.filter((a) => a.state !== "dismissed"), [alerts]);

  const counts = useMemo(() => {
    const c: Record<Bucket, number> = {
      critical: 0,
      high: 0,
      medium: 0,
      low: 0,
      acknowledged: 0,
      resolved: 0,
      muted: 0,
    };
    live.forEach((a) => {
      if (a.state === "open") c[a.severity] += 1;
      else if (a.state !== "dismissed") c[a.state as Bucket] += 1;
    });
    return c;
  }, [live]);

  const visible = useMemo(
    () =>
      live.filter((a) =>
        bucket === "acknowledged" || bucket === "resolved" || bucket === "muted"
          ? a.state === bucket
          : a.state === "open" && a.severity === bucket,
      ),
    [live, bucket],
  );

  const dispose = (id: string, state: AlertState) => setAlertState(id, state);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-1">
        {BUCKETS.map((b) => (
          <button
            key={b}
            onClick={() => setBucket(b)}
            className={cn(
              "rounded px-2 py-1 text-[11px] font-semibold capitalize transition-colors",
              bucket === b
                ? "bg-cyber-blue/20 text-cyber-blue"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {b}
            <span className="ml-1 font-mono text-[10px] opacity-70">{counts[b]}</span>
          </button>
        ))}
      </div>

      {visible.length === 0 ? (
        <EmptyState
          icon={<BellRing className="h-6 w-6" />}
          title={`No ${bucket} alerts`}
          description="Alerts are raised automatically from the live detection stream."
        />
      ) : (
        <ul className="max-h-[26rem] space-y-2 overflow-y-auto pr-1">
          {visible.map((alert) => (
            <li
              key={alert.id}
              className="rounded-lg border border-cyber-blue/15 bg-slate-950/40 px-3 py-2.5"
            >
              <div className="flex flex-wrap items-center gap-2">
                <SeverityChip severity={alert.severity} size="sm" />
                <StatusBadge status={alert.state === "open" ? "warning" : alert.state} />
                <time className="ml-auto font-mono text-[10px] text-muted-foreground">
                  {new Date(alert.timestamp).toLocaleTimeString()}
                </time>
              </div>
              <p className="mt-1.5 text-xs font-medium text-foreground">{alert.title}</p>
              <p className="mt-0.5 text-[11px] text-muted-foreground">{alert.description}</p>
              <p className="mt-1 font-mono text-[10px] text-muted-foreground">{alert.source}</p>

              <div className="mt-2 flex flex-wrap gap-1.5">
                {alert.attackId && (
                  <button className={actionClass} onClick={() => openIncident(alert.attackId!)}>
                    <ExternalLink className="h-3 w-3" /> Open
                  </button>
                )}
                <button className={actionClass} onClick={() => dispose(alert.id, "acknowledged")}>
                  <Check className="h-3 w-3" /> Acknowledge
                </button>
                <button
                  className={cn(actionClass, "border-cyber-green/40 text-cyber-green hover:bg-cyber-green/10")}
                  onClick={() => dispose(alert.id, "resolved")}
                >
                  <CheckCheck className="h-3 w-3" /> Resolve
                </button>
                <button
                  className={cn(actionClass, "border-cyber-amber/40 text-cyber-amber hover:bg-cyber-amber/10")}
                  onClick={() => dispose(alert.id, "muted")}
                >
                  <BellOff className="h-3 w-3" /> Mute
                </button>
                <button
                  className={cn(actionClass, "border-border text-muted-foreground hover:bg-white/5")}
                  onClick={() => dispose(alert.id, "dismissed")}
                >
                  <X className="h-3 w-3" /> Dismiss
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}