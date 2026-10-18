import { asc, count, eq } from "drizzle-orm";
import { Suspense } from "react";
import { db } from "@/db";
import { recommendations, user } from "@/db/schema";
import { MIN_PASSWORD_LENGTH } from "@/lib/auth";
import { requireManager } from "@/lib/auth/session";
import { TeamManager, type TeamMember } from "./TeamManager";

export default function TeamPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-6">
      <Suspense fallback={<p className="text-slate-500">Loading…</p>}>
        <Team />
      </Suspense>
    </div>
  );
}

async function Team() {
  const me = await requireManager();
  const rows = await db
    .select({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      banned: user.banned,
      createdAt: user.createdAt,
      recommendations: count(recommendations.id),
    })
    .from(user)
    .leftJoin(recommendations, eq(recommendations.userId, user.id))
    .groupBy(user.id)
    .orderBy(asc(user.banned), asc(user.role), asc(user.name));

  const members: TeamMember[] = rows.map((r) => ({
    ...r,
    role: r.role === "manager" ? "manager" : "rep",
    banned: !!r.banned,
    createdAt: r.createdAt.toISOString(),
  }));

  return (
    <>
      <h1 className="text-2xl font-semibold">Team</h1>
      <p className="mt-1 text-sm text-slate-600">
        Add reps, change roles, reset passwords. Deactivating signs someone out everywhere but keeps their history.
      </p>
      <TeamManager members={members} currentUserId={me.id} minPasswordLength={MIN_PASSWORD_LENGTH} />
    </>
  );
}
