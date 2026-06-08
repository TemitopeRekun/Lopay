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
  accessCode: string,
): Promise<PaystackOutcome> =>
  new Promise((resolve, reject) => {
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
