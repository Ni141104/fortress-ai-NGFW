import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { RoleProvider } from "../lib/role-store";
import { PlatformProvider } from "../lib/platform-store";
import { useSimulation } from "../hooks/useSimulation";
import DashboardNav from "../components/dashboard/DashboardNav";
import { AttackJourneyViewer } from "../components/simulation/AttackJourneyViewer";
import { CommandCenter } from "../components/simulation/CommandCenter";
import { NotificationCenter } from "../components/platform/NotificationCenter";
import { IncidentReportDrawer } from "../components/soc/IncidentReportDrawer";
import { AuthPanel } from "../components/platform/AuthPanel";
import { getStoredUser } from "../services/api-client";
import type { AuthUser } from "../services/api-client";
import { useRouterState, useNavigate } from "@tanstack/react-router";
import { useRole } from "../lib/role-store";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          This page didn't load
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Something went wrong on our end. You can try refreshing or head back home.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Try again
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Go home
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "AI-NGFW — AI Next-Generation Firewall Console" },
      {
        name: "description",
        content:
          "Enterprise AI-powered next-generation firewall console: live traffic, MITRE ATT&CK mapping, RL policy engine and red-team simulation.",
      },
      { property: "og:title", content: "AI-NGFW — AI Next-Generation Firewall Console" },
      {
        property: "og:description",
        content:
          "Live threat detection, MITRE ATT&CK mapping and reinforcement-learning policy enforcement in one console.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [
      {
        rel: "stylesheet",
        href: appCss,
      },
      { rel: "icon", href: "/favicon.ico", type: "image/x-icon" },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  const [user, setUser] = useState<AuthUser | null>(null);

  useEffect(() => {
    setUser(getStoredUser());
    const handleLogout = () => setUser(null);
    window.addEventListener("ngfw:logout", handleLogout);
    return () => window.removeEventListener("ngfw:logout", handleLogout);
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <RoleProvider key={user?.email ?? "signed-out"}>
        {user ? <AppWithPlatform /> : <LoginScreen onAuthenticated={setUser} />}
      </RoleProvider>
    </QueryClientProvider>
  );
}

function LoginScreen({ onAuthenticated }: { onAuthenticated: (user: AuthUser) => void }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 text-foreground">
      <div className="w-full max-w-md rounded-xl border border-cyber-blue/25 bg-slate-950/80 p-6 shadow-2xl">
        <div className="mb-6">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyber-blue">AI-NGFW Console</p>
          <h1 className="mt-2 text-2xl font-bold">Sign in to continue</h1>
          <p className="mt-2 text-sm text-muted-foreground">Use your assigned email and password to open the security workspace.</p>
        </div>
        <AuthPanel onAuthenticated={(next) => next && onAuthenticated(next)} />
      </div>
    </div>
  );
}

function AppWithPlatform() {
  const snapshot = useSimulation();

  return (
    <PlatformProvider snapshot={snapshot}>
    <RoleRouteGuard />
      <div className="cyber-grid min-h-screen bg-background text-foreground">
        <DashboardNav />
        <main className="mx-auto max-w-[1920px] px-4 py-6 md:px-6">
          <Outlet />
        </main>
      </div>
      <AttackJourneyViewer snapshot={snapshot} />
      <IncidentReportDrawer snapshot={snapshot} />
      <NotificationCenter />
      <CommandCenter snapshot={snapshot} />
    </PlatformProvider>
  );
}

function RoleRouteGuard() {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const navigate = useNavigate();
  const { role, accessRole, hydrated } = useRole();

  useEffect(() => {
    // PREVIOUS IMPLEMENTATION — ran immediately with the default "blue" role
    // before localStorage hydration, so /red-team briefly redirected to
    // /dashboard (or vice versa) on deep-link reload. The guard now waits
    // for the real role to hydrate before acting.
    if (!hydrated) return;
    if (accessRole !== "admin" && role === "blue" && pathname === "/red-team") {
      void navigate({ to: "/dashboard" });
    }
    if (accessRole !== "admin" && role === "red" && pathname === "/dashboard") {
      void navigate({ to: "/red-team" });
    }
  }, [accessRole, navigate, pathname, role, hydrated]);

  if (!hydrated) {
    return (
      <div className="cyber-grid flex min-h-screen items-center justify-center bg-background text-foreground">
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-cyber-blue">
          Loading workspace…
        </p>
      </div>
    );
  }

  return null;
}
