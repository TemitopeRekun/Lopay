import { describe, it, expect, beforeEach, vi } from "vitest";

/**
 * Contract tests for the school-side money operations the Milestone 3 ledger
 * refactor sits behind. The backend moved this logic into LedgerService but the
 * HTTP contract is unchanged — these lock the FE half of that contract (the
 * exact endpoint + payload for confirm / decline / reverse / confirm-first) so a
 * drift on either side is caught. axios is mocked so no real request is made.
 */
const { post, get, patch } = vi.hoisted(() => ({
  post: vi.fn(),
  get: vi.fn(),
  patch: vi.fn(),
}));

vi.mock("axios", () => ({
  default: {
    create: () => ({
      post,
      get,
      patch,
      interceptors: {
        request: { use: vi.fn() },
        response: { use: vi.fn() },
      },
    }),
  },
}));

import { BackendAPI } from "./backend";

describe("BackendAPI.school — ledger operation contract", () => {
  beforeEach(() => {
    post.mockReset().mockResolvedValue({ data: { ok: true } });
    get.mockReset();
    patch.mockReset();
  });

  it("confirmPayment POSTs the paymentId to /school-payments/confirm", async () => {
    const result = await BackendAPI.school.confirmPayment("pay-1");
    expect(post).toHaveBeenCalledWith("/school-payments/confirm", {
      paymentId: "pay-1",
    });
    expect(result).toEqual({ ok: true });
  });

  it("declinePayment POSTs the paymentId to /school-payments/reject", async () => {
    await BackendAPI.school.declinePayment("pay-2");
    expect(post).toHaveBeenCalledWith("/school-payments/reject", {
      paymentId: "pay-2",
    });
  });

  it("reversePayment POSTs paymentId + reason to /school-payments/reverse", async () => {
    await BackendAPI.school.reversePayment("pay-3", "duplicate charge");
    expect(post).toHaveBeenCalledWith("/school-payments/reverse", {
      paymentId: "pay-3",
      reason: "duplicate charge",
    });
  });

  it("reversePayment sends an undefined reason when none is given", async () => {
    await BackendAPI.school.reversePayment("pay-4");
    expect(post).toHaveBeenCalledWith("/school-payments/reverse", {
      paymentId: "pay-4",
      reason: undefined,
    });
  });

  it("confirmFirstPayment POSTs the enrollmentId to /enrollments/confirm-first-payment", async () => {
    await BackendAPI.school.confirmFirstPayment("enr-1");
    expect(post).toHaveBeenCalledWith("/enrollments/confirm-first-payment", {
      enrollmentId: "enr-1",
    });
  });
});
