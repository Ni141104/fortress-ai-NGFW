import { useMemo } from "react";
import { Ban, ShieldCheck, Workflow } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { ConfidenceBar, SeverityChip, StatusBadge, Tag, TimelineItem } from "@/components/ui/cyber";
import { PipelineFlow } from "@/components/simulation/PipelineFlow";
import { useSoc } from "@/lib/soc-store";
import type { SimulationSnapshot } from "@/types/simulation";
import type { IntelEvent, ThreatRow } from "@/types/soc";

/** Full-context investigation surface for a single attack. */
export function IncidentDrawer({
  rows,
  intel,
  snapshot,
}: {
  rows: ThreatRow[];
  intel: IntelEvent[];
  snapshot: SimulationSnapshot;
}) {
  const { selectedIncidentId, closeIncident } = useSoc();
  const row = rows.find((r) => r.id === selectedIncidentId) ?? null;

  const events = useMemo(
    () => (row ? intel.filter((e) => e.attackId === row.id) : []),
    [intel, row],
  );

  const packets = useMemo(
    () => (row ? snapshot.packets.filter((p) => p.attackId === row.id) : []),
    [snapshot.packets, row],
  );

  const policies = useMemo(
    () =>
      row
        ? snapshot.events.filter((e) => e.type === "policy" && e.attackId === row.id)
        : [],
    [snapshot.events, row],
  );

  return (
    <Sheet open={Boolean(row)} onOpenChange={(open) => !open && closeIncident()}>
      <SheetContent
        side="right"
        className="glass-panel w-full overflow-y-auto border-cyber-blue/25 sm:max-w-xl"
      >
        {row && (
          <>
            <SheetHeader className="space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <SeverityChip severity={row.severity} size="sm" />
                <StatusBadge status={row.state === "blocked" ? "block" : row.state} />
                <Tag>{row.mitreTechniqueId}</Tag>
              </div>
              <SheetTitle className="text-base text-foreground">{row.name}</SheetTitle>
              <SheetDescription className="font-mono text-xs">
                {row.id} · {row.sourceIp} → {row.target} · {row.environment}
              </SheetDescription>
            </SheetHeader>

            <div className="space-y-6 px-4 pb-8">
              <section>
                <h4 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-cyber-blue">
                  Attack details
                </h4>
                <dl className="grid grid-cols-2 gap-3">
                  {[
                    ["Kind", row.kind],
                    ["Tactic", row.mitreTactic],
                    ["Stage", row.stageLabel],
                    ["Verdict", row.verdict],
                    ["Started", new Date(row.startedAt).toLocaleString()],
                    ["Updated", new Date(row.updatedAt).toLocaleTimeString()],
                    ["Packets sent", row.packetsSent.toLocaleString()],
                    ["Packets blocked", row.packetsBlocked.toLocaleString()],
                  ].map(([label, value]) => (
                    <div key={label}>
                      <dt className="text-[10px] uppercase tracking-wider text-muted-foreground">
                        {label}
                      </dt>
                      <dd className="font-mono text-xs text-foreground">{value}</dd>
                    </div>
                  ))}
                </dl>
                <div className="mt-3">
                  <ConfidenceBar label="Detection confidence" value={row.confidence} showPercentage />
                </div>
              </section>

              <section>
                <h4 className="mb-2 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-cyber-blue">
                  <Workflow className="h-3.5 w-3.5" /> Detection path
                </h4>
                <PipelineFlow stages={snapshot.stages} packets={packets} />
              </section>

              <section>
                <h4 className="mb-2 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-cyber-blue">
                  <ShieldCheck className="h-3.5 w-3.5" /> Applied policies
                </h4>
                {policies.length === 0 ? (
                  <p className="text-xs text-muted-foreground">
                    No enforcement rule has been installed for this incident yet.
                  </p>
                ) : (
                  <ul className="space-y-2">
                    {policies.map((p) => (
                      <li
                        key={p.id}
                        className="rounded-lg border border-cyber-blue/15 bg-slate-950/40 px-3 py-2"
                      >
                        <div className="flex items-center gap-2">
                          <Ban className="h-3.5 w-3.5 text-cyber-pink" />
                          <span className="font-mono text-[11px] text-foreground">
                            {"rule" in p ? p.rule : p.title}
                          </span>
                        </div>
                        <p className="mt-1 text-[11px] text-muted-foreground">{p.description}</p>
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              <section>
                <h4 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-cyber-blue">
                  Incident timeline
                </h4>
                {events.length === 0 ? (
                  <p className="text-xs text-muted-foreground">No events recorded yet.</p>
                ) : (
                  <ul>
                    {events.map((event, i, arr) => (
                      <TimelineItem
                        key={event.id}
                        title={event.title}
                        description={event.description}
                        timestamp={event.timestamp}
                        severity={event.severity}
                        isLast={i === arr.length - 1}
                      />
                    ))}
                  </ul>
                )}
              </section>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}