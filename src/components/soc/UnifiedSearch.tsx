import { useEffect, useMemo, useState } from "react";
import { Search } from "lucide-react";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { SeverityChip } from "@/components/ui/cyber";
import { searchEverything } from "@/lib/soc-selectors";
import { useSoc } from "@/lib/soc-store";
import { ngfw } from "@/services";
import type { MITRETechnique } from "@/types";
import type { SimulationSnapshot } from "@/types/simulation";
import type { SearchHit, SocAlert, ThreatRow } from "@/types/soc";

const GROUPS: SearchHit["group"][] = [
  "Attacks",
  "Threats",
  "Alerts",
  "Policies",
  "Rules",
  "MITRE",
  "Timeline",
];

/** Global Cmd/Ctrl+K search across attacks, threats, alerts, policies and MITRE. */
export function UnifiedSearch({
  snapshot,
  rows,
  alerts,
}: {
  snapshot: SimulationSnapshot;
  rows: ThreatRow[];
  alerts: SocAlert[];
}) {
  const { searchOpen, setSearchOpen, openIncident } = useSoc();
  const [query, setQuery] = useState("");
  const [techniques, setTechniques] = useState<MITRETechnique[]>([]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const data = await ngfw.mitre.getTechniques();
        if (!cancelled) setTechniques(data);
      } catch {
        /* search still works without ATT&CK metadata */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setSearchOpen(!searchOpen);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [searchOpen, setSearchOpen]);

  const hits = useMemo(
    () => searchEverything(query, snapshot, rows, alerts, techniques).slice(0, 60),
    [query, snapshot, rows, alerts, techniques],
  );

  return (
    <CommandDialog open={searchOpen} onOpenChange={setSearchOpen}>
      <CommandInput
        value={query}
        onValueChange={setQuery}
        placeholder="Search attacks, threats, alerts, policies, MITRE techniques…"
      />
      <CommandList className="max-h-[24rem]">
        <CommandEmpty>
          {query.trim().length < 2 ? "Type at least two characters." : "No results found."}
        </CommandEmpty>
        {GROUPS.map((group) => {
          const groupHits = hits.filter((h) => h.group === group);
          if (!groupHits.length) return null;
          return (
            <CommandGroup key={group} heading={group}>
              {groupHits.map((hit) => (
                <CommandItem
                  key={hit.id}
                  // Results are pre-filtered by searchEverything; including the
                  // query keeps cmdk's own fuzzy filter from hiding them.
                  value={`${hit.title} ${hit.subtitle} ${query}`}
                  onSelect={() => {
                    if (hit.attackId) openIncident(hit.attackId);
                    setSearchOpen(false);
                  }}
                  className="gap-3"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-medium text-foreground">{hit.title}</p>
                    <p className="truncate text-[11px] text-muted-foreground">{hit.subtitle}</p>
                  </div>
                  {hit.severity && <SeverityChip severity={hit.severity} size="sm" showIcon={false} />}
                </CommandItem>
              ))}
            </CommandGroup>
          );
        })}
      </CommandList>
    </CommandDialog>
  );
}

/** Header trigger that opens the unified search palette. */
export function SearchTrigger() {
  const { setSearchOpen } = useSoc();
  return (
    <button
      onClick={() => setSearchOpen(true)}
      className="inline-flex items-center gap-2 rounded-md border border-cyber-blue/25 bg-slate-950/50 px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:border-cyber-blue/50 hover:text-foreground"
    >
      <Search className="h-3.5 w-3.5" />
      Search everything
      <kbd className="rounded border border-cyber-blue/30 px-1 font-mono text-[10px]">⌘K</kbd>
    </button>
  );
}