## Phase 1 — Application Shell + Widget Library (revised)

Recreating the AI-NGFW dashboard in this workspace's stack (TanStack Start + React 19 + Tailwind 4), preserving the reference design language exactly. No backend, no AI pipeline.

### 1. Design system port

Carry the reference tokens into `src/styles.css` in Tailwind 4 CSS-first form — same values, no new theme:
- `--color-cyber-blue #00f3ff`, `--color-cyber-purple #b026ff`, `--color-cyber-pink #ff0080`, `--color-cyber-green #00ff88`
- Dark slate base `#0a0e27`, `bg-cyber-grid` utility, `shimmer` / `pulse-glow` keyframes via `@utility`
- Existing shadcn HSL semantic tokens kept, `dark` forced on `<html>`

Install `framer-motion`, `lucide-react`, and `recharts` to match the reference's animation, icon, and charting language. D3/d3-force deferred until the graph views land.

### 2. Top navigation (preserved, not replaced)

`src/components/dashboard/DashboardNav.tsx` — a faithful port of the reference nav:
- Sticky, `bg-slate-950/95 backdrop-blur-lg`, `border-cyber-blue/30`, gradient hairline underneath
- Shield + Sparkles gradient AI-NGFW logo linking to `/dashboard`
- Nav items with `layoutId="activeTab"` Framer spring indicator, active state via `useRouterState` pathname
- Right side: pulsing `OPERATIONAL` status block, plus the new role switcher
- Responsive: nav items collapse into a sheet/menu under `lg`; logo and status persist

`RoleSwitcher.tsx` — segmented Red Team / Blue Team toggle in the nav, `cyber-pink` vs `cyber-blue` tinted, animated thumb. No login, no auth.

`src/lib/role-store.ts` — lightweight React context + `localStorage` persistence exposing `{ role, setRole }`. Widgets read it to adapt content. Structured so Supabase Auth can later supply the role without touching consumers.

### 3. Routes (minimal)

| Page | File | Path |
|---|---|---|
| Dashboard | `src/routes/dashboard.tsx` | `/dashboard` |
| Red Team | `src/routes/red-team.tsx` | `/red-team` |
| Settings | `src/routes/settings.tsx` | `/settings` |

`src/routes/index.tsx` redirects `/` → `/dashboard` (matching the reference `app/page.tsx`), replacing the template placeholder. Shared chrome (nav + `max-w-[1920px]` main + footer line) lives in `src/routes/__root.tsx` around `<Outlet />`, mirroring the reference's `app/dashboard/layout.tsx`.

Each route defines its own `head()` metadata.

### 4. Service layer (typed, swappable)

`src/types/index.ts` and `src/types/siem.ts` — ported wholesale from the reference (`TrafficStat`, `ThreatDataPoint`, `MITRETechnique`, `RLDecision`, `ZeroDayDetection`, `HoneynetNode/Edge`, `LogEntry`, `SystemMetric`, `Flow`, `WazuhAlert`, `TheHiveCase`, `CortexJob`, FL types).

`src/services/` — one interface per domain, each with a mock implementation:

```
services/
  types.ts          // NgfwService interfaces
  mock/             // ported generators from lib/api*.ts, split by domain
    traffic.ts  threats.ts  mitre.ts  rl.ts  honeypot.ts
    federated.ts  siem.ts  policy.ts  system.ts
  index.ts          // single provider export — swap mock -> live later
```

Every widget consumes the interface, never the mock directly, so a real API is a one-line swap.

`src/hooks/useLiveData.ts` — one shared polling hook (interval + pause on tab blur) replacing the ~20 duplicated `useEffect + setInterval + setState` blocks in the reference, and a single simulation clock so all widgets tick together instead of each randomizing independently.

### 5. Reusable component library

`src/components/ui/` — `Card` (incl. cyber glow variant), `Button`, `Input`, `Table`, `Progress`, `Badge`, plus the design kit promoted out of the reference's `siem/components/ui`: `SeverityChip`, `StatusBadge`, `Tag`, `ConfidenceBar`, `TimelineItem`, `ArtifactRow`, `Skeleton`, `EmptyState`, `Toast`. App-wide from day one instead of buried in one route.

`src/components/layout/` — `PageHeader`, `WidgetCard` (title + actions + live-tick indicator + skeleton/empty states), `SectionGrid`.

### 6. Production-ready widgets

`src/components/dashboard/` — each fully implemented against the service layer with real charts, filters, and interactions:

- **AIPipelinePanel** — Tier-0 → Tier-1 → Tier-2 → RL → PEO stage rail, animated packet flow, per-stage throughput and latency
- **ThreatOverview** — Recharts area/stacked timeline with range selector
- **OverviewCards / StatCard** — sparkline stat tiles, delta arrows
- **ActiveAttacks** — live sortable table with severity chips and drill-in drawer
- **RecentAlerts** — Wazuh-style alert feed with severity filter
- **PolicyVersionCard** — Tier-0 policy version, diff summary, rollback affordance
- **SystemHealth** — CPU/mem/throughput gauges and progress bars
- **LiveTimeline** — unified event stream using `TimelineItem`
- **ThreatIntel** — IOC feed with tags and confidence bars
- **MITREPanel** — technique heatmap + tactic breakdown
- **RLPanel** — decision feed, reward curve, action distribution
- **HoneypotPanel** — session list, attacker commands, capture stats
- **FederatedLearningPanel** — client roster, round progress, accuracy-per-round chart
- **ZeroDayPanel** — Isolation Forest anomaly candidates with score bars

Each widget: loading skeleton, empty state, error state, memoized, responsive, no hardcoded colors outside tokens.

### 7. Page composition

- **Dashboard (Blue Team default SOC view)** — AIPipelinePanel, ThreatOverview, OverviewCards, ActiveAttacks, RecentAlerts, PolicyVersionCard, SystemHealth, LiveTimeline, ThreatIntel, plus MITRE/RL/Honeypot/FL/ZeroDay panels in a responsive grid.
- **Red Team** — attack-simulator surface reusing the same widgets from the attacker's angle: technique picker (MITREPanel), launch/queue controls, ActiveAttacks scoped to own campaigns, LiveTimeline of simulated events, HoneypotPanel showing what got trapped. Simulation actions are wired to the mock service.
- **Settings** — role default, polling interval, demo-mode toggles, theme accent, service-endpoint fields (inert, ready for the real API).

Role switching re-scopes widget content and grid emphasis; it never swaps in a different component set.

### Technical notes

- File-based routing: `src/routes/dashboard.tsx` → `/dashboard`; navigation via `<Link to="...">`, never `<a href>`.
- No `tailwind.config.ts` — Tailwind 4 config is CSS-first in `src/styles.css`.
- No `createServerFn`, no Lovable Cloud, no database this phase. Everything is client-side mock behind service interfaces.
- Folder names mirror the reference (`components/dashboard`, `components/ui`, `types`) so later phases drop in cleanly.

### Out of scope for Phase 1

Supabase Auth, D3 force graphs, flow/session detail routes, SIEM case management workflow, cross-widget attack-lifecycle correlation, any real backend.
