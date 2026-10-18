import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parseLenderCsv } from "./csv";
import {
  type Borrower,
  type Program,
  daysSince,
  evaluateProgram,
  isStale,
  matchPrograms,
} from "./matching";

const program = (overrides: Partial<Program> = {}): Program => ({
  id: 1,
  lenderName: "Test Bank",
  programType: "7(a) Small Loan",
  minLoanAmount: 50_000,
  maxLoanAmount: 250_000,
  minCreditScore: 660,
  minYearsInBusiness: 2,
  interestRateMin: 10,
  interestRateMax: 12,
  maxTermMonths: 120,
  eligibleBusinessTypes: "All",
  turnaroundDays: 20,
  specialRequirements: null,
  ...overrides,
});

const borrower = (overrides: Partial<Borrower> = {}): Borrower => ({
  loanAmount: null,
  businessType: null,
  yearsInBusiness: null,
  creditTier: null,
  creditScore: null,
  ...overrides,
});

describe("loan amount", () => {
  it("treats min and max as inclusive", () => {
    expect(evaluateProgram(program(), borrower({ loanAmount: 50_000 })).status).toBe("eligible");
    expect(evaluateProgram(program(), borrower({ loanAmount: 250_000 })).status).toBe("eligible");
  });

  it("explains which bound was missed", () => {
    expect(evaluateProgram(program(), borrower({ loanAmount: 49_999 })).failures).toEqual([
      "Min loan is $50k ($49,999 requested)",
    ]);
    expect(evaluateProgram(program(), borrower({ loanAmount: 300_000 })).failures).toEqual([
      "Max loan is $250k ($300k requested)",
    ]);
  });
});

describe("business type", () => {
  it('matches "All" programs for any type, including Other', () => {
    expect(evaluateProgram(program(), borrower({ businessType: "Retail" })).status).toBe("eligible");
    expect(evaluateProgram(program(), borrower({ businessType: "Other" })).status).toBe("eligible");
  });

  it("requires an exact match for industry-specific programs", () => {
    const p = program({ eligibleBusinessTypes: "Construction" });
    expect(evaluateProgram(p, borrower({ businessType: "Construction" })).status).toBe("eligible");
    expect(evaluateProgram(p, borrower({ businessType: "Retail" })).failures).toEqual(["Only lends to Construction"]);
  });
});

describe("years in business", () => {
  it("passes exactly at the minimum and fails just under", () => {
    expect(evaluateProgram(program(), borrower({ yearsInBusiness: 2 })).status).toBe("eligible");
    expect(evaluateProgram(program(), borrower({ yearsInBusiness: 1.5 })).failures).toEqual([
      "Needs 2 yrs in business (borrower has 1.5 yrs)",
    ]);
  });
});

describe("credit", () => {
  it("passes when the whole tier band clears the minimum", () => {
    const r = evaluateProgram(program({ minCreditScore: 680 }), borrower({ creditTier: "Good" }));
    expect(r.status).toBe("eligible");
    expect(r.warnings).toEqual([]);
  });

  it("passes with a warning when the tier band straddles the minimum", () => {
    const r = evaluateProgram(program({ minCreditScore: 700 }), borrower({ creditTier: "Good" }));
    expect(r.status).toBe("eligible");
    expect(r.warnings).toEqual(["Confirm credit score is 700+"]);
  });

  it("fails when the whole tier band is below the minimum", () => {
    const r = evaluateProgram(program({ minCreditScore: 680 }), borrower({ creditTier: "Fair" }));
    expect(r.failures).toEqual(["Needs 680+ credit (Fair is 620–679)"]);
  });

  it("uses an exact score over the tier", () => {
    // Fair tier alone would fail a 680 minimum; the actual score clears it.
    const r = evaluateProgram(program({ minCreditScore: 680 }), borrower({ creditTier: "Fair", creditScore: 690 }));
    expect(r.status).toBe("eligible");
    expect(r.warnings).toEqual([]);
    // And a score below the minimum fails even with a tier that would pass.
    const r2 = evaluateProgram(program({ minCreditScore: 680 }), borrower({ creditTier: "Excellent", creditScore: 650 }));
    expect(r2.failures).toEqual(["Needs 680+ credit (borrower has 650)"]);
  });
});

