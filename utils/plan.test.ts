import { describe, it, expect } from "vitest";
import {
  MONTHLY_INSTALLMENTS,
  WEEKLY_INSTALLMENTS,
  installmentCount,
  toPlanType,
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
