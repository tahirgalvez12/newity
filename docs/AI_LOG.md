# AI Usage Log

Tool: **Claude Code** (desktop app, Claude Opus), used as a pair-programming partner for the whole project, in one continuous session. The full session is in [AI_SESSION_TRANSCRIPT.pdf](AI_SESSION_TRANSCRIPT.pdf) (63 pages): every prompt and reply, and every tool call with a trimmed result. Model reasoning, browser screenshots and two personal screenshots are omitted, as the PDF's first page explains. This log summarizes how AI was used in each phase, and where I had to check or correct its output.

## 1. Understanding

- Gave Claude the brief (.docx) and the CSV and asked it to plan and ask me questions *before* building.
- Before asking anything, Claude audited the data and pointed out things that shaped the product:
  - Reps think in **tiers** (Excellent/Good/Fair), but the data has hard **minimum scores**, so a mapping was needed.
  - Every program needs **≥1 year in business**, so startups get zero results, and the UI has to handle that on purpose.
  - All `last_updated` dates are **8+ months old** relative to today, so a "stale rates" flag fires on every row.
  - `special_requirements` contradicts the structured columns in places.
  - **Revenue** is something reps know, but the data has nothing to match it against.
  - The manager "what are reps recommending" request is the only feature that needs a backend.

## 2. Scoping and planning

- Claude asked 8 multiple-choice questions, each with a recommended option and the trade-off. I accepted most defaults and overrode two:
  - **Next.js instead of a static Vite app.**
  - **A real Postgres in Docker instead of a JSON file** for recommendations ("simple now, but I want it to scale later").
- Claude wrote [PLAN.md](../PLAN.md) covering matching rules, screens, data model, test plan, a time-boxed schedule, and an explicit **cut order** in case we fell behind. I reviewed and approved it before any code was written.

## 3. Building

- Scaffolding: Next.js 16, Docker Postgres, Drizzle schema and migrations, CSV seed with upsert.
- **Checking the AI against current docs:** the generated project said "this is NOT the Next.js you know". Claude read the bundled Next 16 docs before writing pages, found that *Cache Components* is on by default, and structured the data-reading pages to match (`connection()` + `<Suspense>`). The production build confirmed it.
- The matching engine was written as a pure function first, with tests, before any UI.
- The UI was built and then driven in a real browser pane:
  - clicked through compare, recommend and share;
  - checked the database row the Recommend button wrote;
  - tested at phone width.

## 4. Testing: where AI output was wrong and got caught

| What happened | How it was caught | Fix |
|---|---|---|
| **$49,999 was displayed as "$50k"**, so a near-miss read "Min loan is $50k ($50k requested)", which would confuse a rep | Boundary test failed | Short money format only when exact; otherwise the full amount |
| A test assumed every startup near-miss was a "needs 1 yr" program; some need 2 | Test against the real CSV failed | Fixed the test's assumption (the code was right) |
| 504 loans ranked #1 for a $150k restaurant on rate, but 504 only funds real estate and equipment | Noticed while reviewing the live UI | Added a note on 504 cards. "Loan purpose" input listed as V2 |
| Compare checkboxes had no accessible name, and a `title` was overriding the Copy button's label | Browser accessibility tree during QA | Added `aria-label`, removed the `title` |
| Copy-to-clipboard failed silently in an embedded browser, and the fallback message was wrong for a summary | Manual QA in the browser pane | Added a legacy `execCommand` fallback and a correct message |
| `.gitignore` from the scaffold ignored `.env.example`, which would break first-time setup | Reviewing generated files | Un-ignored it |

Also tested: invalid requests to the API (400/404 responses), tampered share URLs, CSV validation errors, and a production `next build`.

## 5. Documentation

- Claude drafted the README (setup in 3 commands, matching rules, scope cuts with reasons, test approach), this log, and the [demo outline](DEMO.md). I edited them for tone and accuracy.

## 6. Iteration 2: accounts and roles

The request was "make it more robust: auth and role-based accounts; reps see one view, managers another".

- **Scoping:** Claude asked 4 questions before writing code: sign-in method, library, how accounts get created, and what each role sees. I chose:
  - email + password;
  - Better Auth;
  - managers add reps in the app;
  - reps get the matcher plus their own history.
- **Research:** a sub-agent read the current Better Auth docs while Claude read the installed package's source and type definitions. This mattered: the docs disagreed with each other on the Drizzle adapter import. The installed code was treated as the source of truth.
- **Dependency problem, debugged instead of forced:**
  - Installing Better Auth hit an npm peer-dependency conflict, and then an npm crash.
  - Claude bisected it with throwaway lockfile-only installs and found that Vitest 4/5 trigger an npm 10 bug.
  - The fix was to keep Vitest 3 and regenerate the lockfile. It did *not* use `--force` or `--legacy-peer-deps`, which would have shipped a broken `npm install` to reviewers.
- **Security issues Claude found in the library and fixed:**

| Issue | Fix |
|---|---|
| Better Auth's admin plugin lets an admin **demote themselves** (only self-*ban* is blocked), which could leave the team with no manager | Server hook blocks changing your own role |
| The plugin accepts **role arrays** (`["rep","manager"]`), giving combined permissions our pages don't understand | Hook only allows exactly `rep` or `manager` |
| Manager page headings sat outside the role check, so they'd be **prerendered into the static shell** sent to a rep | Moved all manager content inside the guarded component |
| Login `?next=` could be an **open redirect** | `safeNextPath` accepts same-site paths only (unit tested) |
| The Recommend API took the rep name from the request body | Now always the session user; e2e test proves a spoofed `userId` is ignored |

