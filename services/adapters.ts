import {
  ApiEnrollment,
  ApiNotification,
  ApiPaymentStatus,
  ApiPendingPayment,
  ApiSchool,
  ApiTransaction,
  ApiUser,
  Child,
  Notification,
  School,
  Transaction,
  User,
  UserRole,
} from "../types";
import { logger } from "../utils/logger";
import { installmentCount } from "../utils/plan";

const toNumber = (value: unknown): number => {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : 0;
  }
  if (typeof value === "string" && value.trim() !== "") {
    const n = Number(value);
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
};

export const normalizeUser = (apiUser: ApiUser): User => {
  let role: UserRole = "parent";
  const rawRole = apiUser.role;
  const apiRole = (rawRole || "").trim().toLowerCase();

  if (
    apiRole === "owner" ||
    apiRole.includes("admin") ||
    apiRole === "superadmin" ||
    apiRole === "super_admin"
  ) {
    if (apiRole.includes("school")) {
      role = "school_owner";
    } else {
      role = "owner";
    }
  } else if (apiRole.includes("school") || apiRole === "owner") {
    role = "school_owner";
  }

  return {
    id: apiUser.id,
    email: apiUser.email,
    name: apiUser.fullName || apiUser.name || "Unknown User",
    role,
    phoneNumber: apiUser.phoneNumber,
    schoolId: apiUser.schoolId,
    createdAt: apiUser.createdAt,
    // Server-counted; carried through rather than derived. The admin directory
    // used to compute this from a roster it could not legally fetch.
    enrollmentCount: apiUser.enrollmentCount,
  };
};

/**
 * A UI status label → the API enum value the server filters on.
 *
 * The inverse of the status mapping in `normalizeTransaction` below. History
 * screens send this to the server instead of filtering a fetched page, because
 * the lists are paginated: a client-side filter searches only the current page
 * and renders the result as if it were the whole set.
 *
 * `Successful` maps to `SUCCESS` — the enum the backend actually stores. The
 * normalizer accepts several spellings on the way in, but only this one is a
 * valid filter value, and the server ignores anything it doesn't recognise
 * rather than returning an empty page that would read as "no transactions".
 */
export const API_PAYMENT_STATUS: Record<
  Exclude<Transaction["status"], never>,
  ApiPaymentStatus
> = {
  Successful: "SUCCESS",
  Pending: "PENDING",
  Failed: "FAILED",
  Reversed: "REVERSED",
};

export const normalizeTransaction = (
  apiTx: ApiTransaction | ApiPendingPayment,
): Transaction => {
  const amount = toNumber(apiTx.amount ?? apiTx.amountPaid);
  const platformFeeAmount = toNumber(
    apiTx.platformFeeAmount ?? apiTx.platformFee,
  );
  const rawPlatformFeePercentage =
    apiTx.platformFeePercentage ?? apiTx.platformFeeRate;

  let platformFeePercentage: number | undefined;

  if (
    rawPlatformFeePercentage !== undefined &&
    rawPlatformFeePercentage !== null
  ) {
    const numeric =
      typeof rawPlatformFeePercentage === "number"
        ? rawPlatformFeePercentage
        : toNumber(rawPlatformFeePercentage);

    if (numeric > 0) {
      platformFeePercentage = numeric >= 1 ? numeric / 100 : numeric;
    }
  }

  const upperStatus = (apiTx.status || "PENDING").toUpperCase();
  const isSuccess =
    upperStatus === "SUCCESS" ||
    upperStatus === "SUCCESSFUL" ||
    upperStatus === "PAID" ||
    upperStatus === "COMPLETED";
  const isFailed = upperStatus === "FAILED";
  // A reversed payment is neither pending nor failed — it succeeded and was then
  // undone (school reversal, or a Paystack dispute/refund). It used to fall through
  // to "Pending", so a parent who had just been told "Payment Reversed" saw the row
  // still processing.
  const isReversed = upperStatus === "REVERSED";

  return {
    id: apiTx.id,
    userId: "",
    childId: "",
    childName: apiTx.childName || apiTx.studentName || "Unknown Child",
    // Carried through so admin drill-downs can deep-link to the owning school;
    // without it the dashboard can only group by (ambiguous) school name.
    schoolId: apiTx.schoolId,
    schoolName: apiTx.schoolName || "Unknown School",
    amount,
    date: apiTx.date || apiTx.paymentDate || new Date().toISOString(),
    status: isSuccess
      ? "Successful"
      : isFailed
        ? "Failed"
        : isReversed
          ? "Reversed"
          : "Pending",
    receiptUrl: apiTx.receiptUrl,
    receiptSignedUrl: apiTx.receiptSignedUrl,
    type: apiTx.type || apiTx.paymentType,
    className: apiTx.className,
    platformFeeAmount:
      Number.isFinite(platformFeeAmount) && platformFeeAmount > 0
        ? platformFeeAmount
        : undefined,
    platformFeePercentage:
      typeof platformFeePercentage === "number" && platformFeePercentage > 0
        ? platformFeePercentage
        : undefined,
  };
};

