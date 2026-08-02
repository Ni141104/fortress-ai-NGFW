import type { ReactNode } from "react";
import { motion } from "framer-motion";
import { ArrowDownRight, ArrowRight, ArrowUpRight } from "lucide-react";
import { cn } from "@/lib/utils";

export type StatTone = "blue" | "green" | "pink" | "purple" | "amber";

const toneText: Record<StatTone, string> = {
  blue: "text-cyber-blue",
  green: "text-cyber-green",
  pink: "text-cyber-pink",
  purple: "text-cyber-purple",
  amber: "text-cyber-amber",
};

const toneStroke: Record<StatTone, string> = {
  blue: "var(--cyber-blue)",
  green: "var(--cyber-green)",
  pink: "var(--cyber-pink)",
  purple: "var(--cyber-purple)",
  amber: "var(--cyber-amber)",
};

const toneBorder: Record<StatTone, string> = {
  blue: "border-cyber-blue/25",
  green: "border-cyber-green/25",
  pink: "border-cyber-pink/25",
  purple: "border-cyber-purple/25",
  amber: "border-cyber-amber/25",
};

/** Tiny inline sparkline — shares the cyber palette, no external chart deps. */
export function Sparkline({
  data,
  tone = "blue",
  className,
  height = 28,
}: {
  data: number[];
  tone?: StatTone;
  className?: string;
  height?: number;
}) {
  const points = data.length > 1 ? data : [0, 0];
  const min = Math.min(...points);
  const max = Math.max(...points);
  const span = max - min || 1;
  const width = 100;
  const coords = points.map((v, i) => {
    const x = (i / (points.length - 1)) * width;
    const y = height - ((v - min) / span) * (height - 4) - 2;
    return `${x.toFixed(2)},${y.toFixed(2)}`;
  });

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      role="img"
      aria-hidden="true"
      className={cn("w-full", className)}
      style={{ height }}
    >
      <polyline
        points={`0,${height} ${coords.join(" ")} ${width},${height}`}
        fill={toneStroke[tone]}
        opacity={0.12}
        stroke="none"
      />
      <polyline
        points={coords.join(" ")}
        fill="none"
        stroke={toneStroke[tone]}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}

export interface StatCardProps {
  label: string;
  value: string | number;
  unit?: string | undefined;
  hint?: string | undefined;
  icon?: ReactNode | undefined;
  tone?: StatTone | undefined;
  /** Signed percentage / delta driving the trend indicator. */
  trend?: number | undefined;
  trendLabel?: string | undefined;
  /** Lower values are better (e.g. latency) — flips trend colouring. */
  invertTrend?: boolean | undefined;
  sparkline?: number[] | undefined;
  delay?: number | undefined;
  onClick?: (() => void) | undefined;
  className?: string | undefined;
}

/**
 * The single metric tile used across the platform (executive overview,
 * system health, incident drawer). Never re-implement a metric box.
 */
export function StatCard({
  label,
  value,
  unit,
  hint,
  icon,
  tone = "blue",
  trend,
  trendLabel,
  invertTrend = false,
  sparkline,
  delay = 0,
  onClick,
  className,
}: StatCardProps) {
  const hasTrend = typeof trend === "number" && Number.isFinite(trend);
  const flat = hasTrend && Math.abs(trend) < 0.05;
  const good = hasTrend && !flat ? (invertTrend ? trend < 0 : trend > 0) : false;
  const TrendIcon = flat ? ArrowRight : trend && trend > 0 ? ArrowUpRight : ArrowDownRight;

  const interactive = typeof onClick === "function";

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay }}
      className={cn("h-full", className)}
    >
      <div
        role={interactive ? "button" : undefined}
        tabIndex={interactive ? 0 : undefined}
        onClick={onClick}
        onKeyDown={(e) => {
          if (!interactive) return;
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onClick?.();
          }
        }}
        className={cn(
          "glass-panel flex h-full flex-col justify-between rounded-xl border px-4 py-3 transition-all duration-300",
          toneBorder[tone],
          interactive &&
            "cursor-pointer hover:cyber-glow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyber-blue/60",
        )}
      >
        <div className="flex items-start gap-2">
          {icon && <span className={cn("mt-0.5 shrink-0", toneText[tone])}>{icon}</span>}
          <span className="min-w-0 flex-1 truncate text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
            {label}
          </span>
          {hasTrend && (
            <span
              className={cn(
                "inline-flex shrink-0 items-center gap-0.5 rounded px-1 py-0.5 font-mono text-[10px] font-semibold",
                flat
                  ? "bg-muted/40 text-muted-foreground"
                  : good
                    ? "bg-cyber-green/10 text-cyber-green"
                    : "bg-cyber-pink/10 text-cyber-pink",
              )}
              title={trendLabel ?? "vs previous window"}
            >
              <TrendIcon className="h-3 w-3" />
              {Math.abs(trend).toFixed(1)}%
            </span>
          )}
        </div>

        <div className="mt-2 flex items-baseline gap-1">
          <span className={cn("font-mono text-2xl font-bold leading-none", toneText[tone])}>
            {typeof value === "number" ? value.toLocaleString() : value}
          </span>
          {unit && <span className="text-[11px] text-muted-foreground">{unit}</span>}
        </div>

        {sparkline && sparkline.length > 1 && (
          <div className="mt-2">
            <Sparkline data={sparkline} tone={tone} />
          </div>
        )}

        {hint && <p className="mt-2 truncate text-[11px] text-muted-foreground">{hint}</p>}
      </div>
    </motion.div>
  );
}