import "dotenv/config";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Pool } from "pg";
import { matchPrograms, type Borrower, type CreditTier, type Program, type SortKey } from "../src/lib/matching";

/*
 * Differential test: the TypeScript matcher vs. an INDEPENDENT implementation of the same
 * rules written as SQL against the real lender_programs table. The SQL is written from the
 * rules in the README, not from matching.ts, so a misunderstanding in one is unlikely to be
 * repeated in the other. Thousands of seeded random borrowers, weighted toward the exact
 * boundary values in the data, must produce identical eligible lists (in the same order),
 * identical near-miss sets and identical "confirm credit" warnings.
 *
 * Needs the database (npm run setup); does not need the web server.
 */

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const BORROWERS = 4000;

// Tier bands from the README ("Excellent 720+, Good 680–719, Fair 620–679").
const BANDS: Record<CreditTier, [number, number]> = { Excellent: [720, 850], Good: [680, 719], Fair: [620, 679] };

const ORACLE_SQL = `
  WITH b AS (
    SELECT $1::int AS amt, $2::text AS btype, $3::numeric AS yrs,
           $4::int AS score, $5::int AS tier_low, $6::int AS tier_high
  ),
  checks AS (
    SELECT p.id, p.interest_rate_min, p.turnaround_days, p.max_loan_amount,
      (b.amt IS NOT NULL AND (b.amt < p.min_loan_amount OR b.amt > p.max_loan_amount))::int AS f_amount,
      (b.btype IS NOT NULL AND p.eligible_business_types <> 'All' AND p.eligible_business_types <> b.btype)::int AS f_type,
      (b.yrs IS NOT NULL AND b.yrs < p.min_years_in_business)::int AS f_years,
      (CASE WHEN b.score IS NOT NULL THEN b.score < p.min_credit_score
            WHEN b.tier_low IS NOT NULL THEN b.tier_high < p.min_credit_score
            ELSE false END)::int AS f_credit,
      (b.score IS NULL AND b.tier_low IS NOT NULL
         AND b.tier_low < p.min_credit_score AND b.tier_high >= p.min_credit_score) AS warn_credit
    FROM lender_programs p, b
  )
  SELECT id, (f_amount + f_type + f_years + f_credit) AS failures, warn_credit,
         interest_rate_min, turnaround_days, max_loan_amount
  FROM checks`;

const ORDER: Record<SortKey, string> = {
  rate: "interest_rate_min ASC, turnaround_days ASC, id ASC",
  speed: "turnaround_days ASC, interest_rate_min ASC, id ASC",
  maxLoan: "max_loan_amount DESC, interest_rate_min ASC, id ASC",
};

let programs: Program[] = [];
let types: string[] = [];

// Deterministic RNG so a failure is reproducible (the seed is printed on failure).
let seed = 20261018;
const rand = () => ((seed = (seed * 1_103_515_245 + 12_345) % 2 ** 31) / 2 ** 31);
const pick = <T>(xs: T[]): T => xs[Math.floor(rand() * xs.length)];
const maybe = <T>(v: T, pNull = 0.2): T | null => (rand() < pNull ? null : v);

function randomBorrower(): Borrower {
  const p = pick(programs);
  // Half the time land exactly on/just past a real boundary in the data, else anywhere.
  const amount = rand() < 0.5 ? pick([p.minLoanAmount, p.minLoanAmount - 1, p.maxLoanAmount, p.maxLoanAmount + 1]) : Math.round(rand() * 6_000_000);
  const years = rand() < 0.5 ? pick([p.minYearsInBusiness, p.minYearsInBusiness - 0.5, 0, 0.5]) : Math.round(rand() * 20) / 2;
  const score = rand() < 0.5 ? pick([p.minCreditScore, p.minCreditScore - 1, p.minCreditScore + 1]) : 550 + Math.floor(rand() * 300);
  const useScore = rand() < 0.3;
  return {
    loanAmount: maybe(Math.max(1, amount)),
    businessType: maybe(pick([...types, "Other"])),
    yearsInBusiness: maybe(Math.max(0, years)),
    creditTier: maybe(pick<CreditTier>(["Excellent", "Good", "Fair"])),
    creditScore: useScore ? score : null,
  };
}

async function oracle(b: Borrower, sort: SortKey) {
  const band = b.creditTier ? BANDS[b.creditTier] : [null, null];
  const params = [b.loanAmount, b.businessType, b.yearsInBusiness, b.creditScore, band[0], band[1]];
  const { rows } = await pool.query(`SELECT * FROM (${ORACLE_SQL}) r ORDER BY ${ORDER[sort]}`, params);
  return {
    eligible: rows.filter((r) => Number(r.failures) === 0).map((r) => r.id as number),
    near: rows.filter((r) => Number(r.failures) === 1).map((r) => r.id as number),
    warned: rows.filter((r) => Number(r.failures) === 0 && r.warn_credit).map((r) => r.id as number).sort((x, y) => x - y),
  };
}

beforeAll(async () => {
  const { rows } = await pool.query(`SELECT * FROM lender_programs ORDER BY id`);
  if (!rows.length) throw new Error("lender_programs is empty. Run `npm run setup` first.");
  programs = rows.map((r) => ({
    id: r.id,
    lenderName: r.lender_name,
    programType: r.program_type,
    minLoanAmount: r.min_loan_amount,
    maxLoanAmount: r.max_loan_amount,
    minCreditScore: r.min_credit_score,
    minYearsInBusiness: Number(r.min_years_in_business),
    interestRateMin: Number(r.interest_rate_min),
    interestRateMax: Number(r.interest_rate_max),
    maxTermMonths: r.max_term_months,
    eligibleBusinessTypes: r.eligible_business_types,
    turnaroundDays: r.turnaround_days,
    specialRequirements: r.special_requirements,
  }));
  types = [...new Set(programs.map((p) => p.eligibleBusinessTypes))].filter((t) => t !== "All");
});

afterAll(() => pool.end());

describe("matcher agrees with an independent SQL implementation", () => {
  it(`on ${BORROWERS} random and boundary borrowers, across all sort orders`, async () => {
    let compared = 0;
    let boundaryHits = 0;
    for (let i = 0; i < BORROWERS; i++) {
      const borrower = randomBorrower();
      const sort = pick<SortKey>(["rate", "speed", "maxLoan"]);
      const ts = matchPrograms(programs, borrower, sort);
      const sql = await oracle(borrower, sort);
      const context = `seed run #${i}: ${JSON.stringify(borrower)} sort=${sort}`;

      expect(ts.eligible.map((r) => r.program.id), `eligible list/order, ${context}`).toEqual(sql.eligible);
      expect(ts.nearMisses.map((r) => r.program.id), `near-miss list/order, ${context}`).toEqual(sql.near);
      expect(
        ts.eligible.filter((r) => r.warnings.length > 0).map((r) => r.program.id).sort((x, y) => x - y),
        `credit warnings, ${context}`,
      ).toEqual(sql.warned);
      for (const r of ts.nearMisses) expect(r.failures, `near-miss has exactly one reason, ${context}`).toHaveLength(1);

      compared++;
      if (programs.some((p) => borrower.loanAmount === p.minLoanAmount || borrower.loanAmount === p.maxLoanAmount)) boundaryHits++;
    }
    expect(compared).toBe(BORROWERS);
    // Guard against the generator silently drifting away from boundaries.
    expect(boundaryHits).toBeGreaterThan(BORROWERS * 0.2);
  }, 120_000);
});
