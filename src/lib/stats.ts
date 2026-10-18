import "server-only";
import { count, desc, eq, gte, sql } from "drizzle-orm";
import { db } from "@/db";
import { lenderPrograms, recommendations } from "@/db/schema";

export const RANGES = { "7": 7, "30": 30, all: null } as const;
export type RangeKey = keyof typeof RANGES;

export function parseRange(value: string | string[] | undefined): RangeKey {
  return typeof value === "string" && value in RANGES ? (value as RangeKey) : "30";
}

export async function getRecommendationStats(range: RangeKey) {
  const days = RANGES[range];
  const where = days == null ? undefined : gte(recommendations.createdAt, sql`now() - make_interval(days => ${days})`);

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
      .select({ repName: recommendations.repName, count: count() })
      .from(recommendations)
      .where(where)
      .groupBy(recommendations.repName)
      .orderBy(desc(count()), recommendations.repName),
    db
      .select({ programType: lenderPrograms.programType, count: count() })
      .from(recommendations)
      .innerJoin(lenderPrograms, eq(recommendations.programId, lenderPrograms.id))
      .where(where)
      .groupBy(lenderPrograms.programType)
      .orderBy(desc(count()), lenderPrograms.programType),
    db
      .select({
        id: recommendations.id,
        repName: recommendations.repName,
        createdAt: recommendations.createdAt,
        borrower: recommendations.borrowerSnapshot,
        lenderName: lenderPrograms.lenderName,
        programType: lenderPrograms.programType,
      })
      .from(recommendations)
      .innerJoin(lenderPrograms, eq(recommendations.programId, lenderPrograms.id))
      .where(where)
      .orderBy(desc(recommendations.createdAt))
      .limit(10),
  ]);

  const total = byRep.reduce((sum, r) => sum + r.count, 0);
  return { total, byProgram, byRep, byProgramType, recent };
}
