import { execFileSync } from "node:child_process";
import { db, expect, REP, signIn, test } from "./helpers";

// The monthly-update flow from the README: re-import a newer CSV and the changed programs are
// flagged for reps. Restores the original data and history afterwards.

const seed = (file: string) => execFileSync("npx", ["tsx", "scripts/seed.ts", file], { encoding: "utf8" });
let start: Date;

test.beforeAll(() => {
  start = new Date();
});

test.afterAll(async () => {
  seed("data/lenders.csv");
  await db.query(`DELETE FROM rate_history WHERE changed_at >= $1`, [start]);
});

test("re-importing a newer CSV flags exactly the changed programs", async ({ page }) => {
  const output = seed("data/lenders-update-sample.csv");
  expect(output).toContain("4 programs changed rates or terms");

  const { rows } = await db.query(
    `SELECT p.lender_name, p.program_type FROM rate_history h JOIN lender_programs p ON p.id = h.program_id WHERE h.changed_at >= $1`,
    [start],
  );
  expect(rows).toHaveLength(4);

  await signIn(page, REP.email);
  // No filters: every program is listed, so every flag should be visible.
  await page.goto("/");
  const flagged = page.locator("article").filter({ hasText: /↻ (Rate|Term) changed/ });
  await expect(flagged).toHaveCount(4);
  for (const r of rows) {
    await expect(flagged.filter({ hasText: r.lender_name }).filter({ hasText: r.program_type })).toHaveCount(1);
  }
  // A program that didn't change carries no flag.
  const unchanged = page.locator("article").filter({ hasNotText: /↻ (Rate|Term) changed/ });
  await expect(unchanged).toHaveCount((await page.locator("article").count()) - 4);
});
