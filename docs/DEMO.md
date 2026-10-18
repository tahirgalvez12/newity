# Demo outline (≤11 min, for the sales team)

Before recording, run `npm run db:seed-demo` and open http://localhost:3000. Sign in as `alex@newity.test` (rep); you'll switch to `manager@newity.test` later. The password is `DEMO_PASSWORD` in `.env`.

1. **The problem (30s).** "You're on the phone flipping between PDFs and a spreadsheet. This gives you the answer while the borrower is still talking."
2. **Live call walkthrough (3 min).**
   - Type `150k` → Restaurant → `2` years → Good. The list narrows as you type, and there's no Submit button.
   - Read a card: rate, term, turnaround, loan range. The blue "Ask about" lines are your follow-up questions.
   - Click **Fair**: some programs drop out, and others show "Confirm credit score is 650+". Type an exact score and the warnings go away.
   - Open **Almost eligible**: "Max loan is $250k". That's a talking point, not a dead end.
   - Check Compare on 2–3 programs → **Compare side by side** (best values are starred).
   - **Copy summary** → paste into an email. **Copy share link** → it reopens the exact view.
   - **Recommend**: it's logged under your account automatically.
   - **My recommendations**: everything you've recommended, with one click to reopen that borrower in the matcher for a follow-up call.
   - Startup case: `0.5` years → a clear "follow up at the 1-year mark" message.
3. **Manager view (1.5 min).**
   - Sign out and sign in as the manager. You land on the dashboard: top programs, by program type, by rep, and latest activity.
   - **Team page:** add a new rep (a temporary password is generated), change a role, reset a password, deactivate someone. They're signed out everywhere, but their history stays.
   - Point out that reps can't get here. If a rep opens `/manager`, they're sent back to the matcher with a note.
4. **Rate updates (1 min).** "You asked for a way to flag when lender rates are updated."
   - Before recording, have the matcher open with `150k` → Restaurant → `2` years → Good.
   - In a terminal: `npm run db:seed data/lenders-update-sample.csv`. It prints "4 programs changed rates or terms" and lists each one, old → new.
   - Reload the matcher. Summit Lending Group's 7(a) Standard now shows **↻ Rate changed**, with "was 9.8–11.7%" under the new 9.3–11.2%, and its amber age badge is gone. Hover the badge for the details.
   - Compare Summit and Gateway side by side: the flag and the old values are there too. Flags last 30 days after the import, and every change is kept in a `rate_history` table.
   - To rehearse again from the original rates, run `npm run db:reset`. Re-importing `data/lenders.csv` would itself be a rate change, and get flagged.
5. **Scope decisions (1.5 min).**
   - Built: speed on the call first.
   - Cut: SSO/MFA, CSV upload screen, revenue matching, parsing special requirements (see the README table).
   - Every card is amber because the sample rates really are 8 months old. The flag is working as intended.
6. **Testing (1.5 min).**
   - 83 unit tests on the rules that would lose deals if wrong, plus 24 security tests that try to break the role boundaries over real HTTP.
   - The four QA personas.
   - Before shipping: a 30-minute session with 2 reps on real calls, checking the credit bands with sales leadership, and Playwright tests for the click-through flows.
7. **What's next (1 min).**
   - **V2 = rate update pipeline:** change detection and card flags are already in (step 4). Next is uploading the CSV in the app with a preview of the changes before they go live, so no one needs a terminal.
   - Then: a loan purpose input (so 504 stops showing for working capital), and SSO with your company identity provider.
8. **Honest self-assessment (1 min).**
   - **Good:** fast, the rules are tested, near-misses help on calls, and the data model can grow.
   - **Rough:**
     - the credit bands are my assumption;
     - auth is solid for 10 internal users (roles enforced server-side, 24 security tests), but there's no SSO/MFA, no password-reset email, and rate limiting is single-server;
     - special requirements are display-only;
     - 504 vs. working capital is handled by a note, not a rule;
     - the manager view counts clicks, not funded loans.
