import { matchPrograms } from "../src/lib/matching";
import { currentTab, db, expect, loadPrograms, MANAGER, REP, signIn, signOut, test } from "./helpers";

// A rep's whole call, in the order the README's "Things to try" describes it.

test.describe("rep on a call", () => {
  test.beforeEach(async ({ page }) => {
    await signIn(page, REP.email);
  });

  test("lands on the matcher, sees only rep navigation", async ({ page }) => {
    await expect(page).toHaveURL("/");
    await expect(currentTab(page)).toHaveText("Matcher");
    const nav = page.getByRole("navigation", { name: "Main" });
    await expect(nav.getByRole("link")).toHaveText(["Matcher", "My recommendations"]);
    await expect(page.getByText("Rep", { exact: true })).toBeVisible();
  });

  test("results narrow as the rep types and match the rules exactly", async ({ page }) => {
    const programs = await loadPrograms();
    const total = programs.length;
    await expect(page.getByRole("heading", { level: 2, name: `All ${total} programs` })).toBeVisible();

    await page.getByLabel("Loan amount").fill("150k");
    await page.getByLabel("Business type").selectOption("Restaurant/Food Service");
    await page.getByLabel("Years in business").fill("2");
    await page.getByRole("radio", { name: /Good/ }).click();

    const expected = matchPrograms(
      programs,
      { loanAmount: 150_000, businessType: "Restaurant/Food Service", yearsInBusiness: 2, creditTier: "Good", creditScore: null },
      "rate",
    );
    await expect(page.getByRole("heading", { level: 2, name: `${expected.eligible.length} programs fit` })).toBeVisible();
    const cards = page.locator("article");
    await expect(cards).toHaveCount(expected.eligible.length);
    // Same programs, same order (lowest rate first) as the tested matching rules.
    await expect(cards.locator("h3")).toHaveText(expected.eligible.map((r) => r.program.lenderName));

    // State lives in the URL, so a refresh (or a shared link) keeps the borrower.
    await expect(page).toHaveURL(/amt=150000/);
    await page.reload();
    await expect(page.getByLabel("Loan amount")).toHaveValue("$150,000");
    await expect(cards).toHaveCount(expected.eligible.length);
  });

  test("borderline credit warns, and an exact score resolves it", async ({ page }) => {
    await page.goto("/?amt=300000&type=Retail&yrs=1&tier=Fair");
    const warnings = page.getByText(/Confirm credit score is \d+\+/);
    await expect(warnings.first()).toBeVisible();
    await page.getByLabel("Exact score (optional)").fill("700");
    await expect(warnings).toHaveCount(0);
  });

  test("near-misses explain the one thing that's off", async ({ page }) => {
    await page.goto("/?amt=40000&type=Construction&yrs=0.5&tier=Fair");
    await expect(page.getByRole("heading", { level: 2, name: "0 programs fit" })).toBeVisible();
    await expect(page.getByText(/follow up at the 1-year mark/)).toBeVisible();
    const near = page.locator("details");
    await expect(near).toHaveAttribute("open", "");
    await expect(near.locator("li").first()).toContainText(/Needs .* in business \(borrower has 6 mo\)/);
  });

  test("compare side by side, copy a summary, copy a share link", async ({ page, context }) => {
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    await page.goto("/?amt=150000&type=Restaurant%2FFood+Service&yrs=2&tier=Good");
    const cards = page.locator("article");
    const names = [await cards.nth(0).locator("h3").innerText(), await cards.nth(1).locator("h3").innerText()];
    await cards.nth(0).getByRole("checkbox").check();
    await cards.nth(1).getByRole("checkbox").check();
    await expect(page.getByText(/Comparing\s*2\s*\/4/)).toBeVisible();

    await page.getByRole("button", { name: "Compare side by side" }).click();
    const dialog = page.getByRole("dialog", { name: "Compare programs" });
    await expect(dialog).toBeVisible();
    for (const n of names) await expect(dialog.getByText(n, { exact: true })).toBeVisible();
    await expect(dialog.getByText("★ best").first()).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();

    await page.getByRole("button", { name: /Copy summary \(2\)/ }).click();
    await expect(page.getByRole("status").filter({ hasText: "Copied summary of 2 programs" })).toBeVisible();
    const summary = await page.evaluate(() => navigator.clipboard.readText());
    expect(summary).toContain("SBA loan options for: $150k · Restaurant/Food Service · 2 yrs in business · Good credit");
    for (const n of names) expect(summary).toContain(n);

    await page.getByRole("button", { name: "Copy share link" }).click();
    const link = await page.evaluate(() => navigator.clipboard.readText());
    expect(new URL(link).searchParams.get("cmp")?.split(",")).toHaveLength(2);
    // The link reopens the exact comparison.
    await page.goto(link);
    await expect(page.getByText(/Comparing\s*2\s*\/4/)).toBeVisible();
  });

  test("recommend is saved under the signed-in rep and shows in their history", async ({ page }) => {
    const start = new Date();
    await page.goto("/?amt=150000&type=Retail&yrs=2&tier=Good");
    const card = page.locator("article").first();
    const lender = await card.locator("h3").innerText();
    await card.getByRole("button", { name: "Recommend" }).click();
    await expect(card.getByRole("button", { name: "✓ Recommended" })).toBeDisabled();

    const { rows } = await db.query(
      `SELECT u.email, p.lender_name, r.borrower_snapshot FROM recommendations r
       JOIN "user" u ON u.id = r.user_id JOIN lender_programs p ON p.id = r.program_id
       WHERE r.created_at >= $1 ORDER BY r.created_at DESC LIMIT 1`,
      [start],
    );
    expect(rows[0]).toMatchObject({ email: REP.email, lender_name: lender });
    expect(rows[0].borrower_snapshot).toMatchObject({ loanAmount: 150000, businessType: "Retail" });

    await page.getByRole("link", { name: "My recommendations" }).click();
    await expect(currentTab(page)).toHaveText("My recommendations");
    await expect(page.locator("li").first()).toContainText(lender);
    await expect(page.locator("li").first()).toContainText("$150k · Retail");
  });

  test("manager pages are off limits and never render manager content", async ({ page }) => {
    await page.goto("/manager");
    await expect(page).toHaveURL("/");
    await expect(page.getByText("That page is for sales managers.")).toBeVisible();
    await page.goto("/manager/team");
    await expect(page).toHaveURL("/");
    await expect(page.getByText("Add a team member")).toHaveCount(0);
  });

  test("signing out ends access", async ({ page }) => {
    await signOut(page);
    await page.goto("/history");
    await expect(page).toHaveURL(/\/login\?next=%2Fhistory/);
  });
});

