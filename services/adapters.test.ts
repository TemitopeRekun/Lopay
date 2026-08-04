import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  normalizeUser,
  normalizeTransaction,
  normalizeChild,
  normalizeSchool,
  normalizeNotification,
} from "./adapters";
import type {
  ApiUser,
  ApiTransaction,
  ApiPendingPayment,
  ApiEnrollment,
  ApiPayment,
  ApiSchool,
  ApiNotification,
} from "../types";

/**
 * Pure request/response transform coverage. These functions map backend DTOs to
 * frontend domain types; the branch-heavy fallback/alias logic is the biggest
 * easy coverage win, so every alias and status branch is exercised here.
 */

const baseUser = (over: Partial<ApiUser> = {}): ApiUser => ({
  id: "u1",
  email: "a@b.com",
  role: "PARENT",
  createdAt: "2026-01-01T00:00:00Z",
  ...over,
});

describe("normalizeUser", () => {
  it("defaults an unknown/parent role to 'parent' and maps fullName", () => {
    const out = normalizeUser(baseUser({ role: "PARENT", fullName: "Jane" }));
    expect(out).toEqual({
      id: "u1",
      email: "a@b.com",
      name: "Jane",
      role: "parent",
      phoneNumber: undefined,
      schoolId: undefined,
      createdAt: "2026-01-01T00:00:00Z",
    });
  });

  it("maps 'owner' to 'owner'", () => {
    expect(normalizeUser(baseUser({ role: "owner" })).role).toBe("owner");
  });

  it("maps a plain admin role to 'owner'", () => {
    expect(normalizeUser(baseUser({ role: "ADMIN" })).role).toBe("owner");
  });

  it("maps 'superadmin' and 'super_admin' to 'owner'", () => {
    expect(normalizeUser(baseUser({ role: "superadmin" })).role).toBe("owner");
    expect(normalizeUser(baseUser({ role: "super_admin" })).role).toBe("owner");
  });

  it("maps an admin role containing 'school' to 'school_owner'", () => {
    expect(normalizeUser(baseUser({ role: "SCHOOL_ADMIN" })).role).toBe(
      "school_owner",
    );
  });

  it("maps a 'school' (non-admin) role to 'school_owner'", () => {
    expect(normalizeUser(baseUser({ role: "SCHOOL_OWNER" })).role).toBe(
      "school_owner",
    );
  });

  it("falls back to name, then 'Unknown User', when fullName is absent", () => {
    expect(normalizeUser(baseUser({ fullName: undefined, name: "Bob" })).name).toBe(
      "Bob",
    );
    expect(
      normalizeUser(baseUser({ fullName: undefined, name: undefined })).name,
    ).toBe("Unknown User");
  });

  it("passes through phoneNumber and schoolId", () => {
    const out = normalizeUser(
      baseUser({ phoneNumber: "0803", schoolId: "s9" }),
    );
    expect(out.phoneNumber).toBe("0803");
    expect(out.schoolId).toBe("s9");
  });

  it("handles a null/empty raw role as 'parent'", () => {
    expect(normalizeUser(baseUser({ role: "" })).role).toBe("parent");
    expect(normalizeUser(baseUser({ role: undefined as any })).role).toBe(
      "parent",
    );
  });
});

const baseTx = (over: Partial<ApiTransaction> = {}): ApiTransaction =>
  ({
    id: "t1",
    amount: 1000,
    status: "SUCCESS",
    ...over,
  }) as ApiTransaction;

