import { describe, it, expect } from "vitest";
import {
  calculateNextDueDate,
  formatDate,
  formatDateTime,
  formatRelativeTime,
} from "./date";

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

describe("formatRelativeTime", () => {
  const NOW = new Date("2026-06-15T12:00:00");
  const minutesAgo = (n: number) =>
    new Date(NOW.getTime() - n * 60_000).toISOString();

  it("never renders a raw ISO timestamp", () => {
    // The whole point: history, the dashboard log and the notification list used to
    // print `apiTx.date` / `createdAt` verbatim.
    const out = formatRelativeTime(minutesAgo(5), NOW);
    expect(out).not.toMatch(/T\d{2}:\d{2}/);
    expect(out).not.toContain("Z");
  });

  it("returns '-' for a missing or unparseable value", () => {
    expect(formatRelativeTime(undefined, NOW)).toBe("-");
    expect(formatRelativeTime("nonsense", NOW)).toBe("-");
  });

  it("reads 'Just now' under a minute", () => {
    expect(formatRelativeTime(minutesAgo(0), NOW)).toBe("Just now");
  });

  it("counts minutes within the hour", () => {
    expect(formatRelativeTime(minutesAgo(42), NOW)).toBe("42m ago");
  });

  it("counts hours within the day", () => {
    expect(formatRelativeTime(minutesAgo(5 * 60), NOW)).toBe("5h ago");
  });

  it("names yesterday rather than counting 24h", () => {
    expect(formatRelativeTime(minutesAgo(26 * 60), NOW)).toBe("Yesterday");
  });

  it("counts days within the week", () => {
    expect(formatRelativeTime(minutesAgo(3 * 24 * 60), NOW)).toBe("3d ago");
  });

  it("falls back to a calendar date past a week", () => {
    expect(formatRelativeTime("2026-05-02T12:00:00", NOW)).toBe("2 May");
  });

  it("includes the year once it differs from the current one", () => {
    expect(formatRelativeTime("2025-11-02T12:00:00", NOW)).toBe("2 Nov 2025");
  });

  it("does not render a negative age for a future-dated row", () => {
    // Clock skew between the server and the device must not produce "-43m ago".
    const future = new Date(NOW.getTime() + 60 * 60_000).toISOString();
    expect(formatRelativeTime(future, NOW)).toBe("Just now");
  });
});

describe("formatDateTime", () => {
  it("returns '-' for a missing or unparseable value", () => {
    expect(formatDateTime(undefined)).toBe("-");
    expect(formatDateTime("nonsense")).toBe("-");
  });

  it("includes both the date and the time of day", () => {
    const out = formatDateTime("2026-06-15T14:35:00");
    expect(out).toContain("15 Jun 2026");
    expect(out).toMatch(/14:35/);
  });
});
