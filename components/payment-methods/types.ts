/**
 * The school account an installment is transferred into.
 *
 * `isLopayEscrow` used to select a second mode here — the platform's own account,
 * for a manual first-payment "activation" transfer. That flow was removed from the
 * backend when first payments moved to the Paystack split, so the flag was pinned
 * false and every branch on it was dead. Only the school account remains.
 */
export interface BankDetails {
  accountName: string;
  bankName: string;
  accountNumber: string;
  institutionName: string;
}
