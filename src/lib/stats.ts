import "server-only";
import { and, count, desc, eq, gte, sql, type SQL } from "drizzle-orm";
import { db } from "@/db";
import { lenderPrograms, recommendations, user } from "@/db/schema";

export const RANGES = { "7": 7, "30": 30, all: null } as const;
export type RangeKey = keyof typeof RANGES;

export function parseRange(value: string | string[] | undefined): RangeKey {
  return typeof value === "string" && value in RANGES ? (value as RangeKey) : "30";
}

function since(range: RangeKey): SQL | undefined {
  const days = RANGES[range];
  return days == null ? undefined : gte(recommendations.createdAt, sql`now() - make_interval(days => ${days})`);
}

/** Team-wide numbers. Callers must have checked the viewer is a manager. */
export async function getRecommendationStats(range: RangeKey) {
  const where = since(range);

  const [byProgram, byRep, byProgramType, recent] = await Promise.all([
    db
      .select({
        programId: lenderPrograms.id,
        lenderName: lenderPrograms.lenderName,
        programType: lenderPrograms.programType,
        count: count(),
      })
      .from(recommendations)
      .innerJoin(lenderPrograms, eq(recommendations.programId, lenderPrograms.id))
      .where(where)
      .groupBy(lenderPrograms.id)
      .orderBy(desc(count()), lenderPrograms.lenderName)
      .limit(15),
    db
      .select({ userId: user.id, name: user.name, banned: user.banned, count: count() })
      .from(recommendations)
      .innerJoin(user, eq(recommendations.userId, user.id))
      .where(where)
      .groupBy(user.id)
      .orderBy(desc(count()), user.name),
    db
      .select({ programType: lenderPrograms.programType, count: count() })
      .from(recommendations)
      .innerJoin(lenderPrograms, eq(recommendations.programId, lenderPrograms.id))
      .where(where)
      .groupBy(lenderPrograms.programType)
      .orderBy(desc(count()), lenderPrograms.programType),
    recentRecommendations(where, 10),
  ]);

  const total = byRep.reduce((sum, r) => sum + r.count, 0);
  return { total, byProgram, byRep, byProgramType, recent };
}

/** One user's own recommendations. Scoped by user id in the query, not filtered afterwards. */
export async function getUserHistory(userId: string, range: RangeKey) {
  const where = and(eq(recommendations.userId, userId), since(range));
  const [rows, [{ total }]] = await Promise.all([
    recentRecommendations(where, 100),
    db.select({ total: count() }).from(recommendations).where(where),
  ]);
  return { total, rows };
}

function recentRecommendations(where: SQL | undefined, limit: number) {
  return db
    .select({
      id: recommendations.id,
      repName: user.name,
      createdAt: recommendations.createdAt,
      borrower: recommendations.borrowerSnapshot,
      programId: lenderPrograms.id,
      lenderName: lenderPrograms.lenderName,
      programType: lenderPrograms.programType,
      interestRateMin: lenderPrograms.interestRateMin,
      interestRateMax: lenderPrograms.interestRateMax,
    })
    .from(recommendations)
    .innerJoin(lenderPrograms, eq(recommendations.programId, lenderPrograms.id))
    .innerJoin(user, eq(recommendations.userId, user.id))
    .where(where)
    .orderBy(desc(recommendations.createdAt))
    .limit(limit);
}
