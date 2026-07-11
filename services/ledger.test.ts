import { describe, it, expect } from "vitest";
import {
  getChildBalance,
  getChildProgress,
  getChildDisplayStatus,
} from "./ledger";
import type { Child } from "../types";

/**
 * Pure ledger/presentation helpers derived from a normalized Child. Every
 * balance-fallback and display-status branch is exercised directly.
 */

const child = (over: Partial<Child> = {}): Child =>
  ({
    id: "c1",
    parentId: "",
    name: "Kid",
    school: "St X",
    grade: "JSS1",
    totalFee: 1000,
    paidAmount: 400,
    nextInstallmentAmount: 200,
    nextDueDate: "Pending",
    status: "Active",
    avatarUrl: "",
    remainingBalance: 600,
    ...over,
  }) as Child;

describe("getChildBalance", () => {
  it("uses the explicit remainingBalance when it is a non-negative number", () => {
    expect(getChildBalance(child({ totalFee: 1000, paidAmount: 400, remainingBalance: 600 }))).toEqual({
      total: 1000,
      paid: 400,
      remaining: 600,
    });
  });

  it("derives remaining from total - paid when remainingBalance is absent", () => {
    expect(
      getChildBalance(child({ totalFee: 1000, paidAmount: 300, remainingBalance: undefined })),
    ).toEqual({ total: 1000, paid: 300, remaining: 700 });
  });

  it("derives remaining when remainingBalance is negative (ignored)", () => {
    const out = getChildBalance(
      child({ totalFee: 1000, paidAmount: 250, remainingBalance: -5 }),
    );
    expect(out.remaining).toBe(750);
  });

  it("clamps a negative derived remaining to 0", () => {
    const out = getChildBalance(
      child({ totalFee: 1000, paidAmount: 1500, remainingBalance: undefined }),
    );
    expect(out.remaining).toBe(0);
  });

  it("treats non-finite total/paid as 0", () => {
    const out = getChildBalance(
      child({ totalFee: NaN as any, paidAmount: NaN as any, remainingBalance: 500 }),
    );
    expect(out.paid).toBe(0);
    // total falls back to paid + remaining = 0 + 500
    expect(out.total).toBe(500);
    expect(out.remaining).toBe(500);
  });

  it("computes total as paid + remaining when total is not positive", () => {
    const out = getChildBalance(
      child({ totalFee: 0, paidAmount: 200, remainingBalance: 300 }),
    );
    expect(out.total).toBe(500);
  });
});

describe("getChildProgress", () => {
  it("computes the paid percentage of the total", () => {
    const out = getChildProgress(
      child({ totalFee: 1000, paidAmount: 250, remainingBalance: 750 }),
    );
    expect(out.percent).toBe(25);
    expect(out.status).toBe("Active");
  });

  it("caps the percentage at 100 when overpaid", () => {
    const out = getChildProgress(
      child({ totalFee: 1000, paidAmount: 1500, remainingBalance: 0 }),
    );
    expect(out.percent).toBe(100);
  });

  it("returns 0 percent when the total is 0", () => {
    const out = getChildProgress(
      child({ totalFee: 0, paidAmount: 0, remainingBalance: 0 }),
    );
    expect(out.percent).toBe(0);
  });
});

describe("getChildDisplayStatus", () => {
  it("returns 'Awaiting Approval' for a pending child with nothing paid", () => {
    expect(
      getChildDisplayStatus(
        child({ status: "Pending", paidAmount: 0, totalFee: 1000, remainingBalance: 1000 }),
      ),
    ).toBe("Awaiting Approval");
  });

  it("returns 'Not Active' for an inactive child with nothing paid", () => {
    expect(
      getChildDisplayStatus(
        child({ status: "Unknown" as any, paidAmount: 0, totalFee: 1000, remainingBalance: 1000 }),
      ),
    ).toBe("Not Active");
  });

  it("returns 'Completed' for a completed child", () => {
    expect(
      getChildDisplayStatus(child({ status: "Completed", paidAmount: 1000 })),
    ).toBe("Completed");
  });

  it("returns the raw status for a defaulted child", () => {
    expect(
      getChildDisplayStatus(child({ status: "Defaulted", paidAmount: 200 })),
    ).toBe("Defaulted");
  });

  it("returns the raw status for a failed child", () => {
    expect(
      getChildDisplayStatus(child({ status: "Failed", paidAmount: 200 })),
    ).toBe("Failed");
  });

  it("returns the raw status for an active child", () => {
    expect(
      getChildDisplayStatus(child({ status: "Active", paidAmount: 200 })),
    ).toBe("Active");
  });

  it("returns the raw status for a pending child that has paid something", () => {
    expect(
      getChildDisplayStatus(child({ status: "Pending", paidAmount: 200 })),
    ).toBe("Pending");
  });

  it("falls through to the raw status for an unknown status with payments", () => {
    expect(
      getChildDisplayStatus(child({ status: "Weird" as any, paidAmount: 200 })),
    ).toBe("Weird");
  });
});
