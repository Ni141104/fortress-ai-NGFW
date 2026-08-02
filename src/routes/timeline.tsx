import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { ListTree } from "lucide-react";
import { PageHeader, SectionGrid } from "@/components/layout/PageHeader";
import { WidgetCard } from "@/components/layout/WidgetCard";
import { LiveTimeline } from "@/components/simulation/LiveTimeline";
import {
  SimulationControls,
  SimulationMetricsStrip,
} from "@/components/simulation/SimulationControls";
import { useSimulation } from "@/hooks/useSimulation";
import { cn } from "@/lib/utils";
import type { SimEventType } from "@/types/simulation";

const FILTERS: Array<{ id: SimEventType | "all"; label: string }> = [
  { id: "all", label: "All" },
  { id: "attack", label: "Attack" },
  { id: "packet", label: "Packet" },
  { id: "timeline", label: "Stage" },
  { id: "threat", label: "Threat" },
  { id: "policy", label: "Policy" },
];

export const Route = createFileRoute("/timeline")({
  head: () => ({
    meta: [
      { title: "Live Timeline — AI-NGFW" },
      {
        name: "description",
        content:
          "Chronological stream of every simulation event: attack start, packet capture, anomaly detection, classification, MITRE mapping and firewall updates.",
      },
      { property: "og:title", content: "Live Timeline — AI-NGFW" },
      {
        property: "og:description",
        content: "Every AI-NGFW simulation event in chronological order.",
      },
    ],
  }),
  component: TimelinePage,
});

function TimelinePage() {
  const snapshot = useSimulation();
  const [filter, setFilter] = useState<SimEventType | "all">("all");

  const events =
    filter === "all" ? snapshot.events : snapshot.events.filter((e) => e.type === filter);

  return (
    <div>
      <PageHeader
        title="Live Timeline"
        description="Every event published by the centralized simulation engine, newest first."
        actions={<SimulationControls snapshot={snapshot} />}
      />

      <div className="mb-6">
        <WidgetCard
          title="Engine Telemetry"
          subtitle="Counters for the current run"
          icon={<ListTree className="h-4 w-4" />}
          live={snapshot.status === "running"}
        >
          <SimulationMetricsStrip snapshot={snapshot} />
        </WidgetCard>
      </div>

      <SectionGrid className="xl:grid-cols-1">
        <WidgetCard
          title="Simulation Event Stream"
          subtitle={`${events.length} event(s) in view`}
          icon={<ListTree className="h-4 w-4" />}
          live={snapshot.status === "running"}
          actions={
            <div className="flex flex-wrap gap-1">
              {FILTERS.map((f) => (
                <button
                  key={f.id}
                  onClick={() => setFilter(f.id)}
                  className={cn(
                    "rounded px-2 py-1 text-[11px] font-semibold transition-colors",
                    filter === f.id
                      ? "bg-cyber-blue/20 text-cyber-blue"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {f.label}
                </button>
              ))}
            </div>
          }
        >
          <LiveTimeline events={events} limit={80} />
        </WidgetCard>
      </SectionGrid>
    </div>
  );
}
