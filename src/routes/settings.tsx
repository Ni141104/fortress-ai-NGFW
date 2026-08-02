import { createFileRoute } from "@tanstack/react-router";
import { FileStack, Server, SlidersHorizontal } from "lucide-react";
import { PageHeader, SectionGrid } from "@/components/layout/PageHeader";
import { WidgetCard } from "@/components/layout/WidgetCard";
import { StatusBadge, Tag } from "@/components/ui/cyber";
import { useLiveData } from "@/hooks/useLiveData";
import { ngfw } from "@/services";
import { useRole } from "@/lib/role-store";

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
  const { role } = useRole();
  const policies = useLiveData(() => ngfw.policy.getHistory(), [], 0);
  const clients = useLiveData(() => ngfw.federated.getClients(), [], 10000);

  return (
    <div>
      <PageHeader
        title="Platform Settings"
        description="Policy lifecycle, federated learning fleet and operator context."
      />

      <SectionGrid className="xl:grid-cols-2">
        <WidgetCard
          title="Operator Context"
          subtitle="Mock role — Supabase Auth pending"
          icon={<SlidersHorizontal className="h-4 w-4" />}
          live={false}
        >
          <div className="space-y-3 text-sm">
            <Row label="Active role" value={<StatusBadge status={role === "red" ? "block" : "healthy"} />} />
            <Row label="Perspective" value={role === "red" ? "Offensive" : "Defensive"} />
            <Row label="Data source" value={<Tag>mock-service</Tag>} />
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
                    {version.ruleCount} rules · +{version.added} / -{version.removed} · {version.author}
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

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-muted-foreground">{label}</span>
      {value}
    </div>
  );
}
