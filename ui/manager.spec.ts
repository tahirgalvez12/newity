import { currentTab, db, expect, formAlert, MANAGER, REP, signIn, signOut, submitSignIn, test } from "./helpers";

const RUN = Date.now();
const NEW_REP = { name: `UI Test Rep ${RUN}`, email: `ui-rep-${RUN}@newity.test` };

test.afterAll(async () => {
  await db.query(`DELETE FROM recommendations WHERE user_id IN (SELECT id FROM "user" WHERE email LIKE 'ui-rep-%@newity.test')`);
  await db.query(`DELETE FROM "user" WHERE email LIKE 'ui-rep-%@newity.test'`);
});

test.describe("manager", () => {
  test("lands on the dashboard with team-wide numbers from the database", async ({ page }) => {
    await signIn(page, MANAGER.email);
    await expect(page).toHaveURL("/manager");
    await expect(currentTab(page)).toHaveText("Dashboard");
    const nav = page.getByRole("navigation", { name: "Main" });
    await expect(nav.getByRole("link")).toHaveText(["Dashboard", "Team", "Matcher", "My recommendations"]);

    const { rows } = await db.query(`SELECT count(*)::int AS n FROM recommendations WHERE created_at > now() - interval '30 days'`);
    await expect(page.getByText("Recommendations", { exact: true }).locator("..")).toContainText(String(rows[0].n));

    // Range tabs change the URL and the active tab.
    await page.getByRole("link", { name: "All time" }).click();
    await expect(page).toHaveURL("/manager?days=all");
    await expect(page.getByRole("link", { name: "All time" })).toHaveAttribute("aria-current", "page");
  });

  test("onboards a rep, who can sign in; deactivating them locks them out", async ({ page, browser }) => {
    await signIn(page, MANAGER.email);
    await page.getByRole("link", { name: "Team" }).click();
    await expect(currentTab(page)).toHaveText("Team");

    await page.getByLabel("Name").fill(NEW_REP.name);
    await page.getByLabel("Work email").fill(NEW_REP.email);
    await page.getByRole("button", { name: "Add & create password" }).click();
    const notice = page.getByRole("status").filter({ hasText: `Added ${NEW_REP.name}` });
    await expect(notice).toBeVisible();
    const tempPassword = (await notice.locator("code").innerText()).trim();
    expect(tempPassword).toMatch(/^[A-Za-z0-9]{14,}$/);

    // The new rep signs in, in a separate browser, with the password the manager was shown.
    const repContext = await browser.newContext({ extraHTTPHeaders: { "x-forwarded-for": `10.78.0.${RUN % 250}` } });
    const repPage = await repContext.newPage();
    await signIn(repPage, NEW_REP.email, tempPassword);
    await expect(repPage).toHaveURL("/");
    await expect(repPage.getByLabel("Loan amount")).toBeVisible();

    // Manager deactivates them.
    page.once("dialog", (d) => d.accept());
    const row = page.getByRole("row").filter({ hasText: NEW_REP.email });
    await row.getByRole("button", { name: "Deactivate" }).click();
    await expect(row.getByText("Deactivated")).toBeVisible();

    // Their open session is gone...
    await repPage.goto("/history");
    await expect(repPage).toHaveURL(/\/login/);
    // ...and signing in again is refused with a clear message.
    await repPage.getByLabel("Email").fill(NEW_REP.email);
    await repPage.getByLabel("Password").fill(tempPassword);
    await submitSignIn(repPage);
    await expect(formAlert(repPage)).toContainText("deactivated");
    await repContext.close();
  });

  test("can't change their own role or deactivate themselves from the UI", async ({ page }) => {
    await signIn(page, MANAGER.email);
    await page.goto("/manager/team");
    // Match the exact email cell: "manager@newity.test" is also a substring of "dana.manager@newity.test".
    const me = page.getByRole("row").filter({ has: page.getByText(MANAGER.email, { exact: true }) });
    await expect(me).toHaveCount(1);
    await expect(me.getByRole("combobox")).toBeDisabled();
    await expect(me.getByRole("button", { name: "Deactivate" })).toHaveCount(0);
  });

  test("the Account page shows who you are and is marked as current", async ({ page }) => {
    await signIn(page, MANAGER.email);
    await page.getByRole("link", { name: /Account settings/ }).click();
    await expect(page).toHaveURL("/account");
    await expect(page.getByText(MANAGER.email).last()).toBeVisible();
    await expect(page.getByRole("link", { name: /Account settings/ })).toHaveAttribute("aria-current", "page");
    await signOut(page);
  });
});

test.describe("login", () => {
  test("wrong password shows a generic error and stays on the page", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("Email").fill(REP.email);
    await page.getByLabel("Password").fill("not-the-password");
    expect(await submitSignIn(page)).not.toBe("ok");
    await expect(formAlert(page)).toHaveText("Email or password is incorrect.");
    await expect(page).toHaveURL(/\/login/);
  });

  test("one-click demo buttons sign in as each role (local only)", async ({ page }) => {
    if (process.env.E2E_PRODUCTION) {
      // Production builds must never offer demo sign-in or print the demo password.
      await page.goto("/login");
      await expect(page.getByText("Local demo")).toHaveCount(0);
      expect(await page.content()).not.toContain(process.env.DEMO_PASSWORD!);
      return;
    }
    test.setTimeout(60_000);
    // These buttons sign in directly, so give the shared limiter a clean window first.
    await page.waitForTimeout(11_000);
    await page.goto("/login");
    await page.getByRole("button", { name: /Manager\s*Morgan Chen/ }).click();
    await expect(page).toHaveURL("/manager");
    await signOut(page);
    await page.getByRole("button", { name: /Rep\s*Alex Rivera/ }).click();
    await expect(page).toHaveURL("/");
  });

  test("after login you return to the page you asked for", async ({ page }) => {
    await page.goto("/history?days=7");
    await expect(page).toHaveURL(/\/login\?next=/);
    await page.getByLabel("Email").fill(REP.email);
    await page.getByLabel("Password").fill(process.env.DEMO_PASSWORD!);
    await submitSignIn(page);
    await expect(page).toHaveURL("/history?days=7");
  });
});
