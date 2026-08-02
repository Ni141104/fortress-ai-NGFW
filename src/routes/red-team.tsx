import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Crosshair, Swords } from "lucide-react";
import { PageHeader, SectionGrid } from "@/components/layout/PageHeader";
import { WidgetCard } from "@/components/layout/WidgetCard";
import { EmptyState, SeverityChip, Tag } from "@/components/ui/cyber";
import { useLiveData } from "@/hooks/useLiveData";
import { ngfw } from "@/services";
import type { ActiveAttack } from "@/types";

export const Route = createFileRoute("/red-team")({
  head: () => ({
    meta: [
      { title: "Red Team Simulation Range — AI-NGFW" },
      {
        name: "description",
        content:
          "Launch MITRE ATT&CK technique simulations against the firewall and watch the AI defense pipeline respond in real time.",
      },
      { property: "og:title", content: "Red Team Simulation Range — AI-NGFW" },
      {
        property: "og:description",
        content: "Launch MITRE ATT&CK simulations and observe autonomous defense responses.",
      },
    ],
  }),
  component: RedTeamPage,
});

function RedTeamPage() {
  const catalog = useLiveData(() => ngfw.mitre.getSimulationCatalog(), [], 0);
  const [queue, setQueue] = useState<ActiveAttack[]>(() => ngfw.simulation.getQueue());
  const [target, setTarget] = useState("10.0.4.22");

  const launch = (techniqueId: string) => {
    ngfw.simulation.launch(techniqueId, target);
    setQueue(ngfw.simulation.getQueue());
  };

  const abort = (id: string) => {
    ngfw.simulation.abort(id);
    setQueue(ngfw.simulation.getQueue());
  };

  return (
    <div>
      <PageHeader
        accent="pink"
        title="Red Team Simulation Range"
        description="Fire MITRE ATT&CK techniques at the inspection pipeline and verify autonomous containment."
        actions={
          <input
            value={target}
            onChange={(e) => setTarget(e.target.value)}
            aria-label="Target IP"
            className="w-40 rounded-md border border-cyber-pink/30 bg-slate-950/60 px-3 py-1.5 font-mono text-xs text-foreground outline-none focus:border-cyber-pink"
          />
        }
      />

      <SectionGrid className="xl:grid-cols-2">
        <WidgetCard
          title="Technique Catalog"
          subtitle="Select a technique to launch"
          icon={<Crosshair className="h-4 w-4" />}
          live={false}
          isLoading={catalog.isLoading}
          error={catalog.error}
          onRetry={catalog.refresh}
        >
          <div className="max-h-[28rem] space-y-3 overflow-y-auto pr-1">
            {(catalog.data ?? []).map((technique) => (
              <div
                key={technique.id}
                className="flex items-center justify-between gap-3 rounded-md border border-cyber-pink/15 p-3"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <Tag>{technique.id}</Tag>
                    <SeverityChip severity={technique.severity} size="sm" showIcon={false} />
                  </div>
                  <p className="mt-1 truncate text-sm font-medium">{technique.name}</p>
                  <p className="truncate text-xs text-muted-foreground">{technique.tactic}</p>
                </div>
                <button
                  onClick={() => launch(technique.id)}
                  className="shrink-0 rounded-md border border-cyber-pink/40 bg-cyber-pink/10 px-3 py-1.5 text-xs font-semibold text-cyber-pink transition-colors hover:bg-cyber-pink/20"
                >
                  Launch
                </button>
              </div>
            ))}
          </div>
        </WidgetCard>

        <WidgetCard
          title="Simulation Queue"
          subtitle="Active offensive operations"
          icon={<Swords className="h-4 w-4" />}
          live={queue.length > 0}
        >
          {queue.length === 0 ? (
            <EmptyState
              icon={<Swords className="h-6 w-6" />}
              title="No simulations running"
              description="Launch a technique from the catalog to begin."
            />
          ) : (
            <div className="space-y-3">
              {queue.map((attack) => (
                <div
                  key={attack.id}
                  className="flex items-center justify-between gap-3 rounded-md border border-cyber-pink/20 p-3"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{attack.technique}</p>
                    <p className="font-mono text-[11px] text-muted-foreground">
                      {attack.sourceIp} → {attack.targetIp}
                    </p>
                  </div>
                  <button
                    onClick={() => abort(attack.id)}
                    className="shrink-0 rounded-md border border-border px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
                  >
                    Abort
                  </button>
                </div>
              ))}
            </div>
          )}
        </WidgetCard>
      </SectionGrid>
    </div>
  );
}
