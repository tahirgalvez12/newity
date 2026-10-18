import { formatTerm } from "@/lib/format";
import { formatRateChange, isRecentChange } from "@/lib/rate-changes";
import type { ProgramView } from "./types";
import { badge } from "./ui";

type FromTo = { from: string; to: string };

export interface RecentChange {
  /** Old → new rate range, or null if only the term changed. */
  rate: FromTo | null;
  /** Old → new max term, or null if only the rate changed. */
  term: FromTo | null;
  /** YYYY-MM-DD the re-import recorded it. */
  recordedOn: string;
}

/** The program's latest rate/term change if it was recorded within the flag window, else null. */
export function recentChange(p: ProgramView, now: Date): RecentChange | null {
  const c = p.rateChange;
  if (!c || !isRecentChange(c.changedAt, now)) return null;
  const rateMoved = c.oldInterestRateMin !== c.newInterestRateMin || c.oldInterestRateMax !== c.newInterestRateMax;
  return {
    rate: rateMoved
      ? formatRateChange(
          { interestRateMin: c.oldInterestRateMin, interestRateMax: c.oldInterestRateMax },
          { interestRateMin: c.newInterestRateMin, interestRateMax: c.newInterestRateMax },
        )
      : null,
    term: c.oldMaxTermMonths !== c.newMaxTermMonths ? { from: formatTerm(c.oldMaxTermMonths), to: formatTerm(c.newMaxTermMonths) } : null,
    recordedOn: c.changedAt.slice(0, 10),
  };
}

/** "↻ Rate changed" (or "Term changed") with old → new on hover. Renders nothing without a recent change. */
export function RateChangeBadge({ recent }: { recent: RecentChange | null }) {
  if (!recent) return null;
  const detail = [
    recent.rate && `Rate ${recent.rate.from} → ${recent.rate.to}`,
    recent.term && `Max term ${recent.term.from} → ${recent.term.to}`,
    `Changed in the rate import on ${recent.recordedOn}`,
  ]
    .filter(Boolean)
    .join("\n");
  return (
    <span className={badge.info} title={detail}>
      <span aria-hidden>↻ </span>
      {recent.rate ? "Rate changed" : "Term changed"}
    </span>
  );
}
