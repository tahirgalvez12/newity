import type { Borrower, CreditTier, SortKey } from "./matching";

/**
 * Everything on the matcher screen lives in the URL, so a link reproduces the exact view:
 * reps can share a comparison, bookmark a borrower, or refresh mid-call without losing work.
 */
export interface MatcherState {
  borrower: Borrower;
  sort: SortKey;
  compareIds: number[];
}

const TIERS: CreditTier[] = ["Excellent", "Good", "Fair"];
const SORTS: SortKey[] = ["rate", "speed", "maxLoan"];
export const MAX_COMPARE = 4;

function positiveNumber(value: string | null): number | null {
  if (value == null || value.trim() === "") return null;
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

export function readMatcherState(params: URLSearchParams): MatcherState {
  const tier = params.get("tier") as CreditTier | null;
  const sort = params.get("sort") as SortKey | null;
  const score = positiveNumber(params.get("score"));
  return {
    borrower: {
      loanAmount: positiveNumber(params.get("amt")) || null,
      businessType: params.get("type") || null,
      yearsInBusiness: positiveNumber(params.get("yrs")),
      creditTier: tier && TIERS.includes(tier) ? tier : null,
      creditScore: score != null && score >= 300 && score <= 850 ? Math.round(score) : null,
    },
    sort: sort && SORTS.includes(sort) ? sort : "rate",
    compareIds: [
      ...new Set(
        (params.get("cmp") ?? "")
          .split(",")
          .map(Number)
          .filter((n) => Number.isInteger(n) && n > 0),
      ),
    ].slice(0, MAX_COMPARE),
  };
}

export function writeMatcherState(state: MatcherState): URLSearchParams {
  const p = new URLSearchParams();
  const b = state.borrower;
  if (b.loanAmount != null) p.set("amt", String(b.loanAmount));
  if (b.businessType) p.set("type", b.businessType);
  if (b.yearsInBusiness != null) p.set("yrs", String(b.yearsInBusiness));
  if (b.creditTier) p.set("tier", b.creditTier);
  if (b.creditScore != null) p.set("score", String(b.creditScore));
  if (state.sort !== "rate") p.set("sort", state.sort);
  if (state.compareIds.length) p.set("cmp", state.compareIds.join(","));
  return p;
}
