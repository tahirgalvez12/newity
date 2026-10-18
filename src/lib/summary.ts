import { formatMoneyShort, formatRate, formatTerm, formatYears } from "./format";
import type { Borrower, Program } from "./matching";

export interface SummaryProgram extends Program {
  requiresCollateral: string;
  lastUpdated: string;
}

export function describeBorrower(b: Borrower): string {
  const parts: string[] = [];
  if (b.loanAmount != null) parts.push(formatMoneyShort(b.loanAmount));
  if (b.businessType) parts.push(b.businessType);
  if (b.yearsInBusiness != null) parts.push(`${formatYears(b.yearsInBusiness)} in business`);
  if (b.creditScore != null) parts.push(`${b.creditScore} credit`);
  else if (b.creditTier) parts.push(`${b.creditTier} credit`);
  return parts.join(" · ");
}

function formatDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

/** Plain text a rep can paste into an email to the borrower. No internal jargon, no near-misses. */
export function buildBorrowerSummary(borrower: Borrower, programs: SummaryProgram[]): string {
  const who = describeBorrower(borrower);
  const lines = [`SBA loan options${who ? ` for: ${who}` : ""}`, ""];
  programs.forEach((p, i) => {
    lines.push(`${i + 1}. ${p.lenderName} (${p.programType})`);
    lines.push(
      `   Rate: ${formatRate(p.interestRateMin, p.interestRateMax)} · Term up to ${formatTerm(p.maxTermMonths)} · Typical turnaround: ${p.turnaroundDays} days`,
    );
    lines.push(
      `   Loan range: ${formatMoneyShort(p.minLoanAmount)}–${formatMoneyShort(p.maxLoanAmount)} · Collateral: ${p.requiresCollateral}`,
    );
    if (p.specialRequirements) lines.push(`   Note: ${p.specialRequirements}`);
    lines.push("");
  });
  const oldest = programs.map((p) => p.lastUpdated).sort()[0];
  if (oldest) lines.push(`Rates as of ${formatDate(oldest)}. Final rates and terms are subject to lender approval.`);
  return lines.join("\n");
}
