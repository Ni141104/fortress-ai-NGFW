import { Copy, Pause, Play, Repeat, Route, Swords, Trash2, X } from "lucide-react";
import { attackService } from "@/services";
import { ConfidenceBar, EmptyState, SeverityChip, StatusBadge, Tag } from "@/components/ui/cyber";
import { usePlatform } from "@/lib/platform-store";
import type { AttackRunState, QueuedAttack } from "@/types/simulation";

const stateBadge: Record<AttackRunState, string> = {
  queued: "idle",
  running: "healthy",
  paused: "warning",
  completed: "allow",
  blocked: "block",
  unknown: "degraded",
  cancelled: "offline",
  disconnected: "offline",
};

const iconBtn =
  "inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-[11px] text-muted-foreground transition-colors hover:border-cyber-blue/40 hover:text-cyber-blue disabled:cursor-not-allowed disabled:opacity-40";

/** Attack queue with per-operation lifecycle actions. */
export function AttackQueuePanel({ queue }: { queue: QueuedAttack[] }) {
  const { openJourney, settings } = usePlatform();
  const liveMode = !settings.demoModeEnabled;
  if (queue.length === 0) {
    return (
      <EmptyState
        icon={<Swords className="h-6 w-6" />}
        title="Queue is empty"
        description="Configure an attack and add it to the queue to begin."
      />
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        {/* PREVIOUS IMPLEMENTATION — always enabled:
            <button className={iconBtn} onClick={() => attackService.clearQueue()}> */}
        <button
          className={iconBtn}
          disabled={liveMode}
          title={
            liveMode
              ? "Clear queue is disabled in live mode — FastAPI runs finish server-side"
              : undefined
          }
          onClick={() => attackService.clearQueue()}
        >
          <Trash2 className="h-3 w-3" /> Clear queue
        </button>
      </div>

      <ul className="max-h-[30rem] space-y-3 overflow-y-auto pr-1">
        {queue.map((attack) => (
          <li key={attack.id} className="rounded-md border border-cyber-pink/20 p-3">
            <div className="flex flex-wrap items-center gap-2">
              <Tag>{attack.mitreTechniqueId}</Tag>
              <SeverityChip severity={attack.severity} size="sm" showIcon={false} />
              <StatusBadge status={stateBadge[attack.state]} className="ml-auto" />
            </div>

            <p className="mt-1.5 text-sm font-medium text-foreground">{attack.name}</p>
            <p className="font-mono text-[11px] text-muted-foreground">
              {attack.sourceIp} → {attack.config.target} · {attack.config.intensity} ·{" "}
              {attack.config.payloadVariant}
              {attack.config.stealthMode ? " · stealth" : ""}
            </p>

            <div className="mt-2">
              <ConfidenceBar
                value={attack.progress}
                label={`Progress · ${attack.packetsBlocked.toLocaleString()}/${attack.packetsSent.toLocaleString()} blocked`}
                tone={attack.state === "blocked" ? "pink" : "blue"}
              />
            </div>

            {attack.config.notes && (
              <p className="mt-2 border-l-2 border-cyber-purple/40 pl-2 text-[11px] italic text-muted-foreground">
                {attack.config.notes}
              </p>
            )}

            <div className="mt-3 flex flex-wrap gap-2">
              <button className={iconBtn} onClick={() => openJourney(attack.id)}>
                <Route className="h-3 w-3" /> Journey
              </button>
              {attack.state === "running" && liveMode !== true && (
                <button className={iconBtn} onClick={() => attackService.pauseAttack(attack.id)}>
                  <Pause className="h-3 w-3" /> Pause
                </button>
              )}
              {attack.state === "paused" && liveMode !== true && (
                <button className={iconBtn} onClick={() => attackService.resumeAttack(attack.id)}>
                  <Play className="h-3 w-3" /> Resume
                </button>
              )}
              {(attack.state === "queued" ||
                attack.state === "running" ||
                attack.state === "paused") && (
                <button
                  className={iconBtn}
                  disabled={liveMode}
                  title={liveMode ? "Live runs finish server-side; unsupported" : undefined}
                  onClick={() => attackService.cancelAttack(attack.id)}
                >
                  <X className="h-3 w-3" /> Cancel
                </button>
              )}
              {/* PREVIOUS IMPLEMENTATION — no live guard:
              <button className={iconBtn} onClick={() => attackService.replayAttack(attack.id)}> */}
              <button
                className={iconBtn}
                disabled={liveMode}
                title={
                  liveMode
                    ? "Replay is disabled in live mode — launch a fresh op from the catalog"
                    : undefined
                }
                onClick={() => attackService.replayAttack(attack.id)}
              >
                <Repeat className="h-3 w-3" /> Replay
              </button>
              <button className={iconBtn} onClick={() => attackService.duplicate(attack.id)}>
                <Copy className="h-3 w-3" /> Duplicate
              </button>
              <button className={iconBtn} onClick={() => attackService.remove(attack.id)}>
                <Trash2 className="h-3 w-3" /> Remove
              </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
