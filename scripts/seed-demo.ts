import "dotenv/config";
import { db, pool } from "../src/db";
import { count, eq } from "drizzle-orm";
import { lenderPrograms, recommendations, user } from "../src/db/schema";
import { matchPrograms, type Borrower, type CreditTier } from "../src/lib/matching";

// Usage: npm run db:seed-demo            (replaces all recommendations)
//        npm run db:seed-demo -- --if-empty (only seeds a fresh database; used by `npm run setup`)
// Replaces ALL recommendations with ~60 realistic fake ones over the last 30 days, spread
// across the active rep accounts, so the manager dashboard has something to show in a demo.
// Never run this against real data.
const TYPES = ["Restaurant/Food Service", "Construction", "Retail", "Manufacturing", "Professional Services", "Healthcare", "Other"];
const TIERS: CreditTier[] = ["Excellent", "Good", "Good", "Fair"];
const AMOUNTS = [40_000, 75_000, 120_000, 150_000, 250_000, 350_000, 500_000, 900_000, 1_500_000, 2_500_000];

// Deterministic so the demo looks the same every time.
let seed = 42;
const rand = () => ((seed = (seed * 1_103_515_245 + 12_345) % 2 ** 31) / 2 ** 31);
const pick = <T>(xs: T[]) => xs[Math.floor(rand() * xs.length)];

async function main() {
  if (process.argv.includes("--if-empty")) {
    const [{ n }] = await db.select({ n: count() }).from(recommendations);
    if (n > 0) {
      console.log(`Kept ${n} existing recommendations (demo data not added).`);
      return;
    }
  }
  const programs = await db.select().from(lenderPrograms);
  if (!programs.length) throw new Error("No lender programs. Run `npm run db:seed` first.");
  const reps = (await db.select({ id: user.id }).from(user).where(eq(user.role, "rep"))).map((r) => r.id);
  if (!reps.length) throw new Error("No rep accounts. Run `npm run db:seed-users` first.");

  const rows: (typeof recommendations.$inferInsert)[] = [];
  while (rows.length < 60) {
    const borrower: Borrower = {
      loanAmount: pick(AMOUNTS),
      businessType: pick(TYPES),
      yearsInBusiness: pick([1, 2, 2, 3, 4, 6, 10]),
      creditTier: pick(TIERS),
      creditScore: null,
    };
    // Reps mostly pick from the top of the list, like they would on a real call.
    const { eligible } = matchPrograms(programs, borrower);
    if (!eligible.length) continue;
    const choice = eligible[Math.min(Math.floor(rand() * rand() * 4), eligible.length - 1)].program;
    const daysAgo = rand() * 30;
    rows.push({
      programId: choice.id,
      userId: pick(reps),
      borrowerSnapshot: borrower,
      createdAt: new Date(Date.now() - daysAgo * 86_400_000),
    });
  }

  const { rowCount } = await db.delete(recommendations);
  await db.insert(recommendations).values(rows);
  console.log(`Inserted ${rows.length} demo recommendations${rowCount ? ` (replaced ${rowCount} existing)` : ""}.`);
}

main()
  .catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
