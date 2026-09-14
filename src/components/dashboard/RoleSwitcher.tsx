import { motion } from "framer-motion";
import { Shield, Swords } from "lucide-react";
import { useRole } from "@/lib/role-store";
import { cn } from "@/lib/utils";
import { useNavigate } from "@tanstack/react-router";

const OPTIONS = [
  { value: "blue" as const, label: "Blue Team", icon: Shield },
  { value: "red" as const, label: "Red Team", icon: Swords },
];

export default function RoleSwitcher() {
  const { role, setRole, allowedRoles } = useRole();
  const navigate = useNavigate();

  return (
    <div
      role="radiogroup"
      aria-label="Operating role"
      className="relative flex items-center gap-1 rounded-lg border border-cyber-blue/25 bg-slate-950/60 p-1"
    >
      {OPTIONS.filter((option) => allowedRoles.includes(option.value)).map((option) => {
        const Icon = option.icon;
        const active = role === option.value;
        const tone = option.value === "red" ? "text-cyber-pink" : "text-cyber-blue";

        return (
          <button
            key={option.value}
            role="radio"
            aria-checked={active}
            onClick={() => {
              setRole(option.value);
              void navigate({ to: option.value === "blue" ? "/dashboard" : "/red-team" });
            }}
            className={cn(
              "relative flex items-center gap-2 rounded-md px-3 py-1.5 text-xs font-semibold transition-colors duration-200",
              active ? tone : "text-muted-foreground hover:text-foreground",
            )}
          >
            {active && (
              <motion.span
                layoutId="roleThumb"
                transition={{ type: "spring", bounce: 0.2, duration: 0.5 }}
                className={cn(
                  "absolute inset-0 rounded-md border",
                  option.value === "red"
                    ? "border-cyber-pink/50 bg-cyber-pink/10"
                    : "border-cyber-blue/50 bg-cyber-blue/10",
                )}
              />
            )}
            <Icon className="relative z-10 h-3.5 w-3.5" />
            <span className="relative z-10 hidden sm:inline">{option.label}</span>
          </button>
        );
      })}
    </div>
  );
}
