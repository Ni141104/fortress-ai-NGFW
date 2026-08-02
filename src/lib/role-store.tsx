import { createContext, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import type { Role } from "@/types";

interface RoleContextValue {
  role: Role;
  setRole: (role: Role) => void;
  isRed: boolean;
  isBlue: boolean;
}

const STORAGE_KEY = "ngfw.role";

const RoleContext = createContext<RoleContextValue | null>(null);

export function RoleProvider({ children }: { children: ReactNode }) {
  const [role, setRoleState] = useState<Role>("blue");

  // Read persisted role after hydration to avoid an SSR mismatch.
  useEffect(() => {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored === "red" || stored === "blue") setRoleState(stored);
  }, []);

  const value = useMemo<RoleContextValue>(
    () => ({
      role,
      isRed: role === "red",
      isBlue: role === "blue",
      setRole: (next: Role) => {
        setRoleState(next);
        window.localStorage.setItem(STORAGE_KEY, next);
      },
    }),
    [role],
  );

  return <RoleContext.Provider value={value}>{children}</RoleContext.Provider>;
}

export function useRole(): RoleContextValue {
  const ctx = useContext(RoleContext);
  if (!ctx) throw new Error("useRole must be used within a RoleProvider");
  return ctx;
}
