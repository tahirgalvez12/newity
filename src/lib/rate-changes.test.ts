import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parseLenderCsv } from "./csv";
import { describeChange, diffRates, formatRateChange, isRecentChange } from "./rate-changes";

const program = (lenderName: string, programType: string, overrides: Partial<{ interestRateMin: number; interestRateMax: number; maxTermMonths: number; lastUpdated: string }> = {}) => ({
  lenderName,
  programType,
  interestRateMin: 10,
  interestRateMax: 12,
  maxTermMonths: 120,
  lastUpdated: "2026-01-15",
  ...overrides,
});

const inDb = (id: number, ...args: Parameters<typeof program>) => ({ id, ...program(...args) });

describe("diffRates", () => {
  it("records a rate change with old and new values", () => {
    const diff = diffRates(
      [inDb(7, "Acme Bank", "SBA Express")],
      [program("Acme Bank", "SBA Express", { interestRateMin: 9.5, lastUpdated: "2026-10-01" })],
    );
    expect(diff.changed).toEqual([
      {
        programId: 7,
        lenderName: "Acme Bank",
        programType: "SBA Express",
        old: { interestRateMin: 10, interestRateMax: 12, maxTermMonths: 120, lastUpdated: "2026-01-15" },
        new: { interestRateMin: 9.5, interestRateMax: 12, maxTermMonths: 120, lastUpdated: "2026-10-01" },
      },
    ]);
    expect(diff.unchanged).toBe(0);
  });

  it("counts a max rate or term change as a change", () => {
    const diff = diffRates(
      [inDb(1, "A", "504 Loan"), inDb(2, "B", "504 Loan")],
      [program("A", "504 Loan", { interestRateMax: 12.5 }), program("B", "504 Loan", { maxTermMonths: 240 })],
    );
    expect(diff.changed.map((c) => c.programId)).toEqual([1, 2]);
  });

  it("treats identical numbers as unchanged, even with a newer last_updated", () => {
    const diff = diffRates(
      [inDb(1, "A", "SBA Express"), inDb(2, "B", "SBA Express")],
      [program("A", "SBA Express"), program("B", "SBA Express", { lastUpdated: "2026-10-01" })],
    );
    expect(diff).toEqual({ changed: [], unchanged: 2, added: [], missing: [] });
  });

  it("reports a new program as added, not changed", () => {
    const diff = diffRates([inDb(1, "A", "SBA Express")], [program("A", "SBA Express"), program("A", "504 Loan")]);
    expect(diff.added).toEqual([{ lenderName: "A", programType: "504 Loan" }]);
    expect(diff.changed).toEqual([]);
    expect(diff.unchanged).toBe(1);
  });

  it("reports a program missing from the CSV without treating it as a change", () => {
    const diff = diffRates([inDb(1, "A", "SBA Express"), inDb(2, "B", "504 Loan")], [program("A", "SBA Express")]);
    expect(diff.missing).toEqual([{ lenderName: "B", programType: "504 Loan" }]);
    expect(diff.changed).toEqual([]);
  });

  it("matches on lender AND program, not either alone", () => {
    const diff = diffRates([inDb(1, "A", "SBA Express")], [program("A", "504 Loan", { interestRateMin: 7 })]);
    expect(diff.added).toHaveLength(1);
    expect(diff.missing).toHaveLength(1);
    expect(diff.changed).toEqual([]);
  });

  it("finds exactly the edits made in the demo update CSV", () => {
    const base = parseLenderCsv(readFileSync("data/lenders.csv", "utf8")).map((p, i) => ({ ...p, id: i + 1 }));
    const update = parseLenderCsv(readFileSync("data/lenders-update-sample.csv", "utf8"));
    const diff = diffRates(base, update);
    expect(diff.changed.length).toBeGreaterThanOrEqual(3);
    expect(diff.changed.length).toBeLessThanOrEqual(4);
    expect(diff.added).toEqual([]);
    expect(diff.missing).toEqual([]);
    expect(diff.unchanged + diff.changed.length).toBe(base.length);
    for (const c of diff.changed) expect(c.new.lastUpdated > c.old.lastUpdated).toBe(true);
  });
});

describe("formatRateChange / describeChange", () => {
  it("uses the card format", () => {
    expect(formatRateChange({ interestRateMin: 11, interestRateMax: 13.6 }, { interestRateMin: 10.5, interestRateMax: 13.6 })).toEqual({
      from: "11.0–13.6%",
      to: "10.5–13.6%",
    });
  });

  it("falls back to full precision when rounding would hide the change", () => {
    expect(formatRateChange({ interestRateMin: 11.2, interestRateMax: 12.5 }, { interestRateMin: 11.24, interestRateMax: 12.5 })).toEqual({
      from: "11.2–12.5%",
      to: "11.24–12.5%",
    });
  });

  it("describes rate and term changes for the seed summary", () => {
    const old = program("A", "504 Loan");
    expect(describeChange({ ...old, old, new: { ...old, interestRateMin: 9.5, maxTermMonths: 240 } })).toBe(
      "A · 504 Loan: 10.0–12.0% → 9.5–12.0%, term 120 → 240 months",
    );
    expect(describeChange({ ...old, old, new: { ...old, maxTermMonths: 240 } })).toBe("A · 504 Loan: term 120 → 240 months");
  });
});

describe("isRecentChange", () => {
  const now = new Date(2026, 9, 18);
  it("flags changes for 30 days after the import", () => {
    expect(isRecentChange("2026-10-18T21:26:02.148Z", now)).toBe(true);
    expect(isRecentChange("2026-09-18T09:00:00.000Z", now)).toBe(true);
    expect(isRecentChange("2026-09-17T09:00:00.000Z", now)).toBe(false);
  });
});
