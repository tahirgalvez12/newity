import "dotenv/config";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Pool } from "pg";

// End-to-end security checks against a RUNNING app (npm run dev, or npm run build && npm start).
// Run with: npm run test:e2e. Uses the demo accounts from `npm run db:seed-users`.

const BASE = process.env.E2E_BASE_URL ?? "http://localhost:3000";
const PASSWORD = process.env.DEMO_PASSWORD!;
const REP = "alex@newity.test";
const OTHER_REP = "jordan@newity.test";
const MANAGER = "manager@newity.test";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const RUN = Date.now();
const createdEmails: string[] = [];

// Sign-in is rate limited per client IP (3 tries / 10s). Each test client gets its own
// IP so the suite isn't throttled by itself; the rate-limit test deliberately reuses one.
let ipCounter = 0;
const nextIp = () => `10.99.${Math.floor(++ipCounter / 250)}.${ipCounter % 250}`;

class Client {
  cookie = "";
  constructor(readonly ip = nextIp()) {}

  async req(path: string, init: RequestInit & { json?: unknown } = {}) {
    const headers = new Headers(init.headers);
    headers.set("origin", BASE); // Better Auth rejects cross-origin POSTs
    headers.set("x-forwarded-for", this.ip);
    if (this.cookie) headers.set("cookie", this.cookie);
    if (init.json !== undefined) headers.set("content-type", "application/json");
    const res = await fetch(BASE + path, {
      ...init,
      headers,
      body: init.json !== undefined ? JSON.stringify(init.json) : init.body,
      redirect: "manual",
    });
    const setCookies = res.headers.getSetCookie();
    if (setCookies.length) {
      const jar = new Map(this.cookie.split("; ").filter(Boolean).map((c) => c.split("=") as [string, string]));
      for (const sc of setCookies) {
        const [pair] = sc.split(";");
        const i = pair.indexOf("=");
        jar.set(pair.slice(0, i), pair.slice(i + 1));
      }
      this.cookie = [...jar].filter(([, v]) => v).map(([k, v]) => `${k}=${v}`).join("; ");
    }
    return res;
  }

  signIn(email: string, password = PASSWORD) {
    return this.req("/api/auth/sign-in/email", { method: "POST", json: { email, password } });
  }

  static async as(email: string) {
    const c = new Client();
    const res = await c.signIn(email);
    expect(res.status, `sign in as ${email}`).toBe(200);
    return c;
  }
}

/** Pages guarded inside <Suspense> stream a redirect rather than a 3xx; check what was rendered. */
async function page(c: Client, path: string) {
  const res = await c.req(path);
  return { status: res.status, location: res.headers.get("location"), html: res.status === 200 ? await res.text() : "" };
}

let rep: Client;
let manager: Client;

beforeAll(async () => {
  expect(PASSWORD, "DEMO_PASSWORD must be set (see .env.example)").toBeTruthy();
  const health = await fetch(BASE + "/login").catch(() => null);
  if (!health) throw new Error(`App isn't running at ${BASE}. Start it with npm run dev first.`);
  [rep, manager] = await Promise.all([Client.as(REP), Client.as(MANAGER)]);
});

afterAll(async () => {
  // Accounts created by this run: remove them and anything they recorded.
  if (createdEmails.length) {
    await pool.query(`DELETE FROM recommendations WHERE user_id IN (SELECT id FROM "user" WHERE email = ANY($1))`, [createdEmails]);
    await pool.query(`DELETE FROM "user" WHERE email = ANY($1)`, [createdEmails]);
  }
  await pool.end();
});

describe("signed out", () => {
  const anon = new Client();

  it.each(["/", "/history", "/manager", "/manager/team", "/account"])("redirects %s to login", async (path) => {
    const res = await anon.req(path);
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toContain("/login");
  });

  it("keeps where you were going (including borrower details) for after login", async () => {
    const res = await anon.req("/history?days=7");
    expect(new URL(res.headers.get("location")!, BASE).searchParams.get("next")).toBe("/history?days=7");
  });

  it("rejects API calls with 401", async () => {
    const res = await anon.req("/api/recommendations", { method: "POST", json: { programId: 1, borrower: {} } });
    expect(res.status).toBe(401);
  });

  it("can't sign up, even by calling the endpoint directly", async () => {
    const res = await anon.req("/api/auth/sign-up/email", {
      method: "POST",
      json: { email: `e2e-signup-${RUN}@newity.test`, password: "long-enough-password", name: "Intruder" },
    });
    expect(res.status).toBeGreaterThanOrEqual(400);
    const { rows } = await pool.query(`SELECT 1 FROM "user" WHERE email = $1`, [`e2e-signup-${RUN}@newity.test`]);
    expect(rows).toHaveLength(0);
  });
});

describe("login", () => {
  it("gives the same answer for a wrong password and an unknown email", async () => {
    const wrongPassword = await new Client().signIn(REP, "definitely-wrong-pw");
    const unknownEmail = await new Client().signIn(`nobody-${RUN}@newity.test`, "definitely-wrong-pw");
    expect(wrongPassword.status).toBe(401);
    expect(unknownEmail.status).toBe(wrongPassword.status);
    expect((await unknownEmail.json()).code).toBe((await wrongPassword.json()).code);
  });

  it("throttles repeated attempts from one client", async () => {
    const c = new Client();
    const statuses: number[] = [];
    for (let i = 0; i < 5; i++) statuses.push((await c.signIn(REP, "wrong-password-again")).status);
    expect(statuses).toContain(429);
  });

  it("sets an httpOnly session cookie", async () => {
    const res = await new Client().signIn(REP);
    const cookie = res.headers.getSetCookie().find((c) => c.includes("session_token"));
    expect(cookie).toMatch(/HttpOnly/i);
    expect(cookie).toMatch(/SameSite=Lax/i);
  });
});

