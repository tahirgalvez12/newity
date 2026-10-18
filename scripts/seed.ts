import "dotenv/config";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { sql } from "drizzle-orm";
import { db, pool } from "../src/db";
import { lenderPrograms, rateHistory } from "../src/db/schema";
import { parseLenderCsv } from "../src/lib/csv";
import { describeChange, diffRates } from "../src/lib/rate-changes";

// Usage: npm run db:seed [path/to/lenders.csv]
async function main() {
  const file = resolve(process.argv[2] ?? "data/lenders.csv");
  const rows = parseLenderCsv(readFileSync(file, "utf8"));

  const diff = await db.transaction(async (tx) => {
    // Compare before writing so we know which programs' rates or terms this import changes.
    const current = await tx.select().from(lenderPrograms);
    const diff = diffRates(current, rows);

    // Upsert on (lender, program) so re-running with a newer CSV updates rates in place
    // and keeps program ids stable (recommendations and rate history reference them).
    await tx
      .insert(lenderPrograms)
      .values(rows)
      .onConflictDoUpdate({
        target: [lenderPrograms.lenderName, lenderPrograms.programType],
        set: Object.fromEntries(
          Object.keys(rows[0])
            .filter((k) => k !== "lenderName" && k !== "programType")
            .map((k) => {
              const column = lenderPrograms[k as keyof typeof lenderPrograms.$inferInsert];
              return [k, sql.raw(`excluded.${column.name}`)];
            }),
        ),
      });

    if (diff.changed.length) {
      await tx.insert(rateHistory).values(
        diff.changed.map((c) => ({
          programId: c.programId,
          oldInterestRateMin: c.old.interestRateMin,
          newInterestRateMin: c.new.interestRateMin,
          oldInterestRateMax: c.old.interestRateMax,
          newInterestRateMax: c.new.interestRateMax,
          oldMaxTermMonths: c.old.maxTermMonths,
          newMaxTermMonths: c.new.maxTermMonths,
          oldLastUpdated: c.old.lastUpdated,
          newLastUpdated: c.new.lastUpdated,
        })),
      );
    }
    return diff;
  });

  console.log(`Seeded ${rows.length} lender programs from ${file}`);
  const n = diff.changed.length;
  console.log(`${n} program${n === 1 ? "" : "s"} changed rates or terms${n ? ":" : ""}`);
  for (const c of diff.changed) console.log(`  ${describeChange(c)}`);
  if (diff.added.length) console.log(`${diff.added.length} new program(s) added`);
  if (diff.missing.length) {
    console.log(`${diff.missing.length} program(s) in the database are not in this CSV (left unchanged):`);
    for (const m of diff.missing) console.log(`  ${m.lenderName} · ${m.programType}`);
  }
}

main()
  .catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
