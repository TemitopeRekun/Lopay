import axios from "axios";
import {
  ApiSchoolStats,
  ApiPendingPayment,
  ApiEnrollment,
  ApiTransaction,
  ApiNotification,
  ApiUser,
  ApiSchoolBankDetails,
} from "../types";
import {
  ApiAdminOverview,
  ApiAdminSchoolSummary,
  ApiAdminStudentsSummary,
  ApiPlatformRevenue,
} from "../types.admin";

export const API_URL =
  (import.meta as any).env?.VITE_API_URL ?? "http://localhost:3001";

export const apiClient = axios.create({
  baseURL: `${API_URL}/api/v1`,
  headers: {
    "Content-Type": "application/json",
  },
});

apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem("accessToken");
  if (token && config.url !== "/schools") {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const status = error?.response?.status;
    // Better Auth sessions are long-lived (7 days) and the bearer token is
    // refreshed on every authClient call. A 401 means the session is genuinely
    // gone — force logout rather than attempting a silent token exchange.
    if (status === 401) {
      if (typeof window !== "undefined") {
        window.dispatchEvent(new Event("lopay:unauthorized"));
      }
    }
    return Promise.reject(error);
  },
);

export interface AuditLogEntry {
  id: string;
  action: string;
  entityType: string;
  entityId: string;
  actorUserId: string | null;
  actorRole: string | null;
  schoolId: string | null;
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
  metadata: Record<string, unknown> | null;
  reason: string | null;
  createdAt: string;
}

