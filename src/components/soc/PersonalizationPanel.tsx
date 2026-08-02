import { ArrowDown, ArrowUp, Eye, EyeOff, LayoutGrid, RotateCcw } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { SOC_WIDGETS, useSoc } from "@/lib/soc-store";

const iconBtn =
  "rounded border border-cyber-blue/25 p-1 text-muted-foreground transition-colors hover:border-cyber-blue/50 hover:text-cyber-blue disabled:opacity-30";

/** Per-analyst layout: widget visibility, order and column span (persisted). */
export function PersonalizationPanel() {
  const { prefs, setPref, moveWidget, resetPrefs } = useSoc();
  const ordered = [...prefs].sort((a, b) => a.order - b.order);

  return (
    <Popover>
      <PopoverTrigger className="inline-flex items-center gap-2 rounded-md border border-cyber-blue/25 bg-slate-950/50 px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:border-cyber-blue/50 hover:text-foreground">
        <LayoutGrid className="h-3.5 w-3.5" />
        Customize
      </PopoverTrigger>
      <PopoverContent align="end" className="glass-panel w-80 border-cyber-blue/25 p-3">
        <div className="mb-2 flex items-center justify-between">
          <p className="text-xs font-semibold text-foreground">Dashboard layout</p>
          <button
            onClick={resetPrefs}
            className="inline-flex items-center gap-1 text-[11px] text-cyber-blue hover:underline"
          >
            <RotateCcw className="h-3 w-3" /> Reset
          </button>
        </div>
        <ul className="space-y-1.5">
          {ordered.map((pref, index) => {
            const meta = SOC_WIDGETS.find((w) => w.id === pref.id);
            return (
              <li
                key={pref.id}
                className="flex items-center gap-2 rounded-md border border-cyber-blue/15 bg-slate-950/40 px-2 py-1.5"
              >
                <span
                  className={cn(
                    "min-w-0 flex-1 truncate text-[11px]",
                    pref.visible ? "text-foreground" : "text-muted-foreground line-through",
                  )}
                >
                  {meta?.name ?? pref.id}
                </span>
                <select
                  aria-label={`${meta?.name} width`}
                  value={pref.span}
                  onChange={(e) => setPref(pref.id, { span: Number(e.target.value) as 1 | 2 | 3 })}
                  className="rounded border border-cyber-blue/25 bg-slate-950/60 px-1 py-0.5 text-[10px] text-foreground focus:outline-none"
                >
                  <option value={1}>1/3</option>
                  <option value={2}>2/3</option>
                  <option value={3}>Full</option>
                </select>
                <button
                  className={iconBtn}
                  aria-label="Move up"
                  disabled={index === 0}
                  onClick={() => moveWidget(pref.id, -1)}
                >
                  <ArrowUp className="h-3 w-3" />
                </button>
                <button
                  className={iconBtn}
                  aria-label="Move down"
                  disabled={index === ordered.length - 1}
                  onClick={() => moveWidget(pref.id, 1)}
                >
                  <ArrowDown className="h-3 w-3" />
                </button>
                <button
                  className={iconBtn}
                  aria-label={pref.visible ? "Hide widget" : "Show widget"}
                  onClick={() => setPref(pref.id, { visible: !pref.visible })}
                >
                  {pref.visible ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
                </button>
              </li>
            );
          })}
        </ul>
      </PopoverContent>
    </Popover>
  );
}