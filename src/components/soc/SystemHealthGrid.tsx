import { Cpu, Database, Gauge, HardDrive, Network, Plug, Radio, Server, Shield, Timer, Waves } from "lucide-react";
import type { ReactNode } from "react";
import { StatCard } from "@/components/ui/stat-card";
import { StatusBadge } from "@/components/ui/cyber";
import { cn } from "@/lib/utils";
import type { MetricSeries } from "@/hooks/useMetricSeries";
import type { HealthMetric, ServiceStatus } from "@/types/soc";

const ICONS: Record<string, ReactNode> = {
  cpu: <Cpu className="h-4 w-4" />,
  memory: <HardDrive className="h-4 w-4" />,
  "packet-rate": <Waves className="h-4 w-4" />,
  traffic: <Network className="h-4 w-4" />,
  throughput: <Gauge className="h-4 w-4" />,
  blocked: <Shield className="h-4 w-4" />,
  latency: <Timer className="h-4 w-4" />,
};

const SERVICE_ICONS: Record<string, ReactNode> = {
  ws: <Radio className="h-4 w-4" />,
  db: <Database className="h-4 w-4" />,
  api: <Server className="h-4 w-4" />,
  ml: <Plug className="h-4 w-4" />,
};

/** Live infrastructure telemetry — every value derived from the engine snapshot. */
export function SystemHealthGrid({
  metrics,
  series,
}: {
  metrics: HealthMetric[];
  series: MetricSeries;
}) {
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {metrics.map((metric, i) => (
        <StatCard
          key={metric.id}
          label={metric.label}
          value={metric.unit === "%" || metric.unit === "Gbps" || metric.unit === "ms" || metric.unit === "GB" ? metric.value.toFixed(metric.unit === "%" ? 1 : 2) : metric.value}
          unit={metric.unit}
          tone={metric.status === "critical" ? "pink" : metric.status === "warning" ? "amber" : metric.tone}
          icon={ICONS[metric.id]}
          trend={series.trend[`hl:${metric.id}`]}
          invertTrend={metric.invert ?? false}
          sparkline={series.history[`hl:${metric.id}`] ?? []}
          hint={metric.status === "normal" ? "Within nominal band" : `${metric.status.toUpperCase()} threshold breached`}
          delay={i * 0.03}
        />
      ))}
    </div>
  );
}

/** Backing-service status column (WebSocket / DB / FastAPI / ML engine). */
export function ServiceStatusList({ services }: { services: ServiceStatus[] }) {
  return (
    <ul className="space-y-2">
      {services.map((service) => (
        <li
          key={service.id}
          className={cn(
            "flex items-center gap-3 rounded-lg border border-cyber-blue/15 bg-slate-950/40 px-3 py-2.5 transition-colors hover:border-cyber-blue/35",
          )}
        >
          <span className="text-cyber-blue">{SERVICE_ICONS[service.id]}</span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-medium text-foreground">{service.label}</p>
            <p className="truncate font-mono text-[10px] text-muted-foreground">{service.detail}</p>
          </div>
          <StatusBadge status={service.status} />
        </li>
      ))}
    </ul>
  );
}