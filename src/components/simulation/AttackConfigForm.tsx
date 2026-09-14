import { EmptyState } from "@/components/ui/cyber";
import { Crosshair, FileSearch, Upload } from "lucide-react";
import { cn } from "@/lib/utils";
import type { AttackCatalogEntry, AttackConfig, AttackIntensity } from "@/types/simulation";

const INTENSITIES: AttackIntensity[] = ["low", "medium", "high", "extreme"];

const fieldClass =
  "w-full rounded-md border border-cyber-pink/25 bg-slate-950/60 px-3 py-1.5 font-mono text-xs text-foreground outline-none transition-colors focus:border-cyber-pink";

const labelClass = "mb-1 block text-[11px] uppercase tracking-wider text-muted-foreground";

/** Attack configuration form. Emits a fully typed AttackConfig. */
export function AttackConfigForm({
  definition,
  config,
  onChange,
  onEnqueue,
}: {
  definition: AttackCatalogEntry | null;
  config: AttackConfig;
  onChange: (patch: Partial<AttackConfig>) => void;
  onEnqueue: () => void;
}) {
  if (!definition) {
    return (
      <EmptyState
        icon={<Crosshair className="h-6 w-6" />}
        title="No attack selected"
        description="Pick a technique from the catalog to configure an operation."
      />
    );
  }

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        onEnqueue();
      }}
    >
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label className={labelClass} htmlFor="cfg-target">
            Target
          </label>
          <input
            id="cfg-target"
            value={config.target}
            onChange={(e) => onChange({ target: e.target.value })}
            className={fieldClass}
            placeholder="10.0.4.22"
          />
        </div>

        <div>
          <label className={labelClass} htmlFor="cfg-variant">
            Payload variant
          </label>
          <select
            id="cfg-variant"
            value={config.payloadVariant}
            onChange={(e) => onChange({ payloadVariant: e.target.value })}
            className={fieldClass}
          >
            {definition.payloadVariants.map((v) => (
              <option key={v} value={v}>
                {v}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <span className={labelClass}>Attack intensity</span>
        <div className="flex flex-wrap gap-2">
          {INTENSITIES.map((level) => (
            <button
              key={level}
              type="button"
              onClick={() => onChange({ intensity: level })}
              className={cn(
                "rounded-md border px-3 py-1.5 text-xs font-semibold uppercase tracking-wider transition-colors",
                config.intensity === level
                  ? "border-cyber-pink/60 bg-cyber-pink/15 text-cyber-pink"
                  : "border-border text-muted-foreground hover:text-foreground",
              )}
            >
              {level}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label className={labelClass} htmlFor="cfg-duration">
            Duration — {config.durationSec}s
          </label>
          <input
            id="cfg-duration"
            type="range"
            min={10}
            max={180}
            step={5}
            value={config.durationSec}
            onChange={(e) => onChange({ durationSec: Number(e.target.value) })}
            className="w-full accent-[var(--cyber-pink)]"
          />
        </div>

        <div>
          <label className={labelClass} htmlFor="cfg-rate">
            Packet rate — {config.packetRate.toLocaleString()} pkt/s
          </label>
          <input
            id="cfg-rate"
            type="range"
            min={10}
            max={5000}
            step={10}
            value={config.packetRate}
            onChange={(e) => onChange({ packetRate: Number(e.target.value) })}
            className="w-full accent-[var(--cyber-pink)]"
          />
        </div>
      </div>

      <div className="rounded-md border border-cyber-blue/25 bg-cyber-blue/5 px-3 py-2">
        <label className="flex cursor-pointer items-center gap-2" htmlFor="cfg-pcap">
          <Upload className="h-3.5 w-3.5 text-cyber-blue" />
          <span className="min-w-0 flex-1">
            <span className="block text-xs font-semibold text-foreground">
              {config.pcapFile
                ? "Capture selected — real traffic"
                : "Attach real traffic capture (optional)"}
            </span>
            <span className="truncate font-mono text-[10px] text-muted-foreground">
              {config.pcapFile
                ? `${config.pcapFile.name} · ${(config.pcapFile.size / 1024).toFixed(1)} KB`
                : "Upload a .pcap/.pcapng file — every flow drives the full ML pipeline"}
            </span>
          </span>
          <FileSearch className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        </label>
        <input
          id="cfg-pcap"
          type="file"
          accept=".pcap,.pcapng,application/vnd.tcpdump.pcap,application/x-pcapng"
          className="sr-only"
          onChange={(e) => {
            const file = e.target.files?.[0] ?? null;
            onChange({ pcapFile: file });
          }}
        />
        {config.pcapFile && (
          <button
            type="button"
            onClick={() => onChange({ pcapFile: null })}
            className="mt-1.5 rounded border border-cyber-blue/30 px-2 py-0.5 text-[10px] font-semibold text-cyber-blue transition-colors hover:bg-cyber-blue/10"
          >
            Remove capture
          </button>
        )}
      </div>

      <label className="flex items-center justify-between rounded-md border border-cyber-purple/25 bg-cyber-purple/5 px-3 py-2">
        <span>
          <span className="block text-xs font-semibold text-foreground">Stealth mode</span>
          <span className="text-[11px] text-muted-foreground">
            Low-and-slow traffic from an internal source to evade Tier-0 signatures
          </span>
        </span>
        <input
          type="checkbox"
          checked={config.stealthMode}
          onChange={(e) => onChange({ stealthMode: e.target.checked })}
          className="h-4 w-4 accent-[var(--cyber-purple)]"
        />
      </label>

      <div>
        <label className={labelClass} htmlFor="cfg-notes">
          Attack notes
        </label>
        <textarea
          id="cfg-notes"
          rows={2}
          value={config.notes}
          onChange={(e) => onChange({ notes: e.target.value })}
          className={cn(fieldClass, "resize-none")}
          placeholder="Operator context for this run…"
        />
      </div>

      <button
        type="submit"
        className="w-full rounded-md border border-cyber-pink/50 bg-cyber-pink/15 px-4 py-2 text-sm font-semibold text-cyber-pink transition-colors hover:bg-cyber-pink/25 disabled:cursor-not-allowed disabled:opacity-40"
      >
        {config.pcapFile
          ? `Add “${definition.name}” with capture to queue`
          : `Add “${definition.name}” to queue`}
      </button>
    </form>
  );
}
