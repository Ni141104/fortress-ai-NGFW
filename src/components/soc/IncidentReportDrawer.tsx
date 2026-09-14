import { useMemo, useRef } from "react";
import { AlertTriangle, Download, FileJson, FileText, Printer, Shield } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { LiveTimeline } from "@/components/simulation/LiveTimeline";
import { ConfidenceBar, SeverityChip, StatusBadge, Tag, TimelineItem } from "@/components/ui/cyber";
import { usePlatform } from "@/lib/platform-store";
import { deriveThreatRows } from "@/lib/soc-selectors";
import type { SimulationSnapshot } from "@/types/simulation";

const RECOMMENDED_ACTIONS: Record<string, string[]> = {
  critical: [
    "Isolate source IP at perimeter firewall immediately",
    "Initiate full packet capture on affected segment",
    "Escalate to Tier-3 incident response team",
    "Review MITRE technique for lateral movement indicators",
  ],
  high: [
    "Apply quarantine policy to source host",
    "Review RL decision log for policy tuning",
    "Update Tier-0 signature rules from captured payload",
  ],
  medium: [
    "Monitor source for 24h with elevated logging",
    "Validate policy enforcement across edge nodes",
  ],
  low: ["Log incident for trend analysis", "Schedule routine policy review"],
};

function riskLevel(confidence: number, severity: string): { label: string; tone: string } {
  const score = confidence * 100;
  if (severity === "critical" || score > 85) return { label: "CRITICAL", tone: "text-cyber-pink" };
  if (severity === "high" || score > 70) return { label: "HIGH", tone: "text-cyber-purple" };
  if (severity === "medium" || score > 50) return { label: "MEDIUM", tone: "text-cyber-amber" };
  return { label: "LOW", tone: "text-cyber-green" };
}

