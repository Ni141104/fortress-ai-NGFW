import { useMemo } from "react";
import {
  Ban,
  Brain,
  GitBranch,
  Lightbulb,
  Network,
  ShieldAlert,
  ShieldCheck,
  Workflow,
} from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { ConfidenceBar, SeverityChip, StatusBadge, Tag } from "@/components/ui/cyber";
import { PipelineFlow } from "@/components/simulation/PipelineFlow";
import { deriveXaiExplanation } from "@/lib/ai-selectors";
import { useSoc } from "@/lib/soc-store";
import type { RLAction } from "@/types";
import type { SimulationSnapshot } from "@/types/simulation";

const ACTION_TONE: Record<RLAction, string> = {
  allow: "allow",
  block: "block",
  quarantine: "quarantine",
  redirect: "redirect",
};

const DETAIL_ROW =
  "flex items-start gap-3 rounded-lg border border-cyber-blue/15 bg-slate-950/40 px-3 py-2.5";
const DETAIL_LABEL = "text-[10px] uppercase tracking-wider text-muted-foreground";
const DETAIL_VALUE = "mt-0.5 text-xs text-foreground";

/**
 * Shared Explainable AI drawer.
 *
 * Opens whenever any attack, policy or threat is selected for explanation.
 * Reuses the existing Sheet + PipelineFlow + cyber design kit — no new
 * primitives. Every value is derived from the simulation snapshot, so a
 * FastAPI backend drops in without UI changes.
 */
export function ExplainableAiDrawer({ snapshot }: { snapshot: SimulationSnapshot }) {
  const { xaiSubjectId, xaiSubjectKind, closeXai } = useSoc();

  const explanation = useMemo(
    () => (xaiSubjectId ? deriveXaiExplanation(xaiSubjectId, xaiSubjectKind, snapshot) : null),
    [xaiSubjectId, xaiSubjectKind, snapshot],
  );

  const packets = useMemo(
    () =>
      explanation?.subjectId
        ? snapshot.packets.filter((p) => p.attackId === explanation.subjectId)
        : [],
    [snapshot.packets, explanation?.subjectId],
  );

  return (
    <Sheet open={Boolean(explanation)} onOpenChange={(open) => !open && closeXai()}>
      <SheetContent
        side="right"
        className="glass-panel w-full overflow-y-auto border-cyber-purple/25 sm:max-w-lg"
      >
        {explanation && (
          <>
            <SheetHeader className="space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <SeverityChip severity={explanation.severity} size="sm" />
                <StatusBadge status={ACTION_TONE[explanation.rlDecision]} />
                <Tag>{explanation.subjectKind.toUpperCase()}</Tag>
              </div>
              <SheetTitle className="flex items-center gap-2 text-base text-foreground">
                <Brain className="h-4 w-4 text-cyber-purple" />
                {explanation.title}
              </SheetTitle>
              <SheetDescription className="font-mono text-xs">
                {explanation.subtitle}
              </SheetDescription>
            </SheetHeader>

            <div className="space-y-6 px-4 pb-8">
              {/* Why detected / why blocked */}
              <section>
                <h4 className="mb-2 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-cyber-purple">
                  <ShieldAlert className="h-3.5 w-3.5" /> Detection rationale
                </h4>
                <div className="space-y-2">
                  <div className={DETAIL_ROW}>
                    <Lightbulb className="mt-0.5 h-3.5 w-3.5 shrink-0 text-cyber-amber" />
                    <div className="min-w-0">
                      <p className={DETAIL_LABEL}>Why detected</p>
                      <p className={DETAIL_VALUE}>{explanation.whyDetected}</p>
                    </div>
                  </div>
                  <div className={DETAIL_ROW}>
                    <Ban className="mt-0.5 h-3.5 w-3.5 shrink-0 text-cyber-pink" />
                    <div className="min-w-0">
                      <p className={DETAIL_LABEL}>Why blocked</p>
                      <p className={DETAIL_VALUE}>{explanation.whyBlocked}</p>
                    </div>
                  </div>
                </div>
              </section>

              {/* Model scores */}
              <section>
                <h4 className="mb-2 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-cyber-purple">
                  <Brain className="h-3.5 w-3.5" /> Model scores
                </h4>
                <div className="space-y-3 rounded-lg border border-cyber-blue/15 bg-slate-950/40 px-3 py-3">
                  <ConfidenceBar
                    label="Isolation Forest score"
                    value={explanation.isolationForestScore}
                    tone="purple"
                  />
                  <ConfidenceBar
                    label="XGBoost confidence"
                    value={explanation.xgboostConfidence}
                    tone="blue"
                  />
                  <ConfidenceBar
                    label="Overall confidence"
                    value={explanation.confidence}
                    tone="green"
                  />
                </div>
              </section>

              {/* Mapping + decision */}
              <section>
                <h4 className="mb-2 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-cyber-purple">
                  <Network className="h-3.5 w-3.5" /> Mapping & decision
                </h4>
                <dl className="grid grid-cols-2 gap-3">
                  <div className={DETAIL_ROW}>
                    <Network className="mt-0.5 h-3.5 w-3.5 shrink-0 text-cyber-amber" />
                    <div className="min-w-0">
                      <dt className={DETAIL_LABEL}>MITRE mapping</dt>
                      <dd className={DETAIL_VALUE}>{explanation.mitreMapping}</dd>
                    </div>
                  </div>
                  <div className={DETAIL_ROW}>
                    <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-cyber-green" />
                    <div className="min-w-0">
                      <dt className={DETAIL_LABEL}>RL decision</dt>
                      <dd className={DETAIL_VALUE}>
                        <StatusBadge status={ACTION_TONE[explanation.rlDecision]} />
                      </dd>
                    </div>
                  </div>
                  <div className={DETAIL_ROW}>
                    <GitBranch className="mt-0.5 h-3.5 w-3.5 shrink-0 text-cyber-blue" />
                    <div className="min-w-0">
                      <dt className={DETAIL_LABEL}>Policy version</dt>
                      <dd className={`font-mono ${DETAIL_VALUE}`}>{explanation.policyVersion}</dd>
                    </div>
                  </div>
                  <div className={DETAIL_ROW}>
                    <Lightbulb className="mt-0.5 h-3.5 w-3.5 shrink-0 text-cyber-amber" />
                    <div className="min-w-0">
                      <dt className={DETAIL_LABEL}>Recommended action</dt>
                      <dd className={DETAIL_VALUE}>{explanation.recommendedAction}</dd>
                    </div>
                  </div>
                </dl>
              </section>

              {/* Pipeline path */}
              <section>
                <h4 className="mb-2 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-cyber-purple">
                  <Workflow className="h-3.5 w-3.5" /> Detection path
                </h4>
                <PipelineFlow stages={snapshot.stages} packets={packets} />
              </section>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
