import { useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Brain, GitBranch, History, Trophy } from "lucide-react";
import { WidgetCard } from "@/components/layout/WidgetCard";
import { ConfidenceBar, EmptyState, SeverityChip, StatusBadge, Tag } from "@/components/ui/cyber";
import { useSoc } from "@/lib/soc-store";
import { cn } from "@/lib/utils";
import type { RLAction } from "@/types";
import type { RLAgentSummary } from "@/types/ai";

const ACTION_COLOR: Record<RLAction, string> = {
  allow: "var(--cyber-green)",
  block: "var(--cyber-pink)",
  quarantine: "var(--cyber-amber)",
  redirect: "var(--cyber-purple)",
};

const ACTION_BADGE: Record<RLAction, string> = {
  allow: "allow",
  block: "block",
  quarantine: "quarantine",
  redirect: "redirect",
};

/** Reusable Reinforcement Learning intelligence widget. */
export function RLIntelligenceWidget({ agent }: { agent: RLAgentSummary }) {
  const { openXai } = useSoc();
  const [tab, setTab] = useState<"reward" | "distribution" | "timeline" | "history">("reward");

  const maxCount = useMemo(
    () => Math.max(1, ...agent.actionDistribution.map((a) => a.count)),
    [agent.actionDistribution],
  );

  return (
    <WidgetCard
      title="Reinforcement Learning"
      subtitle={`${agent.policyVersion} · ${agent.episodes} episodes`}
      icon={<Brain className="h-4 w-4" />}
      actions={
        <button
          onClick={() => openXai(agent.decisions[0]?.id ?? "rl-policy", "threat")}
          className="rounded-md border border-cyber-purple/40 bg-cyber-purple/10 px-2.5 py-1 text-[11px] font-semibold text-cyber-purple transition-colors hover:bg-cyber-purple/20"
        >
          Explain
        </button>
      }
    >
      <div className="space-y-4">
        {/* Summary stats */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <SummaryStat
            label="Policy version"
            value={agent.policyVersion}
            icon={<GitBranch className="h-3 w-3" />}
            tone="blue"
          />
          <SummaryStat
            label="Learning"
            value={`${agent.learningProgress.toFixed(0)}%`}
            icon={<Brain className="h-3 w-3" />}
            tone="purple"
          />
          <SummaryStat
            label="Reward"
            value={agent.reward.toFixed(3)}
            icon={<Trophy className="h-3 w-3" />}
            tone="amber"
          />
          <SummaryStat
            label="Accuracy"
            value={`${agent.policyAccuracy}%`}
            icon={<Brain className="h-3 w-3" />}
            tone="green"
          />
        </div>

        <div>
          <ConfidenceBar label="Model confidence" value={agent.confidence} tone="purple" />
        </div>

        {/* Tabs */}
        <div className="flex flex-wrap gap-1">
          {(
            [
              ["reward", "Reward Trend"],
              ["distribution", "Decision Distribution"],
              ["timeline", "Learning Timeline"],
              ["history", "Version History"],
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

        {/* Tab content */}
        {tab === "reward" && (
          <div className="h-40">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={agent.rewardCurve}
                margin={{ top: 4, right: 4, left: -28, bottom: 0 }}
              >
                <defs>
                  <linearGradient id="rlReward" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--cyber-purple)" stopOpacity={0.4} />
                    <stop offset="100%" stopColor="var(--cyber-purple)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,243,255,0.08)" />
                <XAxis
                  dataKey="episode"
                  tick={{ fill: "var(--muted-foreground)", fontSize: 10 }}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fill: "var(--muted-foreground)", fontSize: 10 }}
                  tickLine={false}
                  width={36}
                />
                <Tooltip
                  contentStyle={{
                    background: "rgba(10,14,39,0.95)",
                    border: "1px solid rgba(176,38,255,0.3)",
                    borderRadius: 8,
                    fontSize: 11,
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="cumulative"
                  stroke="var(--cyber-purple)"
                  strokeWidth={2}
                  fill="url(#rlReward)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}

        {tab === "distribution" && (
          <div className="h-40">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={agent.actionDistribution}
                margin={{ top: 4, right: 4, left: -28, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,243,255,0.08)" />
                <XAxis
                  dataKey="action"
                  tick={{ fill: "var(--muted-foreground)", fontSize: 10 }}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fill: "var(--muted-foreground)", fontSize: 10 }}
                  tickLine={false}
                  width={36}
                />
                <Tooltip
                  contentStyle={{
                    background: "rgba(10,14,39,0.95)",
                    border: "1px solid rgba(0,243,255,0.3)",
                    borderRadius: 8,
                    fontSize: 11,
                  }}
                />
                <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                  {agent.actionDistribution.map((entry) => (
                    <Cell key={entry.action} fill={ACTION_COLOR[entry.action]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {tab === "timeline" && (
          <div className="max-h-40 space-y-2 overflow-y-auto pr-1">
            {agent.learningTimeline.length === 0 ? (
              <EmptyState
                icon={<History className="h-6 w-6" />}
                title="No learning events yet"
                description="RL decisions appear as the simulation runs."
              />
            ) : (
              agent.learningTimeline.map((point) => (
                <div
                  key={`${point.tick}-${point.label}`}
                  className="flex items-center gap-3 rounded-lg border border-cyber-purple/15 bg-slate-950/40 px-3 py-2"
                >
                  <span className="font-mono text-[10px] text-muted-foreground">
                    t+{point.tick}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-xs text-foreground">
                    {point.label}
                  </span>
                  <span className="font-mono text-[11px] text-cyber-amber">
                    r={point.reward.toFixed(2)}
                  </span>
                </div>
              ))
            )}
          </div>
        )}

        {tab === "history" && (
          <div className="space-y-2">
            {agent.versionHistory.map((v) => (
              <div
                key={v.version}
                className="flex items-center gap-3 rounded-lg border border-cyber-blue/15 bg-slate-950/40 px-3 py-2"
              >
                <Tag>{v.version}</Tag>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-muted-foreground">Reward</span>
                    <span className="font-mono text-cyber-amber">{v.reward.toFixed(3)}</span>
                  </div>
                  <div className="mt-1">
                    <ConfidenceBar value={v.accuracy} tone="green" showPercentage={false} />
                  </div>
                </div>
                <span className="font-mono text-[10px] text-muted-foreground">
                  {(v.accuracy * 100).toFixed(1)}%
                </span>
              </div>
            ))}
          </div>
        )}

        {/* Recent decisions */}
        <div>
          <h4 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-cyber-blue">
            Recent decisions
          </h4>
          {agent.decisions.length === 0 ? (
            <p className="text-xs text-muted-foreground">No RL decisions published yet.</p>
          ) : (
            <ul className="max-h-32 space-y-1.5 overflow-y-auto pr-1">
              {agent.decisions.slice(0, 6).map((d) => (
                <li
                  key={d.id}
                  className="flex items-center gap-2 rounded-md border border-cyber-blue/10 bg-slate-950/30 px-2 py-1.5"
                >
                  <StatusBadge status={ACTION_BADGE[d.decision]} />
                  <span className="min-w-0 flex-1 truncate text-[11px] text-muted-foreground">
                    {d.reason}
                  </span>
                  <span className="font-mono text-[10px] text-muted-foreground">
                    {new Date(d.timestamp).toLocaleTimeString()}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Stage stats footer */}
        <div className="grid grid-cols-2 gap-2 border-t border-cyber-blue/10 pt-3 sm:grid-cols-5">
          {agent.stageStats.map((s) => (
            <div key={s.id} className="text-center">
              <p className="truncate text-[10px] uppercase text-muted-foreground">
                {s.name.split(" ")[0]}
              </p>
              <p className="font-mono text-xs text-cyber-blue">{s.packets.toLocaleString()}</p>
              <p className="font-mono text-[10px] text-cyber-pink">{s.blocked} blocked</p>
            </div>
          ))}
        </div>
      </div>
    </WidgetCard>
  );
}

function SummaryStat({
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
