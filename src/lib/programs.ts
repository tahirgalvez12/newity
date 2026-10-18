import "server-only";
import { asc, desc } from "drizzle-orm";
import { db } from "@/db";
import { lenderPrograms, rateHistory } from "@/db/schema";
import type { ProgramView } from "@/components/types";

/** Every program, each with its most recent recorded rate/term change (if any). */
export async function getPrograms(): Promise<ProgramView[]> {
  const [programs, changes] = await Promise.all([
    db.select().from(lenderPrograms).orderBy(asc(lenderPrograms.id)),
    db
      .selectDistinctOn([rateHistory.programId])
      .from(rateHistory)
      .orderBy(rateHistory.programId, desc(rateHistory.changedAt), desc(rateHistory.id)),
  ]);
  const latest = new Map(changes.map((c) => [c.programId, { ...c, changedAt: c.changedAt.toISOString() }]));
  return programs.map((p) => ({ ...p, rateChange: latest.get(p.id) ?? null }));
}
