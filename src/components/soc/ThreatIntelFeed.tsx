import { useMemo, useState } from "react";
import { Rss } from "lucide-react";
import { ConfidenceBar, EmptyState, SeverityChip, Tag } from "@/components/ui/cyber";
import { cn } from "@/lib/utils";
import { useSoc } from "@/lib/soc-store";
import { usePlatform } from "@/lib/platform-store";
import type { IntelCategory, IntelEvent } from "@/types/soc";

const CATEGORIES: Array<IntelCategory | "All"> = [
  "All",
  "New Threat",
  "Policy Updated",
  "Unknown Behaviour",
  "Firewall Triggered",
  "Isolation Forest",
  "XGBoost Classified",
  "MITRE Mapped",
  "RL Decision",
];

const categoryTone: Record<string, string> = {
  "New Threat": "border-cyber-pink/40 bg-cyber-pink/10 text-cyber-pink",
  "Policy Updated": "border-cyber-green/40 bg-cyber-green/10 text-cyber-green",
  "Unknown Behaviour": "border-cyber-amber/40 bg-cyber-amber/10 text-cyber-amber",
  "Firewall Triggered": "border-cyber-blue/40 bg-cyber-blue/10 text-cyber-blue",
  "Isolation Forest": "border-cyber-purple/40 bg-cyber-purple/10 text-cyber-purple",
  "XGBoost Classified": "border-cyber-purple/40 bg-cyber-purple/10 text-cyber-purple",
  "MITRE Mapped": "border-cyber-amber/40 bg-cyber-amber/10 text-cyber-amber",
  "RL Decision": "border-cyber-green/40 bg-cyber-green/10 text-cyber-green",
};

/** Continuously updating intelligence stream, straight off the event bus. */
export function ThreatIntelFeed({ events, limit = 60 }: { events: IntelEvent[]; limit?: number }) {
  const { openIncident } = useSoc();
  const { openJourney } = usePlatform();
  const [category, setCategory] = useState<IntelCategory | "All">("All");

  const visible = useMemo(
    () =>
      (category === "All" ? events : events.filter((e) => e.category === category)).slice(0, limit),
    [events, category, limit],
  );

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-1">
        {CATEGORIES.map((c) => (
          <button
            key={c}
            onClick={() => setCategory(c)}
            className={cn(
              "rounded px-2 py-1 text-[11px] font-medium transition-colors",
              category === c
                ? "bg-cyber-blue/20 text-cyber-blue"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {c}
          </button>
        ))}
      </div>

      {visible.length === 0 ? (
        <EmptyState
          icon={<Rss className="h-6 w-6" />}
          title="Intelligence feed is quiet"
          description="Events appear here as soon as the simulation engine publishes them."
        />
      ) : (
        <ul className="max-h-[26rem] space-y-2 overflow-y-auto pr-1">
          {visible.map((event) => (
            <li key={event.id}>
              <button
                onClick={() => event.attackId && openJourney(event.attackId)}
                disabled={!event.attackId}
                className={cn(
                  "w-full rounded-lg border border-cyber-blue/15 bg-slate-950/40 px-3 py-2.5 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyber-blue/60",
                  event.attackId ? "hover:border-cyber-blue/40 hover:bg-cyber-blue/5" : "cursor-default",
                )}
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={cn(
                      "rounded border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
                      categoryTone[event.category] ?? "border-border bg-muted/40 text-muted-foreground",
                    )}
                  >
                    {event.category}
                  </span>
                  <SeverityChip severity={event.severity} size="sm" showIcon={false} />
                  <time className="ml-auto font-mono text-[10px] text-muted-foreground">
                    {new Date(event.timestamp).toLocaleTimeString()}
                  </time>
                </div>
                <p className="mt-1.5 text-xs font-medium text-foreground">{event.title}</p>
                <p className="mt-0.5 text-[11px] text-muted-foreground">{event.description}</p>
                <div className="mt-2 flex items-center gap-3">
                  <Tag>{event.source}</Tag>
                  <div className="w-28">
                    <ConfidenceBar value={event.confidence} tone="purple" />
                  </div>
                </div>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}