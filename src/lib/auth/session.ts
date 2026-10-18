import "server-only";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import type { Role } from "@/db/schema";
import { auth } from "./index";

export interface CurrentUser {
  id: string;
  name: string;
  email: string;
  role: Role;
}

/** The signed-in user, validated against the session table (not just "a cookie exists"). */
export async function getCurrentUser(): Promise<CurrentUser | null> {
  const result = await auth.api.getSession({ headers: await headers() });
  if (!result || result.user.banned) return null;
  const { id, name, email, role } = result.user;
  return { id, name, email, role: role === "manager" ? "manager" : "rep" };
}

/** For pages: sends signed-out visitors to the login page. */
export async function requireUser(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

/** For manager-only pages: reps are bounced to the matcher, not shown an error. */
export async function requireManager(): Promise<CurrentUser> {
  const user = await requireUser();
  if (user.role !== "manager") redirect("/?denied=manager");
  return user;
}

export function homeFor(role: Role): string {
  return role === "manager" ? "/manager" : "/";
}