- **Testing:**
  - A 24-test HTTP security suite runs against the live app as each role. It passed against dev and production builds.
  - To prove the tests aren't hollow, Claude disabled two guards on purpose. The right tests failed, and one even showed the real damage: the manager really got demoted. The guards and data were restored and re-run green.
- **A false alarm, investigated rather than "fixed":** in browser QA the login form didn't respond. Claude traced it to the hidden browser pane pausing animation frames, which React uses to reveal streamed content. That's a test-environment artifact, so no app change was needed. The investigation did confirm that the form inputs have no `name` attributes, so a pre-hydration native submit can't leak a password into the URL.

## 7. Making it easy for a tester

- I pointed out that the README didn't make sign-in obvious. Claude rewrote the README as a numbered path from clone to signed in, with the credentials written out. It added "things to try" for each role and a troubleshooting table, and it made `npm run setup` seed demo data on a fresh database.
- Claude then **followed the README literally in a fresh copy** of the repo, with a new database volume and no `.env`. Setup took about 12 seconds.
- That walk-through found a real bug the automated tests missed. After signing out, the login form was stuck on "Signing in…", because Next 16 keeps recently visited pages alive (hidden) across client-side navigation. The same mechanism meant the previous user's pages stayed in the DOM after sign-out. Sign-in and sign-out now do a full page load.
- One-click "Rep / Manager" demo sign-in buttons were added. They're gated by `SHOW_DEMO_LOGINS` *and* disabled in production builds, which was verified against a real `next build` (no button, no password in the HTML).

## 8. Visual revamp (dark mode)

- I asked for a neat dark mode and pointed out that the nav didn't show which page you were on.
- Claude built a semantic token palette instead of flipping colors class by class. It **computed** WCAG contrast for every text/surface pair rather than eyeballing it; the lowest is 4.72:1.
- A script did the mechanical conversion to tokens, followed by a hand pass on each screen. Shared button, input and card styles were added.
- Active nav state uses `usePathname` with exact matching for `/` and `/manager`, so the Team page doesn't also light up Dashboard.
- Each page was checked visually at desktop and phone width, which caught three issues:
  - the nav was squeezed into a sideways scroll on phones, so it now gets its own row;
  - a long lender name in a number-sized stat tile wrapped awkwardly;
  - the compare tray chips stacked into three rows.

  All three were fixed. Unit tests, e2e tests and the production build were re-run afterwards.

## 9. Flagging rate updates

The sales team asked for "a way to flag when lender rates are updated". The app only showed rate *age*; it couldn't tell a re-import with new rates from one with the same rates.

- **What was built:**
  - a `rate_history` table (old and new rate range, max term and lender date per change), added with a drizzle-kit migration;
  - `npm run db:seed` now compares the incoming CSV with the database inside the same transaction as the upsert, records each change, and prints a summary ("4 programs changed rates or terms", then old → new for each);
  - a blue **↻ Rate changed** badge (or **Term changed**) on cards and in the compare table for 30 days, with the old value struck through under the new one and old → new on hover. It uses the info token plus an icon and words, never color alone;
  - `data/lenders-update-sample.csv` with 4 edits (a cut, a rise, a term change, and a rate + term change) so the flags can be demoed.
- **Decisions:**
  - The diff is a pure function (`src/lib/rate-changes.ts`) with 11 tests: changed, unchanged, new program, removed program, matching on lender *and* program, and the exact edits in the sample file.
  - A newer `last_updated` with the same numbers is **not** a change. Otherwise every monthly re-confirmation would light up every card and the flag would mean nothing.
  - Programs missing from a new CSV are reported but left alone, as before. Deleting them could break recommendations that point at them.
  - Cards use one-decimal rates, so a 0.04-point change would read "11.2% → 11.2%". The display falls back to full precision in that case (tested).
- **Verification:** ran the seed twice against a separate database: the first import of the sample recorded 4 changes, a second identical import recorded 0. Checked the badges, inline old values and compare table in the browser at desktop and phone width. Unit tests, e2e tests, `tsc`, ESLint and `next build` were re-run.

## 9. "How do you know this works?"

- I asked for proof, not assurances. Claude didn't just re-run the existing tests; it added two new, independent kinds of evidence.
- **A differential test:** the matching rules re-implemented as SQL from the README (not the code), compared with the TypeScript matcher on 4,000 boundary-weighted random borrowers. Claude injected three bugs to show this test catches them.
- **Playwright browser tests** for every rep and manager flow. They caught two real phone-layout bugs that visual checks had missed:
  - the matcher only overflowed once web fonts loaded;
  - on the Team page, a visually-hidden table header escaped its scroll box.

  Each bug was diagnosed to its root cause, fixed, and confirmed on a production build 3 out of 3 times.
- **A clean clone of the pushed repo** was set up only via the README and passed every suite. Claude caught its own first attempt reusing the existing database volume (same folder name) and redid it in a new folder.
- [docs/VERIFICATION.md](VERIFICATION.md) maps each requirement to its evidence and lists what is *not* proven, e.g. the credit bands are a business assumption that tests can't validate.

## What I'd keep doing / change

- **Keep:** making the AI ask questions and write a plan before coding; testing the core logic before building UI; driving the real app in a browser instead of trusting "it compiles".
- **Change:** ask for the data audit as a written artifact up front, so it can be shared with the sales team to confirm assumptions like the credit tier bands.
