import { createFileRoute } from "@tanstack/react-router";
import { FileStack, Server, SlidersHorizontal } from "lucide-react";
import { PageHeader, SectionGrid } from "@/components/layout/PageHeader";
import { WidgetCard } from "@/components/layout/WidgetCard";
import { StatusBadge, Tag } from "@/components/ui/cyber";
import { DemoModeButton } from "@/components/simulation/ScenarioLibrary";
import { useLiveData } from "@/hooks/useLiveData";
import { usePlatform } from "@/lib/platform-store";
import { ngfw } from "@/services";
import { useRole } from "@/lib/role-store";
import type { ReactNode } from "react";
import { useState } from "react";
import { resetLearnedDefense } from "@/services";
import { AdminUserPanel } from "@/components/platform/AdminUserPanel";

export const Route = createFileRoute("/settings")({
  head: () => ({
    meta: [
      { title: "Platform Settings — AI-NGFW" },
      {
        name: "description",
        content:
          "Review firewall policy versions, federated learning participants and operator role configuration.",
      },
      { property: "og:title", content: "Platform Settings — AI-NGFW" },
      {
        property: "og:description",
        content: "Policy versions, federated learning nodes and operator role configuration.",
      },
    ],
  }),
  component: SettingsPage,
});

function SettingsPage() {
  const { role, accessRole } = useRole();
  const { settings, updateSettings, resetSettings } = usePlatform();
  const [resetMessage, setResetMessage] = useState<string | null>(null);
  const policies = useLiveData(() => ngfw.policy.getHistory(), [], settings.widgetRefreshInterval);
  const clients = useLiveData(
    () => ngfw.federated.getClients(),
    [],
    settings.widgetRefreshInterval,
  );

  return (
    <div>
      <PageHeader
        title="Platform Settings"
        description="Policy lifecycle, federated learning fleet and operator context."
      />

      <SectionGrid className="xl:grid-cols-2">
        {accessRole === "admin" && <WidgetCard title="Team Access Management" subtitle="Provision Blue Team and Red Team accounts" icon={<Server className="h-4 w-4" />} live={false} className="xl:col-span-2"><AdminUserPanel /></WidgetCard>}
        <WidgetCard
          title="Operator Context"
          subtitle="Operator role and current data source"
          icon={<SlidersHorizontal className="h-4 w-4" />}
          live={false}
        >
          <div className="space-y-3 text-sm">
            <Row
              label="Active role"
              value={<StatusBadge status={role === "red" ? "block" : "healthy"} />}
            />
            <Row label="Perspective" value={role === "red" ? "Offensive" : "Defensive"} />
            <Row label="Data source" value={<Tag>{settings.demoModeEnabled ? "demo-service" : "fastapi"}</Tag>} />
          </div>
        </WidgetCard>

        <WidgetCard
          title="Simulation Settings"
          subtitle="Engine controls, demo orchestration and polling cadence"
          icon={<SlidersHorizontal className="h-4 w-4" />}
          live={false}
          className="xl:col-span-2"
        >
          <div className="grid gap-4 md:grid-cols-2">
            <SettingRow
              label="Simulation speed"
              description="Persists across the command center and all transport controls."
              control={
                <div className="flex flex-wrap gap-1">
                  {([1, 2, 5] as const).map((speed) => (
                    <button
                      key={speed}
                      onClick={() => updateSettings({ simulationSpeed: speed })}
                      className={[
                        "rounded border px-2.5 py-1 text-[11px] font-semibold transition-colors",
                        settings.simulationSpeed === speed
                          ? "border-cyber-purple/50 bg-cyber-purple/10 text-cyber-purple"
                          : "border-cyber-blue/20 text-muted-foreground hover:border-cyber-blue/40 hover:text-foreground",
                      ].join(" ")}
                    >
                      {speed}x
                    </button>
                  ))}
                </div>
              }
            />

            <SettingRow
              label="Widget refresh interval"
              description="Controls how often live mock services re-poll in the background."
              control={
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                    <span>Refresh every</span>
                    <span className="font-mono text-cyber-blue">
                      {settings.widgetRefreshInterval} ms
                    </span>
                  </div>
                  <input
                    type="range"
                    min={1000}
                    max={10000}
                    step={500}
                    value={settings.widgetRefreshInterval}
                    onChange={(e) =>
                      updateSettings({ widgetRefreshInterval: Number(e.target.value) })
                    }
                    className="w-full accent-[var(--cyber-blue)]"
                  />
                </div>
              }
            />

            <SettingRow
              label="Demo mode"
              description="Enables the one-click multi-attack demo launch from the nav and command center."
              control={
                <button
                  onClick={() => updateSettings({ demoModeEnabled: !settings.demoModeEnabled })}
                  className={[
                    "inline-flex items-center rounded border px-3 py-1.5 text-[11px] font-semibold transition-colors",
                    settings.demoModeEnabled
                      ? "border-cyber-green/40 bg-cyber-green/10 text-cyber-green"
                      : "border-cyber-pink/40 bg-cyber-pink/10 text-cyber-pink",
                  ].join(" ")}
                >
                  {settings.demoModeEnabled ? "Enabled" : "Disabled"}
                </button>
              }
            />

            <SettingRow
              label="Auto replay"
              description="Replays the last queue after completion."
              control={
                <button
                  onClick={() => updateSettings({ autoReplay: !settings.autoReplay })}
                  className={[
                    "inline-flex items-center rounded border px-3 py-1.5 text-[11px] font-semibold transition-colors",
                    settings.autoReplay
                      ? "border-cyber-blue/40 bg-cyber-blue/10 text-cyber-blue"
                      : "border-border bg-slate-950/40 text-muted-foreground hover:text-foreground",
                  ].join(" ")}
                >
                  {settings.autoReplay ? "On" : "Off"}
                </button>
              }
            />
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <DemoModeButton />
            <button
              onClick={() => {
                setResetMessage(null);
                void resetLearnedDefense().then((result) => setResetMessage(`${result.removed_rules} learned rules deactivated`)).catch((error: Error) => setResetMessage(error.message));
              }}
              className="rounded-md border border-cyber-pink/40 px-3 py-1.5 text-[11px] font-semibold text-cyber-pink"
            >
              Reset Learned Defense
            </button>
            <button
              onClick={resetSettings}
              className="rounded-md border border-border px-3 py-1.5 text-[11px] font-semibold text-muted-foreground transition-colors hover:border-cyber-blue/40 hover:text-foreground"
            >
              Reset settings
            </button>
          </div>
          {resetMessage && <p className="mt-2 text-xs text-muted-foreground">{resetMessage}</p>}
        </WidgetCard>

        <WidgetCard
          title="Notifications & Appearance"
          subtitle="Alert delivery and theme persistence"
          icon={<SlidersHorizontal className="h-4 w-4" />}
          live={false}
          className="xl:col-span-2"
        >
          <div className="grid gap-4 md:grid-cols-2">
            <SettingRow
              label="Notifications"
              description="Controls engine-driven notification delivery."
              control={
                <button
                  onClick={() =>
                    updateSettings({ notificationsEnabled: !settings.notificationsEnabled })
                  }
                  className={[
                    "inline-flex items-center rounded border px-3 py-1.5 text-[11px] font-semibold transition-colors",
                    settings.notificationsEnabled
                      ? "border-cyber-green/40 bg-cyber-green/10 text-cyber-green"
                      : "border-border bg-slate-950/40 text-muted-foreground hover:text-foreground",
                  ].join(" ")}
                >
                  {settings.notificationsEnabled ? "Enabled" : "Disabled"}
                </button>
              }
            />

            <SettingRow
              label="Notification sound"
              description="UI-only preference for future audio cues."
              control={
                <button
                  onClick={() => updateSettings({ notificationSound: !settings.notificationSound })}
                  className={[
                    "inline-flex items-center rounded border px-3 py-1.5 text-[11px] font-semibold transition-colors",
                    settings.notificationSound
                      ? "border-cyber-purple/40 bg-cyber-purple/10 text-cyber-purple"
                      : "border-border bg-slate-950/40 text-muted-foreground hover:text-foreground",
                  ].join(" ")}
                >
                  {settings.notificationSound ? "On" : "Off"}
                </button>
              }
            />

            <SettingRow
              label="Theme accent"
              description="Persisted for future accent styling without changing the current palette."
              control={
                <select
                  value={settings.themeAccent}
                  onChange={(e) =>
                    updateSettings({
                      themeAccent: e.target.value as typeof settings.themeAccent,
                    })
                  }
                  className="rounded-md border border-cyber-blue/25 bg-slate-950/50 px-2 py-1.5 text-xs text-foreground"
                >
                  <option value="blue">Blue</option>
                  <option value="purple">Purple</option>
                  <option value="pink">Pink</option>
                  <option value="green">Green</option>
                </select>
              }
            />

            <SettingRow
              label="Current refresh policy"
              description="Applied to policy and federated learning pollers in this screen."
              control={<Tag>{settings.widgetRefreshInterval} ms</Tag>}
            />
          </div>
        </WidgetCard>

        <WidgetCard
          title="Policy Versions"
          subtitle="Signed rule bundles"
          icon={<FileStack className="h-4 w-4" />}
          live={false}
          isLoading={policies.isLoading}
          error={policies.error}
          onRetry={policies.refresh}
        >
          <div className="space-y-3">
            {(policies.data ?? []).map((version) => (
              <div key={version.version} className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{version.version}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {version.ruleCount} rules · +{version.added} / -{version.removed} ·{" "}
                    {version.author}
                  </p>
                </div>
                <StatusBadge status={version.rolloutPercent >= 100 ? "healthy" : "warning"} />
              </div>
            ))}
          </div>
        </WidgetCard>

        <WidgetCard
          title="Federated Learning Fleet"
          subtitle="Participating edge nodes"
          icon={<Server className="h-4 w-4" />}
          isLoading={clients.isLoading}
          error={clients.error}
          onRetry={clients.refresh}
          className="xl:col-span-2"
        >
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {(clients.data ?? []).map((client) => (
              <div
                key={client.id}
                className="flex items-center justify-between gap-3 rounded-md border border-cyber-blue/15 p-3"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{client.name}</p>
                  <p className="truncate text-xs text-muted-foreground">{client.region}</p>
                </div>
                <StatusBadge status={client.status} />
              </div>
            ))}
          </div>
        </WidgetCard>
      </SectionGrid>
    </div>
  );
}

function Row({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-muted-foreground">{label}</span>
      {value}
    </div>
  );
}

function SettingRow({
  label,
  description,
  control,
}: {
  label: string;
  description: string;
  control: ReactNode;
}) {
  return (
    <div className="rounded-md border border-cyber-blue/15 bg-slate-950/40 p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-medium text-foreground">{label}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
        </div>
        <div className="shrink-0">{control}</div>
      </div>
    </div>
  );
}