export const normalizeChild = (apiEnrollment: ApiEnrollment): Child => {
  if (!apiEnrollment) {
    logger.error("normalizeChild called with null/undefined");
    return {} as Child;
  }

  const hasPaidField =
    apiEnrollment.paidAmount !== undefined &&
    apiEnrollment.paidAmount !== null;
  const paidFromField = hasPaidField ? toNumber(apiEnrollment.paidAmount) : 0;

  /*
   * Fallback only — the server sends `paidAmount`, summed over CONFIRMED
   * payments (see the backend's `enrollment-view.ts`).
   *
   * This sum used to include every payment row regardless of status, so on a
   * payload without the field a PENDING transfer counted as paid the moment it
   * was submitted, and a FAILED or REVERSED one stayed counted forever —
   * overstating what the parent had paid and understating what they owed.
   * Mirroring the server's rule keeps the two derivations in agreement.
   */
  const paidFromPayments = (apiEnrollment.payments || []).reduce((sum, p) => {
    const status = p.status ? String(p.status).toUpperCase() : "";
    const isConfirmed =
      typeof p.isConfirmed === "boolean" ? p.isConfirmed : undefined;
    // A reversal flips isConfirmed to false, which is the signal the server
    // itself uses; fall back to the status when the flag isn't on the payload.
    const counts =
      isConfirmed !== undefined
        ? isConfirmed
        : status === "SUCCESS" || status === "SUCCESSFUL" || status === "PAID";
    return counts ? sum + toNumber(p.amount ?? p.amountPaid) : sum;
  }, 0);

  const paidAmount = hasPaidField ? paidFromField : paidFromPayments;

  const childName =
    apiEnrollment.childName ||
    apiEnrollment.studentName ||
    apiEnrollment.child?.fullName ||
    "Unknown Child";

  if (!apiEnrollment.id && !apiEnrollment.childId && !apiEnrollment.child?.id) {
    logger.error("Missing ID in enrollment:", apiEnrollment);
  }

  /*
   * The enrollment's own remaining balance is authoritative — it is the number
   * the ledger decrements on every confirmed payment. Deriving
   * `totalFee - paidAmount` instead is lossy: paidAmount is the GROSS the parent
   * paid, and the 2.5% platform fee inside a first payment never reduced the
   * school-fee balance, so the derivation comes out short by that fee.
   *
   * So it is used only when the payload genuinely omits the field. A present-
   * but-zero balance is a real zero (a settled plan, or a defaulted enrollment
   * that was paid off) and must not be second-guessed.
   */
  const hasRemainingField =
    apiEnrollment.remainingBalance !== undefined &&
    apiEnrollment.remainingBalance !== null;

  let remainingBalance = hasRemainingField
    ? Math.max(0, toNumber(apiEnrollment.remainingBalance))
    : 0;

  const rawTotalFeeField = toNumber(apiEnrollment.totalFee ?? apiEnrollment.totalSchoolFee);

  if (!hasRemainingField && rawTotalFeeField > 0 && paidAmount >= 0) {
    const derivedRemaining = rawTotalFeeField - paidAmount;
    remainingBalance = derivedRemaining > 0 ? derivedRemaining : 0;
  }

  let totalFee = rawTotalFeeField;
  if (totalFee <= 0) {
    if (remainingBalance > 0 || paidAmount > 0) {
      totalFee = remainingBalance + paidAmount;
    } else {
      totalFee = 0;
    }
  }

  const payments = apiEnrollment.payments || [];

  const successfulInstallments = payments.filter((p) => {
    const type = (p.type || p.paymentType || "").toUpperCase();
    const status = p.status
      ? String(p.status).toUpperCase()
      : "";
    return type === "INSTALLMENT" && status === "SUCCESS";
  });

  const inferredInstallmentAmount =
    successfulInstallments.length > 0
      ? toNumber(
          successfulInstallments[successfulInstallments.length - 1].amount ??
            successfulInstallments[successfulInstallments.length - 1]
              .amountPaid,
        )
      : 0;

  /*
   * The next installment is the server's number.
   *
   * It is the money needed to close the next slot of the plan's schedule, which
   * the server derives from how much installment VALUE has been paid — so a
   * parent who paid five slots in one transfer is quoted the sixth slot, not the
   * balance re-spread over eleven. See the backend's
   * `common/installment-schedule.ts`.
   *
   * This adapter used to read `standardInstallmentAmount ?? installmentAmount` —
   * fields no enrollment endpoint returns — so the value was ALWAYS 0 and the
   * client silently fell back to its own guess: the previous installment's amount,
   * or `balance / planCount`. A parent one installment into a monthly plan was
   * quoted `balance / 3` on the "Pay School" button when the server would have
   * said `balance / 2`.
   *
   * The derivations stay only as a fallback for a payload that genuinely omits the
   * field (an older backend, or an admin list shaped differently).
   */
  const rawInstallmentAmountFromApi = toNumber(
    apiEnrollment.nextInstallmentAmount ??
      apiEnrollment.standardInstallmentAmount ??
      apiEnrollment.installmentAmount,
  );

  const defaultInstallmentCount = installmentCount(
    apiEnrollment.installmentFrequency,
  );

  let nextInstallmentAmount = 0;

  if (rawInstallmentAmountFromApi > 0) {
    nextInstallmentAmount = rawInstallmentAmountFromApi;
  } else if (inferredInstallmentAmount > 0) {
    nextInstallmentAmount = inferredInstallmentAmount;
  } else if (remainingBalance > 0 && defaultInstallmentCount > 0) {
    nextInstallmentAmount = remainingBalance / defaultInstallmentCount;
  }

  const hasPendingInstallment = payments.some((p) => {
    const type = (p.type || p.paymentType || "").toUpperCase();
    const status = p.status
      ? String(p.status).toUpperCase()
      : "";
    const isConfirmed =
      p.isConfirmed === true || p.isConfirmed === false
        ? p.isConfirmed
        : undefined;

    if (type !== "INSTALLMENT") {
      return false;
    }

    if (status === "PENDING") {
      return true;
    }

    if (
      status === "SUCCESS" &&
      typeof isConfirmed === "boolean" &&
      isConfirmed === false
    ) {
      return true;
    }

    return false;
  });

  const hasFailedFirstPayment = payments.some((p) => {
    const type = (p.type || p.paymentType || "").toUpperCase();
    const status = p.status
      ? String(p.status).toUpperCase()
      : "";

    return type === "FIRST_PAYMENT" && status === "FAILED";
  });

  const hasFailedInstallment = payments.some((p) => {
    const type = (p.type || p.paymentType || "").toUpperCase();
    const status = p.status
      ? String(p.status).toUpperCase()
      : "";

    return type === "INSTALLMENT" && status === "FAILED";
  });

  /*
   * A payment the school took back.
   *
   * REVERSED was the one ledger status with nowhere to surface on the parent's
   * plan card: the balance silently went back up (the server re-increments it
   * and reopens a COMPLETED plan to ACTIVE) while the card showed no reason why.
   * The parent is notified — "Payment Reversed" — so the plan they open next
   * must be able to say the same thing.
   */
  const hasReversedPayment = payments.some((p) => {
    const status = p.status ? String(p.status).toUpperCase() : "";
    return status === "REVERSED";
  });

  return {
    id: apiEnrollment.id || apiEnrollment.childId || apiEnrollment.child?.id || '',
    parentId: "",
    name: childName,
    school: apiEnrollment.schoolName || "Unknown School",
    grade:
      apiEnrollment.className || apiEnrollment.child?.className || "Unknown",
    totalFee,
    paidAmount,
    nextInstallmentAmount,
    nextDueDate: apiEnrollment.nextDueDate || "Pending",
    status: normalizeStatus(apiEnrollment.paymentStatus, remainingBalance),
    avatarUrl: `https://ui-avatars.com/api/?name=${encodeURIComponent(
      childName,
    )}&background=random`,
    remainingBalance,
    availableBalance:
      apiEnrollment.availableBalance !== undefined
        ? toNumber(apiEnrollment.availableBalance)
        : remainingBalance,
    schoolId: apiEnrollment.schoolId || "",
    installmentFrequency: apiEnrollment.installmentFrequency,
    installmentAmount: rawInstallmentAmountFromApi,
    // Schedule position, straight from the server. Absent on payloads that
    // predate it (admin lists, older backends), so both stay optional.
    installmentsPaid: toNumber(apiEnrollment.installmentsPaid),
    installmentsTotal:
      toNumber(apiEnrollment.installmentsTotal) || defaultInstallmentCount,
    creditTowardNextInstallment: toNumber(
      apiEnrollment.creditTowardNextInstallment,
    ),
    hasPendingInstallment,
    hasFailedFirstPayment,
    hasFailedInstallment,
    hasReversedPayment,
    payments,
  };
};

