import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { CsvImportError, parseLenderCsv, parseUsDate } from "./csv";

const HEADER =
  "lender_name,program_type,min_loan_amount,max_loan_amount,min_credit_score,credit_tier_required,min_years_in_business,interest_rate_min,interest_rate_max,max_term_months,sba_guarantee_pct,eligible_business_types,requires_collateral,max_existing_debt_ratio,turnaround_days,special_requirements,last_updated";

describe("parseLenderCsv", () => {
  it("parses the provided sample file", () => {
    const rows = parseLenderCsv(readFileSync("data/lenders.csv", "utf8"));
    expect(rows).toHaveLength(49);
    expect(rows[0]).toMatchObject({
      lenderName: "First National Bank",
      programType: "Community Advantage",
      minLoanAmount: 10000,
      interestRateMin: 11,
      requiresCollateral: "Varies",
      maxExistingDebtRatio: 0.5,
      lastUpdated: "2026-01-16",
    });
  });

  it("maps blank optional fields to null", () => {
    const rows = parseLenderCsv(readFileSync("data/lenders.csv", "utf8"));
    const pacificSmall = rows.find((r) => r.lenderName === "Pacific Commerce Bank" && r.programType === "7(a) Small Loan");
    expect(pacificSmall?.maxExistingDebtRatio).toBeNull();
    const firstSmall = rows.find((r) => r.lenderName === "First National Bank" && r.programType === "7(a) Small Loan");
    expect(firstSmall?.specialRequirements).toBeNull();
  });

  it("rejects bad numbers with the line number", () => {
    const csv = `${HEADER}\nBank,SBA Express,abc,500000,650,Good,2,10,12,84,50,All,No,,10,,1/1/2026`;
    expect(() => parseLenderCsv(csv)).toThrow(/Line 2: "min_loan_amount" must be a number/);
  });

  it("rejects unknown collateral values", () => {
    const csv = `${HEADER}\nBank,SBA Express,10000,500000,650,Good,2,10,12,84,50,All,Maybe,,10,,1/1/2026`;
    expect(() => parseLenderCsv(csv)).toThrow(CsvImportError);
  });

  it("rejects inverted ranges", () => {
    const csv = `${HEADER}\nBank,SBA Express,600000,500000,650,Good,2,10,12,84,50,All,No,,10,,1/1/2026`;
    expect(() => parseLenderCsv(csv)).toThrow(/min_loan_amount is greater than max_loan_amount/);
  });

  it("rejects files missing columns", () => {
    expect(() => parseLenderCsv("lender_name,program_type\nA,B")).toThrow(/missing columns/);
  });
});

describe("parseUsDate", () => {
  it("converts M/D/YYYY to ISO", () => {
    expect(parseUsDate("1/2/2026", 2)).toBe("2026-01-02");
    expect(parseUsDate("12/31/2025", 2)).toBe("2025-12-31");
  });

  it("rejects other formats", () => {
    expect(() => parseUsDate("2026-01-02", 2)).toThrow(CsvImportError);
  });
});
