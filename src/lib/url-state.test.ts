import { describe, expect, it } from "vitest";
import { readMatcherState, writeMatcherState, type MatcherState } from "./url-state";
import { buildBorrowerSummary, type SummaryProgram } from "./summary";

describe("matcher URL state", () => {
  it("round-trips a full state", () => {
    const state: MatcherState = {
      borrower: { loanAmount: 150000, businessType: "Restaurant/Food Service", yearsInBusiness: 2, creditTier: "Good", creditScore: 701 },
      sort: "speed",
      compareIds: [3, 9],
    };
    expect(readMatcherState(writeMatcherState(state))).toEqual(state);
  });

  it("defaults everything when the URL is empty", () => {
    expect(readMatcherState(new URLSearchParams())).toEqual({
      borrower: { loanAmount: null, businessType: null, yearsInBusiness: null, creditTier: null, creditScore: null },
      sort: "rate",
      compareIds: [],
    });
  });

  it("ignores tampered or junk values instead of crashing", () => {
    const s = readMatcherState(new URLSearchParams("amt=-5&tier=Amazing&score=9000&sort=random&cmp=1,abc,1,2,3,4,5&yrs=x"));
    expect(s.borrower).toEqual({ loanAmount: null, businessType: null, yearsInBusiness: null, creditTier: null, creditScore: null });
    expect(s.sort).toBe("rate");
    expect(s.compareIds).toEqual([1, 2, 3, 4]); // deduped and capped
  });

  it("keeps 0 years in business (a startup) distinct from unknown", () => {
    expect(readMatcherState(new URLSearchParams("yrs=0")).borrower.yearsInBusiness).toBe(0);
  });
});

describe("borrower summary", () => {
  const p: SummaryProgram = {
    id: 1,
    lenderName: "Heritage Credit Union",
    programType: "7(a) Small Loan",
    minLoanAmount: 30000,
    maxLoanAmount: 250000,
    minCreditScore: 680,
    minYearsInBusiness: 1,
    interestRateMin: 9.2,
    interestRateMax: 10.8,
    maxTermMonths: 120,
    eligibleBusinessTypes: "Retail",
    turnaroundDays: 19,
    specialRequirements: "Franchise must be SBA-approved",
    requiresCollateral: "Varies",
    lastUpdated: "2026-02-03",
  };

  it("lists programs with rates, terms and notes", () => {
    const text = buildBorrowerSummary(
      { loanAmount: 150000, businessType: "Retail", yearsInBusiness: 2, creditTier: "Good", creditScore: null },
      [p],
    );
    expect(text).toContain("SBA loan options for: $150k · Retail · 2 yrs in business · Good credit");
    expect(text).toContain("1. Heritage Credit Union (7(a) Small Loan)");
    expect(text).toContain("Rate: 9.2–10.8% · Term up to 10 yrs · Typical turnaround: 19 days");
    expect(text).toContain("Note: Franchise must be SBA-approved");
    expect(text).toContain("Rates as of Feb 3, 2026.");
  });
});
