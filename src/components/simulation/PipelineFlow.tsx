import { AnimatePresence, motion } from "framer-motion";
import { ChevronDown } from "lucide-react";
import { StatusBadge } from "@/components/ui/cyber";
import { cn } from "@/lib/utils";
import type { SimStageState, SimulationPacket } from "@/types/simulation";

const statusTone: Record<string, string> = {
  idle: "border-border/60",
  processing: "border-cyber-blue/50 cyber-glow",
  escalating: "border-cyber-amber/60 cyber-glow-purple",
  blocked: "border-cyber-pink/60 cyber-glow-red",
  clear: "border-cyber-green/50 cyber-glow-green",
};

const packetTone: Record<string, string> = {
  low: "bg-cyber-blue",
  medium: "bg-cyber-amber",
  high: "bg-cyber-purple",
  critical: "bg-cyber-pink",
};

/**
 * Flagship live pipeline visualization.
 * Purely presentational: every value comes from the simulation engine snapshot.
 */
export function PipelineFlow({
  stages,
  packets,
}: {
  stages: SimStageState[];
  packets: SimulationPacket[];
}) {
  return (
    <ol className="space-y-1">
      {stages.map((stage, index) => {
        const inStage = packets.filter((p) => p.stage === stage.id);
        const isLast = index === stages.length - 1;

        return (
          <li key={stage.id}>
            <div
              className={cn(
                "relative overflow-hidden rounded-lg border bg-slate-950/40 px-4 py-3 transition-all duration-300",
                statusTone[stage.status] ?? statusTone["idle"],
              )}
            >
              <div className="flex flex-wrap items-center gap-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-cyber-blue/30 bg-cyber-blue/10 font-mono text-[10px] font-bold text-cyber-blue">
                  {stage.short}
                </span>

                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-foreground">{stage.name}</p>
                  <p className="truncate text-[11px] text-muted-foreground">{stage.subtitle}</p>
                </div>

                <StatusBadge status={stage.status} />

                <dl className="grid grid-cols-3 gap-4 text-right">
                  <div>
                    <dt className="text-[10px] uppercase tracking-wider text-muted-foreground">
                      Latency
                    </dt>
                    <dd className="font-mono text-xs text-cyber-blue">
                      {stage.latencyMs.toFixed(2)}ms
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[10px] uppercase tracking-wider text-muted-foreground">
                      Confidence
                    </dt>
                    <dd className="font-mono text-xs text-cyber-purple">
                      {(stage.confidence * 100).toFixed(0)}%
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[10px] uppercase tracking-wider text-muted-foreground">
                      Packets
                    </dt>
                    <dd className="font-mono text-xs text-cyber-green">
                      {stage.packetCount.toLocaleString()}
                    </dd>
                  </div>
                </dl>
              </div>

              {/* Packets currently resident in this stage */}
              <div className="mt-2 flex h-4 items-center gap-1.5">
                <AnimatePresence mode="popLayout">
                  {inStage.slice(0, 14).map((packet) => (
                    <motion.span
                      key={packet.id}
                      layout
                      initial={{ opacity: 0, y: -12, scale: 0.4 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 12, scale: 0.4 }}
                      transition={{ duration: 0.25 }}
                      title={`${packet.protocol} ${packet.bytes}B · ${packet.sourceIp}`}
                      className={cn(
                        "h-2 w-2 rounded-full",
                        packetTone[packet.severity] ?? "bg-cyber-blue",
                      )}
                    />
                  ))}
                </AnimatePresence>
                {inStage.length > 14 && (
                  <span className="font-mono text-[10px] text-muted-foreground">
                    +{inStage.length - 14}
                  </span>
                )}
              </div>

              {stage.blockedCount > 0 && (
                <span className="absolute right-3 bottom-2 font-mono text-[10px] text-cyber-pink">
                  {stage.blockedCount.toLocaleString()} dropped
                </span>
              )}
            </div>

            {!isLast && (
              <div className="flex justify-center py-0.5">
                <ChevronDown
                  className={cn(
                    "h-4 w-4 transition-colors",
                    inStage.length > 0 ? "animate-pulse text-cyber-blue" : "text-border",
                  )}
                />
              </div>
            )}
          </li>
        );
      })}
    </ol>
  );
}
