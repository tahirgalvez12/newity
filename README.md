# SBA Program Matcher

A tool for NEWITY sales reps to use **while the borrower is on the phone**. The rep enters what they know (loan amount, business type, years in business, credit tier), and the screen instantly shows:

- which SBA programs fit, ranked by rate;
- the programs that *almost* fit, with the one reason why;
- a side-by-side comparison of up to 4 programs;
- a one-click summary to email the borrower, and a link that reopens the exact view.

Everyone signs in. **Reps** get the matcher and their own recommendation history. **Managers** also get a team dashboard (which programs reps recommend most) and a Team page to add reps, change roles, reset passwords and deactivate accounts.

## Quick start: from clone to signed in (about 3 minutes)

You need **Node 20+** and **Docker Desktop** (open and running).

```bash
git clone https://github.com/tahirgalvez12/newity.git
cd newity
npm install
npm run setup
npm run dev
```

`npm run setup` does everything else:
- creates `.env` with a random auth secret;
- starts Postgres in Docker and runs the migrations;
- loads the lender CSV;
- creates the demo accounts below;
- adds 60 sample recommendations so the manager dashboard isn't empty.

**Then open http://localhost:3000.** You'll land on the sign-in page. Either click **Rep** or **Manager** in the yellow "Local demo" box, or type one of these:

| Role | Email | Password |
|---|---|---|
| **Rep** | `alex@newity.test` | `newity-demo-2026` |
| **Manager** | `manager@newity.test` | `newity-demo-2026` |

Other demo accounts use the same password: reps `jordan`, `sam`, `taylor`, `casey`, `riley`, `jamie`, `chris` (all `@newity.test`), and a second manager, `dana.manager@newity.test`. To switch roles, use **Sign out** (top right).

### Things to try

**As the rep** (`alex@newity.test`):
1. Type `150k` → Restaurant/Food Service → `2` years → **Good**. The list narrows as you type.
2. Click **Fair**: some programs drop out, and others warn "Confirm credit score is …". Open **Almost eligible** at the bottom to see why near-misses don't fit.
3. Tick **Compare** on 2–3 cards → **Compare side by side**. Try **Copy summary** and **Copy share link**.
4. Click **Recommend** on a card, then open **My recommendations** in the top nav.
5. Visit http://localhost:3000/manager. A rep is sent back to the matcher.
6. **See rate-change flags.** In a terminal, import the newer sample CSV (4 programs have new rates or terms):
   ```bash
   npm run db:seed data/lenders-update-sample.csv
   ```
   It prints what changed. Reload the matcher: Summit Lending Group, Heritage Credit Union, Gateway Commercial Finance and First National Bank (7(a) Small Loan) now show a blue **↻ Rate changed** (or **Term changed**) badge, with the old value struck through under the new one. Hover the badge for old → new. The flags also appear in **Compare side by side**, and stay for 30 days.

**As the manager** (`manager@newity.test`):
1. You land on the **Dashboard**: top programs, program types and reps, with 7 / 30 / all-time filters.
2. Open **Team**: add a rep (a temporary password is shown once), change someone's role, reset a password, or **Deactivate** someone. Then try signing in as them.
3. The **Matcher** works for managers too.

### If something goes wrong

| Problem | Fix |
|---|---|
| `npm run setup` fails at `docker compose` | Open Docker Desktop, wait until it says it's running, then run `npm run setup` again |
| Port 3000 or 5433 already in use | Stop whatever is using it, or run `npm run dev -- -p 3001` (and set `BETTER_AUTH_URL=http://localhost:3001` in `.env`) |
| "Too many attempts" on sign-in | Login is rate limited (3 tries per 10 s). Wait 10 seconds |
| Want a clean slate | `npm run db:reset`: wipes the database and runs setup again |

### All commands

