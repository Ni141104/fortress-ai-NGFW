import { createFileRoute } from "@tanstack/react-router";
import { Activity, Brain, Network, ShieldAlert } from "lucide-react";
import { PageHeader, SectionGrid } from "@/components/layout/PageHeader";
import { WidgetCard } from "@/components/layout/WidgetCard";
import { ConfidenceBar, SeverityChip, StatusBadge, TimelineItem } from "@/components/ui/cyber";
import { useLiveData } from "@/hooks/useLiveData";
import { ngfw } from "@/services";
import { useRole } from "@/lib/role-store";

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
  const { role } = useRole();
  const traffic = useLiveData(() => ngfw.traffic.getStats(role), [role], 3000);
  const pipeline = useLiveData(() => ngfw.traffic.getPipeline(), [], 3000);
  const feed = useLiveData(() => ngfw.threats.getTimelineFeed(role), [role], 5000);
  const attacks = useLiveData(() => ngfw.threats.getActiveAttacks(role), [role], 5000);
  const rl = useLiveData(() => ngfw.rl.getDecisions(8), [], 6000);
  const health = useLiveData(() => ngfw.system.getHealth(), [], 8000);

  return (
    <div>
      <PageHeader
        title="Live Defense Dashboard"
        description="Unified view of traffic inspection, AI detection pipeline and autonomous policy enforcement."
      />

      <SectionGrid>
        <WidgetCard
          title="Traffic Overview"
          subtitle="Ingress / egress inspection"
          icon={<Network className="h-4 w-4" />}
          isLoading={traffic.isLoading}
          error={traffic.error}
          onRetry={traffic.refresh}
        >
          <dl className="grid grid-cols-2 gap-4">
            {(traffic.data ?? []).map((stat) => (
              <div key={stat.label}>
                <dt className="text-[11px] uppercase tracking-wider text-muted-foreground">
                  {stat.label}
                </dt>
                <dd
                  className={
                    stat.status === "danger"
                      ? "font-mono text-xl font-bold text-cyber-pink"
                      : stat.status === "warning"
                        ? "font-mono text-xl font-bold text-cyber-amber"
                        : "font-mono text-xl font-bold text-cyber-blue"
                  }
                >
                  {stat.value.toLocaleString()}
                </dd>
              </div>
            ))}
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
                value={Math.min(100, stage.throughput / 100)}
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
              <div key={node.name} className="flex items-center justify-between gap-3">
                <span className="truncate text-sm text-foreground">
                  {node.name}{" "}
                  <span className="font-mono text-xs text-muted-foreground">
                    {node.value}
                    {node.unit}
                  </span>
                </span>
                <StatusBadge status={node.status} />
              </div>
            ))}
          </div>
        </WidgetCard>

        <WidgetCard
          title="Threat Timeline"
          subtitle="Chronological detections"
          icon={<ShieldAlert className="h-4 w-4" />}
          isLoading={feed.isLoading}
          error={feed.error}
          onRetry={feed.refresh}
          className="lg:col-span-2"
          delay={0.15}
        >
          <ul className="max-h-80 overflow-y-auto pr-1">
            {(feed.data ?? []).map((event, i, arr) => (
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
            {(rl.data ?? []).map((decision) => (
              <div key={decision.id} className="flex items-center justify-between gap-2">
                <span className="truncate font-mono text-xs text-muted-foreground">
                  {decision.sourceIp} → {decision.destinationIp}
                </span>
                <StatusBadge status={decision.decision} />
              </div>
            ))}
          </div>
        </WidgetCard>
      </SectionGrid>
    </div>
  );
}
