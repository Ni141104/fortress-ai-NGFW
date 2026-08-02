import { Fragment, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowDown, ArrowUp, ChevronRight, Radar, Search, X } from "lucide-react";
import { ConfidenceBar, EmptyState, SeverityChip, StatusBadge, Tag } from "@/components/ui/cyber";
import { cn } from "@/lib/utils";
import { SEVERITY_RANK } from "@/lib/soc-selectors";
import { useSoc } from "@/lib/soc-store";
import type { Severity } from "@/types";
import type { ThreatRow } from "@/types/soc";

type SortKey = "name" | "state" | "stageLabel" | "severity" | "confidence" | "target" | "startedAt";

const SEVERITIES: Array<Severity | "all"> = ["all", "critical", "high", "medium", "low"];

const stateTone: Record<string, string> = {
  running: "healthy",
  queued: "idle",
  paused: "warning",
  blocked: "block",
  completed: "redirect",
  unknown: "warning",
  cancelled: "offline",
};

/** Enterprise threat table — sorting, search, severity filters, expandable rows. */
export function ActiveThreatMonitor({ rows }: { rows: ThreatRow[] }) {
  const { openIncident } = useSoc();
  const [query, setQuery] = useState("");
  const [severity, setSeverity] = useState<Severity | "all">("all");
  const [sortKey, setSortKey] = useState<SortKey>("startedAt");
  const [asc, setAsc] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = rows.filter((row) => {
      if (severity !== "all" && row.severity !== severity) return false;
      if (!q) return true;
      return [row.name, row.id, row.target, row.sourceIp, row.mitreTechniqueId, row.stageLabel, row.state]
        .join(" ")
        .toLowerCase()
        .includes(q);
    });

    return [...filtered].sort((a, b) => {
      const dir = asc ? 1 : -1;
      if (sortKey === "severity") return (SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity]) * dir;
      if (sortKey === "confidence") return (a.confidence - b.confidence) * dir;
      if (sortKey === "startedAt")
        return (new Date(a.startedAt).getTime() - new Date(b.startedAt).getTime()) * dir;
      return String(a[sortKey]).localeCompare(String(b[sortKey])) * dir;
    });
  }, [rows, query, severity, sortKey, asc]);

  const toggleSort = (key: SortKey) => {
    if (key === sortKey) setAsc((v) => !v);
    else {
      setSortKey(key);
      setAsc(false);
    }
  };

  const header = (key: SortKey, label: string, className?: string) => (
    <th scope="col" className={cn("px-3 py-2 text-left font-semibold", className)}>
      <button
        onClick={() => toggleSort(key)}
        className={cn(
          "inline-flex items-center gap-1 rounded transition-colors hover:text-cyber-blue focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyber-blue/60",
          sortKey === key ? "text-cyber-blue" : "text-muted-foreground",
        )}
        aria-label={`Sort by ${label}`}
      >
        {label}
        {sortKey === key &&
          (asc ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />)}
      </button>
    </th>
  );

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[12rem] flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search attacks, targets, techniques…"
            aria-label="Search threats"
            className="w-full rounded-md border border-cyber-blue/25 bg-slate-950/50 py-1.5 pl-8 pr-8 text-xs text-foreground placeholder:text-muted-foreground focus:border-cyber-blue/60 focus:outline-none"
          />
          {query && (
            <button
              onClick={() => setQuery("")}
              aria-label="Clear search"
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
        <div className="flex flex-wrap gap-1">
          {SEVERITIES.map((s) => (
            <button
              key={s}
              onClick={() => setSeverity(s)}
              className={cn(
                "rounded px-2 py-1 text-[11px] font-semibold uppercase tracking-wide transition-colors",
                severity === s
                  ? "bg-cyber-blue/20 text-cyber-blue"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {visible.length === 0 ? (
        <EmptyState
          icon={<Radar className="h-6 w-6" />}
          title="No threats match the current view"
          description="Launch an operation from the Red Team portal or relax the dashboard filters."
        />
      ) : (
        <div className="max-h-[30rem] overflow-auto rounded-lg border border-cyber-blue/15">
          <table className="w-full min-w-[62rem] border-collapse text-xs">
            <thead className="sticky top-0 z-10 bg-slate-950/95 text-[11px] uppercase tracking-wider backdrop-blur">
              <tr className="border-b border-cyber-blue/20">
                <th scope="col" className="w-8 px-2 py-2" />
                {header("name", "Attack")}
                {header("state", "Status")}
                {header("stageLabel", "Stage")}
                {header("severity", "Severity")}
                <th scope="col" className="px-3 py-2 text-left font-semibold text-muted-foreground">
                  MITRE
                </th>
                {header("confidence", "Confidence")}
                {header("target", "Target")}
                {header("startedAt", "Time")}
                <th scope="col" className="px-3 py-2 text-left font-semibold text-muted-foreground">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {visible.map((row) => {
                const open = expanded === row.id;
                return (
                  <Fragment key={row.id}>
                    <tr
                      className="border-b border-cyber-blue/10 transition-colors hover:bg-cyber-blue/5"
                    >
                      <td className="px-2 py-2">
                        <button
                          onClick={() => setExpanded(open ? null : row.id)}
                          aria-label={open ? "Collapse row" : "Expand row"}
                          aria-expanded={open}
                          className="rounded p-1 text-muted-foreground transition-colors hover:text-cyber-blue focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyber-blue/60"
                        >
                          <ChevronRight
                            className={cn("h-3.5 w-3.5 transition-transform", open && "rotate-90")}
                          />
                        </button>
                      </td>
                      <td className="px-3 py-2">
                        <button
                          onClick={() => openIncident(row.id)}
                          className="text-left font-medium text-foreground transition-colors hover:text-cyber-blue focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyber-blue/60"
                        >
                          {row.name}
                        </button>
                        <div className="font-mono text-[10px] text-muted-foreground">{row.id}</div>
                      </td>
                      <td className="px-3 py-2">
                        <StatusBadge status={stateTone[row.state] ?? row.state} />
                        <div className="mt-0.5 text-[10px] uppercase text-muted-foreground">
                          {row.state}
                        </div>
                      </td>
                      <td className="px-3 py-2 text-muted-foreground">{row.stageLabel}</td>
                      <td className="px-3 py-2">
                        <SeverityChip severity={row.severity} size="sm" />
                      </td>
                      <td className="px-3 py-2">
                        <Tag>{row.mitreTechniqueId}</Tag>
                      </td>
                      <td className="w-32 px-3 py-2">
                        <ConfidenceBar value={row.confidence} showPercentage />
                      </td>
                      <td className="px-3 py-2 font-mono text-[11px] text-muted-foreground">
                        {row.target}
                      </td>
                      <td className="px-3 py-2 font-mono text-[11px] text-muted-foreground">
                        {new Date(row.startedAt).toLocaleTimeString()}
                      </td>
                      <td className="px-3 py-2">
                        <button
                          onClick={() => openIncident(row.id)}
                          className="rounded-md border border-cyber-blue/40 px-2 py-1 text-[11px] font-semibold text-cyber-blue transition-colors hover:bg-cyber-blue/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyber-blue/60"
                        >
                          Investigate
                        </button>
                      </td>
                    </tr>
                    <AnimatePresence initial={false}>
                      {open && (
                        <tr key={`${row.id}-detail`}>
                          <td colSpan={10} className="bg-slate-950/40 px-0 py-0">
                            <motion.div
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: "auto", opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              transition={{ duration: 0.25 }}
                              className="overflow-hidden"
                            >
                              <dl className="grid grid-cols-2 gap-4 px-6 py-4 md:grid-cols-4">
                                {[
                                  ["Source", row.sourceIp],
                                  ["Environment", row.environment],
                                  ["Tactic", row.mitreTactic],
                                  ["Verdict", row.verdict],
                                  ["Packets sent", row.packetsSent.toLocaleString()],
                                  ["Packets blocked", row.packetsBlocked.toLocaleString()],
                                  ["Progress", `${row.progress.toFixed(0)}%`],
                                  ["Last update", new Date(row.updatedAt).toLocaleTimeString()],
                                ].map(([label, value]) => (
                                  <div key={label}>
                                    <dt className="text-[10px] uppercase tracking-wider text-muted-foreground">
                                      {label}
                                    </dt>
                                    <dd className="font-mono text-xs text-foreground">{value}</dd>
                                  </div>
                                ))}
                              </dl>
                            </motion.div>
                          </td>
                        </tr>
                      )}
                    </AnimatePresence>
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}