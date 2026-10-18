# SBA Program Matcher — Build Plan

NEWITY Product Engineer take-home (Assessment B: Lender Comparison).
Hard budget: **4 hours total**: build ~3h, then demo, AI log and README.

## The user and the job

8 sales reps and 2 managers. They are not technical. They use the tool **live on the phone**, so speed matters more than anything else.
A rep knows: loan amount, business type, years in business and a rough credit tier (sometimes revenue).
The tool should answer: *"Which programs does this borrower fit, which is best, and what do I tell them?"* in under 10 seconds.

## Decisions made (with the user)

| Topic | Decision | Why |
|---|---|---|
| Stack | Next.js (App Router) + TypeScript + Tailwind | Runs in the browser, and API routes give us a server for persistence |
| Database | Postgres 16 in Docker (`docker compose`), Drizzle ORM + migrations | A real database that can scale later and still runs locally with one command |
| Lender data | CSV → seed script → `lender_programs` table | The CSV stays the source for now; later it can be replaced by an admin upload or sync |
| Matching UX | Programs that fit, ranked at the top. A collapsed "Almost" section lists near-misses with the reason | Zero results leaves the rep with nothing to say; a near-miss is still a talking point |
| Credit input | Tier (Excellent / Good / Fair) **plus** an optional exact score | Matches how reps talk, with precision when they have the number |
| Ranking | Lowest `interest_rate_min` first, turnaround days as tiebreaker. Reps can switch to fastest or largest max loan | Easy to explain to the rep and to the borrower |
| Recommendation tracking | Explicit **Recommend** button → row in `recommendations` → manager tally page | Clear meaning for the manager metric |
| Extras in scope | Rate freshness flag, share link + copy-for-email summary, manager tally, Vitest tests | |

## Matching rules (source of truth: `src/lib/matching.ts`, pure and unit-tested)

Hard criteria. **Eligible** = passes all of them; **near-miss** = fails exactly one.
1. **Loan amount**: `min_loan_amount ≤ amount ≤ max_loan_amount`, bounds inclusive.
2. **Business type**: `eligible_business_types` is `All` or an exact match.
3. **Years in business**: `years ≥ min_years_in_business`.
4. **Credit**: compared against `min_credit_score`. `credit_tier_required` is ignored because it's redundant and coarser.
   - Exact score given → simple `≥` check.
   - Tier only → bands: Excellent 720+, Good 680–719, Fair 620–679.
     - Bottom of band ≥ min → pass.
     - Band straddles min → pass with a **"Verify credit ≥ 660"** warning.
     - Top of band < min → fail.

