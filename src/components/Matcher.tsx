"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { formatMoneyFull, formatRate, parseAmount } from "@/lib/format";
import {
  ALL_BUSINESS_TYPES,
  OTHER_BUSINESS_TYPE,
  daysSince,
  hasAnyCriteria,
  matchPrograms,
  type Borrower,
  type CreditTier,
  type SortKey,
} from "@/lib/matching";
import { buildBorrowerSummary, describeBorrower } from "@/lib/summary";
import { MAX_COMPARE, readMatcherState, writeMatcherState, type MatcherState } from "@/lib/url-state";
import { ComparePanel } from "./ComparePanel";
import { ProgramCard } from "./ProgramCard";
import { btn, card, input, label as labelClass } from "./ui";
import type { ProgramView, RecommendState } from "./types";

const TIERS: { tier: CreditTier; hint: string }[] = [
  { tier: "Excellent", hint: "720+" },
  { tier: "Good", hint: "680–719" },
  { tier: "Fair", hint: "620–679" },
];

const SORT_LABELS: Record<SortKey, string> = {
  rate: "Lowest rate",
  speed: "Fastest turnaround",
  maxLoan: "Largest max loan",
};

const EMPTY_BORROWER: Borrower = { loanAmount: null, businessType: null, yearsInBusiness: null, creditTier: null, creditScore: null };

