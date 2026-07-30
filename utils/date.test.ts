import { describe, it, expect } from "vitest";
import { calculateNextDueDate, formatDate } from "./date";

// Local-noon date strings so the calendar day never rolls over under the
// runner's timezone; en-GB short-month formatting is stable on full-ICU Node.
const START = "2026-06-15T12:00:00";

describe("calculateNextDueDate", () => {
  it("returns 'Pending' when no term start date is given", () => {
    expect(calculateNextDueDate(undefined, "MONTHLY", 0)).toBe("Pending");
  });

  it("returns 'Pending' when the term start date is unparseable", () => {
    expect(calculateNextDueDate("not-a-date", "MONTHLY", 1)).toBe("Pending");
  });

  it("returns the term start date itself when no payments have been made", () => {
    expect(calculateNextDueDate(START, "MONTHLY", 0)).toBe("15 Jun 2026");
  });

  it("adds one month per payment for MONTHLY plans", () => {
    expect(calculateNextDueDate(START, "MONTHLY", 2)).toBe("15 Aug 2026");
  });

  it("defaults to MONTHLY when the frequency is undefined", () => {
    expect(calculateNextDueDate(START, undefined, 1)).toBe("15 Jul 2026");
  });

  it("adds 7 days per payment for WEEKLY plans", () => {
    expect(calculateNextDueDate(START, "WEEKLY", 1)).toBe("22 Jun 2026");
  });

  it("is case-insensitive about the frequency", () => {
    expect(calculateNextDueDate(START, "weekly", 2)).toBe("29 Jun 2026");
  });

  it("adds 14 days per payment for BIWEEKLY plans", () => {
    expect(calculateNextDueDate(START, "BIWEEKLY", 1)).toBe("29 Jun 2026");
  });

  it("treats FORTNIGHTLY as a 14-day cadence too", () => {
    expect(calculateNextDueDate(START, "FORTNIGHTLY", 1)).toBe("29 Jun 2026");
  });
});

describe("formatDate", () => {
  it("returns '-' for an undefined date", () => {
    expect(formatDate(undefined)).toBe("-");
  });

  it("returns '-' for an unparseable date", () => {
    expect(formatDate("nonsense")).toBe("-");
  });

  it("formats a valid date as 'D Mon YYYY'", () => {
    expect(formatDate(START)).toBe("15 Jun 2026");
  });
});