**Shown but not filtered on** (reps don't have this information during the call): collateral (Yes/No/Varies), max debt ratio (blank → "Not specified"), `special_requirements` (shown as a warning chip), SBA guarantee %, max term.

Near-miss reasons are written for a person to read aloud, e.g. *"Needs 2 yrs in business (borrower has 1)"* or *"Min loan $150k ($100k requested)"*.

## Screens

1. **Matcher** (`/`): a single screen with no navigation needed.
   - Left: intake form. Amount (with $ formatting and shortcuts like `250k`), business type dropdown (the 6 types plus Other), years in business, credit tier as segmented buttons, optional score field. Results update **as you type**, with no Submit button.
   - Right: result cards. Lender, program, rate range, max term, turnaround, and badges for collateral, stale rates and special requirements. Each card has a "Compare" checkbox and a "Recommend" button.
   - Collapsed "Almost eligible (N)" section with the reasons.
   - Empty state for borrowers under 1 year in business: *"No SBA programs in our network accept businesses under 1 year — note it and follow up at the 1-year mark."*
2. **Compare** (drawer or panel): 2–4 programs side by side, with the best value in each row highlighted (lowest rate, longest term, fastest turnaround).
3. **Share / Copy**: all form inputs and compare selections live in the URL, so a link reproduces the exact view. "Copy summary" puts a plain-text, email-ready summary on the clipboard.
4. **Manager** (`/manager`): recommendation counts by program and by lender, with a 7 / 30 / all-day filter and an optional per-rep breakdown. The rep picks their name once and it's remembered in localStorage. There is no auth (see the cut list).

**Rate freshness:** each card shows "Rates updated X days ago", with an amber badge after 30 days. *Note: every row in the sample is from Jan–Feb 2026, which is 8+ months before today, so every card will be flagged. The demo will call that out as working as intended.*

## Data model (Drizzle)

- `lender_programs`: every CSV column, typed. Nullable `max_existing_debt_ratio`; `requires_collateral` is an enum; `last_updated` is a date. Unique on (`lender_name`, `program_type`), and seeding is an upsert.
- `recommendations`: `id`, `program_id` FK, `rep_name`, `borrower_snapshot` (jsonb: amount, type, years, credit), `created_at`.
- *(Stretch)* `rate_history`: when a reseed changes a rate, write the old and new values so a card can show "Rate changed since last import". This is the real answer to "flag when lender rates are updated".

## Testing

- **Vitest unit tests** (`matching.test.ts`):
  - inclusive amount bounds
  - "All" vs. specific business type
  - years at the boundary
  - each credit-tier band: pass, borderline and fail
  - exact score overrides the tier
  - exactly one failure → near-miss; two failures → excluded
  - ranking order and tiebreaker
  - borrower with under 1 year in business → empty result
- **Seed/parse test**: blank debt ratio → `null`, date parsing, row count = 49.
- **Manual QA personas** (also used in the demo):
  - $150k restaurant, 2 yrs, Good
  - $2M manufacturer, 4 yrs, Excellent
  - $40k construction startup, 0.5 yrs, Fair (empty state)
  - $300k retail, 1 yr, Fair (borderline credit)
- **Talk about but don't build:** Playwright end-to-end tests, CSV schema validation on import, load and latency checks, usability testing with 2 reps.

## Cut list (for the demo's "what's next" section)

Auth/SSO, CSV upload UI, revenue-based matching (no revenue data), parsing `special_requirements` into rules, deployment, an audit trail of rate changes (unless the stretch goal lands), and mobile layout polish.
**V2 priority:** a rate-update pipeline (admin CSV upload + diff + "rate changed" flags). Rates change monthly, and stale numbers quoted on a call lose trust.

## Known data quirks (for the self-assessment)

- Some `special_requirements` contradict the structured fields ("in business 6 months" on programs that need 2–3 years).
- The SBA guarantee % in the sample doesn't match real SBA rules (e.g. 504 at 40%). We display it as given.
- `credit_tier_required` and `min_credit_score` are redundant, and the score is used.
- Only one business type per row, so some industries (Healthcare, Retail) have very few matches.

## Time plan (~4h)

| Block | Time | Output |
|---|---|---|
| 1 | 0:00–0:25 | Next.js scaffold, docker-compose Postgres, Drizzle schema + migration, CSV seed |
| 2 | 0:25–1:05 | `matching.ts` + Vitest tests (test-first) |
| 3 | 1:05–2:15 | Matcher UI: intake, live results, near-misses, empty state, URL state |
| 4 | 2:15–2:50 | Compare panel, copy summary, Recommend → API → `/manager` |
| 5 | 2:50–3:15 | Freshness badges, QA pass with the personas, fixes |
| 6 | 3:15–3:30 | README (setup in under 5 min: `docker compose up -d && npm i && npm run db:setup && npm run dev`) |
| 7 | 3:30–4:00 | Demo recording, AI usage log |

If we fall behind, cut in this order: per-rep breakdown → `rate_history` stretch → sort switcher → compare highlighting.

## AI usage log

`docs/AI_LOG.md` is updated at the end of each block (understanding → scoping → building → testing → docs). At the end it is accompanied by an export of this Claude Code transcript. This planning conversation (reading the brief, auditing the data, the clarifying Q&A, and this plan) covers the *Understanding* and *Scoping* phases.
