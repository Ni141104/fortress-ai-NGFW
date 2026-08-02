import { createFileRoute } from "@tanstack/react-router";
import { Activity, Brain, Network, ShieldAlert } from "lucide-react";
import { PageHeader, SectionGrid } from "@/components/layout/PageHeader";
import { WidgetCard } from "@/components/layout/WidgetCard";
import { ConfidenceBar, SeverityChip, StatusBadge, TimelineItem } from "@/components/ui/cyber";
import { useLiveData } from "@/hooks/useLiveData";
import { ngfw } from "@/services";

export const Route = createFileRoute("/dashboard")({
  head: () => ({
    meta: [
      { title: "Live Defense Dashboard — AI-NGFW" },
      {
        name: "description",
        content:
          "Real-time firewall telemetry: traffic throughput, AI inference pipeline, threat timeline and reinforcement-learning policy decisions.",
      },
      { property: "og:title", content: "Live Defense Dashboard — AI-NGFW" },
      {
        property: "og:description",
        content: "Real-time firewall telemetry, threat timeline and RL policy decisions.",
      },
    ],
  }),
  component: DashboardPage,
});

function DashboardPage() {
  const traffic = useLiveData(() => ngfw.traffic.getStats(), [], 3000);
  const pipeline = useLiveData(() => ngfw.traffic.getPipelineStages(), [], 3000);
  const timeline = useLiveData(() => ngfw.threats.getTimeline(), [], 5000);
  const attacks = useLiveData(() => ngfw.threats.getActiveAttacks(), [], 5000);
  const rl = useLiveData(() => ngfw.rl.getDecisions(), [], 6000);
  const health = useLiveData(() => ngfw.system.getHealth(), [], 8000);

  return (
    <div>
      <PageHeader
        title="Live Defense Dashboard"
        description="Unified view of traffic inspection, AI detection pipeline and autonomous policy enforcement."
      />

      <SectionGrid>
        <WidgetCard
          title="Traffic Throughput"
          subtitle="Ingress / egress inspection"
          icon={<Network className="h-4 w-4" />}
          isLoading={traffic.isLoading}
          error={traffic.error}
          onRetry={traffic.refresh}
          delay={0}
        >
          <dl className="grid grid-cols-2 gap-4">
            <Metric label="Throughput" value={`${traffic.data?.throughputMbps ?? 0} Mbps`} />
            <Metric label="Packets / s" value={`${traffic.data?.packetsPerSecond ?? 0}`} />
            <Metric label="Active flows" value={`${traffic.data?.activeConnections ?? 0}`} />
            <Metric label="Blocked" value={`${traffic.data?.blocked ?? 0}`} tone="pink" />
          </dl>
        </WidgetCard>

        <WidgetCard
          title="AI Inference Pipeline"
          subtitle="Tiered detection stages"
          icon={<Brain className="h-4 w-4" />}
          isLoading={pipeline.isLoading}
          error={pipeline.error}
          onRetry={pipeline.refresh}
          delay={0.05}
        >
          <div className="space-y-3">
            {(pipeline.data ?? []).map((stage) => (
              <ConfidenceBar
                key={stage.id}
                label={`${stage.name} · ${stage.latencyMs}ms`}
                value={stage.load}
                tone="purple"
              />
            ))}
          </div>
        </WidgetCard>

        <WidgetCard
          title="System Health"
          subtitle="Node telemetry"
          icon={<Activity className="h-4 w-4" />}
          isLoading={health.isLoading}
          error={health.error}
          onRetry={health.refresh}
          delay={0.1}
        >
          <div className="space-y-3">
            {(health.data ?? []).map((node) => (
              <div key={node.id} className="flex items-center justify-between gap-3">
                <span className="truncate text-sm text-foreground">{node.name}</span>
                <StatusBadge status={node.status} />
              </div>
            ))}
          </div>
        </WidgetCard>

        <WidgetCard
          title="Threat Timeline"
          subtitle="Chronological detections"
          icon={<ShieldAlert className="h-4 w-4" />}
          isLoading={timeline.isLoading}
          error={timeline.error}
          onRetry={timeline.refresh}
          className="lg:col-span-2"
          delay={0.15}
        >
          <ul className="max-h-80 overflow-y-auto pr-1">
            {(timeline.data ?? []).map((event, i, arr) => (
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
        </WidgetCard>

        <WidgetCard
          title="Active Attacks"
          subtitle="Currently mitigated sessions"
          icon={<ShieldAlert className="h-4 w-4" />}
          isLoading={attacks.isLoading}
          error={attacks.error}
          onRetry={attacks.refresh}
          delay={0.2}
        >
          <div className="space-y-3">
            {(attacks.data ?? []).slice(0, 6).map((attack) => (
              <div key={attack.id} className="rounded-md border border-cyber-blue/15 p-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate text-sm font-medium">{attack.technique}</span>
                  <SeverityChip severity={attack.severity} size="sm" showIcon={false} />
                </div>
                <p className="mt-1 font-mono text-[11px] text-muted-foreground">
                  {attack.sourceIp} → {attack.targetIp}
                </p>
              </div>
            ))}
          </div>
        </WidgetCard>

        <WidgetCard
          title="RL Policy Decisions"
          subtitle="Autonomous enforcement"
          icon={<Brain className="h-4 w-4" />}
          isLoading={rl.isLoading}
          error={rl.error}
          onRetry={rl.refresh}
          delay={0.25}
        >
          <div className="space-y-3">
            {(rl.data ?? []).slice(0, 6).map((decision) => (
              <div key={decision.id} className="flex items-center justify-between gap-2">
                <span className="truncate text-xs text-muted-foreground">{decision.state}</span>
                <StatusBadge status={decision.action} />
              </div>
            ))}
          </div>
        </WidgetCard>
      </SectionGrid>
    </div>
  );
}

function Metric({
  label,
  value,
  tone = "blue",
}: {
  label: string;
  value: string;
  tone?: "blue" | "pink";
}) {
  return (
    <div>
      <dt className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</dt>
      <dd
        className={
          tone === "pink"
            ? "font-mono text-xl font-bold text-cyber-pink"
            : "font-mono text-xl font-bold text-cyber-blue"
        }
      >
        {value}
      </dd>
    </div>
  );
}
