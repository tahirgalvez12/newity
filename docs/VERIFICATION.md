# Verification

How we know the tool works: what each requirement is checked by, the last full run, and what is **not** proven.

## Last full run

The run used a **fresh clone of `github.com/tahirgalvez12/newity` at `596bff4`**, set up only by following the README. The local stack was stopped first, and the clone got a new, empty database volume.

| Step | Result |
|---|---|
| `npm install` → `npm run setup` | ✅ about 10 s. It created `.env` and a new DB volume, ran the migrations, loaded 49 programs, created 10 accounts and added 60 sample recommendations |
| `npm test` (unit) | ✅ 83 / 83 |
| `npm run typecheck`, ESLint, `next build` | ✅ clean |
| `npm run test:e2e` (HTTP security + SQL differential) | ✅ 25 / 25 |
| `npm run test:ui` (Playwright, Chrome) | ✅ 19 / 19 |

Both server suites also passed against a **production build** (`next build && next start`, with `E2E_PRODUCTION=1`).

## Requirement → evidence

| Requirement (from the brief) | Checked by |
|---|---|
| **Runs in a browser, works with the sample CSV** | Browser tests sign in and use every page. `csv.test.ts` parses all 49 rows and rejects bad data with the line number. |
| **Filter by borrower criteria** | `matching.test.ts` covers each rule at its exact boundaries. `matching-oracle.e2e`: 4,000 borrowers, TypeScript vs. independent SQL, identical results. The `rep.spec` UI test shows the same programs in the same order as the rules. |
| **Rate & term details, eligibility at a glance** | Every card is rendered from DB values. The compare dialog test checks every selected program is present and the "★ best" values are highlighted. |
| **Side-by-side comparison** | `rep.spec`: tick two programs, open the dialog, Esc closes it. |
| **Save or share with a borrower** | `rep.spec` reads the clipboard back: the summary text includes the borrower and programs. The share link reopens the exact comparison. Recommendations are saved and listed in "My recommendations". |
| **Flag when lender rates are updated** | `rate-changes.test.ts` covers the diff logic. `rate-changes.spec` imports the sample update and checks exactly the 4 changed programs are flagged, and none of the others. Each card also shows how old its rates are. |
| **Managers see what reps recommend most** | `manager.spec`: the dashboard total equals a direct DB count, and the range filters work. |
| **Fast & obvious for non-technical reps on a call** | Results update as you type, with no submit button. Near-misses give a one-line reason to read aloud. Startups get an explicit "follow up at 1 year" message (`rep.spec`). |
| **Roles: reps vs. managers** (added scope) | `auth.e2e` (24 HTTP tests): every role boundary, no sign-up, no self-promotion, and deactivation ends sessions. `manager.spec`: onboarding → the new rep signs in → deactivated → locked out. |
| **README setup in under 5 minutes** | The clean-clone run above took about 10 s after `npm install`. |
| **Phone width** | `rep.spec` "phone width": every page for both roles, measured after web fonts load. |

## Does the checking actually work?

A test that can't fail proves nothing. These were deliberately broken to make sure the right test fails:

| Injected bug | Caught by |
|---|---|
| Loan max off-by-one (`>` → `>=`) | matching-oracle |
| Borderline credit passes with no warning | matching-oracle |
| Rate tiebreak (turnaround) dropped | matching-oracle |
| Manager page guard removed | auth e2e |
| Self-role-change guard removed | auth e2e (it really demoted the manager; restored) |

## Bugs that verification found (all fixed)

1. **$49,999 displayed as "$50k"**, producing "Min loan $50k ($50k requested)". Found by unit tests.
2. **Login form stuck on "Signing in…" after sign-out**, with the previous user's pages still in the DOM. Found by following the README as a tester.
3. **Matcher scrolled sideways on phones** once web fonts loaded. Found by the browser tests; a manual check had missed it.
4. **Team page scrolled sideways on phones**: a visually-hidden table header escaped its scroll box. Found by the browser tests, confirmed on a production build.

## What is NOT proven

Being honest about the limits:

- **Business assumptions:** the credit tier bands (Excellent 720+, Good 680–719, Fair 620–679) and treating `min_credit_score` as authoritative are our assumptions. Both test implementations share them, so the tests prove the rules are applied consistently, **not that the rules are what sales leadership wants**. Confirm them with the team.
- **Data accuracy:** we check the CSV for structure, not truth. The sample's SBA guarantee percentages don't match real SBA rules, and some special requirements contradict the structured columns. Both are shown as given.
- **Browsers and devices:** automated only in Chrome. Safari and Firefox weren't run, and phones were emulated at 375 px rather than real devices.
- **Real users:** no usability session with actual reps yet. That's the most important pre-launch step.
- **Scale and production:** not load-tested. Login rate limiting is in memory (single server) and trusts `X-Forwarded-For`, so it needs a proxy. There's no MFA, SSO or audit log (see README "Known gaps").
- **Clipboard fallback:** the legacy copy path for locked-down browsers was exercised manually in an embedded browser, not in the automated suite.
- **Dependencies:** `npm audit` reports one advisory (`braces`, shown as 5 "high" entries along its dependency chain). It's only used by ESLint, never shipped, and has no patched release yet.

## Re-running it yourself

```bash
npm run setup && npm run dev   # in one terminal
npm test && npm run typecheck && npm run test:e2e && npm run test:ui   # in another
```