describe("normalizeTransaction", () => {
  it("maps a successful transaction with core fields", () => {
    const out = normalizeTransaction(
      baseTx({
        childName: "Kid",
        schoolName: "St X",
        date: "2026-02-02",
        type: "INSTALLMENT",
        className: "JSS1",
        receiptUrl: "r",
        receiptSignedUrl: "rs",
      }),
    );
    expect(out.id).toBe("t1");
    expect(out.userId).toBe("");
    expect(out.childId).toBe("");
    expect(out.amount).toBe(1000);
    expect(out.status).toBe("Successful");
    expect(out.childName).toBe("Kid");
    expect(out.schoolName).toBe("St X");
    expect(out.date).toBe("2026-02-02");
    expect(out.type).toBe("INSTALLMENT");
    expect(out.className).toBe("JSS1");
    expect(out.receiptUrl).toBe("r");
    expect(out.receiptSignedUrl).toBe("rs");
  });

  it("carries schoolId through so admin rows can deep-link", () => {
    // Dropped before: the owner dashboard grouped pending first payments by
    // school but had no id to navigate with, leaving each row a dead button.
    const out = normalizeTransaction(baseTx({ schoolId: "sch-1" }));
    expect(out.schoolId).toBe("sch-1");
  });

  it("leaves schoolId undefined when the endpoint omits it", () => {
    const out = normalizeTransaction(baseTx({}));
    expect(out.schoolId).toBeUndefined();
  });

  it("uses amountPaid when amount is absent (pending-payment shape)", () => {
    const pending = {
      id: "p1",
      amountPaid: 750,
      status: "PENDING",
    } as unknown as ApiPendingPayment;
    const out = normalizeTransaction(pending);
    expect(out.amount).toBe(750);
    expect(out.status).toBe("Pending");
  });

  it("parses a numeric string amount and returns 0 for non-numeric", () => {
    expect(normalizeTransaction(baseTx({ amount: "1500" as any })).amount).toBe(
      1500,
    );
    expect(normalizeTransaction(baseTx({ amount: "abc" as any })).amount).toBe(0);
  });

  it("maps every success-like status to 'Successful'", () => {
    for (const s of ["SUCCESS", "successful", "paid", "Completed"]) {
      expect(normalizeTransaction(baseTx({ status: s })).status).toBe(
        "Successful",
      );
    }
  });

  it("maps REVERSED to its own status, not 'Pending'", () => {
    // A reversed payment arrived, was confirmed, and was then undone. It used to
    // fall through to "Pending", so a parent who had just received a
    // "Payment Reversed" notification saw the row still processing.
    expect(normalizeTransaction(baseTx({ status: "REVERSED" })).status).toBe(
      "Reversed",
    );
    expect(normalizeTransaction(baseTx({ status: "reversed" })).status).toBe(
      "Reversed",
    );
  });

  it("maps FAILED to 'Failed' and defaults missing status to 'Pending'", () => {
    expect(normalizeTransaction(baseTx({ status: "FAILED" })).status).toBe(
      "Failed",
    );
    expect(
      normalizeTransaction(baseTx({ status: undefined as any })).status,
    ).toBe("Pending");
  });

  it("falls back to studentName then 'Unknown Child' / 'Unknown School'", () => {
    const out = normalizeTransaction(
      baseTx({ childName: undefined, studentName: "Sam" }),
    );
    expect(out.childName).toBe("Sam");
    const out2 = normalizeTransaction(
      baseTx({ childName: undefined, studentName: undefined }),
    );
    expect(out2.childName).toBe("Unknown Child");
    expect(out2.schoolName).toBe("Unknown School");
  });

  it("falls back to paymentDate then a generated ISO date", () => {
    expect(
      normalizeTransaction(baseTx({ date: undefined, paymentDate: "2026-03-03" }))
        .date,
    ).toBe("2026-03-03");
    const out = normalizeTransaction(
      baseTx({ date: undefined, paymentDate: undefined }),
    );
    expect(typeof out.date).toBe("string");
    expect(out.date.length).toBeGreaterThan(0);
  });

  it("falls back to paymentType for the type field", () => {
    expect(
      normalizeTransaction(baseTx({ type: undefined, paymentType: "FIRST_PAYMENT" }))
        .type,
    ).toBe("FIRST_PAYMENT");
  });

  it("uses platformFee/platformFeeRate aliases", () => {
    const out = normalizeTransaction(
      baseTx({ platformFee: 50, platformFeeRate: 3 as any }),
    );
    expect(out.platformFeeAmount).toBe(50);
    expect(out.platformFeePercentage).toBe(0.03);
  });

  it("normalises a percentage >= 1 by dividing by 100", () => {
    expect(
      normalizeTransaction(baseTx({ platformFeePercentage: 2.5 })).platformFeePercentage,
    ).toBe(0.025);
  });

  it("keeps a fractional percentage (< 1) as-is", () => {
    expect(
      normalizeTransaction(baseTx({ platformFeePercentage: 0.04 })).platformFeePercentage,
    ).toBe(0.04);
  });

  it("parses a string percentage via toNumber", () => {
    expect(
      normalizeTransaction(baseTx({ platformFeePercentage: "5" as any }))
        .platformFeePercentage,
    ).toBe(0.05);
  });

  it("omits zero/negative fee amount and percentage", () => {
    const out = normalizeTransaction(
      baseTx({ platformFeeAmount: 0, platformFeePercentage: 0 }),
    );
    expect(out.platformFeeAmount).toBeUndefined();
    expect(out.platformFeePercentage).toBeUndefined();
  });

  it("omits percentage when both alias fields are null/undefined", () => {
    const out = normalizeTransaction(
      baseTx({
        platformFeePercentage: null as any,
        platformFeeRate: undefined,
      }),
    );
    expect(out.platformFeePercentage).toBeUndefined();
  });
});

