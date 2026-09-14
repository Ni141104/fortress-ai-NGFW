import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Crosshair, Library, ListTree, Settings2, Swords } from "lucide-react";
import { PageHeader, SectionGrid } from "@/components/layout/PageHeader";
import { WidgetCard } from "@/components/layout/WidgetCard";
import { AttackCatalog } from "@/components/simulation/AttackCatalog";
import { AttackConfigForm } from "@/components/simulation/AttackConfigForm";
import { AttackQueuePanel } from "@/components/simulation/AttackQueuePanel";
import { LiveTimeline } from "@/components/simulation/LiveTimeline";
import { ScenarioLibrary } from "@/components/simulation/ScenarioLibrary";
import {
  SimulationControls,
  SimulationMetricsStrip,
} from "@/components/simulation/SimulationControls";
import { useSimulation } from "@/hooks/useSimulation";
import { usePlatform } from "@/lib/platform-store";
import { attackService } from "@/services";
import type { AttackConfig, AttackKind } from "@/types/simulation";

export const Route = createFileRoute("/red-team")({
  head: () => ({
    meta: [
      { title: "Red Team Portal — AI-NGFW" },
      {
        name: "description",
        content:
          "Configure and launch SQL injection, DDoS, DNS tunneling and zero-day attack simulations against the AI firewall pipeline.",
      },
      { property: "og:title", content: "Red Team Portal — AI-NGFW" },
      {
        property: "og:description",
        content: "Attack catalog, configuration and queue for AI-NGFW offensive simulations.",
      },
    ],
  }),
  component: RedTeamPage,
});

function RedTeamPage() {
  const snapshot = useSimulation();
  const { openJourney, settings } = usePlatform();
  const activeAttack = snapshot.queue.find((attack) => attack.id === snapshot.activeAttackId);
  const currentBackendId = activeAttack?.backendId ?? [...snapshot.queue].reverse().find((attack) => attack.backendId)?.backendId;
  const catalog = useMemo(() => attackService.getCatalog(), []);

  const [selected, setSelected] = useState<AttackKind>(catalog[0]!.id);
  const [config, setConfig] = useState<AttackConfig>(() =>
    attackService.defaultConfig(catalog[0]!.id),
  );

  const definition = useMemo(() => attackService.getDefinition(selected), [selected]);

  const selectAttack = (kind: AttackKind) => {
    setSelected(kind);
    setConfig(attackService.defaultConfig(kind));
    // PREVIOUS IMPLEMENTATION — opened the journey of an unrelated already-queued op
    // when selecting a catalog entry. Selecting a catalog entry now only
    // configures the new attack form; journeys open from the queue/launch path.
    // const queued = snapshot.queue.find((a) => a.kind === kind);
    // if (queued) openJourney(queued.id);
  };

  return (
    <div>
      <PageHeader
        accent="pink"
        title="Red Team Portal"
        description="Build, queue and launch adversary operations against the AI inspection pipeline."
        actions={<SimulationControls snapshot={snapshot} />}
      />

      <div className="mb-6 space-y-6">
        <WidgetCard
          title="Engine Telemetry"
          subtitle="Published by the centralized simulation engine"
          icon={<Swords className="h-4 w-4" />}
          live={snapshot.status === "running"}
        >
          {/* PREVIOUS IMPLEMENTATION — always showed the live banner:
            <div className="mb-4 rounded border border-cyber-green/25 bg-cyber-green/5 px-3 py-2 font-mono text-[11px] text-cyber-green">
              Backend attack ID: {currentBackendId ?? "Waiting for FastAPI launch"}
            </div> */}
          {settings.demoModeEnabled ? (
            <div className="mb-4 rounded border border-cyber-blue/25 bg-cyber-blue/5 px-3 py-2 font-mono text-[11px] text-cyber-blue">
              Demo mode — local simulation engine (no FastAPI backend)
            </div>
          ) : (
            <div className="mb-4 rounded border border-cyber-green/25 bg-cyber-green/5 px-3 py-2 font-mono text-[11px] text-cyber-green">
              Backend attack ID: {currentBackendId ?? "Waiting for FastAPI launch"}
            </div>
          )}
          <SimulationMetricsStrip snapshot={snapshot} />
        </WidgetCard>

        <WidgetCard
          title="Scenario Library"
          subtitle="One-click predefined attack scenarios"
          icon={<Library className="h-4 w-4" />}
          live={false}
        >
          <ScenarioLibrary />
        </WidgetCard>
      </div>

      <SectionGrid className="xl:grid-cols-2">
        <WidgetCard
          title="Attack Catalog"
          subtitle="MITRE-mapped adversary techniques"
          icon={<Crosshair className="h-4 w-4" />}
          live={false}
          className="xl:col-span-2"
        >
          <AttackCatalog catalog={catalog} selected={selected} onSelect={selectAttack} />
        </WidgetCard>

        <WidgetCard
          title="Attack Configuration"
          subtitle={definition.name}
          icon={<Settings2 className="h-4 w-4" />}
          live={false}
        >
          <AttackConfigForm
            definition={definition}
            config={config}
            onChange={(patch) => setConfig((c) => ({ ...c, ...patch }))}
            onEnqueue={() => {
              const attack = attackService.enqueue(selected, config);
              // PREVIOUS IMPLEMENTATION — preserved for rollback/debugging
              // Reason replaced: live queueing opened a modal over the Launch control before FastAPI started.
              if (settings.demoModeEnabled) {
                openJourney(attack.id);
              } else {
                attackService.launch();
              }
            }}
          />
        </WidgetCard>

        <WidgetCard
          title="Attack Queue"
          subtitle="Queued · Running · Completed · Blocked · Unknown"
          icon={<Swords className="h-4 w-4" />}
          live={snapshot.status === "running"}
          actions={
            settings.demoModeEnabled ? (
              <button
                onClick={() => attackService.launch()}
                className="rounded-md border border-cyber-pink/40 bg-cyber-pink/10 px-3 py-1 text-[11px] font-semibold text-cyber-pink transition-colors hover:bg-cyber-pink/20"
              >
                Launch
              </button>
            ) : (
              <span className="font-mono text-[10px] text-cyber-green">FastAPI launch on enqueue</span>
            )
          }
        >
          <AttackQueuePanel queue={snapshot.queue} />
        </WidgetCard>

        <WidgetCard
          title="Operation Feed"
          subtitle="Live events from the shared engine"
          icon={<ListTree className="h-4 w-4" />}
          live={snapshot.status === "running"}
          className="xl:col-span-2"
        >
          <LiveTimeline events={snapshot.events} limit={25} />
        </WidgetCard>
      </SectionGrid>
    </div>
  );
}
