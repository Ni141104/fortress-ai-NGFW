import type { ReactNode } from "react";
import { motion } from "framer-motion";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { CyberSkeleton } from "@/components/ui/cyber";
import { cn } from "@/lib/utils";

export interface WidgetCardProps {
  title: string;
  subtitle?: string;
  icon?: ReactNode;
  actions?: ReactNode;
  live?: boolean;
  isLoading?: boolean;
  error?: Error | null;
  onRetry?: () => void;
  className?: string;
  bodyClassName?: string;
  delay?: number;
  children: ReactNode;
}

/**
 * The single container every dashboard widget renders inside:
 * glass panel + cyber border, header with live tick, and built-in
 * loading / error states so widgets never re-implement them.
 */
export function WidgetCard({
  title,
  subtitle,
  icon,
  actions,
  live = true,
  isLoading = false,
  error = null,
  onRetry,
  className,
  bodyClassName,
  delay = 0,
  children,
}: WidgetCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, delay }}
      className={cn("h-full", className)}
    >
      <Card className="glass-panel h-full gap-0 border-cyber-blue/20 py-0 transition-shadow duration-300 hover:cyber-glow">
        <div className="flex items-start gap-3 border-b border-cyber-blue/15 px-5 py-4">
          {icon && <div className="mt-0.5 text-cyber-blue">{icon}</div>}
          <div className="min-w-0 flex-1">
            <h3 className="truncate text-sm font-semibold tracking-tight text-foreground">
              {title}
            </h3>
            {subtitle && (
              <p className="mt-0.5 truncate text-xs text-muted-foreground">{subtitle}</p>
            )}
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {actions}
            {live && (
              <span className="flex items-center gap-1.5 rounded-md border border-cyber-green/30 bg-cyber-green/10 px-2 py-0.5">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-cyber-green" />
                <span className="text-[10px] font-semibold tracking-wider text-cyber-green">
                  LIVE
                </span>
              </span>
            )}
          </div>
        </div>

        <CardContent className={cn("px-5 py-4", bodyClassName)}>
          {error ? (
            <div className="flex flex-col items-center gap-3 py-6 text-center">
              <AlertTriangle className="h-6 w-6 text-cyber-pink" />
              <p className="text-sm text-muted-foreground">{error.message}</p>
              {onRetry && (
                <button
                  onClick={onRetry}
                  className="inline-flex items-center gap-2 rounded-md border border-cyber-blue/40 px-3 py-1.5 text-xs text-cyber-blue transition-colors hover:bg-cyber-blue/10"
                >
                  <RefreshCw className="h-3.5 w-3.5" /> Retry
                </button>
              )}
            </div>
          ) : isLoading ? (
            <div className="space-y-3">
              <CyberSkeleton className="h-4 w-2/3" />
              <CyberSkeleton className="h-4 w-full" />
              <CyberSkeleton className="h-4 w-5/6" />
              <CyberSkeleton className="h-20 w-full" />
            </div>
          ) : (
            children
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}