test.describe("phone width", () => {
  test.use({ viewport: { width: 375, height: 812 } });

  /** Fails with the offending elements listed, after web fonts load (wider text exposed a real bug). */
  async function expectNoSidewaysScroll(page: import("@playwright/test").Page, path: string) {
    await page.goto(path);
    await page.waitForLoadState("networkidle");
    await page.evaluate(() => document.fonts.ready);
    const result = await page.evaluate(() => {
      const vw = document.documentElement.clientWidth;
      const offenders = [...document.querySelectorAll("body *")]
        .filter((e) => e.getBoundingClientRect().right > vw + 1 && getComputedStyle(e).position !== "fixed")
        .slice(0, 3)
        .map((e) => `${e.tagName}: ${(e as HTMLElement).innerText?.slice(0, 40)}`);
      return { scrollWidth: document.documentElement.scrollWidth, clientWidth: vw, offenders };
    });
    expect(result.scrollWidth, `${path} is wider than the screen: ${result.offenders.join(" | ")}`).toBeLessThanOrEqual(result.clientWidth);
  }

  test("rep: navigation stays usable and no page scrolls sideways", async ({ page }) => {
    await signIn(page, REP.email);
    await expect(page.getByRole("link", { name: "My recommendations" })).toBeVisible();
    await expect(currentTab(page)).toHaveText("Matcher");
    for (const path of ["/", "/?amt=150000&type=Restaurant%2FFood+Service&yrs=2&tier=Good&cmp=1,2", "/?amt=40000&yrs=0.5", "/history", "/account"]) {
      await expectNoSidewaysScroll(page, path);
    }
  });

  test("manager: no page scrolls sideways", async ({ page }) => {
    await signIn(page, MANAGER.email);
    for (const path of ["/manager", "/manager?days=all", "/manager/team"]) await expectNoSidewaysScroll(page, path);
  });

  test("login page fits", async ({ page }) => {
    await expectNoSidewaysScroll(page, "/login");
  });
});
