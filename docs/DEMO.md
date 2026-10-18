# Demo outline (≤10 min, for the sales team)

Before recording, run `npm run db:seed-demo` and open http://localhost:3000.

1. **The problem (30s).** "You're on the phone flipping between PDFs and a spreadsheet. This gives you the answer while the borrower is still talking."
2. **Live call walkthrough (3 min).**
   - Type `150k` → Restaurant → `2` years → Good. The list narrows as you type, and there's no Submit button.
   - Read a card: rate, term, turnaround, loan range. The blue "Ask about" lines are your follow-up questions.
   - Click **Fair**: some programs drop out, and others show "Confirm credit score is 650+". Type an exact score and the warnings go away.
   - Open **Almost eligible**: "Max loan is $250k". That's a talking point, not a dead end.
   - Check Compare on 2–3 programs → **Compare side by side** (best values are starred).
   - **Copy summary** → paste into an email. **Copy share link** → it reopens the exact view.
   - Type your name → **Recommend**.
   - Startup case: `0.5` years → a clear "follow up at the 1-year mark" message.
3. **Manager view (1 min).** Top programs, by program type, by rep, latest activity, with 7 / 30 / all-time filters.
4. **Scope decisions (1.5 min).**
   - Built: speed on the call first.
   - Cut: login, CSV upload screen, revenue matching, parsing special requirements (see the README table).
   - Every card is amber because the sample rates really are 8 months old. The flag is working as intended.
5. **Testing (1.5 min).**
   - 53 automated tests on the rules that would lose deals if wrong.
   - The four QA personas.
   - Before shipping: a 30-minute session with 2 reps on real calls, checking the credit bands with sales leadership, and Playwright tests for the click-through flows.
6. **What's next (1 min).**
   - **V2 = rate update pipeline:** upload a CSV in the app, show what changed, and flag "rate changed since last week" on cards. Rates change monthly, and quoting a stale rate costs trust.
   - Then: a loan purpose input (so 504 stops showing for working capital), and login.
7. **Honest self-assessment (1 min).**
   - **Good:** fast, the rules are tested, near-misses help on calls, and the data model can grow.
   - **Rough:**
     - the credit bands are my assumption;
     - there's no auth, so the rep name can be anything;
     - special requirements are display-only;
     - 504 vs. working capital is handled by a note, not a rule;
     - the manager view counts clicks, not funded loans.
