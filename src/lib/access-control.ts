import type { AuthUser } from "@/services/api-client";
import type { Role } from "@/types";

export type AccessRole = Role | "admin";

const ADMIN_EMAIL = "nikhilprajapati1411@gmail.com";
const BLUE_EMAIL = "nikhil141107@gmail.com";
const RED_EMAIL = "112215139@cse.iiitp.ac.in";

export function accessRoleForUser(user: AuthUser | null): AccessRole {
  if (user?.role === "admin" || user?.role === "blue" || user?.role === "red") return user.role;
  const email = user?.email.toLowerCase();
  if (email === ADMIN_EMAIL) return "admin";
  if (email === RED_EMAIL) return "red";
  return email === BLUE_EMAIL ? "blue" : "blue";
}

export function allowedRolesForUser(user: AuthUser | null): Role[] {
  return accessRoleForUser(user) === "admin" ? ["blue", "red"] : [accessRoleForUser(user) as Role];
}

export { ADMIN_EMAIL, BLUE_EMAIL, RED_EMAIL };