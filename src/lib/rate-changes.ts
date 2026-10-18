import type { LenderProgramRow } from "@/db/schema";
import { formatRate } from "./format";
import { daysSince } from "./matching";

/** The fields a re-import compares; everything else (eligibility, notes…) is overwritten silently. */
type Tracked = Pick<LenderProgramRow, "interestRateMin" | "interestRateMax" | "maxTermMonths" | "lastUpdated">;
type Keyed = Pick<LenderProgramRow, "lenderName" | "programType">;

export interface RateChange {
  programId: number;
  lenderName: string;
  programType: string;
  old: Tracked;
  new: Tracked;
}

export interface RateDiff {
  /** Existing programs whose rate range or max term differs in the incoming CSV. */
  changed: RateChange[];
  unchanged: number;
  /** In the CSV but not the database: inserted by the upsert, no history (nothing to compare to). */
  added: Keyed[];
  /** In the database but not the CSV: the seed leaves them as they are. */
  missing: Keyed[];
}

const keyOf = (p: Keyed) => `${p.lenderName}\u0000${p.programType}`;

type RateRange = Pick<Tracked, "interestRateMin" | "interestRateMax">;

const rangesEqual = (a: RateRange, b: RateRange) => a.interestRateMin === b.interestRateMin && a.interestRateMax === b.interestRateMax;

const pickTracked = (p: Tracked): Tracked => ({
  interestRateMin: p.interestRateMin,
  interestRateMax: p.interestRateMax,
  maxTermMonths: p.maxTermMonths,
  lastUpdated: p.lastUpdated,
});

/**
 * Compare the programs in the database with an incoming CSV, matching on (lender, program).
 * Only a rate or term change counts: a newer last_updated with the same numbers is a
 * re-confirmation, not something reps need to be told about.
 */
export function diffRates(current: (Keyed & Tracked & { id: number })[], incoming: (Keyed & Tracked)[]): RateDiff {
  const existing = new Map(current.map((p) => [keyOf(p), p]));
  const incomingKeys = new Set(incoming.map(keyOf));
  const diff: RateDiff = { changed: [], unchanged: 0, added: [], missing: [] };

  for (const next of incoming) {
    const prev = existing.get(keyOf(next));
    if (!prev) {
      diff.added.push({ lenderName: next.lenderName, programType: next.programType });
    } else if (!rangesEqual(prev, next) || prev.maxTermMonths !== next.maxTermMonths) {
      diff.changed.push({
        programId: prev.id,
        lenderName: prev.lenderName,
        programType: prev.programType,
        old: pickTracked(prev),
        new: pickTracked(next),
      });
    } else {
      diff.unchanged++;
    }
  }
  diff.missing = current
    .filter((p) => !incomingKeys.has(keyOf(p)))
    .map((p) => ({ lenderName: p.lenderName, programType: p.programType }));
  return diff;
}

/**
 * Old and new rate ranges as display strings. Uses the cards' one-decimal format, falling back to
 * full precision when rounding would make a real change look like "11.2–12.5% → 11.2–12.5%".
 */
export function formatRateChange(oldRange: RateRange, newRange: RateRange): { from: string; to: string } {
  const from = formatRate(oldRange.interestRateMin, oldRange.interestRateMax);
  const to = formatRate(newRange.interestRateMin, newRange.interestRateMax);
  if (from !== to || rangesEqual(oldRange, newRange)) return { from, to };
  return {
    from: `${oldRange.interestRateMin}–${oldRange.interestRateMax}%`,
    to: `${newRange.interestRateMin}–${newRange.interestRateMax}%`,
  };
}

/** "First National Bank · SBA Express: 11.4–12.5% → 10.9–12.0%, term 84 → 120 months" */
export function describeChange(c: Pick<RateChange, "lenderName" | "programType" | "old" | "new">): string {
  const parts: string[] = [];
  if (!rangesEqual(c.old, c.new)) {
    const { from, to } = formatRateChange(c.old, c.new);
    parts.push(`${from} → ${to}`);
  }
  if (c.old.maxTermMonths !== c.new.maxTermMonths) parts.push(`term ${c.old.maxTermMonths} → ${c.new.maxTermMonths} months`);
  return `${c.lenderName} · ${c.programType}: ${parts.join(", ")}`;
}

/** How long a "Rate changed" badge stays on a card after the import that recorded it. */
export const RATE_CHANGE_FLAG_DAYS = 30;

/** True when a change recorded at `changedAt` (ISO timestamp) is recent enough to flag on cards. */
export function isRecentChange(changedAt: string, now: Date): boolean {
  return daysSince(changedAt.slice(0, 10), now) <= RATE_CHANGE_FLAG_DAYS;
}
