import {
  Activity,
  Boxes,
  Brain,
  ListTree,
  ShieldCheck,
  Swords,
} from "lucide-react";
import { EmptyState, TimelineItem } from "@/components/ui/cyber";
import type { SimulationEvent } from "@/types/simulation";

const iconFor = (event: SimulationEvent) => {
  switch (event.type) {
    case "attack":
      return <Swords className="h-3.5 w-3.5 text-cyber-pink" />;
    case "packet":
      return <Boxes className="h-3.5 w-3.5 text-cyber-blue" />;
    case "stage":
      return <Activity className="h-3.5 w-3.5 text-cyber-purple" />;
    case "policy":
      return <ShieldCheck className="h-3.5 w-3.5 text-cyber-green" />;
    case "threat":
      return <Brain className="h-3.5 w-3.5 text-cyber-amber" />;
    default:
      return <ListTree className="h-3.5 w-3.5 text-cyber-blue" />;
  }
};

/** Chronological feed of everything published by the simulation engine. */
export function LiveTimeline({
  events,
  limit = 40,
}: {
  events: SimulationEvent[];
  limit?: number;
}) {
  const visible = events.slice(0, limit);

  if (visible.length === 0) {
    return (
      <EmptyState
        icon={<ListTree className="h-6 w-6" />}
        title="No simulation events yet"
        description="Start the simulation engine to stream chronological events."
      />
    );
  }

  return (
    <ul className="max-h-[34rem] overflow-y-auto pr-1">
      {visible.map((event, i) => (
        <TimelineItem
          key={event.id}
          title={event.title}
          description={event.description}
          timestamp={event.timestamp}
          severity={event.severity}
          icon={iconFor(event)}
          isLast={i === visible.length - 1}
        />
      ))}
    </ul>
  );
}
