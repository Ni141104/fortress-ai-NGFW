import { Crosshair, Gauge, Target } from "lucide-react";
import { SeverityChip, Tag } from "@/components/ui/cyber";
import { cn } from "@/lib/utils";
import type { AttackCatalogEntry, AttackKind } from "@/types/simulation";

/** Attack catalog grid — selection drives the configuration panel. */
export function AttackCatalog({
  catalog,
  selected,
  onSelect,
}: {
  catalog: AttackCatalogEntry[];
  selected: AttackKind | null;
  onSelect: (kind: AttackKind) => void;
}) {
  return (
    <div className="grid max-h-[34rem] grid-cols-1 gap-3 overflow-y-auto pr-1 md:grid-cols-2">
      {catalog.map((attack) => {
        const active = selected === attack.id;
        return (
          <button
            key={attack.id}
            type="button"
            onClick={() => onSelect(attack.id)}
            className={cn(
              "group flex flex-col gap-2 rounded-md border p-3 text-left transition-all duration-200",
              active
                ? "border-cyber-pink/60 bg-cyber-pink/10 cyber-glow-red"
                : "border-cyber-pink/15 hover:border-cyber-pink/40 hover:bg-cyber-pink/5",
            )}
          >
            <div className="flex items-center gap-2">
              <Tag>{attack.mitreTechniqueId}</Tag>
              <SeverityChip severity={attack.severity} size="sm" showIcon={false} />
              <Crosshair
                className={cn(
                  "ml-auto h-3.5 w-3.5 transition-colors",
                  active ? "text-cyber-pink" : "text-muted-foreground group-hover:text-cyber-pink",
                )}
              />
            </div>

            <div>
              <p className="text-sm font-semibold text-foreground">{attack.name}</p>
              <p className="text-xs text-muted-foreground">{attack.mitreTactic}</p>
            </div>

            <p className="text-xs leading-relaxed text-muted-foreground">{attack.description}</p>

            <div className="mt-auto grid grid-cols-2 gap-2 border-t border-cyber-pink/10 pt-2">
              <div className="flex items-center gap-1.5">
                <Gauge className="h-3 w-3 text-cyber-amber" />
                <span className="font-mono text-[11px] text-cyber-amber">
                  Risk {attack.estimatedRisk}
                </span>
              </div>
              <div className="flex items-start gap-1.5">
                <Target className="mt-0.5 h-3 w-3 shrink-0 text-cyber-purple" />
                <span className="text-[11px] leading-snug text-muted-foreground">
                  {attack.expectedImpact}
                </span>
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
}
