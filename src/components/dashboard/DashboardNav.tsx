import { useState } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import { motion } from "framer-motion";
import {
  LayoutDashboard,
  ListTree,
  Menu,
  Settings,
  Shield,
  Sparkles,
  Swords,
  Workflow,
  X,
} from "lucide-react";
import RoleSwitcher from "./RoleSwitcher";
import { cn } from "@/lib/utils";

const navItems = [
  { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { name: "Red Team", href: "/red-team", icon: Swords },
  { name: "Pipeline", href: "/pipeline", icon: Workflow },
  { name: "Timeline", href: "/timeline", icon: ListTree },
  { name: "Settings", href: "/settings", icon: Settings },
] as const;


export default function DashboardNav() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [mobileOpen, setMobileOpen] = useState(false);

  const isActive = (href: string) =>
    pathname === href || (href !== "/dashboard" && pathname.startsWith(href));

  return (
    <div className="sticky top-0 z-50 border-b border-cyber-blue/30 bg-slate-950/95 backdrop-blur-lg">
      <div className="mx-auto max-w-[1920px] px-4 py-4 md:px-6">
        <div className="flex items-center justify-between gap-4">
          {/* Logo & Title */}
          <Link to="/dashboard" className="group flex shrink-0 items-center gap-3">
            <div className="relative">
              <Shield className="h-9 w-9 text-cyber-blue transition-transform group-hover:scale-110" />
              <Sparkles className="absolute -top-1 -right-1 h-4 w-4 animate-pulse text-cyber-pink" />
            </div>
            <div>
              <h1 className="bg-gradient-to-r from-cyber-blue via-cyber-purple to-cyber-pink bg-clip-text text-xl font-bold text-transparent">
                AI-NGFW
              </h1>
              <p className="text-[10px] text-muted-foreground">Next-Gen Firewall</p>
            </div>
          </Link>

          {/* Navigation Links */}
          <nav className="hidden items-center gap-2 lg:flex">
            {navItems.map((item) => {
              const Icon = item.icon;
              const active = isActive(item.href);

              return (
                <Link
                  key={item.href}
                  to={item.href}
                  className={cn(
                    "relative flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-all duration-200",
                    active
                      ? "bg-cyber-blue/20 text-cyber-blue"
                      : "text-muted-foreground hover:bg-white/5 hover:text-foreground",
                  )}
                >
                  <Icon className="h-4 w-4" />
                  <span>{item.name}</span>
                  {active && (
                    <motion.div
                      layoutId="activeTab"
                      className="absolute inset-0 rounded-lg border-2 border-cyber-blue/50"
                      transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                    />
                  )}
                </Link>
              );
            })}
          </nav>

          {/* Role + System Status */}
          <div className="flex items-center gap-3">
            <RoleSwitcher />
            <div className="hidden text-right md:block">
              <div className="text-[10px] text-muted-foreground">System Status</div>
              <div className="flex items-center gap-2">
                <div className="h-2 w-2 animate-pulse rounded-full bg-cyber-green" />
                <span className="text-xs font-bold text-cyber-green">OPERATIONAL</span>
              </div>
            </div>
            <button
              onClick={() => setMobileOpen((o) => !o)}
              aria-label="Toggle navigation"
              className="rounded-md border border-cyber-blue/30 p-2 text-cyber-blue lg:hidden"
            >
              {mobileOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
            </button>
          </div>
        </div>

        {mobileOpen && (
          <nav className="mt-4 flex flex-col gap-1 lg:hidden">
            {navItems.map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  to={item.href}
                  onClick={() => setMobileOpen(false)}
                  className={cn(
                    "flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition-colors",
                    isActive(item.href)
                      ? "bg-cyber-blue/20 text-cyber-blue"
                      : "text-muted-foreground hover:bg-white/5 hover:text-foreground",
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {item.name}
                </Link>
              );
            })}
          </nav>
        )}
      </div>
      <div className="h-[2px] bg-gradient-to-r from-transparent via-cyber-blue to-transparent" />
    </div>
  );
}
