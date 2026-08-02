import { Pause, Play, RotateCcw, Repeat, Square, Zap } from "lucide-react";
import { simulationService } from "@/services";
import { StatusBadge } from "@/components/ui/cyber";
import { cn } from "@/lib/utils";
import type { SimulationSnapshot, SimulationSpeed } from "@/types/simulation";

const SPEEDS: SimulationSpeed[] = [1, 2, 5];

const controlClass =
  "inline-flex items-center gap-1.5 rounded-md border border-cyber-blue/40 bg-cyber-blue/10 px-3 py-1.5 text-xs font-semibold text-cyber-blue transition-colors hover:bg-cyber-blue/20 disabled:cursor-not-allowed disabled:opacity-40";

/** Transport controls for the centralized simulation engine. */
export function SimulationControls({ snapshot }: { snapshot: SimulationSnapshot }) {
  const { status, speed, metrics } = snapshot;
  const running = status === "running";
  const paused = status === "paused";
  const hasQueue = snapshot.queue.some((a) => a.state === "queued");

  return (
    <div className="flex flex-wrap items-center gap-2">
      <StatusBadge status={status === "running" ? "healthy" : status} />

      {running ? (
        <button className={controlClass} onClick={() => simulationService.pause()}>
          <Pause className="h-3.5 w-3.5" /> Pause
        </button>
      ) : paused ? (
        <button className={controlClass} onClick={() => simulationService.resume()}>
          <Play className="h-3.5 w-3.5" /> Resume
        </button>
      ) : (
        <button
          className={controlClass}
          disabled={!hasQueue}
          onClick={() => simulationService.start()}
        >
          <Play className="h-3.5 w-3.5" /> Start
        </button>
      )}

      <button
        className={cn(controlClass, "border-cyber-pink/40 bg-cyber-pink/10 text-cyber-pink hover:bg-cyber-pink/20")}
        disabled={!running && !paused}
        onClick={() => simulationService.cancel()}
      >
        <Square className="h-3.5 w-3.5" /> Cancel
      </button>

      <button className={controlClass} onClick={() => simulationService.replay()}>
        <Repeat className="h-3.5 w-3.5" /> Replay
      </button>

      <button
        className={cn(controlClass, "border-border bg-transparent text-muted-foreground hover:bg-white/5 hover:text-foreground")}
        onClick={() => simulationService.reset()}
      >
        <RotateCcw className="h-3.5 w-3.5" /> Reset
      </button>

      <div className="flex items-center gap-1 rounded-md border border-cyber-purple/30 bg-cyber-purple/5 p-0.5">
        <Zap className="ml-1.5 h-3 w-3 text-cyber-purple" />
        {SPEEDS.map((s) => (
          <button
            key={s}
            onClick={() => simulationService.setSpeed(s)}
            className={cn(
              "rounded px-2 py-1 font-mono text-[11px] font-semibold transition-colors",
              speed === s
                ? "bg-cyber-purple/20 text-cyber-purple"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {s}x
          </button>
        ))}
      </div>

      <span className="ml-1 font-mono text-[11px] text-muted-foreground">
        t+{metrics.elapsedSec.toFixed(1)}s
      </span>
    </div>
  );
}

/** Compact engine metric strip reused across Phase 2 pages. */
export function SimulationMetricsStrip({ snapshot }: { snapshot: SimulationSnapshot }) {
  const m = snapshot.metrics;
  const items: Array<{ label: string; value: string; tone: string }> = [
    { label: "Generated", value: m.packetsGenerated.toLocaleString(), tone: "text-cyber-blue" },
    { label: "Inspected", value: m.packetsInspected.toLocaleString(), tone: "text-cyber-purple" },
    { label: "Blocked", value: m.packetsBlocked.toLocaleString(), tone: "text-cyber-pink" },
    { label: "Allowed", value: m.packetsAllowed.toLocaleString(), tone: "text-cyber-green" },
    { label: "Threats", value: m.threatsDetected.toLocaleString(), tone: "text-cyber-amber" },
    {
      label: "Avg confidence",
      value: `${(m.avgConfidence * 100).toFixed(0)}%`,
      tone: "text-cyber-blue",
    },
  ];

  return (
    <dl className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
      {items.map((item) => (
        <div key={item.label}>
          <dt className="text-[11px] uppercase tracking-wider text-muted-foreground">
            {item.label}
          </dt>
          <dd className={cn("font-mono text-xl font-bold", item.tone)}>{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}
