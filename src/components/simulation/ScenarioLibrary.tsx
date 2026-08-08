import { Play, Zap } from "lucide-react";
import { SeverityChip, Tag } from "@/components/ui/cyber";
import { launchScenario, SCENARIO_LIBRARY } from "@/lib/scenario-library";
import { usePlatformOptional } from "@/lib/platform-store";
import { simulationService } from "@/services";
import { cn } from "@/lib/utils";
import type { AttackKind, QueuedAttack } from "@/types/simulation";

/** Reusable Scenario Library — each scenario triggers the simulation engine. */
export function ScenarioLibrary({
  onLaunch,
  compact = false,
}: {
  onLaunch?: (kind: AttackKind) => void;
  compact?: boolean;
}) {
  const platform = usePlatformOptional();

  const handleLaunch = (kind: AttackKind) => {
    const attack = launchScenario(kind);
    onLaunch?.(kind);
    if (platform?.settings.simulationSpeed) {
      simulationService.setSpeed(platform.settings.simulationSpeed);
    }
    simulationService.start();
    if (attack) platform?.openJourney(attack.id);
  };

  const handleLaunchAll = () => {
    const launched = SCENARIO_LIBRARY.map((scenario) => launchScenario(scenario.kind));
    simulationService.start();
    if (launched[0]) platform?.openJourney(launched[0].id);
  };

  return (
    <div className="space-y-3">
      {!compact && (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs text-muted-foreground">
            {SCENARIO_LIBRARY.length} predefined scenarios · MITRE-mapped · engine-driven
          </p>
          <button
            onClick={handleLaunchAll}
            className="inline-flex items-center gap-1.5 rounded-md border border-cyber-purple/40 bg-cyber-purple/10 px-3 py-1.5 text-[11px] font-semibold text-cyber-purple transition-colors hover:bg-cyber-purple/20"
          >
            <Zap className="h-3.5 w-3.5" /> Queue all scenarios
          </button>
        </div>
      )}

      <div
        className={cn(
          "grid gap-3",
          compact ? "grid-cols-1" : "max-h-[28rem] grid-cols-1 overflow-y-auto pr-1 md:grid-cols-2",
        )}
      >
        {SCENARIO_LIBRARY.map((scenario) => (
          <div
            key={scenario.id}
            className="flex flex-col gap-2 rounded-md border border-cyber-blue/15 p-3 transition-colors hover:border-cyber-blue/30 hover:bg-cyber-blue/5"
          >
            <div className="flex items-center gap-2">
              <Tag>{scenario.mitreTechniqueId}</Tag>
              <SeverityChip severity={scenario.severity} size="sm" showIcon={false} />
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">{scenario.name}</p>
              <p className="text-[11px] text-cyber-purple">{scenario.tagline}</p>
            </div>
            {!compact && (
              <p className="text-xs leading-relaxed text-muted-foreground">
                {scenario.description}
              </p>
            )}
            <button
              onClick={() => handleLaunch(scenario.kind)}
              className="mt-auto inline-flex items-center justify-center gap-1.5 rounded-md border border-cyber-pink/40 bg-cyber-pink/10 px-3 py-1.5 text-[11px] font-semibold text-cyber-pink transition-colors hover:bg-cyber-pink/20"
            >
              <Play className="h-3 w-3" /> Run scenario
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

/** One-click Demo Mode — starts a complete multi-attack simulation. */
export function DemoModeButton({ className }: { className?: string }) {
  const platform = usePlatformOptional();

  const startDemo = () => {
    if (platform && !platform.settings.demoModeEnabled) return;
    const speed = platform?.settings.simulationSpeed ?? 2;
    const demoRuns = startDemoSimulation(speed);
    if (demoRuns[0]) platform?.openJourney(demoRuns[0].id);
    platform?.setDemoRunning(true);
  };

  return (
    <button
      onClick={startDemo}
      disabled={platform ? !platform.settings.demoModeEnabled : false}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md border border-cyber-pink/50 bg-gradient-to-r from-cyber-pink/20 to-cyber-purple/20 px-4 py-2 text-xs font-bold text-cyber-pink transition-all hover:from-cyber-pink/30 hover:to-cyber-purple/30",
        platform &&
          !platform.settings.demoModeEnabled &&
          "cursor-not-allowed opacity-50 hover:from-cyber-pink/20 hover:to-cyber-purple/20",
        className,
      )}
    >
      <Zap className="h-4 w-4" /> Demo Mode
    </button>
  );
}

/** One-click Demo Mode — starts a complete multi-attack simulation. */
export function startDemoSimulation(speed: 1 | 2 | 5 = 2): QueuedAttack[] {
  simulationService.reset();
  simulationService.setSpeed(speed);

  const demoKinds: AttackKind[] = ["port-scan", "sql-injection", "ssh-brute-force", "zero-day"];
  const launched = demoKinds.map((kind) => launchScenario(kind, { intensity: "medium" }));
  simulationService.start();
  return launched;
}
