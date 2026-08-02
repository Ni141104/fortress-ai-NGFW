import type { ReactNode } from "react";
import { AlertOctagon, AlertTriangle, Info, ShieldAlert } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Severity } from "@/types";

/* ------------------------------------------------------------------ */
/* Cyber design kit — promoted app-wide so every widget shares one     */
/* vocabulary for severity, status, tags and confidence.               */
/* ------------------------------------------------------------------ */

const severityStyles: Record<Severity, string> = {
  low: "border-cyber-blue/40 bg-cyber-blue/10 text-cyber-blue",
  medium: "border-cyber-amber/40 bg-cyber-amber/10 text-cyber-amber",
  high: "border-cyber-purple/50 bg-cyber-purple/10 text-cyber-purple",
  critical: "border-cyber-pink/50 bg-cyber-pink/10 text-cyber-pink",
};

const severityIcons: Record<Severity, typeof Info> = {
  low: Info,
  medium: AlertTriangle,
  high: ShieldAlert,
  critical: AlertOctagon,
};

export function SeverityChip({
  severity,
  size = "md",
  showIcon = true,
  className,
}: {
  severity: Severity;
  size?: "sm" | "md";
  showIcon?: boolean;
  className?: string;
}) {
  const Icon = severityIcons[severity];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md border font-medium uppercase tracking-wide",
        size === "sm" ? "px-1.5 py-0.5 text-[10px]" : "px-2 py-1 text-xs",
        severityStyles[severity],
        className,
      )}
    >
      {showIcon && <Icon className={size === "sm" ? "h-3 w-3" : "h-3.5 w-3.5"} />}
      {severity}
    </span>
  );
}

const statusStyles: Record<string, string> = {
  healthy: "border-cyber-green/40 bg-cyber-green/10 text-cyber-green",
  normal: "border-cyber-green/40 bg-cyber-green/10 text-cyber-green",
  training: "border-cyber-green/40 bg-cyber-green/10 text-cyber-green",
  allow: "border-cyber-green/40 bg-cyber-green/10 text-cyber-green",
  degraded: "border-cyber-amber/40 bg-cyber-amber/10 text-cyber-amber",
  warning: "border-cyber-amber/40 bg-cyber-amber/10 text-cyber-amber",
  aggregating: "border-cyber-amber/40 bg-cyber-amber/10 text-cyber-amber",
  quarantine: "border-cyber-amber/40 bg-cyber-amber/10 text-cyber-amber",
  redirect: "border-cyber-purple/50 bg-cyber-purple/10 text-cyber-purple",
  saturated: "border-cyber-pink/50 bg-cyber-pink/10 text-cyber-pink",
  critical: "border-cyber-pink/50 bg-cyber-pink/10 text-cyber-pink",
  block: "border-cyber-pink/50 bg-cyber-pink/10 text-cyber-pink",
  offline: "border-border bg-muted/40 text-muted-foreground",
  idle: "border-border bg-muted/40 text-muted-foreground",
};

export function StatusBadge({
  status,
  className,
}: {
  status: string;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md border px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wider",
        statusStyles[status.toLowerCase()] ?? "border-cyber-blue/40 bg-cyber-blue/10 text-cyber-blue",
        className,
      )}
    >
      {status}
    </span>
  );
}

export function Tag({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded border border-cyber-blue/25 bg-cyber-blue/5 px-1.5 py-0.5 font-mono text-[10px] text-cyber-blue/90",
        className,
      )}
    >
      {children}
    </span>
  );
}

export function ConfidenceBar({
  value,
  label,
  tone = "blue",
  showPercentage = true,
}: {
  value: number;
  label?: string;
  tone?: "blue" | "green" | "pink" | "purple" | "amber";
  showPercentage?: boolean;
}) {
  const pct = Math.max(0, Math.min(100, value <= 1 ? value * 100 : value));
  const toneClass = {
    blue: "bg-cyber-blue",
    green: "bg-cyber-green",
    pink: "bg-cyber-pink",
    purple: "bg-cyber-purple",
    amber: "bg-cyber-amber",
  }[tone];

  return (
    <div className="w-full">
      {(label || showPercentage) && (
        <div className="mb-1 flex items-center justify-between text-[11px] text-muted-foreground">
          <span>{label}</span>
          {showPercentage && <span className="font-mono">{pct.toFixed(0)}%</span>}
        </div>
      )}
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted/50">
        <div
          className={cn("h-full rounded-full transition-all duration-500", toneClass)}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

export function TimelineItem({
  title,
  description,
  timestamp,
  severity,
  icon,
  isLast = false,
}: {
  title: string;
  description?: string;
  timestamp: string;
  severity: Severity;
  icon?: ReactNode;
  isLast?: boolean;
}) {
  const dotTone = {
    low: "bg-cyber-blue",
    medium: "bg-cyber-amber",
    high: "bg-cyber-purple",
    critical: "bg-cyber-pink",
  }[severity];

  return (
    <li className="relative flex gap-3 pb-4 last:pb-0">
      {!isLast && <span className="absolute left-[7px] top-4 h-full w-px bg-border" />}
      <span className={cn("relative mt-1.5 h-3.5 w-3.5 shrink-0 rounded-full", dotTone)}>
        <span className={cn("absolute inset-0 animate-ping rounded-full opacity-40", dotTone)} />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          {icon}
          <p className="truncate text-sm font-medium text-foreground">{title}</p>
          <time className="ml-auto font-mono text-[11px] text-muted-foreground">
            {new Date(timestamp).toLocaleTimeString()}
          </time>
        </div>
        {description && (
          <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
        )}
      </div>
    </li>
  );
}

export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-cyber-blue/20 px-6 py-10 text-center">
      {icon && <div className="mb-3 text-cyber-blue/60">{icon}</div>}
      <p className="text-sm font-medium text-foreground">{title}</p>
      {description && <p className="mt-1 text-xs text-muted-foreground">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function CyberSkeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "animate-pulse rounded-md bg-gradient-to-r from-muted/40 via-muted/70 to-muted/40",
        className,
      )}
    />
  );
}