describe("rep", () => {
  it("can use the matcher and their history", async () => {
    expect((await page(rep, "/")).html).toContain("Loan amount");
    expect((await page(rep, "/history")).html).toContain("My recommendations");
  });

  it.each(["/manager", "/manager/team"])("never receives manager content at %s", async (path) => {
    const { html } = await page(rep, path);
    expect(html).not.toContain("What reps are recommending");
    expect(html).not.toContain("Add a team member");
    expect(html).not.toContain("manager@newity.test");
    expect(html).toContain("denied=manager"); // streamed redirect back to the matcher
  });

  it.each([
    ["/api/auth/admin/list-users", "GET", undefined],
    ["/api/auth/admin/create-user", "POST", { email: `e2e-rep-made-${RUN}@newity.test`, password: "long-enough-password", name: "X", role: "manager" }],
    ["/api/auth/admin/set-role", "POST", { userId: "anything", role: "manager" }],
  ] as const)("is forbidden from admin API %s", async (path, method, json) => {
    const res = await rep.req(path, { method, json });
    expect(res.status).toBe(403);
  });

  it("can't promote themselves", async () => {
    const me = await (await rep.req("/api/auth/get-session")).json();
    const res = await rep.req("/api/auth/admin/set-role", { method: "POST", json: { userId: me.user.id, role: "manager" } });
    expect(res.status).toBe(403);
    const { rows } = await pool.query(`SELECT role FROM "user" WHERE id = $1`, [me.user.id]);
    expect(rows[0].role).toBe("rep");
  });

  it("records recommendations as themselves, ignoring any user in the body", async () => {
    const me = await (await rep.req("/api/auth/get-session")).json();
    const other = (await pool.query(`SELECT id FROM "user" WHERE email = $1`, [OTHER_REP])).rows[0].id;
    const res = await rep.req("/api/recommendations", {
      method: "POST",
      json: { programId: 1, borrower: { loanAmount: 100000 }, userId: other, repName: "Someone Else" },
    });
    expect(res.status).toBe(201);
    const { id } = await res.json();
    const { rows } = await pool.query(`SELECT user_id FROM recommendations WHERE id = $1`, [id]);
    expect(rows[0].user_id).toBe(me.user.id);
    await pool.query(`DELETE FROM recommendations WHERE id = $1`, [id]);
  });
});

describe("manager", () => {
  it("lands on the dashboard and team pages", async () => {
    expect((await page(manager, "/manager")).html).toContain("What reps are recommending");
    expect((await page(manager, "/manager/team")).html).toContain("Add a team member");
  });

  it("can still use the matcher", async () => {
    expect((await page(manager, "/")).html).toContain("Loan amount");
  });

  it("only allows the two known roles, one at a time", async () => {
    for (const role of ["admin", ["rep", "manager"], "superuser"]) {
      const res = await manager.req("/api/auth/admin/create-user", {
        method: "POST",
        json: { email: `e2e-badrole-${RUN}-${String(role)}@newity.test`, password: "long-enough-password", name: "X", role },
      });
      expect(res.status, `role ${JSON.stringify(role)}`).toBe(400);
    }
  });

  it("can't change their own role or deactivate themselves", async () => {
    const me = await (await manager.req("/api/auth/get-session")).json();
    const demote = await manager.req("/api/auth/admin/set-role", { method: "POST", json: { userId: me.user.id, role: "rep" } });
    expect(demote.status).toBe(403);
    const ban = await manager.req("/api/auth/admin/ban-user", { method: "POST", json: { userId: me.user.id } });
    expect(ban.status).toBeGreaterThanOrEqual(400);
  });

  it("onboards a rep, and deactivating them ends their sessions and blocks sign-in", async () => {
    const email = `e2e-rep-${RUN}@newity.test`;
    createdEmails.push(email);
    const created = await manager.req("/api/auth/admin/create-user", {
      method: "POST",
      json: { email, password: "temporary-password-1", name: "E2E Rep", role: "rep" },
    });
    expect(created.status).toBe(200);
    const { user } = await created.json();

    const newRep = new Client();
    expect((await newRep.signIn(email, "temporary-password-1")).status).toBe(200);
    expect((await page(newRep, "/")).html).toContain("Loan amount");

    const ban = await manager.req("/api/auth/admin/ban-user", { method: "POST", json: { userId: user.id } });
    expect(ban.status).toBe(200);

    // Existing session no longer works...
    const session = await (await newRep.req("/api/auth/get-session")).json();
    expect(session).toBeNull();
    const rec = await newRep.req("/api/recommendations", { method: "POST", json: { programId: 1, borrower: {} } });
    expect(rec.status).toBe(401);
    // ...and they can't sign back in.
    expect((await new Client().signIn(email, "temporary-password-1")).status).toBe(403);
  });
});
