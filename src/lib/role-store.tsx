import { createContext, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import type { Role } from "@/types";
import { accessRoleForUser, allowedRolesForUser } from "@/lib/access-control";
import { getStoredUser } from "@/services/api-client";

interface RoleContextValue {
  role: Role;
  setRole: (role: Role) => void;
  isRed: boolean;
  isBlue: boolean;
  accessRole: "blue" | "red" | "admin";
  allowedRoles: Role[];
  /** False until the persisted role has been read from localStorage. */
  hydrated: boolean;
}

const STORAGE_KEY = "ngfw.role";

const RoleContext = createContext<RoleContextValue | null>(null);

export function RoleProvider({ children }: { children: ReactNode }) {
  const [role, setRoleState] = useState<Role>("blue");
  const [hydrated, setHydrated] = useState(false);
  const user = getStoredUser();
  const accessRole = useMemo(() => accessRoleForUser(user), [user?.email]);
  const allowedRoles = useMemo(() => allowedRolesForUser(user), [accessRole]);

  // Read persisted role after hydration to avoid an SSR mismatch.
  useEffect(() => {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if ((stored === "red" || stored === "blue") && allowedRoles.includes(stored)) setRoleState(stored);
    else setRoleState(allowedRoles[0] ?? "blue");
    setHydrated(true);
  }, [allowedRoles]);

  const value = useMemo<RoleContextValue>(
    () => ({
      role,
      isRed: role === "red",
      isBlue: role === "blue",
      accessRole,
      allowedRoles,
      hydrated,
      setRole: (next: Role) => {
        if (!allowedRoles.includes(next)) return;
        setRoleState(next);
        window.localStorage.setItem(STORAGE_KEY, next);
      },
    }),
    [accessRole, allowedRoles, hydrated, role],
  );

  return <RoleContext.Provider value={value}>{children}</RoleContext.Provider>;
}

export function useRole(): RoleContextValue {
  const ctx = useContext(RoleContext);
  if (!ctx) throw new Error("useRole must be used within a RoleProvider");
  return ctx;
}
