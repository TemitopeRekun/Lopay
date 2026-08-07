import PaystackPop from "@paystack/inline-js";

export type PaystackOutcome = "success" | "cancelled";

/**
 * Open the Paystack inline popup for a transaction already initialized on the
 * backend (we have its access code). Resolves "success" once the charge
 * completes, "cancelled" if the parent closes the modal; rejects on error.
 *
 * The backend webhook is the source of truth for activation — the caller should
 * still call verify() on success to reconcile immediately.
 */
export const openPaystackPopup = (
  accessCode: string | null | undefined,
): Promise<PaystackOutcome> =>
  new Promise((resolve, reject) => {
    /*
     * A transaction Paystack never accepted has no access code, and the backend
     * used to hand that null straight through here. The popup opened on nothing
     * and rendered Paystack's catch-all "we could not start this transaction —
     * enter a valid key", which sent us hunting for a key problem that did not
     * exist. Refuse to open at all and say what actually happened.
     */
    if (!accessCode) {
      reject(
        new Error(
          "This payment could not be started with Paystack. Please try again — if it keeps failing, your school's payout account may need attention.",
        ),
      );
      return;
    }

    try {
      const popup = new PaystackPop();
      popup.resumeTransaction(accessCode, {
        onSuccess: () => resolve("success"),
        onCancel: () => resolve("cancelled"),
        onError: (error) => reject(error),
      });
    } catch (error) {
      reject(error);
    }
  });
