import {
  ApiEnrollment,
  ApiNotification,
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
  };
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

  const paidFromPayments = (apiEnrollment.payments || []).reduce(
    (sum, p) => sum + toNumber(p.amount ?? p.amountPaid),
    0,
  );

  const paidAmount = hasPaidField ? paidFromField : paidFromPayments;

  const childName =
    apiEnrollment.childName ||
    apiEnrollment.studentName ||
    apiEnrollment.child?.fullName ||
    "Unknown Child";

  if (!apiEnrollment.id && !apiEnrollment.childId && !apiEnrollment.child?.id) {
    logger.error("Missing ID in enrollment:", apiEnrollment);
  }

  let remainingBalance = toNumber(apiEnrollment.remainingBalance);

  const rawTotalFeeField = toNumber(apiEnrollment.totalFee ?? apiEnrollment.totalSchoolFee);

  if (rawTotalFeeField > 0 && remainingBalance <= 0 && paidAmount >= 0) {
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
   * It spreads the remaining balance over the installments still outstanding
   * (`balance / (planCount - paidCount)`), so it shrinks as the plan progresses.
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
    hasPendingInstallment,
    hasFailedFirstPayment,
    hasFailedInstallment,
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