| Command | What it does |
|---|---|
| `npm test` | Unit tests (Vitest): matching rules, CSV import, URL state, summary text, route policy |
| `npm run typecheck` | Generate Next.js route types, then run the TypeScript compiler |
| `npm run test:ui` | Browser tests (Playwright) that click through every rep and manager flow, incl. phone width. Uses your installed Chrome (or run `npx playwright install chromium` and set `PW_CHANNEL=chromium`) |
| `npm run test:e2e` | Security tests against the **running** app (start `npm run dev` first): every role boundary, over real HTTP |
| `npm run db:seed-users` | Create the demo accounts (skips ones that exist) |
| `npm run db:seed-demo` | Replace all recommendations with 60 sample ones (setup only does this on an empty database) |
| `npm run db:seed [file.csv]` | Re-import lender data. Upserts by (lender, program), so rate changes update in place. Rate or term changes are recorded in `rate_history` and flagged on cards for 30 days |
| `npm run db:reset` | Wipe the database volume and set it up again from scratch |
| `docker compose down` | Stop Postgres (data is kept in a Docker volume) |

Postgres listens on **localhost:5433**, so it doesn't clash with a local Postgres on 5432.

## How matching works

The rules live in [`src/lib/matching.ts`](src/lib/matching.ts): a pure function, unit-tested, used by the UI.

| Borrower input | Rule |
|---|---|
| Loan amount | Must be within the program's min–max (inclusive) |
| Business type | Program must list it, or "All". "Other industry" matches only "All" programs |
| Years in business | ≥ program minimum |
| Credit | Exact score if given; otherwise tier bands: **Excellent 720+, Good 680–719, Fair 620–679**. If a band straddles the minimum (Good vs. a 700 minimum), the program still shows, with a "Confirm credit score is 700+" warning |

- **Fits** = passes everything. **Almost** = fails exactly one rule. Anything else is hidden.
- Blank inputs don't filter, so the list narrows as the rep types.
- **Shown but not filtered on:** collateral, max debt ratio, SBA guarantee and special requirements. Reps don't have this information on a first call, so the card turns it into "Ask about: …" prompts instead of silently excluding programs.
- **Rate freshness:** each card shows how old its rates are and turns amber after 30 days. *Every row in the sample data is from Jan–Feb 2026, so today every card is amber. That's correct: the data really is 8+ months old.*
- **Rate changes:** when `npm run db:seed` imports a CSV, it compares each program's rate range and max term with what's in the database ([`src/lib/rate-changes.ts`](src/lib/rate-changes.ts), pure and tested) and writes a `rate_history` row for each change, with old and new values. Cards and the compare table show **↻ Rate changed** for 30 days after the import, with the old value inline. A newer `last_updated` with the same numbers isn't flagged: the lender re-confirmed, nothing changed for the borrower.

## Accounts, roles and security

