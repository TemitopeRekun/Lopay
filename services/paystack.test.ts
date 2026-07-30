import { describe, it, expect, beforeEach, vi } from "vitest";

// Mock the Paystack inline SDK. The default export is a constructor whose
// instance exposes `resumeTransaction(accessCode, handlers)`; the handlers drive
// the promise the wrapper returns.
const P = vi.hoisted(() => ({ resumeTransaction: vi.fn() }));
vi.mock("@paystack/inline-js", () => ({
  default: vi.fn(() => ({ resumeTransaction: P.resumeTransaction })),
}));

import { openPaystackPopup } from "./paystack";

describe("openPaystackPopup", () => {
  beforeEach(() => {
    P.resumeTransaction.mockReset();
  });

  it("resolves 'success' when the charge completes", async () => {
    P.resumeTransaction.mockImplementation((_code: string, h: any) =>
      h.onSuccess(),
    );
    await expect(openPaystackPopup("ACCESS_1")).resolves.toBe("success");
    expect(P.resumeTransaction).toHaveBeenCalledWith(
      "ACCESS_1",
      expect.any(Object),
    );
  });

  it("resolves 'cancelled' when the parent closes the modal", async () => {
    P.resumeTransaction.mockImplementation((_code: string, h: any) =>
      h.onCancel(),
    );
    await expect(openPaystackPopup("ACCESS_2")).resolves.toBe("cancelled");
  });

  it("rejects when the SDK reports an error", async () => {
    P.resumeTransaction.mockImplementation((_code: string, h: any) =>
      h.onError(new Error("charge failed")),
    );
    await expect(openPaystackPopup("ACCESS_3")).rejects.toThrow(
      "charge failed",
    );
  });

  it("rejects when opening the popup throws synchronously", async () => {
    P.resumeTransaction.mockImplementation(() => {
      throw new Error("popup broke");
    });
    await expect(openPaystackPopup("ACCESS_4")).rejects.toThrow("popup broke");
  });
});
