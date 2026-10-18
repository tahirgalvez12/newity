# AI Usage Log

Tool: **Claude Code** (desktop app, Claude Opus), used as a pair-programming partner for the whole project, in one continuous session. The full transcript is exported alongside this file. This log summarizes how AI was used in each phase, and where I had to check or correct its output.

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

## What I'd keep doing / change

- **Keep:** making the AI ask questions and write a plan before coding; testing the core logic before building UI; driving the real app in a browser instead of trusting "it compiles".
- **Change:** ask for the data audit as a written artifact up front, so it can be shared with the sales team to confirm assumptions like the credit tier bands.