Auth is [Better Auth](https://www.better-auth.com) with email + password, using Postgres-backed sessions and its admin plugin for roles.

| | Rep | Manager |
|---|---|---|
| Matcher, Recommend, My recommendations, Account | ✓ | ✓ |
| Dashboard (team-wide stats) | redirected to matcher | ✓ |
| Team: add members, change roles, reset passwords, deactivate/reactivate | 403 from the API | ✓ (not for their own account) |

How it's enforced, from the outside in:

1. **`src/proxy.ts`:** signed-out requests are redirected to `/login` (or get a 401 for APIs). This is only a fast first check: it looks at whether a cookie exists, and nothing trusts it.
2. **Every page and API route validates the session against the database:** `requireUser()` / `requireManager()` in [`src/lib/auth/session.ts`](src/lib/auth/session.ts). Manager pages render *all* their content inside the role check, so nothing manager-only lands in a static shell a rep could receive.
3. **Admin actions are Better Auth endpoints guarded by access control** ([`permissions.ts`](src/lib/auth/permissions.ts)). Managers get least privilege: they can't impersonate users or hard-delete them, and "deactivate" (ban) keeps history intact.
4. **An extra server hook** ([`auth/index.ts`](src/lib/auth/index.ts)) allows only the roles `rep` / `manager`, one per user, and stops anyone from changing their own role, so a manager can't accidentally lock the team out.

Other details:
- **No public sign-up.** The sign-up endpoint is disabled, and managers create accounts.
- **Demo sign-in buttons** on the login page appear only when `SHOW_DEMO_LOGINS=true` *and* the app isn't a production build.
- **Passwords:** hashed with scrypt, 10+ characters. Temporary passwords are generated in the browser with `crypto.getRandomValues`.
- **Login:** the same error for an unknown email and a wrong password. Attempts are rate limited (3 per 10 s per client).
- **Sessions:** httpOnly, SameSite=Lax cookies that last 7 days, and cross-origin POSTs are rejected. Deactivating a user deletes all their sessions immediately. Changing your password signs out your other devices.
- **Recommend API:** it attributes the recommendation to the signed-in user from the session and ignores any user sent in the request.
- **Open redirects:** `?next=` after login only accepts same-site paths.

**Known gaps before real production use:**
- **Rate limiting** is in memory, so it would need the `database` store with more than one server instance. It trusts `X-Forwarded-For`, so the app must sit behind a proxy that sets that header.
- **No self-service account recovery:** there's no password reset email or email verification; managers reset passwords.
- **No MFA, and no audit log** of who changed whose role.
- **SSO** (Google Workspace / Okta) would replace passwords entirely for a real sales team.

## Design

A dark theme built from a small set of semantic color tokens in [`globals.css`](src/app/globals.css): surfaces, text, accent and status. Shared button, input, card and badge styles are in [`components/ui.ts`](src/components/ui.ts), so pages stay consistent.
- **Readable:** every text color was checked at ≥4.5:1 contrast on every surface it sits on. Warnings and errors always carry an icon or label, not just color.
- **Clear navigation:** the current page is highlighted in the nav, with an accent underline and `aria-current`. On phones the nav moves to its own row.
- **Light theme later:** only the tokens need light values; components don't change.

## Scope decisions

**Built:**
- live matching with near-misses
- side-by-side compare
- borrower summary and share link
- Recommend → Manager view
- rate-age flags
- rate-change flags on re-import (with history)
- CSV import with validation
- tests

**Cut, and why:**

| Cut | Why |
|---|---|
| SSO, MFA, password-reset email | Email + password with manager-run resets covers 10 internal users and runs locally with no external services. See "Known gaps" above |
| CSV upload screen | Import is a single command today (and it already records and flags rate changes). An upload screen with a preview of the changes is V2 |
| Revenue matching | Reps sometimes know revenue, but the lender data has no revenue rules to match against |
| Parsing "special requirements" into rules | The free text contradicts the structured columns in places (e.g. "6 months in business" on 3-year programs). It's shown to the rep instead of being guessed at |
| Loan purpose (working capital vs. real estate) | Not in the data. 504 loans rank first on rate, so their cards carry a note that they fund real estate and equipment only |
| Deployment, mobile polish, dark mode | A local browser tool is what the brief asked for. The layout still works at phone width |

## Testing

- **Automated unit tests (`npm test`, 83 tests):**
  - every matching rule at its exact boundaries (amount bounds, years, each credit band: pass, borderline and fail)
  - exact score overriding the tier
  - near-miss vs. excluded, and all three sort orders
  - CSV import: blanks → null, bad numbers, unknown values and inverted ranges are rejected with the line number
  - rate-change detection on re-import: changed, unchanged (even with a newer date), new and removed programs, and the exact edits in the demo update CSV
  - tampered share URLs
  - the email summary text
  - real-data "persona" tests that run the actual CSV through the matcher
  - the auth route policy, including the open-redirect guard on `?next=`
- **Matcher vs. an independent implementation** (`npm run test:e2e`): the same rules written a second way, as SQL against the real table, compared with the TypeScript matcher on 4,000 seeded random borrowers weighted toward exact boundary values. Eligible lists and their order, near-misses and credit warnings must match exactly. It caught all three deliberately introduced bugs (off-by-one, missing warning, broken tiebreak).
- **Browser tests (`npm run test:ui`, 19 tests, Playwright):**
  - a rep's full call: filtering matches the rules card for card, URL state survives reload, borderline credit, near-misses, compare dialog, copy summary and share link (clipboard is read back), Recommend is stored under the signed-in user and shows in history;
  - a manager's flows: dashboard numbers match the database, onboarding a rep who then signs in with the generated password, deactivation ends their session and blocks sign-in, no self-demotion;
  - login: errors, the redirect back to where you were going, demo buttons (and their absence in production builds);
  - rate-change import flags exactly the changed programs;
  - every page at phone width, with no sideways scrolling, checked after web fonts load.

  The browser suite found two real phone-layout bugs that visual checks had missed; both are fixed.
- **Security e2e (`npm run test:e2e`, 24 tests)** against a running app, over real HTTP:
  - signed-out access to every page/API
  - sign-up blocked
  - no account enumeration on login
  - login throttling
  - cookie flags
  - reps never receiving manager content, and getting 403 on every admin endpoint
  - no self-promotion
  - recommendations can't be attributed to someone else
  - invalid or multiple roles rejected
  - managers can't demote or deactivate themselves
  - deactivation kills live sessions and blocks sign-in

  These ran green against both `npm run dev` and a production build. They were also checked by disabling guards on purpose, which made the right tests fail.
- **Manual QA personas:**
  - $150k restaurant, 2 yrs, Good
  - $2M manufacturer, 4 yrs, Excellent
  - $40k construction startup, 6 months, Fair (→ "follow up at the 1-year mark")
  - $300k retail, 1 yr, Fair (→ "confirm credit" warnings)
- **API:** `POST /api/recommendations` validates input and returns 400/404 with readable errors. It never stores raw client JSON.

## Project layout

```
data/lenders.csv            sample data (source of truth for now)
data/lenders-update-sample.csv  the same data with 4 rate/term changes, to demo rate-change flags
docker-compose.yml          Postgres 16
drizzle/                    SQL migrations (generated by drizzle-kit)
scripts/seed.ts             CSV → lender_programs (validated upsert), recording rate changes in rate_history
scripts/seed-demo.ts        fake recommendations for the dashboard
scripts/seed-users.ts       demo accounts
src/db/schema.ts            lender_programs, rate_history, recommendations, Better Auth tables (user/session/account/verification)
src/proxy.ts                optimistic signed-in check (redirect to /login)
src/lib/auth/               Better Auth config, roles/permissions, session helpers, route policy
e2e/auth.e2e.test.ts        role-boundary security tests (live server)
src/lib/matching.ts         eligibility + ranking (pure, tested)
src/lib/csv.ts              CSV parsing/validation (pure, tested)
src/lib/rate-changes.ts     re-import diff: which programs' rates or terms changed (pure, tested)
src/lib/url-state.ts        shareable URL <-> screen state
src/components/Matcher.tsx  the main screen
src/app/login, account      sign in, change password
src/app/history             a user's own recommendations
src/app/manager             team dashboard; manager/team = account management
src/app/api/recommendations POST endpoint for the Recommend button (session-attributed)
```

Stack: Next.js 16 (App Router, Cache Components), React 19, TypeScript, Tailwind 4, Postgres 16, Drizzle ORM, Better Auth, Vitest.

See [docs/VERIFICATION.md](docs/VERIFICATION.md) for how each requirement is verified (and what isn't), [PLAN.md](PLAN.md) for the original plan, [docs/AI_LOG.md](docs/AI_LOG.md) for how AI was used, and [docs/AI_SESSION_TRANSCRIPT.pdf](docs/AI_SESSION_TRANSCRIPT.pdf) for the full session.
