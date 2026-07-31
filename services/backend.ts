import axios from "axios";
import { getAuthMode } from "./platform";
import {
  ApiSchoolStats,
  ApiPendingPayment,
  ApiEnrollment,
  ApiTransaction,
  Paginated,
  ApiNotification,
  ApiUser,
  ApiSchoolBankDetails,
  ApiClassFee,
} from "../types";
import type {
  CreateReceiptUploadDto,
  CreateReceiptDownloadDto,
  ReversePaymentDto,
} from "./apiTypes";
import {
  ApiAdminBreakdownStudent,
  ApiAdminBreakdownSummary,
  ApiAdminOverview,
  ApiAdminSchoolSummary,
  ApiAdminStudentsSummary,
  ApiPlatformRevenue,
  BreakdownTab,
} from "../types.admin";

export const API_URL =
  (import.meta as any).env?.VITE_API_URL ?? "http://localhost:3001";

const authMode = getAuthMode();

export const apiClient = axios.create({
  baseURL: `${API_URL}/api/v1`,
  headers: {
    "Content-Type": "application/json",
  },
  // Cookie mode: send the httpOnly Better Auth session cookie cross-origin
  // (the backend enables CORS credentials when CORS_ORIGINS is set).
  withCredentials: authMode === "cookie",
});

apiClient.interceptors.request.use((config) => {
  // Bearer mode only: cookie mode authenticates via the session cookie above.
  if (authMode === "bearer") {
    const token = localStorage.getItem("accessToken");
    if (token && config.url !== "/schools") {
      config.headers.Authorization = `Bearer ${token}`;
    }
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
    // Self-service profile (the logged-in user). Scoped server-side to the
    // session — no id in the path, and role/email cannot be changed here.
    getMe: async () => {
      const response = await apiClient.get(`/users/me`);
      return response.data;
    },
    updateMe: async (data: { fullName?: string; phoneNumber?: string }) => {
      const response = await apiClient.patch(`/users/me`, data);
      return response.data;
    },
    // Admin user management (SUPER_ADMIN only).
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
    getPendingFirstPayments: async (params?: {
      page?: number;
      limit?: number;
    }) => {
      const response = await apiClient.get<Paginated<ApiPendingPayment>>(
        "/admin/pending-first-payments",
        { params: { includeReceiptSignedUrls: true, ...params } },
      );
      return response.data;
    },
    getPendingInstallments: async (params?: {
      page?: number;
      limit?: number;
    }) => {
      const response = await apiClient.get<Paginated<ApiPendingPayment>>(
        "/admin/pending-installments",
        { params: { includeReceiptSignedUrls: true, ...params } },
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
      page?: number;
      limit?: number;
    }) => {
      const response = await apiClient.get<Paginated<ApiTransaction>>(
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
    /** Per-school outstanding / overdue / student counts for the breakdown screen. */
    getBreakdownSummary: async () => {
      const response =
        await apiClient.get<ApiAdminBreakdownSummary>("/admin/breakdown");
      return response.data;
    },
    /**
     * Per-student rows for one school. The tab is sent to the server because
     * overdue ranks on a derived figure — filtering client-side after pagination
     * would page over the wrong set.
     */
    getSchoolBreakdown: async (
      schoolId: string,
      params: { tab: BreakdownTab; page?: number; limit?: number },
    ) => {
      const response = await apiClient.get<
        Paginated<ApiAdminBreakdownStudent> & {
          schoolId: string;
          schoolName: string;
          tab: BreakdownTab;
        }
      >(`/admin/schools/${schoolId}/breakdown`, { params });
      return response.data;
    },
    getOverview: async (range?: "monthly" | "weekly") => {
      const response = await apiClient.get<ApiAdminOverview>("/admin/overview", {
        params: range ? { range } : undefined,
      });
      return response.data;
    },
    getSchoolStudents: async (
      schoolId: string,
      params?: { search?: string; className?: string; page?: number; limit?: number },
    ) => {
      const response = await apiClient.get<Paginated<ApiEnrollment>>(
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
    /**
     * The signed-in owner's own fee schedule. Session-scoped, so it works before
     * the client knows its schoolId — unlike `public.getSchoolFees(id)`.
     */
    getMyFees: async () => {
      const response = await apiClient.get<ApiClassFee[]>(
        "/school-payments/fees",
      );
      return response.data;
    },
    /**
     * Publishes the whole schedule in one request. Replaces a per-class loop that
     * slept 2.5s between calls to dodge the throttle — ~37s for a 15-class school,
     * and half-written if the tab closed midway.
     */
    setMyFees: async (fees: { className: string; feeAmount: number }[]) => {
      const response = await apiClient.post<ApiClassFee[]>(
        "/school-payments/fees/bulk",
        { fees },
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
      const body: ReversePaymentDto = { paymentId, reason };
      const response = await apiClient.post("/school-payments/reverse", body);
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
    /*
     * `enroll` (POST /enrollments) is gone. The backend removed that route when
     * first payments moved to the Paystack split — it was the manual
     * receipt-based path, and calling it 404s. Use initiateFirstPayment below.
     */
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
    // `deleteChild` (DELETE /enrollments/:id) is gone — no such route exists on the
    // backend, and nothing called it. Removing an enrollment would have to unwind
    // settled money, so it is a ledger operation, not a client delete.
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
    markAllRead: async () => {
      const response = await apiClient.patch(`/notifications/read-all`);
      return response.data;
    },
  },
  documents: {
    receipts: {
      createUploadUrl: async (data: CreateReceiptUploadDto) => {
        const response = await apiClient.post(
          "/documents/receipts/upload-url",
          data,
        );
        return response.data as {
          path: string;
          signedUrl: string;
          token?: string;
          expiresIn?: number;
          maxUploadBytes?: number;
          requiredHeaders?: Record<string, string>;
        };
      },
      createDownloadUrl: async (data: CreateReceiptDownloadDto) => {
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

/*
 * The platform's own bank details used to be hardcoded here (`PLATFORM_BANK` /
 * `getPlatformActivationBankDetails`) and rendered as the destination for a manual
 * first-payment transfer. Both are gone:
 *
 *   - First payments are collected through the Paystack split (see
 *     `parent.initiateFirstPayment`), which routes the school's share to its
 *     subaccount and the platform fee to the platform account. There is no manual
 *     transfer step, so the account was being shown for a payment nothing recorded.
 *   - An account number baked into the client is a second source of truth for
 *     settlement details. Bank details now only ever come from the server
 *     (`public.getSchoolBankDetails`).
 */