export const normalizeSchool = (apiSchool: ApiSchool): School => {
  return {
    id: apiSchool.id,
    name: apiSchool.name,
    ownerName: apiSchool.ownerName,
    address: apiSchool.address || "",
    email: apiSchool.email || "",
    phone: apiSchool.phone || "",
    bankName: apiSchool.bankName,
    accountName: apiSchool.accountName,
    accountNumber: apiSchool.accountNumber,
  };
};

// Derive a presentational status (drives the list icon + colour) from the
// notification title. The backend doesn't persist a status, and titles are
// produced by our own code, so keyword matching is reliable here.
const inferNotificationStatus = (
  title: string,
): "success" | "warning" | "error" | "info" => {
  const t = title.toLowerCase();
  if (/(fail|failed|reject|declin|unsuccessful|reversed)/.test(t)) return "error";
  if (/(default|overdue|due|reminder|pending)/.test(t)) return "warning";
  if (/(confirm|complet|received|success|activat|paid|settled)/.test(t))
    return "success";
  return "info";
};

/**
 * Map the backend's persisted `NotificationType` onto the filter tabs.
 *
 * This used to be hardcoded to "payment", which made the Announcements tab
 * permanently empty and filed platform broadcasts under Payments. Falls back to
 * "payment" for a row written before the type column existed — every notification
 * from that era was a money event on an enrollment.
 */
