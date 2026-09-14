import { useMemo, useState } from "react";
import { AlertCircle, FileCode, GitBranch, History, RotateCcw, ShieldCheck } from "lucide-react";
import { WidgetCard } from "@/components/layout/WidgetCard";
import { ConfidenceBar, EmptyState, SeverityChip, StatusBadge, Tag } from "@/components/ui/cyber";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { rollbackPolicy } from "@/services";
import { useSoc } from "@/lib/soc-store";
import { cn } from "@/lib/utils";
import type { PolicyRule, PolicySummary } from "@/types/ai";
import type { PolicyVersion } from "@/types";

/** Reusable Tier-0 Policy Repository widget with rule details + version comparison. */
export function PolicyRepositoryWidget({ summary }: { summary: PolicySummary }) {
  const { openXai } = useSoc();
  const [tab, setTab] = useState<"rules" | "versions" | "diff">("rules");
  const [selectedRule, setSelectedRule] = useState<PolicyRule | null>(null);
  const [comparePair, setComparePair] = useState<[PolicyVersion, PolicyVersion] | null>(null);
  const [rollingBack, setRollingBack] = useState(false);
  const [rollbackNotice, setRollbackNotice] = useState<string | null>(null);

  const handleRollback = () => {
    if (rollingBack) return;
    setRollingBack(true);
    setRollbackNotice(null);
    void rollbackPolicy()
      .then((result) =>
        setRollbackNotice(result.message ?? `${result.rolled_back_rules} learned rule(s) reverted`),
      )
      .catch((error: Error) => setRollbackNotice(error.message ?? "Rollback failed"))
      .finally(() => setRollingBack(false));
  };

  return (
    <>
      <WidgetCard
        title="Tier-0 Policy Repository"
        subtitle={`${summary.currentVersion.version} · ${summary.ruleCount} rules`}
        icon={<FileCode className="h-4 w-4" />}
        actions={
          <button
            className="inline-flex items-center gap-1 rounded-md border border-cyber-blue/30 px-2 py-1 text-[11px] font-semibold text-cyber-blue transition-colors hover:bg-cyber-blue/10 disabled:opacity-40"
            onClick={handleRollback}
            disabled={rollingBack || Boolean(rollbackNotice)}
            title={rollbackNotice ? "Rollback completed — refresh the SOC feed" : undefined}
          >
            <RotateCcw className="h-3 w-3" /> {rollingBack ? "Rolling back…" : "Rollback"}
          </button>
        }
      >
        <div className="space-y-4">
          {rollbackNotice && (
            <div className="flex items-center gap-2 rounded-md border border-cyber-amber/40 bg-cyber-amber/10 px-3 py-2 text-[11px] text-cyber-amber">
              <AlertCircle className="h-3.5 w-3.5 shrink-0" />
              <span className="font-mono">{rollbackNotice}</span>
            </div>
          )}
          {/* Summary stats */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <PolStat
              label="Version"
              value={summary.currentVersion.version}
              icon={<GitBranch className="h-3 w-3" />}
              tone="blue"
            />
            <PolStat
              label="Rules"
              value={String(summary.ruleCount)}
              icon={<FileCode className="h-3 w-3" />}
              tone="green"
            />
            <PolStat
              label="Enforced"
              value={String(summary.enforcementActions)}
              icon={<ShieldCheck className="h-3 w-3" />}
              tone="amber"
            />
            <PolStat
              label="Confidence"
              value={`${(summary.confidence * 100).toFixed(0)}%`}
              icon={<ShieldCheck className="h-3 w-3" />}
              tone="purple"
            />
          </div>

          <div>
            <ConfidenceBar label="Policy confidence" value={summary.confidence} tone="green" />
          </div>

          {/* Tabs */}
          <div className="flex flex-wrap gap-1">
            {(
              [
                ["rules", "Recent Rules"],
                ["versions", "Version History"],
                ["diff", "Diff Summary"],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                onClick={() => setTab(id)}
                className={cn(
                  "rounded px-2 py-1 text-[11px] font-semibold transition-colors",
                  tab === id
                    ? "bg-cyber-blue/20 text-cyber-blue"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {label}
              </button>
            ))}
          </div>

          {/* Recent rules */}
          {tab === "rules" && (
            <div>
              {summary.recentRules.length === 0 ? (
                <EmptyState
                  icon={<FileCode className="h-6 w-6" />}
                  title="No rules installed yet"
                  description="Enforcement rules appear as the RL agent blocks threats."
                />
              ) : (
                <ul className="max-h-52 space-y-1.5 overflow-y-auto pr-1">
                  {summary.recentRules.map((rule) => (
                    <li key={rule.id}>
                      <button
                        onClick={() => setSelectedRule(rule)}
                        className="flex w-full items-center gap-2 rounded-lg border border-cyber-blue/15 bg-slate-950/40 px-3 py-2 text-left transition-colors hover:border-cyber-blue/40 hover:bg-cyber-blue/5"
                      >
                        <StatusBadge
                          status={
                            rule.action === "block"
                              ? "block"
                              : rule.action === "quarantine"
                                ? "quarantine"
                                : rule.action === "redirect"
                                  ? "redirect"
                                  : "allow"
                          }
                        />
                        <SeverityChip severity={rule.severity} size="sm" showIcon={false} />
                        <span className="min-w-0 flex-1 truncate font-mono text-[11px] text-foreground">
                          {rule.rule}
                        </span>
                        <span className="font-mono text-[10px] text-muted-foreground">
                          {new Date(rule.timestamp).toLocaleTimeString()}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {/* Version history */}
          {tab === "versions" && (
            <div className="space-y-2">
              {summary.versionHistory.map((v, i) => (
                <div
                  key={v.version}
                  className="flex items-center gap-3 rounded-lg border border-cyber-blue/15 bg-slate-950/40 px-3 py-2"
                >
                  <Tag>{v.version}</Tag>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[11px] text-muted-foreground">
                      {v.ruleCount} rules · +{v.added} / -{v.removed} · {v.author}
                    </p>
                    <p className="font-mono text-[10px] text-muted-foreground">
                      {new Date(v.publishedAt).toLocaleString()}
                    </p>
                  </div>
                  <StatusBadge status={v.rolloutPercent >= 100 ? "healthy" : "warning"} />
                  {i < summary.versionHistory.length - 1 && (
                    <button
                      onClick={() =>
                        setComparePair([summary.versionHistory[i]!, summary.versionHistory[i + 1]!])
                      }
                      className="rounded border border-cyber-blue/30 px-2 py-0.5 text-[10px] font-semibold text-cyber-blue transition-colors hover:bg-cyber-blue/10"
                    >
                      Compare
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Diff summary */}
          {tab === "diff" && (
            <div className="space-y-2">
              {summary.diffSummary.map((d) => (
                <div
                  key={d.version}
                  className="rounded-lg border border-cyber-blue/15 bg-slate-950/40 px-3 py-2"
                >
                  <div className="flex items-center gap-2">
                    <Tag>{d.version}</Tag>
                    <span className="ml-auto font-mono text-[10px] text-muted-foreground">
                      {d.ruleCount} rules
                    </span>
                  </div>
                  <div className="mt-2 grid grid-cols-3 gap-2 text-center">
                    <div>
                      <p className="text-[10px] uppercase text-muted-foreground">Added</p>
                      <p className="font-mono text-sm font-bold text-cyber-green">+{d.added}</p>
                    </div>
                    <div>
                      <p className="text-[10px] uppercase text-muted-foreground">Removed</p>
                      <p className="font-mono text-sm font-bold text-cyber-pink">-{d.removed}</p>
                    </div>
                    <div>
                      <p className="text-[10px] uppercase text-muted-foreground">Modified</p>
                      <p className="font-mono text-sm font-bold text-cyber-amber">~{d.modified}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </WidgetCard>

      {/* Rule details drawer */}
      <RuleDetailsDrawer
        rule={selectedRule}
        onClose={() => setSelectedRule(null)}
        onExplain={(id) => {
          setSelectedRule(null);
          openXai(id, "policy");
        }}
      />

      {/* Version comparison drawer */}
      <VersionCompareDrawer pair={comparePair} onClose={() => setComparePair(null)} />
    </>
  );
}

function RuleDetailsDrawer({
  rule,
  onClose,
  onExplain,
}: {
  rule: PolicyRule | null;
  onClose: () => void;
  onExplain: (id: string) => void;
}) {
  return (
    <Sheet open={Boolean(rule)} onOpenChange={(open) => !open && onClose()}>
      <SheetContent
        side="right"
        className="glass-panel w-full overflow-y-auto border-cyber-blue/25 sm:max-w-md"
      >
        {rule && (
          <>
            <SheetHeader className="space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <Tag>{rule.version}</Tag>
                <SeverityChip severity={rule.severity} size="sm" />
                <StatusBadge
                  status={
                    rule.action === "block"
                      ? "block"
                      : rule.action === "quarantine"
                        ? "quarantine"
                        : rule.action === "redirect"
                          ? "redirect"
                          : "allow"
                  }
                />
              </div>
              <SheetTitle className="font-mono text-sm text-foreground">Rule details</SheetTitle>
              <SheetDescription className="font-mono text-xs">{rule.rule}</SheetDescription>
            </SheetHeader>

            <div className="space-y-5 px-4 pb-8">
              <section>
                <h4 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-cyber-blue">
                  Rule attributes
                </h4>
                <dl className="grid grid-cols-2 gap-3">
                  {[
                    ["Rule ID", rule.id],
                    ["Action", rule.action.toUpperCase()],
                    ["Version", rule.version],
                    ["Timestamp", new Date(rule.timestamp).toLocaleString()],
                    ["Attack ID", rule.attackId ?? "—"],
                    ["Severity", rule.severity],
                  ].map(([label, value]) => (
                    <div
                      key={label}
                      className="rounded-lg border border-cyber-blue/15 bg-slate-950/40 px-3 py-2"
                    >
                      <dt className="text-[10px] uppercase tracking-wider text-muted-foreground">
                        {label}
                      </dt>
                      <dd className="mt-0.5 font-mono text-xs text-foreground">{value}</dd>
                    </div>
                  ))}
                </dl>
              </section>

              <div>
                <ConfidenceBar label="Rule confidence" value={rule.confidence} tone="blue" />
              </div>

              <button
                onClick={() => rule.attackId && onExplain(rule.attackId)}
                disabled={!rule.attackId}
                className="flex w-full items-center justify-center gap-2 rounded-md border border-cyber-purple/40 bg-cyber-purple/10 px-4 py-2 text-sm font-semibold text-cyber-purple transition-colors hover:bg-cyber-purple/20 disabled:opacity-40"
              >
                <GitBranch className="h-3.5 w-3.5" /> Explain with AI
              </button>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}

function VersionCompareDrawer({
  pair,
  onClose,
}: {
  pair: [PolicyVersion, PolicyVersion] | null;
  onClose: () => void;
}) {
  if (!pair) return null;
  const [a, b] = pair;

  return (
    <Sheet open={Boolean(pair)} onOpenChange={(open) => !open && onClose()}>
      <SheetContent
        side="right"
        className="glass-panel w-full overflow-y-auto border-cyber-blue/25 sm:max-w-lg"
      >
        <SheetHeader className="space-y-2">
          <SheetTitle className="flex items-center gap-2 text-base text-foreground">
            <History className="h-4 w-4 text-cyber-blue" /> Version comparison
          </SheetTitle>
          <SheetDescription className="font-mono text-xs">
            {b.version} → {a.version}
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-4 px-4 pb-8">
          <div className="grid grid-cols-2 gap-3">
            <VersionCard version={b} label="Previous" />
            <VersionCard version={a} label="Current" />
          </div>

          <section>
            <h4 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-cyber-blue">
              Change delta
            </h4>
            <div className="grid grid-cols-3 gap-2 rounded-lg border border-cyber-blue/15 bg-slate-950/40 px-3 py-3 text-center">
              <div>
                <p className="text-[10px] uppercase text-muted-foreground">Added</p>
                <p className="font-mono text-lg font-bold text-cyber-green">
                  +{Math.max(0, a.added - b.added)}
                </p>
              </div>
              <div>
                <p className="text-[10px] uppercase text-muted-foreground">Removed</p>
                <p className="font-mono text-lg font-bold text-cyber-pink">
                  -{Math.max(0, a.removed - b.removed)}
                </p>
              </div>
              <div>
                <p className="text-[10px] uppercase text-muted-foreground">Modified</p>
                <p className="font-mono text-lg font-bold text-cyber-amber">
                  ~{Math.max(0, a.modified - b.modified)}
                </p>
              </div>
            </div>
          </section>

          <button
            onClick={onClose}
            className="w-full rounded-md border border-cyber-blue/40 bg-cyber-blue/10 px-4 py-2 text-sm font-semibold text-cyber-blue transition-colors hover:bg-cyber-blue/20"
          >
            Close comparison
          </button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function VersionCard({ version, label }: { version: PolicyVersion; label: string }) {
  return (
    <div className="rounded-lg border border-cyber-blue/15 bg-slate-950/40 px-3 py-3">
      <div className="flex items-center justify-between">
        <Tag>{version.version}</Tag>
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</span>
      </div>
      <dl className="mt-2 space-y-1 text-[11px]">
        <div className="flex justify-between">
          <dt className="text-muted-foreground">Rules</dt>
          <dd className="font-mono text-foreground">{version.ruleCount}</dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-muted-foreground">Added</dt>
          <dd className="font-mono text-cyber-green">+{version.added}</dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-muted-foreground">Removed</dt>
          <dd className="font-mono text-cyber-pink">-{version.removed}</dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-muted-foreground">Author</dt>
          <dd className="font-mono text-foreground">{version.author}</dd>
        </div>
      </dl>
    </div>
  );
}

function PolStat({
  label,
  value,
  icon,
  tone,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
  tone: "blue" | "green" | "pink" | "purple" | "amber";
}) {
  const toneClass = {
    blue: "text-cyber-blue",
    green: "text-cyber-green",
    pink: "text-cyber-pink",
    purple: "text-cyber-purple",
    amber: "text-cyber-amber",
  }[tone];
  return (
    <div className="rounded-lg border border-cyber-blue/15 bg-slate-950/40 px-3 py-2">
      <div className={cn("flex items-center gap-1", toneClass)}>
        {icon}
        <span className="text-[10px] uppercase tracking-wider">{label}</span>
      </div>
      <p className={cn("mt-1 font-mono text-sm font-bold", toneClass)}>{value}</p>
    </div>
  );
}