/** Professional incident report drawer with print and export actions. */
export function IncidentReportDrawer({ snapshot }: { snapshot: SimulationSnapshot }) {
  const { reportAttackId, closeReport, openJourney } = usePlatform();
  const printRef = useRef<HTMLDivElement>(null);

  const row = useMemo(() => {
    const rows = deriveThreatRows(snapshot);
    const attack = snapshot.queue.find(
      (a) => a.id === reportAttackId || a.backendId === reportAttackId,
    );
    return rows.find((r) => r.id === attack?.id) ?? null;
  }, [snapshot, reportAttackId]);

  const events = useMemo(
    () => (row ? snapshot.events.filter((e) => e.attackId === row.id) : []),
    [snapshot.events, row],
  );

  const policies = useMemo(() => events.filter((e) => e.type === "policy"), [events]);

  const rlDecisions = useMemo(
    () => events.filter((e) => e.type === "timeline" && e.title.toLowerCase().includes("rl")),
    [events],
  );

  const mitreEvents = useMemo(() => events.filter((e) => e.type === "threat"), [events]);

  const reportData = useMemo(() => {
    if (!row) return null;
    return {
      generatedAt: new Date().toISOString(),
      incident: {
        id: row.id,
        name: row.name,
        kind: row.kind,
        severity: row.severity,
        state: row.state,
        sourceIp: row.sourceIp,
        target: row.target,
        mitreTechniqueId: row.mitreTechniqueId,
        mitreTactic: row.mitreTactic,
        confidence: row.confidence,
        verdict: row.verdict,
        packetsSent: row.packetsSent,
        packetsBlocked: row.packetsBlocked,
      },
      timeline: events.map((e) => ({
        id: e.id,
        type: e.type,
        title: e.title,
        description: e.description,
        timestamp: e.timestamp,
      })),
      mitreTechniques: mitreEvents.map((e) => e.title),
      rlDecisions: rlDecisions.map((e) => ({ title: e.title, description: e.description })),
      policyChanges: policies.map((e) => ({
        rule: e.rule,
        action: e.action,
        description: e.description,
      })),
      threatScore: Math.round(row.confidence * 100),
      riskLevel: riskLevel(row.confidence, row.severity).label,
      recommendedActions: RECOMMENDED_ACTIONS[row.severity] ?? RECOMMENDED_ACTIONS["low"],
    };
  }, [row, events, mitreEvents, rlDecisions, policies]);

  const handlePrint = () => {
    window.print();
  };

  const handleJsonExport = () => {
    if (!reportData) return;
    const blob = new Blob([JSON.stringify(reportData, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `incident-${row?.id ?? "report"}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handlePdfExport = () => {
    // UI-only PDF export — opens print dialog as PDF fallback
    alert("PDF export: use Print → Save as PDF from the print dialog.");
    handlePrint();
  };

  const risk = row ? riskLevel(row.confidence, row.severity) : null;
  const detectionEvents = events.filter(
    (event) =>
      event.type === "threat" ||
      event.type === "policy" ||
      (event.type === "timeline" && !event.title.toLowerCase().includes("simulation completed")),
  );

  return (
    <Sheet open={Boolean(row)} onOpenChange={(open) => !open && closeReport()}>
      <SheetContent
        side="right"
        className="glass-panel w-full overflow-y-auto border-cyber-green/25 sm:max-w-2xl print:max-w-none"
      >
        {row && reportData && (
          <>
            <SheetHeader className="space-y-2 print:mb-4">
              <div className="flex flex-wrap items-center gap-2">
                <SeverityChip severity={row.severity} size="sm" />
                <StatusBadge status={row.state === "blocked" ? "block" : row.state} />
                {risk && (
                  <span className={`font-mono text-[11px] font-bold ${risk.tone}`}>
                    RISK: {risk.label}
                  </span>
                )}
              </div>
              <SheetTitle className="flex items-center gap-2 text-base">
                <FileText className="h-4 w-4 text-cyber-green" />
                Incident Report — {row.name}
              </SheetTitle>
              <SheetDescription className="font-mono text-xs">
                {row.id} · Generated {new Date().toLocaleString()}
              </SheetDescription>
            </SheetHeader>

            {/* Export actions — hidden in print */}
            <div className="flex flex-wrap gap-2 px-4 print:hidden">
              <button
                onClick={() => openJourney(row.id)}
                className="inline-flex items-center gap-1 rounded-md border border-cyber-purple/40 bg-cyber-purple/10 px-3 py-1.5 text-xs font-semibold text-cyber-purple hover:bg-cyber-purple/20"
              >
                <FileText className="h-3.5 w-3.5" /> Open Journey
              </button>
              <button
                onClick={handlePrint}
                className="inline-flex items-center gap-1 rounded-md border border-cyber-blue/40 bg-cyber-blue/10 px-3 py-1.5 text-xs font-semibold text-cyber-blue hover:bg-cyber-blue/20"
              >
                <Printer className="h-3.5 w-3.5" /> Print View
              </button>
              <button
                onClick={handleJsonExport}
                className="inline-flex items-center gap-1 rounded-md border border-cyber-purple/40 bg-cyber-purple/10 px-3 py-1.5 text-xs font-semibold text-cyber-purple hover:bg-cyber-purple/20"
              >
                <FileJson className="h-3.5 w-3.5" /> JSON Export
              </button>
              <button
                onClick={handlePdfExport}
                className="inline-flex items-center gap-1 rounded-md border border-cyber-green/40 bg-cyber-green/10 px-3 py-1.5 text-xs font-semibold text-cyber-green hover:bg-cyber-green/20"
              >
                <Download className="h-3.5 w-3.5" /> PDF Export
              </button>
            </div>

            <div ref={printRef} className="space-y-6 px-4 pb-8 print:px-0">
              {/* Attack Summary */}
              <section>
                <h4 className="mb-2 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-cyber-green">
                  <Shield className="h-3.5 w-3.5" /> Attack Summary
                </h4>
                <dl className="grid grid-cols-2 gap-3 rounded-lg border border-cyber-green/15 bg-slate-950/40 p-3">
                  {[
                    ["Attack", row.name],
                    ["Kind", row.kind],
                    ["Source", row.sourceIp],
                    ["Target", row.target],
                    ["MITRE", `${row.mitreTechniqueId} · ${row.mitreTactic}`],
                    ["Verdict", row.verdict ?? "pending"],
                    ["Packets sent", row.packetsSent.toLocaleString()],
                    ["Packets blocked", row.packetsBlocked.toLocaleString()],
                  ].map(([label, value]) => (
                    <div key={label}>
                      <dt className="text-[10px] uppercase tracking-wider text-muted-foreground">
                        {label}
                      </dt>
                      <dd className="font-mono text-xs text-foreground">{value}</dd>
                    </div>
                  ))}
                </dl>
                <div className="mt-3">
                  <ConfidenceBar label="Threat score" value={row.confidence} tone="pink" />
                </div>
              </section>

              {/* Risk snapshot */}
              <section>
                <h4 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-cyber-green">
                  Risk Level
                </h4>
                <div className="grid grid-cols-2 gap-3 rounded-lg border border-cyber-green/15 bg-slate-950/40 p-3 md:grid-cols-4">
                  <Metric
                    label="Threat score"
                    value={`${Math.round(row.confidence * 100)}%`}
                    tone="pink"
                  />
                  <Metric
                    label="Risk"
                    value={risk?.label ?? "LOW"}
                    tone={risk?.tone ?? "text-cyber-green"}
                  />
                  <Metric label="Verdict" value={row.verdict ?? "pending"} tone="blue" />
                  <Metric
                    label="Packets contained"
                    value={row.packetsBlocked.toLocaleString()}
                    tone="green"
                  />
                </div>
              </section>

              {/* Timeline */}
              <section>
                <h4 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-cyber-green">
                  Timeline
                </h4>
                <LiveTimeline events={events} limit={12} />
              </section>

              {/* Detection Timeline */}
              <section>
                <h4 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-cyber-green">
                  Detection Timeline
                </h4>
                {detectionEvents.length === 0 ? (
                  <p className="text-xs text-muted-foreground">No detection events recorded yet.</p>
                ) : (
                  <ul>
                    {detectionEvents.map((event, index) => (
                      <TimelineItem
                        key={event.id}
                        title={event.title}
                        description={event.description}
                        timestamp={event.timestamp}
                        severity={event.severity}
                        isLast={index === detectionEvents.length - 1}
                      />
                    ))}
                  </ul>
                )}
              </section>

              {/* MITRE Techniques */}
              <section>
                <h4 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-cyber-green">
                  MITRE Techniques
                </h4>
                {mitreEvents.length === 0 ? (
                  <p className="text-xs text-muted-foreground">No MITRE mappings recorded.</p>
                ) : (
                  <ul className="space-y-1">
                    {mitreEvents.map((e) => (
                      <li key={e.id} className="flex items-center gap-2 text-xs">
                        <Tag>{row.mitreTechniqueId}</Tag>
                        <span>{e.title}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              {/* RL Decisions */}
              <section>
                <h4 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-cyber-green">
                  RL Decisions
                </h4>
                {rlDecisions.length === 0 ? (
                  <p className="text-xs text-muted-foreground">No RL decisions logged.</p>
                ) : (
                  <ul>
                    {rlDecisions.map((e, i) => (
                      <TimelineItem
                        key={e.id}
                        title={e.title}
                        description={e.description}
                        timestamp={e.timestamp}
                        severity={e.severity}
                        isLast={i === rlDecisions.length - 1}
                      />
                    ))}
                  </ul>
                )}
              </section>

              {/* Policy Changes */}
              <section>
                <h4 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-cyber-green">
                  Policy Changes
                </h4>
                {policies.length === 0 ? (
                  <p className="text-xs text-muted-foreground">No policy changes applied.</p>
                ) : (
                  <ul className="space-y-2">
                    {policies.map((p) => (
                      <li
                        key={p.id}
                        className="rounded border border-cyber-green/15 px-3 py-2 font-mono text-[11px]"
                      >
                        {p.rule}
                        <p className="mt-0.5 text-muted-foreground">{p.description}</p>
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              {/* Recommended Actions */}
              <section>
                <h4 className="mb-2 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-cyber-green">
                  <AlertTriangle className="h-3.5 w-3.5" /> Recommended Actions
                </h4>
                <ol className="list-decimal space-y-1 pl-5 text-xs text-foreground">
                  {(RECOMMENDED_ACTIONS[row.severity] ?? RECOMMENDED_ACTIONS["low"]!).map((action) => (
                    <li key={action}>{action}</li>
                  ))}
                </ol>
              </section>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}

function Metric({ label, value, tone }: { label: string; value: string; tone: string }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className={`mt-0.5 font-mono text-xs font-semibold ${tone}`}>{value}</p>
    </div>
  );
}
