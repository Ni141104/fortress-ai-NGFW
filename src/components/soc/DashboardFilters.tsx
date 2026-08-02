import { RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";
import { useSoc } from "@/lib/soc-store";
import type { SocFilters } from "@/types/soc";

const selectClass =
  "rounded-md border border-cyber-blue/25 bg-slate-950/60 px-2 py-1.5 text-xs text-foreground focus:border-cyber-blue/60 focus:outline-none";

const OPTIONS: Array<{
  key: keyof SocFilters;
  label: string;
  values: string[];
}> = [
  { key: "timeRange", label: "Time range", values: ["all", "5m", "15m", "1h", "24h"] },
  { key: "severity", label: "Severity", values: ["all", "critical", "high", "medium", "low"] },
  {
    key: "attackType",
    label: "Attack type",
    values: [
      "all",
      "sql-injection",
      "xss",
      "port-scan",
      "ssh-brute-force",
      "ddos",
      "malware-download",
      "dns-tunneling",
      "insider-threat",
      "zero-day",
    ],
  },
  {
    key: "status",
    label: "Status",
    values: ["all", "queued", "running", "paused", "blocked", "completed", "unknown", "cancelled"],
  },
  {
    key: "environment",
    label: "Environment",
    values: ["all", "production", "staging", "dmz", "lab"],
  },
];

/** Global filter bar — every SOC widget reacts to it through useSocData. */
export function DashboardFilters({ attackTypes }: { attackTypes?: string[] }) {
  const { filters, setFilter, resetFilters, activeFilterCount } = useSoc();

  return (
    <div className="glass-panel flex flex-wrap items-end gap-3 rounded-xl border border-cyber-blue/20 px-4 py-3">
      {OPTIONS.map((option) => {
        const values =
          option.key === "attackType" && attackTypes?.length
            ? ["all", ...attackTypes]
            : option.values;
        return (
          <label key={option.key} className="flex flex-col gap-1">
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
              {option.label}
            </span>
            <select
              className={selectClass}
              value={String(filters[option.key])}
              onChange={(e) =>
                setFilter(option.key, e.target.value as SocFilters[typeof option.key])
              }
            >
              {values.map((v) => (
                <option key={v} value={v}>
                  {v === "all" ? "All" : v}
                </option>
              ))}
            </select>
          </label>
        );
      })}

      <label className="flex flex-col gap-1">
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Target</span>
        <input
          value={filters.target}
          onChange={(e) => setFilter("target", e.target.value)}
          placeholder="10.0.0.0"
          className={cn(selectClass, "w-36 placeholder:text-muted-foreground")}
        />
      </label>

      <button
        onClick={resetFilters}
        disabled={activeFilterCount === 0}
        className="ml-auto inline-flex items-center gap-1.5 rounded-md border border-cyber-blue/30 px-2.5 py-1.5 text-xs text-cyber-blue transition-colors hover:bg-cyber-blue/10 disabled:opacity-40"
      >
        <RotateCcw className="h-3.5 w-3.5" />
        Reset{activeFilterCount > 0 ? ` (${activeFilterCount})` : ""}
      </button>
    </div>
  );
}