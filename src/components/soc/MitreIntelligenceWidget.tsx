import { useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Crosshair, Flag, GitBranch, Target } from "lucide-react";
import { WidgetCard } from "@/components/layout/WidgetCard";
import { ConfidenceBar, EmptyState, SeverityChip, Tag } from "@/components/ui/cyber";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { useSoc } from "@/lib/soc-store";
import { cn } from "@/lib/utils";
import type { MITRETechnique } from "@/types";
import type { MitreKillChainStep, MitreSummary, MitreTacticSummary } from "@/types/ai";

const TACTIC_COLOR = "var(--cyber-amber)";

/** Reusable MITRE ATT&CK intelligence widget. */
export function MitreIntelligenceWidget({ summary }: { summary: MitreSummary }) {
  const { openXai } = useSoc();
  const [selectedTechnique, setSelectedTechnique] = useState<MITRETechnique | null>(null);
  const [tab, setTab] = useState<"matrix" | "tactics" | "killchain">("matrix");

  return (
    <>
      <WidgetCard
        title="MITRE ATT&CK"
        subtitle={`${summary.totalDetections} detections · ${summary.techniques.length} techniques`}
        icon={<Crosshair className="h-4 w-4" />}
      >
        <div className="space-y-4">
          {/* Summary stats */}
          <div className="grid grid-cols-3 gap-3">
            <MitStat
              label="Techniques"
              value={String(summary.techniques.length)}
              icon={<Target className="h-3 w-3" />}
              tone="amber"
            />
            <MitStat
              label="Tactics"
              value={String(summary.tacticDistribution.length)}
              icon={<Flag className="h-3 w-3" />}
              tone="blue"
            />
            <MitStat
              label="Detections"
              value={String(summary.totalDetections)}
              icon={<Crosshair className="h-3 w-3" />}
              tone="pink"
            />
          </div>

          {/* Tabs */}
          <div className="flex flex-wrap gap-1">
            {(
              [
                ["matrix", "Top Techniques"],
                ["tactics", "Tactic Distribution"],
                ["killchain", "Kill Chain"],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                onClick={() => setTab(id)}
                className={cn(
                  "rounded px-2 py-1 text-[11px] font-semibold transition-colors",
                  tab === id
                    ? "bg-cyber-amber/20 text-cyber-amber"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {label}
              </button>
            ))}
          </div>

          {/* Top techniques */}
          {tab === "matrix" && (
            <div className="space-y-2">
              {summary.topTechniques.length === 0 ? (
                <EmptyState
                  icon={<Crosshair className="h-6 w-6" />}
                  title="No MITRE mappings yet"
                  description="Techniques appear as the simulation engine classifies threats."
                />
              ) : (
                summary.topTechniques.map((tech) => (
                  <button
                    key={tech.id}
                    onClick={() => setSelectedTechnique(tech)}
                    className="flex w-full items-center gap-2 rounded-lg border border-cyber-amber/15 bg-slate-950/40 px-3 py-2 text-left transition-colors hover:border-cyber-amber/40 hover:bg-cyber-amber/5"
                  >
                    <Tag>{tech.id}</Tag>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-medium text-foreground">{tech.name}</p>
                      <p className="truncate text-[10px] text-muted-foreground">{tech.tactic}</p>
                    </div>
                    <span className="font-mono text-[11px] text-cyber-amber">{tech.count}</span>
                  </button>
                ))
              )}
            </div>
          )}

          {/* Tactic distribution chart */}
          {tab === "tactics" && (
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={summary.tacticDistribution}
                  layout="vertical"
                  margin={{ top: 4, right: 4, left: 8, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,243,255,0.08)" />
                  <XAxis
                    type="number"
                    tick={{ fill: "var(--muted-foreground)", fontSize: 10 }}
                    tickLine={false}
                  />
                  <YAxis
                    type="category"
                    dataKey="tactic"
                    tick={{ fill: "var(--muted-foreground)", fontSize: 9 }}
                    tickLine={false}
                    width={90}
                  />
                  <Tooltip
                    contentStyle={{
                      background: "rgba(10,14,39,0.95)",
                      border: "1px solid rgba(251,191,36,0.3)",
                      borderRadius: 8,
                      fontSize: 11,
                    }}
                  />
                  <Bar dataKey="count" radius={[0, 4, 4, 0]} fill={TACTIC_COLOR} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Kill chain progress */}
          {tab === "killchain" && (
            <ol className="space-y-1.5">
              {summary.killChain.map((step, i) => (
                <KillChainRow key={step.phase} step={step} index={i} />
              ))}
            </ol>
          )}
        </div>
      </WidgetCard>

      {/* Technique details drawer */}
      <TechniqueDetailsDrawer
        technique={selectedTechnique}
        onClose={() => setSelectedTechnique(null)}
        onExplain={(id) => {
          setSelectedTechnique(null);
          openXai(id, "threat");
        }}
      />
    </>
  );
}

function KillChainRow({ step, index }: { step: MitreKillChainStep; index: number }) {
  return (
    <li className="flex items-center gap-3">
      <span
        className={cn(
          "flex h-7 w-7 shrink-0 items-center justify-center rounded-full border font-mono text-[10px] font-bold",
          step.reached
            ? "border-cyber-amber/50 bg-cyber-amber/10 text-cyber-amber"
            : "border-border bg-slate-950/40 text-muted-foreground",
        )}
      >
        {index + 1}
      </span>
      <div className="min-w-0 flex-1">
        <p
          className={cn(
            "truncate text-xs",
            step.reached ? "font-medium text-foreground" : "text-muted-foreground",
          )}
        >
          {step.phase}
        </p>
      </div>
      {step.reached ? (
        <span className="font-mono text-[10px] text-cyber-amber">
          {step.techniqueCount} technique{step.techniqueCount !== 1 ? "s" : ""}
        </span>
      ) : (
        <span className="font-mono text-[10px] text-muted-foreground">not reached</span>
      )}
    </li>
  );
}

function TechniqueDetailsDrawer({
  technique,
  onClose,
  onExplain,
}: {
  technique: MITRETechnique | null;
  onClose: () => void;
  onExplain: (id: string) => void;
}) {
  return (
    <Sheet open={Boolean(technique)} onOpenChange={(open) => !open && onClose()}>
      <SheetContent
        side="right"
        className="glass-panel w-full overflow-y-auto border-cyber-amber/25 sm:max-w-md"
      >
        {technique && (
          <>
            <SheetHeader className="space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <Tag>{technique.id}</Tag>
                <SeverityChip
                  severity={
                    technique.severity > 0.75
                      ? "critical"
                      : technique.severity > 0.5
                        ? "high"
                        : technique.severity > 0.25
                          ? "medium"
                          : "low"
                  }
                  size="sm"
                  showIcon={false}
                />
              </div>
              <SheetTitle className="text-base text-foreground">{technique.name}</SheetTitle>
              <SheetDescription className="font-mono text-xs">
                {technique.tactic} · {technique.count} detections
              </SheetDescription>
            </SheetHeader>

            <div className="space-y-5 px-4 pb-8">
              <section>
                <h4 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-cyber-amber">
                  Description
                </h4>
                <p className="text-xs leading-relaxed text-muted-foreground">
                  {technique.description}
                </p>
              </section>

              <section>
                <h4 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-cyber-amber">
                  Detection metrics
                </h4>
                <dl className="grid grid-cols-2 gap-3">
                  <div className="rounded-lg border border-cyber-amber/15 bg-slate-950/40 px-3 py-2">
                    <dt className="text-[10px] uppercase tracking-wider text-muted-foreground">
                      Detections
                    </dt>
                    <dd className="mt-0.5 font-mono text-sm font-bold text-cyber-amber">
                      {technique.count}
                    </dd>
                  </div>
                  <div className="rounded-lg border border-cyber-amber/15 bg-slate-950/40 px-3 py-2">
                    <dt className="text-[10px] uppercase tracking-wider text-muted-foreground">
                      Severity
                    </dt>
                    <dd className="mt-0.5 font-mono text-sm font-bold text-cyber-pink">
                      {(technique.severity * 100).toFixed(0)}%
                    </dd>
                  </div>
                </dl>
                <div className="mt-3">
                  <ConfidenceBar label="Threat severity" value={technique.severity} tone="amber" />
                </div>
              </section>

              <button
                onClick={() => onExplain(technique.id)}
                className="flex w-full items-center justify-center gap-2 rounded-md border border-cyber-purple/40 bg-cyber-purple/10 px-4 py-2 text-sm font-semibold text-cyber-purple transition-colors hover:bg-cyber-purple/20"
              >
                <GitBranch className="h-3.5 w-3.5" /> Explain with AI
              </button>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}

function MitStat({
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
