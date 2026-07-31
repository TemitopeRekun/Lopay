/**
 * Installment cadence, mirroring the backend's `src/common/fees.ts`.
 *
 * The counts were previously inlined as bare `12` / `3` in the dashboard retry
 * path and in the enrollment adapter. They decide the displayed installment
 * amount, so a drift between the two copies (or against the server) shows the
 * parent a figure they will not actually be charged.
 */
export const WEEKLY_INSTALLMENTS = 12;
export const MONTHLY_INSTALLMENTS = 3;

export type PlanType = "Weekly" | "Monthly";

/** Normalize the API's `installmentFrequency` ("WEEKLY" | "MONTHLY") for display. */
export const toPlanType = (frequency: string | undefined): PlanType =>
  String(frequency || "MONTHLY").trim().toUpperCase() === "WEEKLY"
    ? "Weekly"
    : "Monthly";

/** How many installments a plan of this cadence is spread over. */
export const installmentCount = (frequency: string | undefined): number =>
  toPlanType(frequency) === "Weekly"
    ? WEEKLY_INSTALLMENTS
    : MONTHLY_INSTALLMENTS;
