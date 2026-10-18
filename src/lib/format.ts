/**
 * $250k, $1.5M, $5M: short enough to read aloud on a call. Falls back to the full
 * amount when shortening would round (never show $49,999 as "$50k").
 */
export function formatMoneyShort(value: number): string {
  if (value >= 1_000_000 && value % 10_000 === 0) return `$${trim(value / 1_000_000)}M`;
  if (value >= 1_000 && value < 1_000_000 && value % 1_000 === 0) return `$${value / 1_000}k`;
  return formatMoneyFull(value);
}

export function formatMoneyFull(value: number): string {
  return value.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
}

function trim(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(2).replace(/\.?0+$/, "");
}

/**
 * Lenient parse of what a rep types: "250000", "$250,000", "250k", "1.5m", "2 mil".
 * Returns null for anything we can't confidently read.
 */
export function parseAmount(input: string): number | null {
  const cleaned = input.trim().toLowerCase().replace(/[$,\s]/g, "");
  if (!cleaned) return null;
  const match = /^(\d+(?:\.\d+)?)(k|m|mil|mm)?$/.exec(cleaned);
  if (!match) return null;
  const base = Number(match[1]);
  const multiplier = match[2] === "k" ? 1_000 : match[2] ? 1_000_000 : 1;
  const value = Math.round(base * multiplier);
  return value > 0 ? value : null;
}

/** 0.5 → "6 mo", 1 → "1 yr", 3 → "3 yrs" */
export function formatYears(years: number): string {
  if (years < 1) return `${Math.round(years * 12)} mo`;
  return `${trim(years)} ${years === 1 ? "yr" : "yrs"}`;
}

export function formatTerm(months: number): string {
  return months % 12 === 0 ? `${months / 12} yrs` : `${months} mo`;
}

export function formatRate(min: number, max: number): string {
  return `${min.toFixed(1)}–${max.toFixed(1)}%`;
}
