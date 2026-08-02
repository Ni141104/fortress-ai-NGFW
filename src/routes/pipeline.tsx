import { createFileRoute } from "@tanstack/react-router";
import { Activity, ListTree, Workflow } from "lucide-react";
import { PageHeader, SectionGrid } from "@/components/layout/PageHeader";
import { WidgetCard } from "@/components/layout/WidgetCard";
import { LiveTimeline } from "@/components/simulation/LiveTimeline";
import { PipelineFlow } from "@/components/simulation/PipelineFlow";
import {
  SimulationControls,
  SimulationMetricsStrip,
} from "@/components/simulation/SimulationControls";
import { useSimulation } from "@/hooks/useSimulation";

export const Route = createFileRoute("/pipeline")({
  head: () => ({
    meta: [
      { title: "Live AI Pipeline — AI-NGFW" },
      {
        name: "description",
        content:
          "Watch packets flow through Tier-0 adaptive firewall, Isolation Forest, XGBoost, MITRE mapping, RL decisioning and policy enforcement in real time.",
      },
      { property: "og:title", content: "Live AI Pipeline — AI-NGFW" },
      {
        property: "og:description",
        content: "Animated packet flow across the nine-stage AI-NGFW inspection pipeline.",
      },
    ],
  }),
  component: PipelinePage,
});

function PipelinePage() {
  const snapshot = useSimulation();

  return (
    <div>
      <PageHeader
        title="Live AI Pipeline"
        description="Attacker → packet generation → Tier-0 → Tier-1 → Tier-2 → MITRE → RL → PEO → production server."
        actions={<SimulationControls snapshot={snapshot} />}
      />

      <div className="mb-6">
        <WidgetCard
          title="Engine Telemetry"
          subtitle="Aggregate counters across all pipeline stages"
          icon={<Activity className="h-4 w-4" />}
          live={snapshot.status === "running"}
        >
          <SimulationMetricsStrip snapshot={snapshot} />
        </WidgetCard>
      </div>

      <SectionGrid className="xl:grid-cols-3">
        <WidgetCard
          title="Inspection Pipeline"
          subtitle="Animated packet flow between stages"
          icon={<Workflow className="h-4 w-4" />}
          live={snapshot.status === "running"}
          className="xl:col-span-2"
        >
          <PipelineFlow stages={snapshot.stages} packets={snapshot.packets} />
        </WidgetCard>

        <WidgetCard
          title="Stage Events"
          subtitle="Chronological engine feed"
          icon={<ListTree className="h-4 w-4" />}
          live={snapshot.status === "running"}
        >
          <LiveTimeline events={snapshot.events} limit={30} />
        </WidgetCard>
      </SectionGrid>
    </div>
  );
}