// Auth (sign-in/up/out) is handled by the Better Auth client (services/authClient.ts),
// not this axios client. BackendAPI covers the domain endpoints only.
export const BackendAPI = {
  users: {
    get: async (id: string) => {
      const response = await apiClient.get(`/users/${id}`);
      return response.data;
    },
    update: async (user: Partial<import("../types").User>) => {
      const response = await apiClient.patch(`/users/${user.id}`, user);
      return response.data;
    },
  },
  admin: {
    onboardSchool: async (data: {
      schoolName: string;
      ownerEmail: string;
      ownerPassword?: string;
      ownerName: string;
      address: string;
      phone: string;
      bankName: string;
      bankCode: string;
      accountName: string;
      accountNumber: string;
    }) => {
      // Password should be provided by the UI
      const response = await apiClient.post("/admin/onboard-school", data);
      return response.data;
    },
    deleteSchool: async (schoolId: string) => {
      const response = await apiClient.delete(`/schools/${schoolId}`);
      return response.data;
    },
    updateSchool: async (school: Partial<import("../types").School>) => {
      const response = await apiClient.patch(`/schools/${school.id}`, school);
      return response.data;
    },
    deleteUser: async (userId: string) => {
      const response = await apiClient.delete(`/users/${userId}`);
      return response.data;
    },
    getUsers: async () => {
      const response = await apiClient.get<ApiUser[]>("/users");
      return response.data;
    },
    broadcast: async (title: string, message: string) => {
      const response = await apiClient.post("/notifications/broadcast", {
        title,
        message,
      });
      return response.data;
    },
    getPendingFirstPayments: async () => {
      const response = await apiClient.get<ApiPendingPayment[]>(
        "/admin/pending-first-payments",
        { params: { includeReceiptSignedUrls: true } },
      );
      return response.data;
    },
    getPendingInstallments: async () => {
      const response = await apiClient.get<ApiPendingPayment[]>(
        "/admin/pending-installments",
        { params: { includeReceiptSignedUrls: true } },
      );
      return response.data;
    },
    getPlatformRevenue: async () => {
      const response =
        await apiClient.get<ApiPlatformRevenue>("/admin/revenue");
      return response.data;
    },
    getAllTransactions: async (params?: {
      includeReceiptSignedUrls?: boolean;
      receiptType?: "ALL" | "FIRST_PAYMENT" | "INSTALLMENT";
    }) => {
      const response = await apiClient.get<ApiTransaction[]>(
        "/admin/transactions",
        { params },
      );
      return response.data;
    },
    getStudentsSummary: async () => {
      const response = await apiClient.get<ApiAdminStudentsSummary>(
        "/admin/students/summary",
      );
      return response.data;
    },
    getSchoolsSummary: async () => {
      const response = await apiClient.get<ApiAdminSchoolSummary[]>(
        "/admin/schools/summary",
      );
      return response.data;
    },
    getOverview: async () => {
      const response = await apiClient.get<ApiAdminOverview>(
        "/admin/overview",
      );
      return response.data;
    },
    getSchoolStudents: async (
      schoolId: string,
      params?: { search?: string; className?: string; page?: number; limit?: number },
    ) => {
      const response = await apiClient.get<ApiEnrollment[]>(
        `/admin/schools/${schoolId}/students`,
        { params },
      );
      return response.data;
    },
    settleFirstPayment: async (paymentId: string) => {
      const response = await apiClient.post(
        `/admin/settle-first-payment/${paymentId}`,
      );
      return response.data;
    },
    rejectFirstPayment: async (paymentId: string) => {
      const response = await apiClient.post(
        `/admin/reject-first-payment/${paymentId}`,
      );
      return response.data;
    },
    getAuditLogs: async (params?: {
      entityType?: string;
      entityId?: string;
      schoolId?: string;
      actorUserId?: string;
      take?: number;
      skip?: number;
    }) => {
      // Backend returns a paginated envelope { items, total, take, skip }.
      const response = await apiClient.get<{ items: AuditLogEntry[]; total: number }>(
        "/audit-logs",
        { params },
      );
      return response.data.items;
    },
    /** Nigerian bank list for the onboarding settlement-bank dropdown. */
    getBanks: async () => {
      const response = await apiClient.get<
        { name: string; code: string; currency: string }[]
      >("/admin/paystack/banks");
      return response.data;
    },
    /** Verify an account number against a bank code → registered account name. */
    resolveAccount: async (accountNumber: string, bankCode: string) => {
      const response = await apiClient.post<{
        accountName: string;
        accountNumber: string;
      }>("/admin/paystack/resolve-account", { accountNumber, bankCode });
      return response.data;
    },
    /** (Re)create a Paystack subaccount for a school missing one. */
    createSubaccount: async (schoolId: string) => {
      const response = await apiClient.post<{ subaccountCode: string; active: boolean }>(
        `/admin/schools/${schoolId}/paystack-subaccount`,
      );
      return response.data;
    },
  },
  school: {
    getStats: async () => {
      const response = await apiClient.get<ApiSchoolStats>(
        "/school-payments/stats",
      );
      return response.data;
    },
    getPendingPayments: async () => {
      const response = await apiClient.get<ApiPendingPayment[]>(
        "/school-payments/pending",
        { params: { includeReceiptSignedUrls: true } },
      );
      return response.data;
    },
    getStudents: async (params?: { search?: string; className?: string; page?: number; limit?: number }) => {
      const response = await apiClient.get<ApiEnrollment[]>(
        "/school-payments/students",
        { params },
      );
      return response.data;
    },

    getTransactions: async () => {
      const response = await apiClient.get<ApiTransaction[]>(
        "/school-payments/history",
        { params: { includeReceiptSignedUrls: true } },
      );
      return response.data;
    },
    confirmFirstPayment: async (enrollmentId: string) => {
      const response = await apiClient.post(
        "/enrollments/confirm-first-payment",
        { enrollmentId },
      );
      return response.data;
    },
    confirmPayment: async (paymentId: string) => {
      const response = await apiClient.post("/school-payments/confirm", {
        paymentId,
      });
      return response.data;
    },
    declinePayment: async (paymentId: string) => {
      const response = await apiClient.post("/school-payments/reject", {
        paymentId,
      });
      return response.data;
    },
    updateFee: async (
      className: string,
      feeAmount: number,
      schoolId?: string,
    ) => {
      const payload: any = { className, feeAmount };
      if (schoolId) payload.schoolId = schoolId;
      const response = await apiClient.post("/school-payments/fees", payload);
      return response.data;
    },
    updateStudentStatus: async (studentId: string, status: string) => {
      const response = await apiClient.patch(
        `/school-payments/students/${studentId}/status`,
        { status },
      );
      return response.data;
    },
    reversePayment: async (paymentId: string, reason?: string) => {
      const response = await apiClient.post("/school-payments/reverse", {
        paymentId,
        reason,
      });
      return response.data;
    },
  },
  public: {
    getSchools: async () => {
      const response = await apiClient.get<import("../types").School[]>(
        "/schools",
      );
      return response.data;
    },
    getSchoolFees: async (schoolId: string) => {
      const response = await apiClient.get<
        { className: string; feeAmount: number }[]
      >(`/school-payments/fees/${schoolId}`);
      return response.data;
    },
    getSchoolBankDetails: async (schoolId: string) => {
      const response = await apiClient.get<ApiSchoolBankDetails>(
        `/school-payments/bank-details/${schoolId}`,
      );
      return response.data;
    },
    calculatePaymentPlan: async (payload: {
      schoolId: string;
      totalAmount: number;
      feeType: string;
      grade: string;
    }) => {
      // POST /payment/calculate-structure
      const response = await apiClient.post<
        import("../types").PaymentCalculationResponse
      >("/payment/calculate-structure", payload);
      return response.data;
    },
  },
  parent: {
    getChildren: async () => {
      const response = await apiClient.get<ApiEnrollment[]>(
        `/enrollments/my-children?t=${new Date().getTime()}`,
      );
      return response.data;
    },
    enroll: async (data: {
      childId?: string;
      childName?: string;
      schoolId: string;
      className: string;
      installmentFrequency: string;
      firstPaymentPaid: number;
      receiptUrl?: string;
      termStartDate: string;
      termEndDate: string;
      idempotencyKey?: string;
    }) => {
      const response = await apiClient.post("/enrollments", data);
      return response.data;
    },
    /** Initiate a first payment via Paystack split. Returns access code + reference. */
    initiateFirstPayment: async (data: {
      childId?: string;
      childName?: string;
      schoolId: string;
      className: string;
      installmentFrequency: string;
      firstPaymentPaid: number;
      termStartDate: string;
      termEndDate: string;
      idempotencyKey?: string;
    }) => {
      const response = await apiClient.post<{
        reference: string;
        accessCode: string;
        authorizationUrl: string;
        amountCharged: number;
        depositToSchool: number;
        platformFee: number;
        paystackFee: number;
        idempotent?: boolean;
        status?: string;
      }>("/enrollments/initiate-first-payment", data);
      return response.data;
    },
    /** Reconcile a Paystack transaction on return (idempotent with the webhook). */
    verifyPaystack: async (reference: string) => {
      const response = await apiClient.get<{ status: string; reference: string }>(
        "/payments/paystack/verify",
        { params: { reference } },
      );
      return response.data;
    },
    payInstallment: async (
      enrollmentId: string,
      amountPaid: number,
      receiptUrl?: string,
      idempotencyKey?: string,
    ) => {
      const response = await apiClient.post("/enrollments/pay-installment", {
        enrollmentId,
        amountPaid,
        receiptUrl,
        idempotencyKey,
      });
      return response.data;
    },
    getHistory: async () => {
      const response = await apiClient.get<any[]>("/transactions", {
        params: { includeReceiptSignedUrls: true },
      });
      return response.data;
    },
    deleteChild: async (childId: string) => {
      const response = await apiClient.delete(`/enrollments/${childId}`);
      return response.data;
    },
  },
  notifications: {
    get: async () => {
      const response = await apiClient.get<ApiNotification[]>("/notifications");
      return response.data;
    },
    markRead: async (id: string) => {
      const response = await apiClient.patch(`/notifications/${id}/read`);
      return response.data;
    },
  },
  documents: {
    receipts: {
      createUploadUrl: async (data: {
        fileName: string;
        contentType: string;
      }) => {
        const response = await apiClient.post(
          "/documents/receipts/upload-url",
          data,
        );
        return response.data as {
          path: string;
          signedUrl: string;
          token?: string;
          expiresIn?: number;
        };
      },
      createDownloadUrl: async (data: { paymentId: string }) => {
        const response = await apiClient.post(
          "/documents/receipts/download-url",
          data,
        );
        return response.data as {
          path: string;
          signedUrl: string;
          expiresIn?: number;
        };
      },
    },
  },
};

export const PLATFORM_BANK = {
  bankName: "Moniepoint",
  accountName: "Lopay Technologies",
  accountNumber: "9090390581",
};

export const getPlatformActivationBankDetails = (isStudent: boolean) => {
  return {
    accountName: PLATFORM_BANK.accountName,
    bankName: PLATFORM_BANK.bankName,
    accountNumber: PLATFORM_BANK.accountNumber,
    isLopayEscrow: true,
    institutionName: isStudent ? "Lopay Tuition Hub" : "Lopay Activation Hub",
  };
};
