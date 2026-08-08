import { useEffect, useMemo } from "react";
import { ChevronLeft, ChevronRight, FileText, SkipForward, Workflow } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { PipelineFlow } from "@/components/simulation/PipelineFlow";
import { LiveTimeline } from "@/components/simulation/LiveTimeline";
import {
  ConfidenceBar,
  SeverityChip,
  StatusBadge,
  Tag,
  TimelineItem,
} from "@/components/ui/cyber";
import {
  describeJourneyStep,
  inferJourneyStep,
  journeyStagesForAttack,
} from "@/lib/journey-stages";
import { usePlatform } from "@/lib/platform-store";
import { cn } from "@/lib/utils";
import type { SimulationSnapshot } from "@/types/simulation";

/** Unified interactive attack journey — step through every pipeline stage. */
export function AttackJourneyViewer({ snapshot }: { snapshot: SimulationSnapshot }) {
  const {
    journeyAttackId,
    journeyStep,
    closeJourney,
    setJourneyStep,
    openReport,
  } = usePlatform();

  const attack = useMemo(
    () => snapshot.queue.find((a) => a.id === journeyAttackId) ?? null,
    [snapshot.queue, journeyAttackId],
  );

  const stages = useMemo(() => journeyStagesForAttack(attack), [attack]);

  const liveStep = useMemo(
    () => (attack ? inferJourneyStep(snapshot, attack, stages) : 0),
    [snapshot, attack, stages],
  );

  // Auto-advance step while attack is running
  useEffect(() => {
    if (!attack || snapshot.status !== "running") return;
    if (liveStep > journeyStep) setJourneyStep(liveStep);
  }, [liveStep, journeyStep, attack, snapshot.status, setJourneyStep]);

  const currentStage = stages[journeyStep];
  const packets = attack
    ? snapshot.packets.filter((p) => p.attackId === attack.id)
    : [];
  const stageEvents = attack
    ? snapshot.events.filter((e) => e.attackId === attack.id).slice(0, 8)
    : [];

  const canPrev = journeyStep > 0;
  const canNext = journeyStep < stages.length - 1;

  return (
    <Sheet open={Boolean(attack)} onOpenChange={(open) => !open && closeJourney()}>
      <SheetContent
        side="right"
        className="glass-panel w-full overflow-y-auto border-cyber-blue/25 sm:max-w-2xl"
      >
        {attack && currentStage && (
          <>
            <SheetHeader className="space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <SeverityChip severity={attack.severity} size="sm" />
                <StatusBadge status={attack.state === "blocked" ? "block" : attack.state} />
                <Tag>{attack.mitreTechniqueId}</Tag>
                <span className="ml-auto font-mono text-[10px] text-muted-foreground">
                  Step {journeyStep + 1} / {stages.length}
                </span>
              </div>
              <SheetTitle className="flex items-center gap-2 text-base text-foreground">
                <Workflow className="h-4 w-4 text-cyber-blue" />
                Attack Journey — {attack.name}
              </SheetTitle>
              <SheetDescription className="font-mono text-xs">
                {attack.id} · {attack.sourceIp} → {attack.config.target}
              </SheetDescription>
            </SheetHeader>

            <div className="space-y-6 px-4 pb-8">
              {/* Stage stepper */}
              <nav aria-label="Attack journey stages">
                <ol className="flex flex-wrap gap-1">
                  {stages.map((stage, i) => {
                    const reached = i <= liveStep;
                    const active = i === journeyStep;
                    return (
                      <li key={stage.id}>
                        <button
                          onClick={() => setJourneyStep(i)}
                          className={cn(
                            "rounded border px-2 py-1 font-mono text-[10px] font-semibold transition-colors",
                            active
                              ? "border-cyber-blue/60 bg-cyber-blue/20 text-cyber-blue"
                              : reached
                                ? "border-cyber-green/40 bg-cyber-green/10 text-cyber-green"
                                : "border-border text-muted-foreground hover:text-foreground",
                          )}
                          title={stage.name}
                        >
                          {stage.short}
                        </button>
                      </li>
                    );
                  })}
                </ol>
              </nav>

              {/* Current stage detail */}
              <section className="rounded-lg border border-cyber-blue/25 bg-slate-950/40 p-4">
                <div className="flex items-start gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-cyber-blue/30 bg-cyber-blue/10 font-mono text-xs font-bold text-cyber-blue">
                    {currentStage.short}
                  </span>
                  <div className="min-w-0 flex-1">
                    <h3 className="text-sm font-semibold text-foreground">{currentStage.name}</h3>
                    <p className="text-[11px] text-muted-foreground">{currentStage.subtitle}</p>
                    <p className="mt-2 text-xs leading-relaxed text-foreground/90">
                      {describeJourneyStep(currentStage, attack, snapshot)}
                    </p>
                    <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">
                      {currentStage.explanation}
                    </p>
                  </div>
                </div>
                <div className="mt-4">
                  <ConfidenceBar
                    label="Detection confidence at this stage"
                    value={attack.confidence}
                  />
                </div>
              </section>

              {/* Navigation controls */}
              <div className="flex flex-wrap items-center gap-2">
                <button
                  disabled={!canPrev}
                  onClick={() => setJourneyStep(journeyStep - 1)}
                  className="inline-flex items-center gap-1 rounded-md border border-cyber-blue/40 bg-cyber-blue/10 px-3 py-1.5 text-xs font-semibold text-cyber-blue transition-colors hover:bg-cyber-blue/20 disabled:opacity-40"
                >
                  <ChevronLeft className="h-3.5 w-3.5" /> Previous
                </button>
                <button
                  disabled={!canNext}
                  onClick={() => setJourneyStep(journeyStep + 1)}
                  className="inline-flex items-center gap-1 rounded-md border border-cyber-blue/40 bg-cyber-blue/10 px-3 py-1.5 text-xs font-semibold text-cyber-blue transition-colors hover:bg-cyber-blue/20 disabled:opacity-40"
                >
                  Next <ChevronRight className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={() => setJourneyStep(Math.min(liveStep, stages.length - 1))}
                  className="inline-flex items-center gap-1 rounded-md border border-cyber-purple/40 bg-cyber-purple/10 px-3 py-1.5 text-xs font-semibold text-cyber-purple transition-colors hover:bg-cyber-purple/20"
                >
                  <SkipForward className="h-3.5 w-3.5" /> Jump to live
                </button>
                <button
                  onClick={() => {
                    openReport(attack.id);
                  }}
                  className="ml-auto inline-flex items-center gap-1 rounded-md border border-cyber-green/40 bg-cyber-green/10 px-3 py-1.5 text-xs font-semibold text-cyber-green transition-colors hover:bg-cyber-green/20"
                >
                  <FileText className="h-3.5 w-3.5" /> Incident Report
                </button>
              </div>

              {/* Mini pipeline for current attack */}
              <section>
                <h4 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-cyber-blue">
                  Live pipeline position
                </h4>
                <PipelineFlow stages={snapshot.stages} packets={packets} />
              </section>

              {/* Stage events */}
              <section>
                <h4 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-cyber-blue">
                  Stage events
                </h4>
                {stageEvents.length === 0 ? (
                  <p className="text-xs text-muted-foreground">
                    No events recorded for this attack yet. Start the simulation to stream events.
                  </p>
                ) : (
                  <LiveTimeline events={stageEvents} limit={8} />
                )}
              </section>

              {/* Full journey timeline */}
              <section>
                <h4 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-cyber-blue">
                  Complete lifecycle
                </h4>
                <ul>
                  {stages.map((stage, i) => (
                    <TimelineItem
                      key={stage.id}
                      title={stage.name}
                      description={
                        i <= journeyStep
                          ? describeJourneyStep(stage, attack, snapshot)
                          : "Pending — advance the simulation to reach this stage"
                      }
                      timestamp={attack.startedAt ?? attack.createdAt}
                      severity={attack.severity}
                      isLast={i === stages.length - 1}
                    />
                  ))}
                </ul>
              </section>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
