import { describe, it, expect } from "vitest";
import {
  MONTHLY_INSTALLMENTS,
  WEEKLY_INSTALLMENTS,
  installmentCount,
  planEndFor,
  toPlanType,
  todayInputValue,
} from "./plan";

describe("plan cadence constants", () => {
  // These mirror the backend's src/common/fees.ts. A drift shows the parent an
  // installment figure they will not be charged, so pin the values.
  it("matches the backend's installment counts", () => {
    expect(WEEKLY_INSTALLMENTS).toBe(12);
    expect(MONTHLY_INSTALLMENTS).toBe(3);
  });
});

describe("toPlanType", () => {
  it("maps the API's WEEKLY to a display label", () => {
    expect(toPlanType("WEEKLY")).toBe("Weekly");
  });

  it("is case- and whitespace-insensitive", () => {
    expect(toPlanType("  weekly ")).toBe("Weekly");
  });

  it("defaults to Monthly for anything else", () => {
    expect(toPlanType("MONTHLY")).toBe("Monthly");
    expect(toPlanType(undefined)).toBe("Monthly");
    expect(toPlanType("QUARTERLY")).toBe("Monthly");
  });
});

describe("installmentCount", () => {
  it("returns 12 for a weekly plan", () => {
    expect(installmentCount("WEEKLY")).toBe(WEEKLY_INSTALLMENTS);
  });

  it("returns 3 for a monthly plan", () => {
    expect(installmentCount("MONTHLY")).toBe(MONTHLY_INSTALLMENTS);
  });

  it("returns the monthly count when the frequency is missing", () => {
    expect(installmentCount(undefined)).toBe(MONTHLY_INSTALLMENTS);
  });
});

/**
 * `planEndFor` mirrors the server's `derivePlanEnd`. It is display-only, but a
 * display that disagrees with the value the server will write tells a school
 * the wrong date for when a family starts being treated as defaulting.
 */
describe("planEndFor", () => {
  it("adds the cadence's full span for a monthly plan", () => {
    // MONTHLY_INSTALLMENTS = 3, so the plan runs three months.
    expect(planEndFor("2026-09-19", "MONTHLY")).toBe("2026-12-19");
  });

  it("adds the cadence's full span for a weekly plan", () => {
    // WEEKLY_INSTALLMENTS = 12, so twelve weeks = 84 days.
    expect(planEndFor("2026-09-19", "WEEKLY")).toBe("2026-12-12");
  });

  it("clamps to the last day of the target month rather than rolling over", () => {
    // The server's `installmentDueDate` does this through setMonth guarding, and
    // a copy that rolls 31 January into 3 May quotes a date the plan will not
    // actually end on. February is the sharp case.
    expect(planEndFor("2026-01-31", "MONTHLY")).toBe("2026-04-30");
    expect(planEndFor("2025-11-30", "MONTHLY")).toBe("2026-02-28");
  });

  it("handles a leap February", () => {
    expect(planEndFor("2023-11-30", "MONTHLY")).toBe("2024-02-29");
  });

  it("treats an unknown cadence as monthly, like every other reader", () => {
    // `toPlanType` is the single fallback; an inline copy that defaulted the
    // other way would quote twelve weeks for a three-month plan.
    expect(planEndFor("2026-09-19", undefined)).toBe(
      planEndFor("2026-09-19", "MONTHLY"),
    );
    expect(planEndFor("2026-09-19", "nonsense")).toBe(
      planEndFor("2026-09-19", "MONTHLY"),
    );
  });

  it("returns an empty string for an unparseable date instead of Invalid Date", () => {
    // It feeds a date input's value; "Invalid Date" there is a rendering bug,
    // and `toISOString` on one throws outright.
    expect(planEndFor("not-a-date", "MONTHLY")).toBe("");
  });
});

describe("todayInputValue", () => {
  it("is the yyyy-mm-dd a date input accepts", () => {
    expect(todayInputValue()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("is today in the VIEWER's timezone, not UTC", () => {
    // A bare `toISOString().slice(0, 10)` is the previous day for anyone east
    // of UTC after their local midnight — which in Lagos (UTC+1) would make the
    // date input's `min` yesterday and let a school pick a back-dated start.
    const now = new Date();
    const local = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
    expect(todayInputValue()).toBe(local);
  });
});
