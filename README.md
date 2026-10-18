# SBA Program Matcher

A tool for NEWITY sales reps to use **while the borrower is on the phone**. The rep enters what they know (loan amount, business type, years in business, credit tier), and the screen instantly shows:

- which SBA programs fit, ranked by rate;
- the programs that *almost* fit, with the one reason why;
- a side-by-side comparison of up to 4 programs;
- a one-click summary to email the borrower, and a link that reopens the exact view.

Everyone signs in. **Reps** get the matcher and their own recommendation history. **Managers** also get a team dashboard (which programs reps recommend most) and a Team page to add reps, change roles, reset passwords and deactivate accounts.

## Run it locally (about 2 minutes)

Requirements: **Node 20+** and **Docker Desktop** (running).

```bash
npm install
npm run setup     # creates .env (with a random auth secret), starts Postgres, migrates, loads the CSV, creates demo accounts
npm run dev       # http://localhost:3000
```

### Demo accounts

All demo accounts use the password in `DEMO_PASSWORD` (see `.env`; the default is in [.env.example](.env.example)). They are local-only.

| Sign in as | Role | Sees |
|---|---|---|
| `alex@newity.test` (or jordan, sam, taylor, casey, riley, jamie, chris `@newity.test`) | Rep | Matcher, My recommendations |
| `manager@newity.test` (Morgan Chen) or `dana.manager@newity.test` | Manager | Dashboard, Team, Matcher, My recommendations |

Optional: `npm run db:seed-demo` fills the dashboard with 60 sample recommendations spread across the rep accounts. It **clears** existing recommendations.

| Command | What it does |
|---|---|
| `npm test` | Unit tests (Vitest): matching rules, CSV import, URL state, summary text, route policy |
| `npm run test:e2e` | Security tests against the **running** app (start `npm run dev` first): every role boundary, over real HTTP |
| `npm run db:seed-users` | Create the demo accounts (skips ones that exist) |
| `npm run db:seed [file.csv]` | Re-import lender data. Upserts by (lender, program), so rate changes update in place |
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

## Scope decisions

**Built:**
- live matching with near-misses
- side-by-side compare
- borrower summary and share link
- Recommend → Manager view
- rate-age flags
- CSV import with validation
- tests

**Cut, and why:**

| Cut | Why |
|---|---|
| SSO, MFA, password-reset email | Email + password with manager-run resets covers 10 internal users and runs locally with no external services. See "Known gaps" above |
| CSV upload screen | Import is a single command today. A UI is V2, together with rate-change history |
| Revenue matching | Reps sometimes know revenue, but the lender data has no revenue rules to match against |
| Parsing "special requirements" into rules | The free text contradicts the structured columns in places (e.g. "6 months in business" on 3-year programs). It's shown to the rep instead of being guessed at |
| Loan purpose (working capital vs. real estate) | Not in the data. 504 loans rank first on rate, so their cards carry a note that they fund real estate and equipment only |
| Deployment, mobile polish, dark mode | A local browser tool is what the brief asked for. The layout still works at phone width |

## Testing

- **Automated unit tests (`npm test`, 72 tests):**
  - every matching rule at its exact boundaries (amount bounds, years, each credit band: pass, borderline and fail)
  - exact score overriding the tier
  - near-miss vs. excluded, and all three sort orders
  - CSV import: blanks → null, bad numbers, unknown values and inverted ranges are rejected with the line number
  - tampered share URLs
  - the email summary text
  - real-data "persona" tests that run the actual CSV through the matcher
  - the auth route policy, including the open-redirect guard on `?next=`
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
docker-compose.yml          Postgres 16
drizzle/                    SQL migrations (generated by drizzle-kit)
scripts/seed.ts             CSV → lender_programs (validated upsert)
scripts/seed-demo.ts        fake recommendations for the dashboard
scripts/seed-users.ts       demo accounts
src/db/schema.ts            lender_programs, recommendations, Better Auth tables (user/session/account/verification)
src/proxy.ts                optimistic signed-in check (redirect to /login)
src/lib/auth/               Better Auth config, roles/permissions, session helpers, route policy
e2e/auth.e2e.test.ts        role-boundary security tests (live server)
src/lib/matching.ts         eligibility + ranking (pure, tested)
src/lib/csv.ts              CSV parsing/validation (pure, tested)
src/lib/url-state.ts        shareable URL <-> screen state
src/components/Matcher.tsx  the main screen
src/app/login, account      sign in, change password
src/app/history             a user's own recommendations
src/app/manager             team dashboard; manager/team = account management
src/app/api/recommendations POST endpoint for the Recommend button (session-attributed)
```

Stack: Next.js 16 (App Router, Cache Components), React 19, TypeScript, Tailwind 4, Postgres 16, Drizzle ORM, Better Auth, Vitest.

See [PLAN.md](PLAN.md) for the original plan, and [docs/AI_LOG.md](docs/AI_LOG.md) for how AI was used.
