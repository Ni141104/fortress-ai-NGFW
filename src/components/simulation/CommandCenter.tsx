import { useMemo } from "react";
import { ChevronDown, Gauge, Pause, Play, Repeat, RotateCcw, Square, Terminal } from "lucide-react";
import { simulationService } from "@/services";
import { StatusBadge } from "@/components/ui/cyber";
import { usePlatform } from "@/lib/platform-store";
import { stageLabel, stageForAttack } from "@/lib/soc-selectors";
import { getScenarioByKind } from "@/lib/scenario-library";
import { cn } from "@/lib/utils";
import type { SimulationSnapshot, SimulationSpeed } from "@/types/simulation";

const SPEEDS: SimulationSpeed[] = [1, 2, 5];

const controlBtn =
  "inline-flex items-center gap-1 rounded border border-cyber-blue/30 px-2 py-1 text-[10px] font-semibold text-cyber-blue transition-colors hover:bg-cyber-blue/10 disabled:opacity-40";

/** Floating command center — controls the centralized simulation engine. */
export function CommandCenter({ snapshot }: { snapshot: SimulationSnapshot }) {
  const { commandCenterOpen, setCommandCenterOpen, settings, updateSettings, setDemoRunning } =
    usePlatform();

  const activeAttack = useMemo(
    () => snapshot.queue.find((a) => a.id === snapshot.activeAttackId) ?? null,
    [snapshot.queue, snapshot.activeAttackId],
  );

  const currentScenario = activeAttack
    ? (getScenarioByKind(activeAttack.kind)?.name ?? activeAttack.name)
    : (snapshot.queue.find((a) => a.state === "queued")?.name ?? "None");

  const currentStage = activeAttack
    ? stageLabel(stageForAttack(snapshot, activeAttack))
    : snapshot.status === "idle"
      ? "Idle"
      : "Awaiting";

  const { status, speed, metrics } = snapshot;
  const running = status === "running";
  const paused = status === "paused";
  const hasQueue = snapshot.queue.some((a) => a.state === "queued");

  if (!commandCenterOpen) {
    return (
      <button
        onClick={() => setCommandCenterOpen(true)}
        className="fixed bottom-4 right-4 z-40 flex items-center gap-2 rounded-lg border border-cyber-blue/40 bg-slate-950/95 px-4 py-2.5 text-xs font-semibold text-cyber-blue shadow-lg backdrop-blur-lg transition-colors hover:bg-cyber-blue/10"
        aria-label="Open command center"
      >
        <Terminal className="h-4 w-4" />
        Command Center
        <StatusBadge status={running ? "healthy" : status} />
      </button>
    );
  }

  return (
    <div className="fixed bottom-4 right-4 z-40 w-[min(24rem,calc(100vw-2rem))] rounded-lg border border-cyber-blue/30 bg-slate-950/95 shadow-2xl backdrop-blur-lg">
      <div className="flex items-center justify-between gap-2 border-b border-cyber-blue/20 px-3 py-2">
        <div className="flex items-center gap-2">
          <Terminal className="h-4 w-4 text-cyber-blue" />
          <span className="text-xs font-bold text-foreground">Command Center</span>
          <StatusBadge status={running ? "healthy" : status} />
        </div>
        <button
          onClick={() => setCommandCenterOpen(false)}
          className="rounded p-1 text-muted-foreground transition-colors hover:text-foreground"
          aria-label="Minimize command center"
        >
          <ChevronDown className="h-4 w-4" />
        </button>
      </div>

      <div className="space-y-3 p-3">
        <dl className="grid grid-cols-2 gap-2 text-[10px]">
          <div className="rounded border border-cyber-blue/15 bg-slate-950/50 px-2 py-1.5">
            <dt className="text-muted-foreground">Scenario</dt>
            <dd className="truncate font-medium text-foreground">{currentScenario}</dd>
          </div>
          <div className="rounded border border-cyber-blue/15 bg-slate-950/50 px-2 py-1.5">
            <dt className="text-muted-foreground">Stage</dt>
            <dd className="truncate font-medium text-cyber-blue">{currentStage}</dd>
          </div>
          <div className="rounded border border-cyber-blue/15 bg-slate-950/50 px-2 py-1.5">
            <dt className="text-muted-foreground">Elapsed</dt>
            <dd className="font-mono text-foreground">t+{metrics.elapsedSec.toFixed(1)}s</dd>
          </div>
          <div className="rounded border border-cyber-blue/15 bg-slate-950/50 px-2 py-1.5">
            <dt className="text-muted-foreground">Threats</dt>
            <dd className="font-mono text-cyber-amber">{metrics.threatsDetected}</dd>
          </div>
        </dl>

        <div className="flex flex-wrap gap-1">
          {running ? (
            <button className={controlBtn} disabled={!settings.demoModeEnabled} title={!settings.demoModeEnabled ? "Demo Mode only" : undefined} onClick={() => simulationService.pause()}>
              <Pause className="h-3 w-3" /> Pause
            </button>
          ) : paused ? (
            <button className={controlBtn} disabled={!settings.demoModeEnabled} title={!settings.demoModeEnabled ? "Demo Mode only" : undefined} onClick={() => simulationService.resume()}>
              <Play className="h-3 w-3" /> Resume
            </button>
          ) : (
            <button
              className={controlBtn}
              disabled={!hasQueue}
              onClick={() => simulationService.start()}
            >
              <Play className="h-3 w-3" /> Start
            </button>
          )}
          <button
            className={controlBtn}
            disabled={(!running && !paused) || !settings.demoModeEnabled}
            title={!settings.demoModeEnabled ? "Demo Mode only" : undefined}
            onClick={() => {
              simulationService.cancel();
              setDemoRunning(false);
            }}
          >
            <Square className="h-3 w-3" /> Stop
          </button>
          <button className={controlBtn} disabled={!settings.demoModeEnabled} title={!settings.demoModeEnabled ? "Demo Mode only" : undefined} onClick={() => simulationService.replay()}>
            <Repeat className="h-3 w-3" /> Replay
          </button>
          <button
            className={controlBtn}
            onClick={() => {
              simulationService.reset();
              setDemoRunning(false);
            }}
          >
            <RotateCcw className="h-3 w-3" /> Reset
          </button>
        </div>

        <div className="flex items-center gap-1 rounded border border-cyber-purple/30 bg-cyber-purple/5 p-0.5">
          <Gauge className="ml-1 h-3 w-3 text-cyber-purple" />
          <span className="text-[10px] text-muted-foreground">Speed</span>
          {SPEEDS.map((s) => (
            <button
              key={s}
              disabled={!settings.demoModeEnabled}
              title={!settings.demoModeEnabled ? "Demo Mode only" : undefined}
              onClick={() => {
                simulationService.setSpeed(s);
                updateSettings({ simulationSpeed: s });
              }}
              className={cn(
                "rounded px-2 py-0.5 font-mono text-[10px] font-semibold transition-colors",
                speed === s
                  ? "bg-cyber-purple/20 text-cyber-purple"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {s}x
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