const payment = (over: Partial<ApiPayment> = {}): ApiPayment =>
  ({
    amount: 0,
    ...over,
  }) as ApiPayment;

const baseEnrollment = (over: Partial<ApiEnrollment> = {}): ApiEnrollment =>
  ({
    id: "e1",
    className: "JSS1",
    remainingBalance: 0,
    ...over,
  }) as ApiEnrollment;

describe("normalizeChild", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("returns an empty object and logs when given null", () => {
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(normalizeChild(null as any)).toEqual({});
    expect(err).toHaveBeenCalled();
  });

  it("uses the explicit paidAmount field when present", () => {
    const out = normalizeChild(
      baseEnrollment({ paidAmount: 300, totalFee: 1000, remainingBalance: 700 }),
    );
    expect(out.paidAmount).toBe(300);
    expect(out.totalFee).toBe(1000);
    expect(out.remainingBalance).toBe(700);
  });

  it("derives paidAmount from confirmed payments when the field is absent", () => {
    const out = normalizeChild(
      baseEnrollment({
        payments: [
          payment({ amount: 100, isConfirmed: true } as any),
          payment({
            amount: undefined as any,
            amountPaid: 250,
            isConfirmed: true,
          } as any),
        ],
      }),
    );
    expect(out.paidAmount).toBe(350);
  });

  /*
   * The fallback mirrors the server's rule (confirmed payments only — see the
   * backend's `enrollment-view.ts`). It used to sum every row whatever its
   * status, so a submitted-but-unapproved transfer counted as paid the moment
   * it was made, and a failed or reversed one stayed counted for good —
   * overstating what the parent had paid and understating what they owed.
   */
  it("excludes pending, failed and reversed payments from the fallback", () => {
    const out = normalizeChild(
      baseEnrollment({
        payments: [
          payment({ amount: 100, status: "SUCCESS", isConfirmed: true } as any),
          payment({ amount: 500, status: "PENDING", isConfirmed: false } as any),
          payment({ amount: 700, status: "FAILED", isConfirmed: false } as any),
          // A reversal flips isConfirmed back to false.
          payment({ amount: 900, status: "REVERSED", isConfirmed: false } as any),
        ],
      }),
    );
    expect(out.paidAmount).toBe(100);
  });

  it("falls back to the status when isConfirmed is absent", () => {
    const out = normalizeChild(
      baseEnrollment({
        payments: [
          payment({ amount: 100, status: "SUCCESS" } as any),
          payment({ amount: 250, status: "REVERSED" } as any),
        ],
      }),
    );
    expect(out.paidAmount).toBe(100);
  });

  /* A reversal must be visible on the plan card — the balance goes back up. */
  it("flags a reversed payment on the plan", () => {
    const out = normalizeChild(
      baseEnrollment({
        payments: [payment({ amount: 100, status: "REVERSED" } as any)],
      }),
    );
    expect(out.hasReversedPayment).toBe(true);
  });

  it("does not flag a reversal on a plan without one", () => {
    const out = normalizeChild(
      baseEnrollment({
        payments: [payment({ amount: 100, status: "SUCCESS" } as any)],
      }),
    );
    expect(out.hasReversedPayment).toBe(false);
  });

  /*
   * The enrollment's balance is the ledger's own number. Deriving
   * `totalFee - paidAmount` is short by the platform fee inside the first
   * payment (paidAmount is the gross the parent paid), so the derivation is a
   * fallback for a payload that omits the field — not a correction to a zero
   * the server actually sent.
   */
  it("derives remainingBalance only when the field is absent", () => {
    const out = normalizeChild(
      baseEnrollment({
        totalFee: 1000,
        paidAmount: 300,
        remainingBalance: undefined,
      }),
    );
    expect(out.remainingBalance).toBe(700);
  });

  it("honours an explicit zero balance instead of re-deriving one", () => {
    const out = normalizeChild(
      baseEnrollment({ totalFee: 1000, paidAmount: 300, remainingBalance: 0 }),
    );
    expect(out.remainingBalance).toBe(0);
  });

  it("keeps a server balance that the naive derivation would understate", () => {
    // ₦100,000 fee; ₦27,500 gross deposit (₦2,500 of it platform fee) plus a
    // ₦25,000 installment. Derivation says ₦47,500; the ledger says ₦50,000.
    const out = normalizeChild(
      baseEnrollment({
        totalFee: 100000,
        paidAmount: 52500,
        remainingBalance: 50000,
      }),
    );
    expect(out.remainingBalance).toBe(50000);
  });

  it("clamps a negative derived remaining balance to 0", () => {
    const out = normalizeChild(
      baseEnrollment({
        totalFee: 1000,
        paidAmount: 1200,
        remainingBalance: undefined,
      }),
    );
    expect(out.remainingBalance).toBe(0);
  });

  it("clamps a negative server balance to 0", () => {
    const out = normalizeChild(
      baseEnrollment({ totalFee: 1000, paidAmount: 1200, remainingBalance: -50 }),
    );
    expect(out.remainingBalance).toBe(0);
  });

  it("derives totalFee from remaining + paid when no total field is given", () => {
    const out = normalizeChild(
      baseEnrollment({ remainingBalance: 600, paidAmount: 400 }),
    );
    expect(out.totalFee).toBe(1000);
  });

  it("leaves totalFee at 0 when nothing is known", () => {
    const out = normalizeChild(
      baseEnrollment({ remainingBalance: 0, paidAmount: 0 }),
    );
    expect(out.totalFee).toBe(0);
  });

  it("uses totalSchoolFee as an alias for totalFee", () => {
    const out = normalizeChild(
      baseEnrollment({ totalSchoolFee: 800, paidAmount: 0, remainingBalance: 800 }),
    );
    expect(out.totalFee).toBe(800);
  });

  it("resolves the child name from childName/studentName/child.fullName", () => {
    expect(normalizeChild(baseEnrollment({ childName: "A" })).name).toBe("A");
    expect(
      normalizeChild(baseEnrollment({ childName: undefined, studentName: "B" }))
        .name,
    ).toBe("B");
    expect(
      normalizeChild(
        baseEnrollment({
          childName: undefined,
          studentName: undefined,
          child: { id: "c1", fullName: "C", className: "JSS2" },
        }),
      ).name,
    ).toBe("C");
    expect(
      normalizeChild(baseEnrollment({ childName: undefined })).name,
    ).toBe("Unknown Child");
  });

  it("resolves the id from id/childId/child.id, else empty string", () => {
    expect(normalizeChild(baseEnrollment({ id: "e9" })).id).toBe("e9");
    expect(
      normalizeChild(baseEnrollment({ id: "", childId: "cid" })).id,
    ).toBe("cid");
    expect(
      normalizeChild(
        baseEnrollment({
          id: "",
          childId: undefined,
          child: { id: "kid", fullName: "x", className: "y" },
        }),
      ).id,
    ).toBe("kid");
  });

  it("logs when no id can be resolved", () => {
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    normalizeChild(baseEnrollment({ id: "", childId: undefined, child: undefined }));
    expect(err).toHaveBeenCalled();
  });

  it("carries the server's schedule position through untouched", () => {
    // Five slots of a 12-week plan closed by one transfer. These figures are
    // derived server-side from payment VALUE; the client must not recount rows.
    const out = normalizeChild(
      baseEnrollment({
        installmentFrequency: "WEEKLY",
        nextInstallmentAmount: 1000,
        installmentsPaid: 5,
        installmentsTotal: 12,
        creditTowardNextInstallment: 250,
      }),
    );
    expect(out.installmentsPaid).toBe(5);
    expect(out.installmentsTotal).toBe(12);
    expect(out.creditTowardNextInstallment).toBe(250);
  });

  it("defaults the schedule position when an older payload omits it", () => {
    const out = normalizeChild(
      baseEnrollment({ installmentFrequency: "WEEKLY" }),
    );
    expect(out.installmentsPaid).toBe(0);
    expect(out.installmentsTotal).toBe(12); // cadence default, never 0
    expect(out.creditTowardNextInstallment).toBe(0);
  });

  it("uses the server's nextInstallmentAmount above every local derivation", () => {
    // The server quotes what closes the next slot of the schedule. This adapter
    // used to read only `standardInstallmentAmount`/`installmentAmount` — fields
    // no enrollment endpoint returns — and silently fell back to its own guess.
    const out = normalizeChild(
      baseEnrollment({
        nextInstallmentAmount: 450,
        remainingBalance: 900,
        installmentFrequency: "MONTHLY",
        payments: [
          payment({ type: "INSTALLMENT", status: "SUCCESS", amount: 300 }),
        ],
      }),
    );
    // Not 300 (last installment) and not 300 (900/3) — the server said 450.
    expect(out.nextInstallmentAmount).toBe(450);
  });

  it("uses the API installment amount when provided", () => {
    const out = normalizeChild(
      baseEnrollment({ standardInstallmentAmount: 400, remainingBalance: 1200 }),
    );
    expect(out.nextInstallmentAmount).toBe(400);
    expect(out.installmentAmount).toBe(400);
  });

  it("only derives locally when the server omits the figure", () => {
    const out = normalizeChild(
      baseEnrollment({
        nextInstallmentAmount: undefined,
        remainingBalance: 900,
        installmentFrequency: "MONTHLY",
      }),
    );
    expect(out.nextInstallmentAmount).toBe(300);
  });

  it("infers the installment amount from the last successful installment", () => {
    const out = normalizeChild(
      baseEnrollment({
        remainingBalance: 900,
        payments: [
          payment({ type: "INSTALLMENT", status: "SUCCESS", amount: 200 }),
          payment({ type: "INSTALLMENT", status: "SUCCESS", amount: 250 }),
        ],
      }),
    );
    expect(out.nextInstallmentAmount).toBe(250);
  });

  it("splits the remaining balance by 3 for a monthly/default plan", () => {
    const out = normalizeChild(
      baseEnrollment({ remainingBalance: 900, installmentFrequency: "MONTHLY" }),
    );
    expect(out.nextInstallmentAmount).toBe(300);
  });

  it("splits the remaining balance by 12 for a weekly plan", () => {
    const out = normalizeChild(
      baseEnrollment({ remainingBalance: 1200, installmentFrequency: "WEEKLY" }),
    );
    expect(out.nextInstallmentAmount).toBe(100);
  });

  it("flags a pending installment (PENDING status)", () => {
    const out = normalizeChild(
      baseEnrollment({
        payments: [payment({ type: "INSTALLMENT", status: "PENDING" })],
      }),
    );
    expect(out.hasPendingInstallment).toBe(true);
  });

  it("flags a pending installment (SUCCESS but unconfirmed)", () => {
    const out = normalizeChild(
      baseEnrollment({
        payments: [
          payment({ type: "INSTALLMENT", status: "SUCCESS", isConfirmed: false }),
        ],
      }),
    );
    expect(out.hasPendingInstallment).toBe(true);
  });

  it("does not flag pending when the installment is confirmed", () => {
    const out = normalizeChild(
      baseEnrollment({
        payments: [
          payment({
            type: "INSTALLMENT",
            status: "SUCCESS",
            isConfirmed: true,
            amount: 100,
          }),
        ],
      }),
    );
    expect(out.hasPendingInstallment).toBe(false);
  });

  it("ignores non-installment payments for the pending flag", () => {
    const out = normalizeChild(
      baseEnrollment({
        payments: [payment({ type: "FIRST_PAYMENT", status: "PENDING" })],
      }),
    );
    expect(out.hasPendingInstallment).toBe(false);
  });

  it("flags a failed first payment and a failed installment", () => {
    const out = normalizeChild(
      baseEnrollment({
        payments: [
          payment({ type: "FIRST_PAYMENT", status: "FAILED" }),
          payment({ type: "INSTALLMENT", status: "FAILED" }),
        ],
      }),
    );
    expect(out.hasFailedFirstPayment).toBe(true);
    expect(out.hasFailedInstallment).toBe(true);
  });

  it("uses paymentType as an alias for the payment type filters", () => {
    const out = normalizeChild(
      baseEnrollment({
        payments: [
          payment({ paymentType: "INSTALLMENT", status: "PENDING" } as any),
        ],
      }),
    );
    expect(out.hasPendingInstallment).toBe(true);
  });

  it("fills the remaining domain fields and avatar url", () => {
    const out = normalizeChild(
      baseEnrollment({
        schoolName: "St Y",
        className: "JSS3",
        schoolId: "s1",
        nextDueDate: "2026-05-05",
        installmentFrequency: "MONTHLY",
        childName: "Ada",
      }),
    );
    expect(out.school).toBe("St Y");
    expect(out.grade).toBe("JSS3");
    expect(out.schoolId).toBe("s1");
    expect(out.nextDueDate).toBe("2026-05-05");
    expect(out.parentId).toBe("");
    expect(out.avatarUrl).toContain("ui-avatars.com");
    expect(out.avatarUrl).toContain("Ada");
  });

  it("defaults school, grade and nextDueDate when absent", () => {
    const out = normalizeChild(
      baseEnrollment({ schoolName: undefined, nextDueDate: undefined }),
    );
    expect(out.school).toBe("Unknown School");
    expect(out.grade).toBe("JSS1");
    expect(out.nextDueDate).toBe("Pending");
    expect(out.schoolId).toBe("");
  });

  it("uses child.className when className is absent", () => {
    const out = normalizeChild(
      baseEnrollment({
        className: undefined as any,
        child: { id: "c", fullName: "n", className: "PRY2" },
      }),
    );
    expect(out.grade).toBe("PRY2");
  });

  // --- normalizeStatus branches (reached via paymentStatus) ---
  it("maps enrollment payment statuses through normalizeStatus", () => {
    const status = (paymentStatus: string, remainingBalance = 5) =>
      normalizeChild(baseEnrollment({ paymentStatus, remainingBalance })).status;
    expect(status("PENDING")).toBe("Pending");
    expect(status("ACTIVE")).toBe("Active");
    expect(status("COMPLETED")).toBe("Completed");
    expect(status("DEFAULTED")).toBe("Defaulted");
    expect(status("FAILED")).toBe("Failed");
    expect(status("REJECTED")).toBe("Failed");
    expect(status("DECLINED")).toBe("Failed");
  });

  it("treats a missing status as Pending", () => {
    expect(
      normalizeChild(baseEnrollment({ paymentStatus: undefined, remainingBalance: 5 }))
        .status,
    ).toBe("Pending");
  });

  it("marks an unknown status Completed when nothing is owed", () => {
    expect(
      normalizeChild(baseEnrollment({ paymentStatus: "UNKNOWN", remainingBalance: 0 }))
        .status,
    ).toBe("Completed");
  });

  it("marks an unknown status Pending when a balance remains", () => {
    expect(
      normalizeChild(baseEnrollment({ paymentStatus: "UNKNOWN", remainingBalance: 5 }))
        .status,
    ).toBe("Pending");
  });
});

