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
  } else if (apiRole.includes("student")) {
    role = "university_student";
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
    (apiTx as any).platformFeeAmount ?? (apiTx as any).platformFee,
  );
  const rawPlatformFeePercentage =
    (apiTx as any).platformFeePercentage ?? (apiTx as any).platformFeeRate;

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

  return {
    id: apiTx.id,
    userId: "",
    childId: "",
    childName: apiTx.childName || apiTx.studentName || "Unknown Child",
    schoolName: apiTx.schoolName || "Unknown School",
    amount,
    date: apiTx.date || apiTx.paymentDate || new Date().toISOString(),
    status: isSuccess ? "Successful" : isFailed ? "Failed" : "Pending",
    receiptUrl: apiTx.receiptUrl,
    receiptSignedUrl: (apiTx as any).receiptSignedUrl,
    type: apiTx.type || (apiTx as any).paymentType,
    className: (apiTx as any).className,
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
    console.error("normalizeChild called with null/undefined");
    return {} as Child;
  }

  const apiAny = apiEnrollment as any;

  const hasPaidField =
    apiAny.paidAmount !== undefined && apiAny.paidAmount !== null;
  const paidFromField = hasPaidField ? toNumber(apiAny.paidAmount) : 0;

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
    console.error("Missing ID in enrollment:", apiEnrollment);
  }

  let remainingBalance = toNumber(apiEnrollment.remainingBalance);

  const rawTotalFeeField = toNumber(apiAny.totalFee ?? apiAny.totalSchoolFee);

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
    const status = (p as any).status
      ? String((p as any).status).toUpperCase()
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

  const rawInstallmentAmountFromApi = toNumber(
    apiAny.standardInstallmentAmount ?? apiAny.installmentAmount,
  );

  const frequency = String(apiAny.installmentFrequency || "").toUpperCase();
  let defaultInstallmentCount = 3;
  if (frequency === "WEEKLY") {
    defaultInstallmentCount = 12;
  }

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
    const status = (p as any).status
      ? String((p as any).status).toUpperCase()
      : "";
    const isConfirmed =
      (p as any).isConfirmed === true || (p as any).isConfirmed === false
        ? (p as any).isConfirmed
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
    const status = (p as any).status
      ? String((p as any).status).toUpperCase()
      : "";

    return type === "FIRST_PAYMENT" && status === "FAILED";
  });

  const hasFailedInstallment = payments.some((p) => {
    const type = (p.type || p.paymentType || "").toUpperCase();
    const status = (p as any).status
      ? String((p as any).status).toUpperCase()
      : "";

    return type === "INSTALLMENT" && status === "FAILED";
  });

  return {
    id: apiEnrollment.id || apiEnrollment.childId || apiEnrollment.child?.id,
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
    schoolId: apiEnrollment.schoolId || "",
    installmentFrequency: apiAny.installmentFrequency,
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

export const normalizeNotification = (
  apiNotif: ApiNotification,
): Notification => {
  return {
    id: apiNotif.id,
    type: "alert", // Default, maybe infer from title?
    title: apiNotif.title,
    message: apiNotif.message,
    timestamp: apiNotif.createdAt,
    read: apiNotif.isRead,
    link: apiNotif.link,
    status: "info",
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
