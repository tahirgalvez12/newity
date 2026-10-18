import "dotenv/config";
import { expect, test as base, type Page } from "@playwright/test";
import { Pool } from "pg";

export const PASSWORD = process.env.DEMO_PASSWORD!;
export const REP = { email: "alex@newity.test", name: "Alex Rivera" };
export const MANAGER = { email: "manager@newity.test", name: "Morgan Chen" };

export const db = new Pool({ connectionString: process.env.DATABASE_URL, max: 2 });

// Sign-in is rate limited per client (3 tries / 10 s). Each test sends its own address, but the
// browser's sign-ins can still land in one bucket, so submitSignIn() also waits out the window
// if the app says "Too many attempts". The limiter itself is asserted by the HTTP e2e suite.
let ip = 0;

export const test = base.extend({
  // (Playwright's fixture callback is usually named `use`; renamed so React's hooks lint rule doesn't misfire.)
  page: async ({ page }, provide) => {
    await page.setExtraHTTPHeaders({ "x-forwarded-for": `10.77.${Math.floor(++ip / 250)}.${ip % 250}` });
    await provide(page);
  },
});
export { expect };

/** The page's own alert (Next.js also renders an empty role="alert" route announcer). */
export function formAlert(page: Page) {
  return page.locator('p[role="alert"]');
}

/**
 * Sign-in is rate limited (3 tries / 10 s per client) and the whole suite signs in from one
 * browser, so if the app answers "Too many attempts" we wait out the window once and retry.
 * The limiter itself is asserted by the HTTP suite (e2e/auth.e2e.test.ts).
 */
export async function submitSignIn(page: Page) {
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  const throttled = formAlert(page).filter({ hasText: "Too many attempts" });
  const outcome = await Promise.race([
    page.waitForURL((url) => !url.pathname.startsWith("/login"), { timeout: 10_000 }).then(() => "ok" as const),
    throttled.waitFor({ timeout: 10_000 }).then(() => "throttled" as const),
    formAlert(page).filter({ hasNotText: "Too many attempts" }).waitFor({ timeout: 10_000 }).then(() => "error" as const),
  ]).catch(() => "timeout" as const);
  if (outcome === "throttled") {
    console.log("  (sign-in rate limit hit; waiting 11 s and retrying once)");
    await page.waitForTimeout(11_000);
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
  }
  return outcome;
}

/** Signs in through the real form (not a shortcut) and waits for the landing page. */
export async function signIn(page: Page, email: string, password = PASSWORD) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await submitSignIn(page);
  await page.waitForURL((url) => !url.pathname.startsWith("/login"));
}

export async function signOut(page: Page) {
  await page.getByRole("button", { name: "Sign out" }).click();
  await page.waitForURL("**/login");
}

/** Programs straight from the database, shaped for the matcher, to compute what the UI should show. */
export async function loadPrograms() {
  const { rows } = await db.query(`SELECT * FROM lender_programs ORDER BY id`);
  return rows.map((r) => ({
    id: r.id as number,
    lenderName: r.lender_name as string,
    programType: r.program_type as string,
    minLoanAmount: r.min_loan_amount as number,
    maxLoanAmount: r.max_loan_amount as number,
    minCreditScore: r.min_credit_score as number,
    minYearsInBusiness: Number(r.min_years_in_business),
    interestRateMin: Number(r.interest_rate_min),
    interestRateMax: Number(r.interest_rate_max),
    maxTermMonths: r.max_term_months as number,
    eligibleBusinessTypes: r.eligible_business_types as string,
    turnaroundDays: r.turnaround_days as number,
    specialRequirements: r.special_requirements as string | null,
  }));
}

/** The main-nav link marked as the current page. */
export function currentTab(page: Page) {
  return page.getByRole("navigation", { name: "Main" }).locator('[aria-current="page"]');
}
