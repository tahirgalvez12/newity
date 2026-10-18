import Papa from "papaparse";
import type { NewLenderProgramRow } from "@/db/schema";

const REQUIRED_COLUMNS = [
  "lender_name",
  "program_type",
  "min_loan_amount",
  "max_loan_amount",
  "min_credit_score",
  "credit_tier_required",
  "min_years_in_business",
  "interest_rate_min",
  "interest_rate_max",
  "max_term_months",
  "sba_guarantee_pct",
  "eligible_business_types",
  "requires_collateral",
  "max_existing_debt_ratio",
  "turnaround_days",
  "special_requirements",
  "last_updated",
] as const;

type RawRow = Record<(typeof REQUIRED_COLUMNS)[number], string>;

export class CsvImportError extends Error {}

function num(row: RawRow, key: keyof RawRow, line: number): number {
  const value = Number(row[key]?.trim());
  if (row[key]?.trim() === "" || Number.isNaN(value)) {
    throw new CsvImportError(`Line ${line}: "${key}" must be a number (got "${row[key]}")`);
  }
  return value;
}

function oneOf<T extends string>(row: RawRow, key: keyof RawRow, allowed: readonly T[], line: number): T {
  const value = row[key]?.trim() as T;
  if (!allowed.includes(value)) {
    throw new CsvImportError(`Line ${line}: "${key}" must be one of ${allowed.join(", ")} (got "${row[key]}")`);
  }
  return value;
}

/** "1/16/2026" (M/D/YYYY, as exported by the team's spreadsheet) → "2026-01-16" */
export function parseUsDate(input: string, line: number): string {
  const match = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(input.trim());
  if (!match) throw new CsvImportError(`Line ${line}: "last_updated" must be M/D/YYYY (got "${input}")`);
  const [, m, d, y] = match;
  return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
}

/**
 * Parse and validate the lender CSV. Fails loudly on bad rows: a silently-wrong rate
 * quoted to a borrower is worse than a failed import.
 */
export function parseLenderCsv(text: string): NewLenderProgramRow[] {
  const parsed = Papa.parse<RawRow>(text, { header: true, skipEmptyLines: "greedy" });
  if (parsed.errors.length) {
    const e = parsed.errors[0];
    throw new CsvImportError(`CSV parse error on row ${e.row}: ${e.message}`);
  }
  const missing = REQUIRED_COLUMNS.filter((c) => !parsed.meta.fields?.includes(c));
  if (missing.length) throw new CsvImportError(`CSV is missing columns: ${missing.join(", ")}`);

  return parsed.data.map((row, i) => {
    const line = i + 2; // header is line 1
    const debtRatio = row.max_existing_debt_ratio?.trim();
    const special = row.special_requirements?.trim();
    const program: NewLenderProgramRow = {
      lenderName: row.lender_name.trim(),
      programType: row.program_type.trim(),
      minLoanAmount: num(row, "min_loan_amount", line),
      maxLoanAmount: num(row, "max_loan_amount", line),
      minCreditScore: num(row, "min_credit_score", line),
      creditTierRequired: oneOf(row, "credit_tier_required", ["Excellent", "Good", "Fair"] as const, line),
      minYearsInBusiness: num(row, "min_years_in_business", line),
      interestRateMin: num(row, "interest_rate_min", line),
      interestRateMax: num(row, "interest_rate_max", line),
      maxTermMonths: num(row, "max_term_months", line),
      sbaGuaranteePct: num(row, "sba_guarantee_pct", line),
      eligibleBusinessTypes: row.eligible_business_types.trim(),
      requiresCollateral: oneOf(row, "requires_collateral", ["Yes", "No", "Varies"] as const, line),
      maxExistingDebtRatio: debtRatio ? num(row, "max_existing_debt_ratio", line) : null,
      turnaroundDays: num(row, "turnaround_days", line),
      specialRequirements: special || null,
      lastUpdated: parseUsDate(row.last_updated, line),
    };
    if (!program.lenderName || !program.programType) {
      throw new CsvImportError(`Line ${line}: lender_name and program_type are required`);
    }
    if (program.minLoanAmount > program.maxLoanAmount) {
      throw new CsvImportError(`Line ${line}: min_loan_amount is greater than max_loan_amount`);
    }
    if (program.interestRateMin > program.interestRateMax) {
      throw new CsvImportError(`Line ${line}: interest_rate_min is greater than interest_rate_max`);
    }
    return program;
  });
}
