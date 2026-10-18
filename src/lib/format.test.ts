import { describe, expect, it } from "vitest";
import { formatMoneyShort, formatYears, parseAmount } from "./format";

describe("parseAmount", () => {
  it.each([
    ["250000", 250_000],
    ["$250,000", 250_000],
    ["250k", 250_000],
    ["250K", 250_000],
    ["1.5m", 1_500_000],
    ["2 mil", 2_000_000],
    ["$ 75k", 75_000],
  ])("reads %s as %d", (input, expected) => expect(parseAmount(input)).toBe(expected));

  it.each(["", "abc", "12x", "0", "-5000"])("returns null for %j", (input) => expect(parseAmount(input)).toBeNull());
});

describe("formatMoneyShort", () => {
  it.each([
    [10_000, "$10k"],
    [250_000, "$250k"],
    [5_500_000, "$5.5M"],
    [5_000_000, "$5M"],
    [49_999, "$49,999"],
    [1_234_567, "$1,234,567"],
  ])("formats %d as %s", (value, expected) => expect(formatMoneyShort(value)).toBe(expected));
});

describe("formatYears", () => {
  it("uses months under a year", () => expect(formatYears(0.5)).toBe("6 mo"));
  it("pluralizes", () => {
    expect(formatYears(1)).toBe("1 yr");
    expect(formatYears(3)).toBe("3 yrs");
  });
});