describe("status", () => {
  it("treats missing inputs as unknown, not failing", () => {
    expect(evaluateProgram(program(), borrower()).status).toBe("eligible");
  });

  it("is a near-miss with exactly one failure and ineligible with two", () => {
    expect(evaluateProgram(program(), borrower({ loanAmount: 10_000 })).status).toBe("near");
    expect(evaluateProgram(program(), borrower({ loanAmount: 10_000, yearsInBusiness: 1 })).status).toBe("ineligible");
  });
});

describe("ranking", () => {
  const programs = [
    program({ id: 1, interestRateMin: 11, turnaroundDays: 10, maxLoanAmount: 250_000 }),
    program({ id: 2, interestRateMin: 9, turnaroundDays: 40, maxLoanAmount: 5_000_000 }),
    program({ id: 3, interestRateMin: 9, turnaroundDays: 15, maxLoanAmount: 350_000 }),
  ];
  const ids = (sort: "rate" | "speed" | "maxLoan") => matchPrograms(programs, borrower(), sort).eligible.map((r) => r.program.id);

  it("sorts by lowest rate, then fastest turnaround", () => expect(ids("rate")).toEqual([3, 2, 1]));
  it("can sort by fastest turnaround", () => expect(ids("speed")).toEqual([1, 3, 2]));
  it("can sort by largest max loan", () => expect(ids("maxLoan")).toEqual([2, 3, 1]));

  it("splits eligible and near-miss results and drops the rest", () => {
    const res = matchPrograms(
      [program({ id: 1 }), program({ id: 2, minYearsInBusiness: 3 }), program({ id: 3, minYearsInBusiness: 3, minLoanAmount: 500_000 })],
      borrower({ loanAmount: 100_000, yearsInBusiness: 2 }),
    );
    expect(res.eligible.map((r) => r.program.id)).toEqual([1]);
    expect(res.nearMisses.map((r) => r.program.id)).toEqual([2]);
  });
});

describe("rate freshness", () => {
  const now = new Date(2026, 1, 15); // Feb 15, 2026 local time

  it("counts whole days since the update", () => {
    expect(daysSince("2026-02-15", now)).toBe(0);
    expect(daysSince("2026-01-16", now)).toBe(30);
  });

  it("flags rates older than 30 days", () => {
    expect(isStale("2026-01-16", now)).toBe(false);
    expect(isStale("2026-01-15", now)).toBe(true);
  });
});

// Real-data scenarios: the personas we demo and QA with. If someone edits the CSV and these
// change, that's a prompt to double-check the matcher, not necessarily a bug.
describe("sample data personas", () => {
  const programs = parseLenderCsv(readFileSync("data/lenders.csv", "utf8")).map((p, i) => ({ ...p, id: i + 1 }) as Program);

  it("startup under 1 year has no eligible programs", () => {
    const res = matchPrograms(programs, borrower({ loanAmount: 40_000, businessType: "Construction", yearsInBusiness: 0.5, creditTier: "Fair" }));
    expect(res.eligible).toEqual([]);
    expect(res.nearMisses.length).toBeGreaterThan(0);
    // Every program needs 1+ years, so the one thing between this borrower and a near-miss program is time.
    expect(res.nearMisses.every((r) => /^Needs .* in business \(borrower has 6 mo\)$/.test(r.failures[0]))).toBe(true);
  });

  it("$150k restaurant, 2 yrs, Good credit gets ranked options", () => {
    const res = matchPrograms(programs, borrower({ loanAmount: 150_000, businessType: "Restaurant/Food Service", yearsInBusiness: 2, creditTier: "Good" }));
    expect(res.eligible.length).toBeGreaterThanOrEqual(5);
    const rates = res.eligible.map((r) => r.program.interestRateMin);
    expect(rates).toEqual([...rates].sort((a, b) => a - b));
    for (const r of res.eligible) {
      expect(["All", "Restaurant/Food Service"]).toContain(r.program.eligibleBusinessTypes);
    }
  });

  it("$2M manufacturer, 4 yrs, Excellent sees 504 programs first", () => {
    const res = matchPrograms(programs, borrower({ loanAmount: 2_000_000, businessType: "Manufacturing", yearsInBusiness: 4, creditTier: "Excellent" }));
    expect(res.eligible[0].program.programType).toBe("504 Loan");
  });
});
