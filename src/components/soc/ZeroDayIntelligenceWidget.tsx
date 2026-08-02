import { useMemo } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Bug, FileCode, ShieldAlert, Spline } from "lucide-react";
import { WidgetCard } from "@/components/layout/WidgetCard";
import { ConfidenceBar, EmptyState, SeverityChip, Tag } from "@/components/ui/cyber";
import { useSoc } from "@/lib/soc-store";
import { cn } from "@/lib/utils";
import type { ZeroDaySummary } from "@/types/ai";

/** Reusable Zero-Day intelligence widget driven by Isolation Forest + XGBoost. */
export function ZeroDayIntelligenceWidget({ summary }: { summary: ZeroDaySummary }) {
  const { openXai } = useSoc();

  const trendData = useMemo(
    () => summary.anomalyTrend.map((p) => ({ ...p, threshold: p.threshold })),
    [summary.anomalyTrend],
  );

  return (
    <WidgetCard
      title="Zero-Day Intelligence"
      subtitle={`${summary.candidateCount} anomaly candidates`}
      icon={<Bug className="h-4 w-4" />}
    >
      <div className="space-y-4">
        {/* Summary stats */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <ZdStat
            label="IF Score"
            value={summary.avgIsolationForestScore.toFixed(2)}
            icon={<Spline className="h-3 w-3" />}
            tone="purple"
          />
          <ZdStat
            label="XGBoost"
            value={summary.avgXgboostConfidence.toFixed(2)}
            icon={<ShieldAlert className="h-3 w-3" />}
            tone="blue"
          />
          <ZdStat
            label="Candidates"
            value={String(summary.candidateCount)}
            icon={<Bug className="h-3 w-3" />}
            tone="amber"
          />
          <ZdStat
            label="Threshold"
            value="0.60"
            icon={<FileCode className="h-3 w-3" />}
            tone="green"
          />
        </div>

        {/* Anomaly trend */}
        <div>
          <h4 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-cyber-purple">
            Anomaly trend
          </h4>
          <div className="h-36">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trendData} margin={{ top: 4, right: 4, left: -28, bottom: 0 }}>
                <defs>
                  <linearGradient id="zdAnomaly" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--cyber-purple)" stopOpacity={0.4} />
                    <stop offset="100%" stopColor="var(--cyber-purple)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,243,255,0.08)" />
                <XAxis
                  dataKey="tick"
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
                    border: "1px solid rgba(176,38,255,0.3)",
                    borderRadius: 8,
                    fontSize: 11,
                  }}
                />
                <ReferenceLine y={0.6} stroke="var(--cyber-pink)" strokeDasharray="4 4" />
                <Area
                  type="monotone"
                  dataKey="score"
                  stroke="var(--cyber-purple)"
                  strokeWidth={2}
                  fill="url(#zdAnomaly)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Candidate list */}
        <div>
          <h4 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-cyber-blue">
            Anomaly candidates
          </h4>
          {summary.candidates.length === 0 ? (
            <EmptyState
              icon={<Bug className="h-6 w-6" />}
              title="No zero-day candidates"
              description="Novel anomalies that bypass Tier-0 signatures surface here."
            />
          ) : (
            <ul className="max-h-52 space-y-2 overflow-y-auto pr-1">
              {summary.candidates.map((c) => (
                <li
                  key={c.id}
                  className="rounded-lg border border-cyber-purple/15 bg-slate-950/40 px-3 py-2.5"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <SeverityChip severity={c.severity} size="sm" showIcon={false} />
                    <Tag>{c.protocol}</Tag>
                    <span className="ml-auto font-mono text-[10px] text-muted-foreground">
                      {new Date(c.timestamp).toLocaleTimeString()}
                    </span>
                  </div>
                  <p className="mt-1.5 text-xs font-medium text-foreground">{c.candidateThreat}</p>
                  <p className="mt-0.5 text-[11px] text-muted-foreground">
                    {c.suspiciousBehaviour}
                  </p>

                  <div className="mt-2 grid grid-cols-2 gap-2">
                    <ConfidenceBar
                      label="Isolation Forest"
                      value={c.isolationForestScore}
                      tone="purple"
                      showPercentage={false}
                    />
                    <ConfidenceBar
                      label="XGBoost"
                      value={c.xgboostConfidence}
                      tone="blue"
                      showPercentage={false}
                    />
                  </div>

                  <div className="mt-2 flex items-center gap-2">
                    <code className="min-w-0 flex-1 truncate rounded border border-cyber-green/20 bg-cyber-green/5 px-2 py-1 font-mono text-[10px] text-cyber-green">
                      {c.generatedRule}
                    </code>
                    <button
                      onClick={() => openXai(c.attackId ?? c.id, "attack")}
                      className="shrink-0 rounded-md border border-cyber-purple/40 bg-cyber-purple/10 px-2 py-1 text-[10px] font-semibold text-cyber-purple transition-colors hover:bg-cyber-purple/20"
                    >
                      Explain
                    </button>
                  </div>

                  <p className="mt-1.5 font-mono text-[10px] text-muted-foreground">
                    {c.sourceIp} → {c.destinationIp} · {c.environment} · entropy {c.entropyScore}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </WidgetCard>
  );
}

function ZdStat({
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