export function Matcher({ programs }: { programs: ProgramView[] }) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [state, setState] = useState<MatcherState>(() => readMatcherState(new URLSearchParams(searchParams.toString())));
  const { borrower, sort, compareIds } = state;

  // Raw text the rep is typing; parsed values live in `state`.
  const [amountText, setAmountText] = useState(borrower.loanAmount != null ? formatMoneyFull(borrower.loanAmount) : "");
  const [yearsText, setYearsText] = useState(borrower.yearsInBusiness != null ? String(borrower.yearsInBusiness) : "");
  const [scoreText, setScoreText] = useState(borrower.creditScore != null ? String(borrower.creditScore) : "");

  const [compareOpen, setCompareOpen] = useState(false);
  const [recommendStates, setRecommendStates] = useState<Record<number, RecommendState>>({});
  const [toast, setToast] = useState<string | null>(null);
  const amountRef = useRef<HTMLInputElement>(null);
  const now = useMemo(() => new Date(), []);

  // Keep the URL in sync so the view can be shared or survive a refresh.
  useEffect(() => {
    const qs = writeMatcherState(state).toString();
    window.history.replaceState(null, "", qs ? `?${qs}` : window.location.pathname);
  }, [state]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2500);
    return () => clearTimeout(t);
  }, [toast]);

  const updateBorrower = useCallback((patch: Partial<Borrower>) => {
    setState((s) => ({ ...s, borrower: { ...s.borrower, ...patch } }));
    // A changed borrower is a new recommendation context.
    setRecommendStates({});
  }, []);

  const businessTypes = useMemo(
    () => [...new Set(programs.map((p) => p.eligibleBusinessTypes))].filter((t) => t !== ALL_BUSINESS_TYPES).sort(),
    [programs],
  );
  const { eligible, nearMisses } = useMemo(() => matchPrograms(programs, borrower, sort), [programs, borrower, sort]);
  const programsById = useMemo(() => new Map(programs.map((p) => [p.id, p])), [programs]);
  const compared = compareIds.map((id) => programsById.get(id)).filter((p): p is ProgramView => p != null);
  const newestUpdate = useMemo(() => programs.map((p) => p.lastUpdated).sort().at(-1), [programs]);

  const amountInvalid = amountText.trim() !== "" && parseAmount(amountText) == null;
  const scoreInvalid = scoreText.trim() !== "" && borrower.creditScore == null;
  const filtering = hasAnyCriteria(borrower);

  function toggleCompare(id: number) {
    setState((s) => {
      if (s.compareIds.includes(id)) return { ...s, compareIds: s.compareIds.filter((x) => x !== id) };
      if (s.compareIds.length >= MAX_COMPARE) return s;
      return { ...s, compareIds: [...s.compareIds, id] };
    });
  }

  function resetAll() {
    setState({ borrower: EMPTY_BORROWER, sort: "rate", compareIds: [] });
    setAmountText("");
    setYearsText("");
    setScoreText("");
    setRecommendStates({});
    setCompareOpen(false);
    amountRef.current?.focus();
  }

  async function recommend(programId: number) {
    setRecommendStates((s) => ({ ...s, [programId]: "saving" }));
    try {
      const res = await fetch("/api/recommendations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ programId, borrower }),
      });
      if (res.status === 401) {
        // Session expired mid-call: keep the URL (borrower details) so nothing is lost after sign-in.
        router.push(`/login?next=${encodeURIComponent(window.location.pathname + window.location.search)}`);
        return;
      }
      if (!res.ok) throw new Error(await res.text());
      setRecommendStates((s) => ({ ...s, [programId]: "done" }));
    } catch {
      setRecommendStates((s) => ({ ...s, [programId]: "error" }));
    }
  }

  async function copy(text: string, message: string) {
    setToast((await copyToClipboard(text)) ? message : "Your browser blocked copying. Try again, or use Ctrl/Cmd+C.");
  }

  function copySummary() {
    const chosen = compared.length ? compared : eligible.slice(0, 3).map((r) => r.program);
    if (!chosen.length) return;
    copy(
      buildBorrowerSummary(borrower, chosen),
      `Copied summary of ${chosen.length} program${chosen.length === 1 ? "" : "s"}. Paste it into your email.`,
    );
  }

  return (
    <div className="mx-auto grid max-w-7xl gap-6 px-4 py-6 pb-28 lg:grid-cols-[320px_1fr] lg:gap-8">
      {/* ---------- Intake ---------- */}
      <aside className="lg:sticky lg:top-20 lg:self-start">
        <form className={`${card} space-y-5 p-5`} onSubmit={(e) => e.preventDefault()}>
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="font-semibold tracking-tight text-ink">Borrower</h2>
              <p className="text-xs text-ink-3">Results update as you type.</p>
            </div>
            <button type="button" onClick={resetAll} className={`${btn.secondary} shrink-0 whitespace-nowrap`} title="Clear the form for a new call">
              New borrower
            </button>
          </div>

          <Field label="Loan amount" htmlFor="amount" error={amountInvalid ? "Try 250k, 1.5m or 250000" : undefined}>
            <input
              id="amount"
              ref={amountRef}
              autoFocus
              inputMode="decimal"
              placeholder="e.g. 250k"
              value={amountText}
              onChange={(e) => {
                setAmountText(e.target.value);
                updateBorrower({ loanAmount: parseAmount(e.target.value) });
              }}
              onBlur={() => borrower.loanAmount != null && setAmountText(formatMoneyFull(borrower.loanAmount))}
              className={input(amountInvalid)}
            />
          </Field>

          <Field label="Business type" htmlFor="type">
            <select
              id="type"
              value={borrower.businessType ?? ""}
              onChange={(e) => updateBorrower({ businessType: e.target.value || null })}
              className={input()}
            >
              <option value="">Any / not sure</option>
              {businessTypes.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
              <option value={OTHER_BUSINESS_TYPE}>Other industry</option>
            </select>
          </Field>

          <Field label="Years in business" htmlFor="years" hint="Use 0.5 for 6 months">
            <input
              id="years"
              type="number"
              min={0}
              step={0.5}
              inputMode="decimal"
              placeholder="e.g. 2"
              value={yearsText}
              onChange={(e) => {
                setYearsText(e.target.value);
                const n = e.target.value === "" ? null : Number(e.target.value);
                updateBorrower({ yearsInBusiness: n != null && Number.isFinite(n) && n >= 0 ? n : null });
              }}
              className={input()}
            />
          </Field>

          <fieldset>
            <legend className={labelClass}>Credit</legend>
            <div className="grid grid-cols-3 gap-1 rounded-lg border border-line bg-canvas p-1" role="radiogroup" aria-label="Credit tier">
              {TIERS.map(({ tier, hint }) => {
                const active = borrower.creditTier === tier;
                return (
                  <button
                    key={tier}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    onClick={() => updateBorrower({ creditTier: active ? null : tier })}
                    className={`rounded-md px-2 py-1.5 text-sm transition-colors ${
                      active ? "bg-accent-soft font-semibold text-accent ring-1 ring-accent-line" : "text-ink-2 hover:bg-surface-2 hover:text-ink"
                    }`}
                  >
                    {tier}
                    <span className={`block text-[11px] font-normal ${active ? "text-accent/80" : "text-ink-3"}`}>{hint}</span>
                  </button>
                );
              })}
            </div>
            <div className="mt-3">
              <Field label="Exact score (optional)" htmlFor="score" error={scoreInvalid ? "Enter a score from 300 to 850" : undefined} small>
                <input
                  id="score"
                  inputMode="numeric"
                  placeholder="e.g. 702"
                  value={scoreText}
                  onChange={(e) => {
                    setScoreText(e.target.value);
                    const n = Number(e.target.value);
                    updateBorrower({ creditScore: Number.isInteger(n) && n >= 300 && n <= 850 ? n : null });
                  }}
                  className={input(scoreInvalid)}
                />
              </Field>
            </div>
          </fieldset>
        </form>
        {newestUpdate && (
          <p className="mt-3 flex items-start gap-1.5 px-1 text-xs text-ink-3">
            <span aria-hidden>ⓘ</span>
            <span>
              {programs.length} lender programs · newest rate update {newestUpdate} ({daysSince(newestUpdate, now)} days ago)
            </span>
          </p>
        )}
      </aside>

      {/* ---------- Results ---------- */}
      <section aria-live="polite">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight text-ink">
              {filtering ? `${eligible.length} program${eligible.length === 1 ? "" : "s"} fit` : `All ${programs.length} programs`}
            </h2>
            <p className="mt-0.5 text-sm text-ink-2">
              {filtering ? describeBorrower(borrower) : "Enter borrower details to narrow the list."}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <label className="text-sm text-ink-3" htmlFor="sort">
              Sort
            </label>
            <select
              id="sort"
              value={sort}
              onChange={(e) => setState((s) => ({ ...s, sort: e.target.value as SortKey }))}
              className="rounded-lg border border-line-strong bg-surface-2 px-2 py-1.5 text-sm text-ink hover:border-ink-3"
            >
              {Object.entries(SORT_LABELS).map(([k, label]) => (
                <option key={k} value={k}>
                  {label}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={copySummary}
              disabled={!compared.length && !eligible.length}
              className={`${btn.secondary} whitespace-nowrap`}
            >
              Copy summary{compared.length ? ` (${compared.length})` : " (top 3)"}
            </button>
          </div>
        </div>

        {eligible.length === 0 && filtering && (
          <div role="status" className="mb-4 rounded-xl border border-warn-line bg-warn-soft p-4 text-warn">
            <p className="font-semibold">⚠ No programs fit this borrower right now.</p>
            {borrower.yearsInBusiness != null && borrower.yearsInBusiness < 1 ? (
              <p className="mt-1 text-sm text-ink-2">
                Every program in our network requires at least 1 year in business. Note the start date and follow up at the 1-year mark.
              </p>
            ) : (
              <p className="mt-1 text-sm text-ink-2">Check the near-misses below: often one detail (amount, credit) changes the picture.</p>
            )}
          </div>
        )}

        <div className="space-y-3">
          {eligible.map((r) => (
            <ProgramCard
              key={r.program.id}
              result={r}
              now={now}
              compared={compareIds.includes(r.program.id)}
              compareDisabled={compareIds.length >= MAX_COMPARE}
              onToggleCompare={() => toggleCompare(r.program.id)}
              recommendState={recommendStates[r.program.id]}
              onRecommend={() => recommend(r.program.id)}
            />
          ))}
        </div>

        {filtering && nearMisses.length > 0 && (
          <details className={`${card} group mt-6`} open={eligible.length === 0}>
            <summary className="flex cursor-pointer list-none items-center justify-between gap-2 rounded-xl px-4 py-3 hover:bg-surface-2 [&::-webkit-details-marker]:hidden">
              <span className="font-medium text-ink">
                Almost eligible <span className="text-ink-3">({nearMisses.length})</span>
                <span className="ml-2 text-sm font-normal text-ink-3">one requirement off</span>
              </span>
              <span aria-hidden className="text-ink-3 transition-transform group-open:rotate-180">⌄</span>
            </summary>
            <ul className="divide-y divide-line border-t border-line">
              {nearMisses.map((r) => (
                <li key={r.program.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 text-sm">
                  <div>
                    <span className="font-medium text-ink">{r.program.lenderName}</span>{" "}
                    <span className="text-ink-2">· {r.program.programType}</span>
                    <span className="tabular ml-2 text-ink-3">{formatRate(r.program.interestRateMin, r.program.interestRateMax)}</span>
                  </div>
                  <span className="rounded-md bg-danger-soft px-2 py-0.5 text-danger">✕ {r.failures[0]}</span>
                </li>
              ))}
            </ul>
          </details>
        )}
      </section>

      {/* ---------- Compare tray ---------- */}
      {compared.length > 0 && (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-line-strong bg-surface/90 shadow-[0_-8px_24px_rgba(0,0,0,0.4)] backdrop-blur">
          <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-3 px-4 py-3">
            <span className="text-sm font-medium text-ink">
              Comparing <span className="tabular text-accent">{compared.length}</span>
              <span className="text-ink-3">/{MAX_COMPARE}</span>
            </span>
            <ul className="flex flex-1 flex-wrap gap-2">
              {compared.map((p) => (
                <li key={p.id} className="flex max-w-full items-center gap-1 rounded-full border border-accent-line bg-accent-soft py-0.5 pr-1 pl-2.5 text-xs text-accent">
                  <span className="truncate">
                    {p.lenderName} <span className="text-accent/70">· {p.programType}</span>
                  </span>
                  <button type="button" aria-label={`Remove ${p.lenderName}`} onClick={() => toggleCompare(p.id)} className="ml-1 grid h-5 w-5 place-items-center rounded-full text-xs hover:bg-accent/20">
                    ✕
                  </button>
                </li>
              ))}
            </ul>
            <button type="button" onClick={() => copy(window.location.href, "Link copied. It opens this exact comparison.")} className={btn.secondary}>
              Copy share link
            </button>
            <button
              type="button"
              onClick={() => setCompareOpen(true)}
              disabled={compared.length < 2}
              title={compared.length < 2 ? "Select at least 2 programs" : undefined}
              className={btn.primary}
            >
              Compare side by side
            </button>
          </div>
        </div>
      )}

      {compareOpen && compared.length > 0 && (
        <ComparePanel programs={compared} now={now} onClose={() => setCompareOpen(false)} onRemove={toggleCompare} />
      )}

      {toast && (
        <div role="status" className="fixed bottom-20 left-1/2 z-50 -translate-x-1/2 rounded-lg border border-line-strong bg-surface-3 px-4 py-2 text-sm text-ink shadow-xl shadow-black/40">
          {toast}
        </div>
      )}
    </div>
  );
}

/** Clipboard API first; falls back to the legacy copy command for browsers/iframes that block it. */
async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const el = document.createElement("textarea");
    el.value = text;
    el.setAttribute("readonly", "");
    el.style.position = "fixed";
    el.style.opacity = "0";
    document.body.appendChild(el);
    el.select();
    try {
      return document.execCommand("copy");
    } catch {
      return false;
    } finally {
      el.remove();
    }
  }
}

function Field({
  label,
  htmlFor,
  hint,
  error,
  small,
  children,
}: {
  label: string;
  htmlFor: string;
  hint?: string;
  error?: string;
  small?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label htmlFor={htmlFor} className={small ? "mb-1 block text-xs font-medium text-ink-3" : labelClass}>
        {label}
      </label>
      {children}
      {error ? <p className="mt-1 text-xs text-danger">{error}</p> : hint ? <p className="mt-1 text-xs text-ink-3">{hint}</p> : null}
    </div>
  );
}
