import type { ReactNode } from "react";
import { createFileRoute } from "@tanstack/react-router";
import {
  Activity,
  BellRing,
  Brain,
  Bug,
  FileCode,
  Gauge,
  GitBranch,
  Radar,
  Rss,
  Server,
} from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { WidgetCard } from "@/components/layout/WidgetCard";
import { ActiveThreatMonitor } from "@/components/soc/ActiveThreatMonitor";
import { AlertCenter } from "@/components/soc/AlertCenter";
import { DashboardFilters } from "@/components/soc/DashboardFilters";
import { ExplainableAiDrawer } from "@/components/soc/ExplainableAiDrawer";
import { FederatedLearningWidget } from "@/components/soc/FederatedLearningWidget";
import { HoneypotIntelligenceWidget } from "@/components/soc/HoneypotIntelligenceWidget";
import { IncidentDrawer } from "@/components/soc/IncidentDrawer";
import { MitreIntelligenceWidget } from "@/components/soc/MitreIntelligenceWidget";
import { PersonalizationPanel } from "@/components/soc/PersonalizationPanel";
import { PolicyRepositoryWidget } from "@/components/soc/PolicyRepositoryWidget";
import { RLIntelligenceWidget } from "@/components/soc/RLIntelligenceWidget";
import { ServiceStatusList, SystemHealthGrid } from "@/components/soc/SystemHealthGrid";
import { ThreatIntelFeed } from "@/components/soc/ThreatIntelFeed";
import { ThreatOverview } from "@/components/soc/ThreatOverview";
import { UnifiedSearch, SearchTrigger } from "@/components/soc/UnifiedSearch";
import { ZeroDayIntelligenceWidget } from "@/components/soc/ZeroDayIntelligenceWidget";
import { useSocData } from "@/hooks/useSocData";
import { SocProvider, useSoc } from "@/lib/soc-store";
import { cn } from "@/lib/utils";
import { usePlatformOptional } from "@/lib/platform-store";

export const Route = createFileRoute("/dashboard")({
  head: () => ({
    meta: [
      { title: "Security Operations Center — AI-NGFW" },
      {
        name: "description",
        content:
          "Blue Team SOC: live threat overview, active threat monitor, system health, intelligence feed, alert triage and incident investigation.",
      },
      { property: "og:title", content: "Security Operations Center — AI-NGFW" },
      {
        property: "og:description",
        content:
          "Live threat posture, detection telemetry and analyst triage in one Blue Team console.",
      },
    ],
  }),
  component: DashboardRoute,
});

function DashboardRoute() {
  return (
    <SocProvider>
      <SecurityOperationsCenter />
    </SocProvider>
  );
}

const SPAN_CLASS: Record<1 | 2 | 3, string> = {
  1: "xl:col-span-1",
  2: "xl:col-span-2",
  3: "xl:col-span-3",
};

/** Phase 3 SOC — every widget reads one snapshot via useSocData. */
function SecurityOperationsCenter() {
  const { prefs } = useSoc();
  const platform = usePlatformOptional();
  const {
    snapshot,
    rows,
    scopedAlerts,
    scopedIntel,
    health,
    services,
    overview,
    series,
    rlAgent,
    flSummary,
    honeypot,
    mitre,
    zeroDay,
    policy,
  } = useSocData();

  const openAlerts = scopedAlerts.filter((a) => a.state === "open").length;

  const widgets: Record<string, ReactNode> = {
    overview: (
      <WidgetCard
        title="Threat Overview"
        subtitle="Executive posture across the filtered window"
        icon={<Gauge className="h-4 w-4" />}
      >
        <ThreatOverview metrics={overview} series={series} />
      </WidgetCard>
    ),
    monitor: (
      <WidgetCard
        title="Active Threat Monitor"
        subtitle={`${rows.length} operations in scope`}
        icon={<Radar className="h-4 w-4" />}
        bodyClassName="px-3 py-4"
      >
        <ActiveThreatMonitor rows={rows} />
      </WidgetCard>
    ),
    health: (
      <WidgetCard
        title="Live System Health"
        subtitle="Infrastructure telemetry from the running engine"
        icon={<Activity className="h-4 w-4" />}
      >
        <SystemHealthGrid metrics={health} series={series} />
      </WidgetCard>
    ),
    services: (
      <WidgetCard
        title="Service Status"
        subtitle="Platform components"
        icon={<Server className="h-4 w-4" />}
      >
        <ServiceStatusList services={services} />
      </WidgetCard>
    ),
    intel: (
      <WidgetCard
        title="Threat Intelligence Feed"
        subtitle="Categorized detections as they stream in"
        icon={<Rss className="h-4 w-4" />}
      >
        <ThreatIntelFeed events={scopedIntel} />
      </WidgetCard>
    ),
    alerts: (
      <WidgetCard
        title="Alert Center"
        subtitle={`${openAlerts} awaiting triage`}
        icon={<BellRing className="h-4 w-4" />}
      >
        <AlertCenter alerts={scopedAlerts} />
      </WidgetCard>
    ),
    rl: <RLIntelligenceWidget agent={rlAgent} />,
    fl: <FederatedLearningWidget summary={flSummary} />,
    honeypot: <HoneypotIntelligenceWidget summary={honeypot} />,
    mitre: <MitreIntelligenceWidget summary={mitre} />,
    zeroday: <ZeroDayIntelligenceWidget summary={zeroDay} />,
    policy: <PolicyRepositoryWidget summary={policy} />,
  };

  const ordered = [...prefs].sort((a, b) => a.order - b.order).filter((p) => p.visible);

  return (
    <div className="space-y-5">
      <PageHeader
        title="Security Operations Center"
        description={
          platform?.settings.demoModeEnabled === false
            ? "Blue Team command view: persisted FastAPI attacks, authenticated pipeline events and analyst triage."
            : "Blue Team command view: live threat posture, detection telemetry and analyst triage — all driven by the centralized simulation engine."
        }
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <SearchTrigger />
            <PersonalizationPanel />
          </div>
        }
      />

      <DashboardFilters />

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
        {ordered.map((pref, index) => (
          <div
            key={pref.id}
            className={cn(SPAN_CLASS[pref.span], "min-w-0")}
            style={{ order: index }}
          >
            {widgets[pref.id]}
          </div>
        ))}
      </div>

      <IncidentDrawer rows={rows} intel={scopedIntel} snapshot={snapshot} />
      <ExplainableAiDrawer snapshot={snapshot} />
      <UnifiedSearch snapshot={snapshot} rows={rows} alerts={scopedAlerts} />
    </div>
  );
}
