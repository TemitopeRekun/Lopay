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

/**
 * When a plan starting on `start` finishes, for DISPLAY only.
 *
 * Mirrors the server's `derivePlanEnd` (`enrollment-invites/invite-policy.ts`),
 * which is what actually writes `ChildEnrollment.termEndDate`. The school does
 * not choose this value: it is the cliff `DefaulterDetectionService` and
 * `computeArrears` both read, and the instalment counts are fixed, so it is
 * always exactly the cadence's span.
 *
 * It lives here rather than inside the screen that shows it because it was
 * inlined there first, and an inlined copy of a rule the server owns is how the
 * two drift — which is the whole reason `installmentCount` above exists. Any
 * screen that needs to show a plan's end should call this.
 *
 * Returns the `yyyy-mm-dd` a date input wants, in the viewer's own timezone.
 */
export const planEndFor = (
  start: string,
  frequency: string | undefined,
): string => {
  const date = new Date(`${start}T00:00:00`);
  if (Number.isNaN(date.getTime())) return "";

  if (toPlanType(frequency) === "Weekly") {
    date.setDate(date.getDate() + WEEKLY_INSTALLMENTS * 7);
  } else {
    // Clamp to the last day of the target month rather than rolling into the
    // next one, exactly as the server's `installmentDueDate` does: 31 January
    // plus three months is 30 April, not 1 May.
    const targetDay = date.getDate();
    date.setDate(1);
    date.setMonth(date.getMonth() + MONTHLY_INSTALLMENTS);
    const lastDayOfTargetMonth = new Date(
      date.getFullYear(),
      date.getMonth() + 1,
      0,
    ).getDate();
    date.setDate(Math.min(targetDay, lastDayOfTargetMonth));
  }

  return toDateInputValue(date);
};

/** A `Date` as the `yyyy-mm-dd` a date input wants, in the viewer's timezone. */
export const toDateInputValue = (date: Date): string => {
  const offsetMs = date.getTimezoneOffset() * 60 * 1000;
  return new Date(date.getTime() - offsetMs).toISOString().slice(0, 10);
};

/** Today, as the `yyyy-mm-dd` a date input wants. */
export const todayInputValue = (): string => toDateInputValue(new Date());
