import { formatMoneyShort, formatYears } from "./format";

export type CreditTier = "Excellent" | "Good" | "Fair";

/** The fields the matcher reads. A structural subset of the DB row so tests can build fixtures easily. */
export interface Program {
  id: number;
  lenderName: string;
  programType: string;
  minLoanAmount: number;
  maxLoanAmount: number;
  minCreditScore: number;
  minYearsInBusiness: number;
  interestRateMin: number;
  interestRateMax: number;
  maxTermMonths: number;
  eligibleBusinessTypes: string;
  turnaroundDays: number;
  specialRequirements: string | null;
}

/** Everything is optional: results narrow as the rep fills in what they know. */
export interface Borrower {
  loanAmount: number | null;
  businessType: string | null;
  yearsInBusiness: number | null;
  creditTier: CreditTier | null;
  creditScore: number | null;
}

/**
 * Score ranges reps mean when they say a tier. Assumption agreed with the business;
 * the CSV only has hard minimum scores, so this mapping is what bridges the two.
 */
export const CREDIT_BANDS: Record<CreditTier, { low: number; high: number }> = {
  Excellent: { low: 720, high: 850 },
  Good: { low: 680, high: 719 },
  Fair: { low: 620, high: 679 },
};

export const ALL_BUSINESS_TYPES = "All";
export const OTHER_BUSINESS_TYPE = "Other";

export type MatchStatus = "eligible" | "near" | "ineligible";

export interface MatchResult<P extends Program = Program> {
  program: P;
  status: MatchStatus;
  /** Hard criteria the borrower fails, phrased so a rep can read them aloud. */
  failures: string[];
  /** Criteria that pass but need confirming on the call (e.g. borderline credit tier). */
  warnings: string[];
}

export type SortKey = "rate" | "speed" | "maxLoan";

type Check = { ok: true; warning?: string } | { ok: false; reason: string };
const PASS: Check = { ok: true };

function checkAmount(p: Program, amount: number | null): Check {
  if (amount == null) return PASS;
  if (amount < p.minLoanAmount) {
    return { ok: false, reason: `Min loan is ${formatMoneyShort(p.minLoanAmount)} (${formatMoneyShort(amount)} requested)` };
  }
  if (amount > p.maxLoanAmount) {
    return { ok: false, reason: `Max loan is ${formatMoneyShort(p.maxLoanAmount)} (${formatMoneyShort(amount)} requested)` };
  }
  return PASS;
}

function checkBusinessType(p: Program, type: string | null): Check {
  if (!type) return PASS;
  if (p.eligibleBusinessTypes === ALL_BUSINESS_TYPES || p.eligibleBusinessTypes === type) return PASS;
  return { ok: false, reason: `Only lends to ${p.eligibleBusinessTypes}` };
}

function checkYears(p: Program, years: number | null): Check {
  if (years == null) return PASS;
  if (years >= p.minYearsInBusiness) return PASS;
  return {
    ok: false,
    reason: `Needs ${formatYears(p.minYearsInBusiness)} in business (borrower has ${formatYears(years)})`,
  };
}

function checkCredit(p: Program, tier: CreditTier | null, score: number | null): Check {
  const min = p.minCreditScore;
  // An exact score always wins over the tier.
  if (score != null) {
    return score >= min ? PASS : { ok: false, reason: `Needs ${min}+ credit (borrower has ${score})` };
  }
  if (!tier) return PASS;
  const band = CREDIT_BANDS[tier];
  if (band.low >= min) return PASS;
  if (band.high >= min) return { ok: true, warning: `Confirm credit score is ${min}+` };
  return { ok: false, reason: `Needs ${min}+ credit (${tier} is ${band.low}–${band.high})` };
}

export function evaluateProgram<P extends Program>(program: P, borrower: Borrower): MatchResult<P> {
  const checks = [
    checkAmount(program, borrower.loanAmount),
    checkBusinessType(program, borrower.businessType),
    checkYears(program, borrower.yearsInBusiness),
    checkCredit(program, borrower.creditTier, borrower.creditScore),
  ];
  const failures = checks.flatMap((c) => (c.ok ? [] : [c.reason]));
  const warnings = checks.flatMap((c) => (c.ok && c.warning ? [c.warning] : []));
  const status: MatchStatus = failures.length === 0 ? "eligible" : failures.length === 1 ? "near" : "ineligible";
  return { program, status, failures, warnings };
}

const comparators: Record<SortKey, (a: Program, b: Program) => number> = {
  rate: (a, b) => a.interestRateMin - b.interestRateMin || a.turnaroundDays - b.turnaroundDays,
  speed: (a, b) => a.turnaroundDays - b.turnaroundDays || a.interestRateMin - b.interestRateMin,
  maxLoan: (a, b) => b.maxLoanAmount - a.maxLoanAmount || a.interestRateMin - b.interestRateMin,
};

export interface MatchSummary<P extends Program = Program> {
  eligible: MatchResult<P>[];
  nearMisses: MatchResult<P>[];
}

export function matchPrograms<P extends Program>(
  programs: P[],
  borrower: Borrower,
  sort: SortKey = "rate",
): MatchSummary<P> {
  const compare = (a: MatchResult<P>, b: MatchResult<P>) =>
    comparators[sort](a.program, b.program) || a.program.id - b.program.id;
  const results = programs.map((p) => evaluateProgram(p, borrower));
  return {
    eligible: results.filter((r) => r.status === "eligible").sort(compare),
    nearMisses: results.filter((r) => r.status === "near").sort(compare),
  };
}

export function hasAnyCriteria(b: Borrower): boolean {
  return (
    b.loanAmount != null || b.businessType != null || b.yearsInBusiness != null || b.creditTier != null || b.creditScore != null
  );
}

export const STALE_AFTER_DAYS = 30;

/** Whole days between a YYYY-MM-DD date and `now`, computed in UTC so it doesn't shift by timezone. */
export function daysSince(isoDate: string, now: Date): number {
  const [y, m, d] = isoDate.split("-").map(Number);
  const then = Date.UTC(y, m - 1, d);
  const today = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.max(0, Math.floor((today - then) / 86_400_000));
}

export function isStale(isoDate: string, now: Date): boolean {
  return daysSince(isoDate, now) > STALE_AFTER_DAYS;
}