const normalizeNotificationType = (
  apiType: string | undefined,
): Notification["type"] => {
  switch ((apiType || "").toUpperCase()) {
    case "ANNOUNCEMENT":
      return "announcement";
    case "ALERT":
      return "alert";
    default:
      return "payment";
  }
};

export const normalizeNotification = (
  apiNotif: ApiNotification,
): Notification => {
  return {
    id: apiNotif.id,
    type: normalizeNotificationType(apiNotif.type),
    title: apiNotif.title,
    message: apiNotif.message,
    timestamp: apiNotif.createdAt,
    read: apiNotif.isRead,
    link: apiNotif.link,
    status: inferNotificationStatus(apiNotif.title),
  };
};

// Helper for status normalization
const normalizeStatus = (
  status: string | undefined,
  remainingBalance: number,
): "Active" | "Pending" | "Completed" | "Defaulted" | "Failed" => {
  const upperStatus = (status || "").toUpperCase();

  if (upperStatus === "PENDING" || !upperStatus) {
    return "Pending";
  }

  if (upperStatus === "ACTIVE") {
    return "Active";
  }

  if (upperStatus === "COMPLETED") {
    return "Completed";
  }

  if (upperStatus === "DEFAULTED") {
    return "Defaulted";
  }

  if (upperStatus === "FAILED") {
    return "Failed";
  }

  if (upperStatus === "REJECTED" || upperStatus === "DECLINED") {
    return "Failed";
  }

  if (remainingBalance <= 0) {
    return "Completed";
  }

  return "Pending";
};
