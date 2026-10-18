import "dotenv/config";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { sql } from "drizzle-orm";
import { db, pool } from "../src/db";
import { lenderPrograms } from "../src/db/schema";
import { parseLenderCsv } from "../src/lib/csv";

// Usage: npm run db:seed [path/to/lenders.csv]
async function main() {
  const file = resolve(process.argv[2] ?? "data/lenders.csv");
  const rows = parseLenderCsv(readFileSync(file, "utf8"));

  // Upsert on (lender, program) so re-running with a newer CSV updates rates in place
  // and keeps program ids stable (recommendations reference them).
  await db
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

  console.log(`Seeded ${rows.length} lender programs from ${file}`);
}

main()
  .catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
