import { useState } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { ArrowDown, GitBranch, Globe, Server, Zap } from "lucide-react";
import { WidgetCard } from "@/components/layout/WidgetCard";
import { ConfidenceBar, StatusBadge, Tag } from "@/components/ui/cyber";
import { cn } from "@/lib/utils";
import type { FlPipelineStep, FlSummary, FlSyncStatus } from "@/types/ai";

const SYNC_TONE: Record<FlSyncStatus, string> = {
  idle: "idle",
  collecting: "training",
  aggregating: "aggregating",
  distributing: "training",
  complete: "healthy",
};

/** Reusable Federated Learning intelligence widget. */
export function FederatedLearningWidget({ summary }: { summary: FlSummary }) {
  const [tab, setTab] = useState<"pipeline" | "accuracy" | "nodes" | "rounds">("pipeline");

  return (
    <WidgetCard
      title="Federated Learning"
      subtitle={`${summary.globalModelVersion} · round ${summary.currentRound}`}
      icon={<GitBranch className="h-4 w-4" />}
    >
      <div className="space-y-4">
        {/* Summary stats */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <FlStat
            label="Round"
            value={String(summary.currentRound)}
            icon={<Zap className="h-3 w-3" />}
            tone="purple"
          />
          <FlStat
            label="Nodes"
            value={String(summary.participatingNodes)}
            icon={<Server className="h-3 w-3" />}
            tone="blue"
          />
          <FlStat
            label="Global acc."
            value={`${(summary.globalAccuracy * 100).toFixed(1)}%`}
            icon={<Globe className="h-3 w-3" />}
            tone="green"
          />
          <FlStat
            label="Sync"
            value={`${summary.syncProgress}%`}
            icon={<GitBranch className="h-3 w-3" />}
            tone="amber"
          />
        </div>

        <div className="flex items-center justify-between rounded-lg border border-cyber-purple/15 bg-slate-950/40 px-3 py-2">
          <span className="text-[11px] uppercase tracking-wider text-muted-foreground">
            Synchronization
          </span>
          <StatusBadge status={SYNC_TONE[summary.syncStatus]} />
        </div>

        {/* Tabs */}
        <div className="flex flex-wrap gap-1">
          {(
            [
              ["pipeline", "Pipeline"],
              ["accuracy", "Accuracy Trend"],
              ["nodes", "Nodes"],
              ["rounds", "Round History"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={cn(
                "rounded px-2 py-1 text-[11px] font-semibold transition-colors",
                tab === id
                  ? "bg-cyber-purple/20 text-cyber-purple"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Pipeline visualization */}
        {tab === "pipeline" && (
          <ol className="space-y-1">
            {summary.pipeline.map((step, i) => (
              <FlPipelineRow key={step.id} step={step} isLast={i === summary.pipeline.length - 1} />
            ))}
          </ol>
        )}

        {/* Accuracy trend */}
        {tab === "accuracy" && (
          <div className="h-44">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={summary.accuracyTrend}
                margin={{ top: 4, right: 4, left: -28, bottom: 0 }}
              >
                <defs>
                  <linearGradient id="flAcc" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--cyber-green)" stopOpacity={0.4} />
                    <stop offset="100%" stopColor="var(--cyber-green)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,243,255,0.08)" />
                <XAxis
                  dataKey="round"
                  tick={{ fill: "var(--muted-foreground)", fontSize: 10 }}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fill: "var(--muted-foreground)", fontSize: 10 }}
                  tickLine={false}
                  width={36}
                  domain={[0, 1]}
                />
                <Tooltip
                  contentStyle={{
                    background: "rgba(10,14,39,0.95)",
                    border: "1px solid rgba(0,255,136,0.3)",
                    borderRadius: 8,
                    fontSize: 11,
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="accuracy"
                  stroke="var(--cyber-green)"
                  strokeWidth={2}
                  fill="url(#flAcc)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Nodes */}
        {tab === "nodes" && (
          <ul className="max-h-48 space-y-2 overflow-y-auto pr-1">
            {summary.nodes.map((node) => (
              <li
                key={node.id}
                className="rounded-lg border border-cyber-blue/15 bg-slate-950/40 px-3 py-2"
              >
                <div className="flex items-center gap-2">
                  <Tag>{node.id}</Tag>
                  <span className="min-w-0 flex-1 truncate text-xs font-medium text-foreground">
                    {node.name}
                  </span>
                  <StatusBadge status={node.status} />
                </div>
                <p className="mt-1 font-mono text-[10px] text-muted-foreground">{node.region}</p>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  <ConfidenceBar
                    label="Accuracy"
                    value={node.accuracy}
                    tone="green"
                    showPercentage={false}
                  />
                  <ConfidenceBar
                    label="Sync"
                    value={node.syncProgress / 100}
                    tone="blue"
                    showPercentage={false}
                  />
                </div>
                <p className="mt-1 font-mono text-[10px] text-muted-foreground">
                  {node.samples.toLocaleString()} samples · round {node.lastRound}
                </p>
              </li>
            ))}
          </ul>
        )}

        {/* Round history */}
        {tab === "rounds" && (
          <div className="max-h-48 space-y-1.5 overflow-y-auto pr-1">
            {summary.roundHistory.slice(0, 12).map((r) => (
              <div
                key={r.round}
                className="flex items-center gap-3 rounded-md border border-cyber-blue/10 bg-slate-950/30 px-2 py-1.5"
              >
                <span className="font-mono text-[11px] text-cyber-purple">R{r.round}</span>
                <span className="font-mono text-[11px] text-cyber-green">
                  {(r.accuracy * 100).toFixed(1)}%
                </span>
                <span className="font-mono text-[11px] text-cyber-pink">
                  loss {r.loss.toFixed(3)}
                </span>
                <span className="ml-auto font-mono text-[10px] text-muted-foreground">
                  {r.participants} nodes
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </WidgetCard>
  );
}

function FlPipelineRow({ step, isLast }: { step: FlPipelineStep; isLast: boolean }) {
  const tone =
    step.status === "complete"
      ? "border-cyber-green/50 bg-cyber-green/5 text-cyber-green"
      : step.status === "idle"
        ? "border-border bg-slate-950/40 text-muted-foreground"
        : "border-cyber-purple/50 bg-cyber-purple/5 text-cyber-purple animate-pulse-glow";

  return (
    <li>
      <div className={cn("flex items-center gap-2 rounded-lg border px-3 py-2", tone)}>
        <span className="min-w-0 flex-1 truncate text-xs font-medium">{step.label}</span>
        <StatusBadge
          status={
            step.status === "complete" ? "healthy" : step.status === "idle" ? "idle" : "aggregating"
          }
        />
      </div>
      {!isLast && (
        <div className="flex justify-center py-0.5">
          <ArrowDown className="h-3.5 w-3.5 text-cyber-purple/50" />
        </div>
      )}
    </li>
  );
}

function FlStat({
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
