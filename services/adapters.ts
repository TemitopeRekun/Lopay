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

export const normalizeUser = (apiUser: ApiUser): User => {
  // Determine role safely
  let role: UserRole = "parent";
  const rawRole = apiUser.role;
  const apiRole = (rawRole || "").trim().toLowerCase();

  console.log(
    `[normalizeUser] Input role: "${rawRole}", Normalized: "${apiRole}"`,
  );

  if (
    apiRole === "owner" ||
    apiRole.includes("admin") || // Covers admin, superadmin, super_admin, super admin
    apiRole === "superadmin" ||
    apiRole === "super_admin"
  ) {
    // Special check: ensure it's not school_admin (which contains admin)
    // But we check school first? No, we check strict owner/admin first.
    // Wait, school_admin contains admin.
    if (apiRole.includes("school")) {
      role = "school_owner";
    } else {
      role = "owner";
    }
  } else if (apiRole.includes("school") || apiRole === "owner") {
    // Covers school_owner, school_admin, school owner
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
  return {
    id: apiTx.id,
    userId: "", // Often not provided in this specific payload
    childId: "", // Often not provided
    childName: apiTx.childName || apiTx.studentName || "Unknown Child",
    schoolName: apiTx.schoolName || "Unknown School",
    amount: apiTx.amount || apiTx.amountPaid || 0,
    date: apiTx.date || apiTx.paymentDate || new Date().toISOString(),
    status:
      (apiTx.status || "PENDING").toUpperCase() === "SUCCESS"
        ? "Successful"
        : (apiTx.status || "PENDING").toUpperCase() === "FAILED"
          ? "Failed"
          : "Pending",
    receiptUrl: apiTx.receiptUrl,
    type: apiTx.type || (apiTx as any).paymentType, // Handle both
  };
};

export const normalizeChild = (apiEnrollment: ApiEnrollment): Child => {
  // Ensure we have a valid object
  if (!apiEnrollment) {
    console.error("normalizeChild called with null/undefined");
    return {} as Child;
  }

  // Calculate total paid amount
  const paidAmount = (apiEnrollment.payments || []).reduce(
    (sum, p) => sum + (p.amount || p.amountPaid || 0),
    0,
  );

  const childName =
    apiEnrollment.childName ||
    apiEnrollment.studentName ||
    apiEnrollment.child?.fullName ||
    "Unknown Child";

  // Log if critical fields are missing
  if (!apiEnrollment.id && !apiEnrollment.childId && !apiEnrollment.child?.id) {
    console.error("Missing ID in enrollment:", apiEnrollment);
  }

  return {
    id: apiEnrollment.id || apiEnrollment.childId || apiEnrollment.child?.id, // Fallback chain
    parentId: "", // Not returned by API usually
    name: childName,
    school: apiEnrollment.schoolName || "Unknown School",
    grade:
      apiEnrollment.className || apiEnrollment.child?.className || "Unknown",
    totalFee: 0, // Not provided in sample
    paidAmount: paidAmount,
    nextInstallmentAmount: 0, // Not provided in sample
    nextDueDate: apiEnrollment.nextDueDate || "Pending",
    status: normalizeStatus(
      apiEnrollment.paymentStatus,
      apiEnrollment.remainingBalance,
    ),
    avatarUrl: `https://ui-avatars.com/api/?name=${encodeURIComponent(
      childName,
    )}&background=random`,
    remainingBalance: apiEnrollment.remainingBalance || 0,
    schoolId: apiEnrollment.schoolId || "",
  };
};

export const normalizeSchool = (apiSchool: ApiSchool): School => {
  return {
    id: apiSchool.id,
    name: apiSchool.name,
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
  const upperStatus = (status || "PENDING").toUpperCase();

  if (
    upperStatus === "FAILED" ||
    upperStatus === "REJECTED" ||
    upperStatus === "DECLINED"
  ) {
    return "Failed";
  }

  if (
    upperStatus === "OVERDUE" ||
    upperStatus === "DEFAULTED" ||
    upperStatus === "OWING"
  ) {
    return "Defaulted";
  }

  if (upperStatus === "COMPLETED" || upperStatus === "PAID") {
    return "Completed";
  }

  if (remainingBalance <= 0) {
    return "Completed";
  }

  if (
    upperStatus === "ACTIVE" ||
    upperStatus === "ON TRACK" ||
    upperStatus === "PARTIAL" ||
    upperStatus === "DUE SOON"
  ) {
    return "Active";
  }

  return "Pending";
};
