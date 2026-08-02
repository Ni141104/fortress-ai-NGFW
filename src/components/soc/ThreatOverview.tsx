import {
  Activity,
  AlertOctagon,
  Brain,
  Clock,
  Gauge,
  HelpCircle,
  ShieldCheck,
  Timer,
  Zap,
} from "lucide-react";
import type { ReactNode } from "react";
import { StatCard } from "@/components/ui/stat-card";
import { useSoc } from "@/lib/soc-store";
import type { MetricSeries } from "@/hooks/useMetricSeries";
import type { OverviewMetric } from "@/types/soc";

const ICONS: Record<string, ReactNode> = {
  active: <Activity className="h-4 w-4" />,
  blocked: <ShieldCheck className="h-4 w-4" />,
  unknown: <HelpCircle className="h-4 w-4" />,
  critical: <AlertOctagon className="h-4 w-4" />,
  accuracy: <Brain className="h-4 w-4" />,
  policy: <ShieldCheck className="h-4 w-4" />,
  "detection-time": <Clock className="h-4 w-4" />,
  throughput: <Gauge className="h-4 w-4" />,
  response: <Timer className="h-4 w-4" />,
};

/** Executive overview strip — reuses the shared StatCard, sparklines included. */
export function ThreatOverview({
  metrics,
  series,
}: {
  metrics: OverviewMetric[];
  series: MetricSeries;
}) {
  const { setSearchOpen } = useSoc();

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
      {metrics.map((metric, i) => (
        <StatCard
          key={metric.id}
          label={metric.label}
          value={metric.display}
          unit={metric.unit}
          hint={metric.hint}
          tone={metric.tone}
          icon={ICONS[metric.id] ?? <Zap className="h-4 w-4" />}
          trend={series.trend[`ov:${metric.id}`]}
          invertTrend={metric.invert ?? false}
          sparkline={series.history[`ov:${metric.id}`] ?? []}
          delay={i * 0.03}
          onClick={metric.id === "critical" ? () => setSearchOpen(true) : undefined}
        />
      ))}
    </div>
  );
}