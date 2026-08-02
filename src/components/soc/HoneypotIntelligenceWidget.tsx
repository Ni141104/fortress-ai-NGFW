import { useMemo, useState } from "react";
import { Bug, Command, Radar, ShieldAlert, Terminal } from "lucide-react";
import { WidgetCard } from "@/components/layout/WidgetCard";
import {
  ConfidenceBar,
  EmptyState,
  SeverityChip,
  StatusBadge,
  Tag,
  TimelineItem,
} from "@/components/ui/cyber";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import type { HoneypotSummary } from "@/types/ai";
import type { HoneypotSession } from "@/types";

/** Reusable Honeypot intelligence widget with session details drawer. */
export function HoneypotIntelligenceWidget({ summary }: { summary: HoneypotSummary }) {
  const [selectedSession, setSelectedSession] = useState<HoneypotSession | null>(null);

  const threatTone =
    summary.threatScore > 75 ? "pink" : summary.threatScore > 50 ? "amber" : "green";

  return (
    <>
      <WidgetCard
        title="Honeypot Intelligence"
        subtitle={`${summary.activeSessions} sessions · ${summary.capturedPayloads} payloads`}
        icon={<Radar className="h-4 w-4" />}
      >
        <div className="space-y-4">
          {/* Summary stats */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <HpStat
              label="Active"
              value={String(summary.activeSessions)}
              icon={<Radar className="h-3 w-3" />}
              tone="blue"
            />
            <HpStat
              label="Commands"
              value={String(summary.commandsExecuted)}
              icon={<Command className="h-3 w-3" />}
              tone="purple"
            />
            <HpStat
              label="Payloads"
              value={String(summary.capturedPayloads)}
              icon={<Bug className="h-3 w-3" />}
              tone="amber"
            />
            <HpStat
              label="Threat"
              value={summary.threatScore.toFixed(0)}
              icon={<ShieldAlert className="h-3 w-3" />}
              tone={threatTone}
            />
          </div>

          <div>
            <ConfidenceBar
              label="Aggregate threat score"
              value={summary.threatScore / 100}
              tone={threatTone}
            />
          </div>

          {/* Behaviour timeline */}
          <div>
            <h4 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-cyber-blue">
              Behaviour timeline
            </h4>
            {summary.behaviourTimeline.length === 0 ? (
              <EmptyState
                icon={<Radar className="h-6 w-6" />}
                title="No honeypot activity"
                description="Captured sessions appear here as attackers interact with decoys."
              />
            ) : (
              <ul>
                {summary.behaviourTimeline.slice(0, 6).map((event, i, arr) => (
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
          </div>

          {/* Sessions list */}
          <div>
            <h4 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-cyber-blue">
              Sessions
            </h4>
            {summary.sessions.length === 0 ? (
              <p className="text-xs text-muted-foreground">No captured sessions.</p>
            ) : (
              <ul className="max-h-40 space-y-1.5 overflow-y-auto pr-1">
                {summary.sessions.slice(0, 8).map((session) => (
                  <li key={session.id}>
                    <button
                      onClick={() => setSelectedSession(session)}
                      className="flex w-full items-center gap-2 rounded-lg border border-cyber-blue/15 bg-slate-950/40 px-3 py-2 text-left transition-colors hover:border-cyber-blue/40 hover:bg-cyber-blue/5"
                    >
                      <Tag>{session.service}</Tag>
                      <SeverityChip severity={session.severity} size="sm" showIcon={false} />
                      <span className="min-w-0 flex-1 truncate font-mono text-[11px] text-muted-foreground">
                        {session.attackerIp}
                      </span>
                      <span className="font-mono text-[10px] text-muted-foreground">
                        {session.commands.length} cmd
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </WidgetCard>

      {/* Session details drawer */}
      <SessionDetailsDrawer session={selectedSession} onClose={() => setSelectedSession(null)} />
    </>
  );
}

function SessionDetailsDrawer({
  session,
  onClose,
}: {
  session: HoneypotSession | null;
  onClose: () => void;
}) {
  return (
    <Sheet open={Boolean(session)} onOpenChange={(open) => !open && onClose()}>
      <SheetContent
        side="right"
        className="glass-panel w-full overflow-y-auto border-cyber-pink/25 sm:max-w-md"
      >
        {session && (
          <>
            <SheetHeader className="space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <Tag>{session.service}</Tag>
                <SeverityChip severity={session.severity} size="sm" />
                <StatusBadge status="healthy" />
              </div>
              <SheetTitle className="flex items-center gap-2 text-base text-foreground">
                <Terminal className="h-4 w-4 text-cyber-pink" />
                Session {session.id}
              </SheetTitle>
              <SheetDescription className="font-mono text-xs">
                {session.attackerIp} · {session.durationSec}s · {session.payloadsCaptured} payloads
              </SheetDescription>
            </SheetHeader>

            <div className="space-y-5 px-4 pb-8">
              <section>
                <h4 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-cyber-blue">
                  Captured commands
                </h4>
                <div className="rounded-lg border border-cyber-pink/20 bg-slate-950/60 p-3 font-mono text-[11px] leading-relaxed">
                  {session.commands.map((cmd, i) => (
                    <div key={i} className="flex gap-2">
                      <span className="shrink-0 text-cyber-green">$</span>
                      <span className="text-foreground">{cmd}</span>
                    </div>
                  ))}
                </div>
              </section>

              <section>
                <h4 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-cyber-blue">
                  Session details
                </h4>
                <dl className="grid grid-cols-2 gap-3">
                  {[
                    ["Attacker IP", session.attackerIp],
                    ["Service", session.service],
                    ["Started", new Date(session.startedAt).toLocaleString()],
                    ["Duration", `${session.durationSec}s`],
                    ["Commands", String(session.commands.length)],
                    ["Payloads", String(session.payloadsCaptured)],
                  ].map(([label, value]) => (
                    <div
                      key={label}
                      className="rounded-lg border border-cyber-blue/15 bg-slate-950/40 px-3 py-2"
                    >
                      <dt className="text-[10px] uppercase tracking-wider text-muted-foreground">
                        {label}
                      </dt>
                      <dd className="mt-0.5 font-mono text-xs text-foreground">{value}</dd>
                    </div>
                  ))}
                </dl>
              </section>

              <button
                onClick={onClose}
                className="w-full rounded-md border border-cyber-pink/40 bg-cyber-pink/10 px-4 py-2 text-sm font-semibold text-cyber-pink transition-colors hover:bg-cyber-pink/20"
              >
                Close session
              </button>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}

function HpStat({
  label,
  value,
  icon,
  tone,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
  tone: "blue" | "green" | "pink" | "purple" | "amber";
}) {
  const toneClass = {
    blue: "text-cyber-blue",
    green: "text-cyber-green",
    pink: "text-cyber-pink",
    purple: "text-cyber-purple",
    amber: "text-cyber-amber",
  }[tone];
  return (
    <div className="rounded-lg border border-cyber-blue/15 bg-slate-950/40 px-3 py-2">
      <div className={cn("flex items-center gap-1", toneClass)}>
        {icon}
        <span className="text-[10px] uppercase tracking-wider">{label}</span>
      </div>
      <p className={cn("mt-1 font-mono text-sm font-bold", toneClass)}>{value}</p>
    </div>
  );
}
