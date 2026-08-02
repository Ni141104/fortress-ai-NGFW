import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function PageHeader({
  title,
  description,
  actions,
  accent = "blue",
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
  accent?: "blue" | "pink";
}) {
  return (
    <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1
          className={cn(
            "bg-gradient-to-r bg-clip-text text-3xl font-bold text-transparent",
            accent === "pink"
              ? "from-cyber-pink via-cyber-purple to-cyber-amber"
              : "from-cyber-blue via-cyber-purple to-cyber-pink",
          )}
        >
          {title}
        </h1>
        {description && (
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{description}</p>
        )}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </header>
  );
}

export function SectionGrid({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("grid grid-cols-1 gap-6 lg:grid-cols-2 xl:grid-cols-3", className)}>
      {children}
    </div>
  );
}
