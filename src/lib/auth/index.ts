import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { APIError, createAuthMiddleware, getSessionFromCtx } from "better-auth/api";
import { nextCookies } from "better-auth/next-js";
import { admin } from "better-auth/plugins";
import { db } from "@/db";
import { account, ROLES, session, user, verification } from "@/db/schema";
import { ac, roles } from "./permissions";

export const MIN_PASSWORD_LENGTH = 10;

const ROLE_ENDPOINTS = new Set(["/admin/create-user", "/admin/set-role", "/admin/update-user"]);

/**
 * Guards Better Auth's admin endpoints beyond what its permission model covers:
 * - exactly one role per user ("rep" or "manager"): the plugin also accepts role arrays,
 *   which would grant combined permissions our pages don't understand;
 * - nobody changes their own role, so a manager can't accidentally demote themselves and
 *   leave the team without anyone who can manage accounts.
 */
const roleGuard = createAuthMiddleware(async (ctx) => {
  if (!ROLE_ENDPOINTS.has(ctx.path)) return;
  const body = (ctx.body ?? {}) as { userId?: string; role?: unknown; data?: { role?: unknown } };
  const role = ctx.path === "/admin/update-user" ? body.data?.role : body.role;
  if (role === undefined) return;
  if (typeof role !== "string" || !(ROLES as readonly string[]).includes(role)) {
    throw new APIError("BAD_REQUEST", { message: `Role must be one of: ${ROLES.join(", ")}` });
  }
  if (ctx.path !== "/admin/create-user") {
    const current = await getSessionFromCtx(ctx);
    if (current && body.userId === current.user.id) {
      throw new APIError("FORBIDDEN", { message: "You can't change your own role. Ask another manager." });
    }
  }
});

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: "pg",
    schema: { user, session, account, verification },
  }),
  emailAndPassword: {
    enabled: true,
    // Internal tool: there is no public sign-up. Managers create accounts on the Team page.
    disableSignUp: true,
    minPasswordLength: MIN_PASSWORD_LENGTH,
  },
  session: {
    // A rep's workday plus margin; idle sessions roll forward daily.
    expiresIn: 60 * 60 * 24 * 7,
    updateAge: 60 * 60 * 24,
  },
  hooks: { before: roleGuard },
  rateLimit: {
    // On in dev too, so the login throttle can be demoed and tested. In-memory storage is fine
    // for a single server; move to "database" storage before running more than one instance.
    enabled: true,
  },
  plugins: [
    admin({
      ac,
      roles,
      defaultRole: "rep",
      bannedUserMessage: "This account has been deactivated. Ask your manager to reactivate it.",
    }),
    nextCookies(), // must stay last
  ],
});

export type Session = typeof auth.$Infer.Session;