describe("normalizeSchool", () => {
  const baseSchool = (over: Partial<ApiSchool> = {}): ApiSchool => ({
    id: "s1",
    name: "St X",
    ...over,
  });

  it("maps all fields when present", () => {
    const out = normalizeSchool(
      baseSchool({
        ownerName: "Owner",
        address: "1 Road",
        email: "s@x.com",
        phone: "0803",
        bankName: "GTB",
        accountName: "St X Ltd",
        accountNumber: "0011",
      }),
    );
    expect(out).toEqual({
      id: "s1",
      name: "St X",
      ownerName: "Owner",
      address: "1 Road",
      email: "s@x.com",
      phone: "0803",
      bankName: "GTB",
      accountName: "St X Ltd",
      accountNumber: "0011",
    });
  });

  it("defaults address/email/phone to empty strings when absent", () => {
    const out = normalizeSchool(baseSchool());
    expect(out.address).toBe("");
    expect(out.email).toBe("");
    expect(out.phone).toBe("");
    expect(out.ownerName).toBeUndefined();
  });
});

describe("normalizeNotification", () => {
  const baseNotif = (over: Partial<ApiNotification> = {}): ApiNotification => ({
    id: "n1",
    title: "Payment received",
    message: "hello",
    isRead: false,
    createdAt: "2026-06-06",
    ...over,
  });

  it("maps core fields", () => {
    const out = normalizeNotification(
      baseNotif({ link: "/x", isRead: true, type: "PAYMENT" }),
    );
    expect(out).toMatchObject({
      id: "n1",
      type: "payment",
      title: "Payment received",
      message: "hello",
      timestamp: "2026-06-06",
      read: true,
      link: "/x",
    });
  });

  it("carries a platform broadcast through as an announcement", () => {
    // This was hardcoded to "payment", which left the Announcements tab
    // permanently empty and filed broadcasts under Payments.
    expect(
      normalizeNotification(baseNotif({ type: "ANNOUNCEMENT" })).type,
    ).toBe("announcement");
  });

  it("carries a defaulted/dispute notice through as an alert", () => {
    expect(normalizeNotification(baseNotif({ type: "ALERT" })).type).toBe(
      "alert",
    );
  });

  it("is case-insensitive about the persisted kind", () => {
    expect(
      normalizeNotification(baseNotif({ type: "announcement" })).type,
    ).toBe("announcement");
  });

  it("treats a row with no type as a payment event", () => {
    // Rows written before the type column existed were all money events.
    expect(normalizeNotification(baseNotif({ type: undefined })).type).toBe(
      "payment",
    );
  });

  it("falls back to payment for a kind it does not recognise", () => {
    expect(normalizeNotification(baseNotif({ type: "SOMETHING_NEW" })).type).toBe(
      "payment",
    );
  });

  it("infers an error status from failure/reject keywords", () => {
    expect(normalizeNotification(baseNotif({ title: "Payment failed" })).status).toBe(
      "error",
    );
    expect(
      normalizeNotification(baseNotif({ title: "Enrollment rejected" })).status,
    ).toBe("error");
  });

  it("infers a warning status from due/reminder keywords", () => {
    expect(
      normalizeNotification(baseNotif({ title: "Installment due soon" })).status,
    ).toBe("warning");
  });

  it("infers a success status from confirm/paid keywords", () => {
    expect(
      normalizeNotification(baseNotif({ title: "Payment confirmed" })).status,
    ).toBe("success");
  });

  it("falls back to info for a neutral title", () => {
    expect(
      normalizeNotification(baseNotif({ title: "Welcome to Lopay" })).status,
    ).toBe("info");
  });
});
