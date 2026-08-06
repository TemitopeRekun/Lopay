import axios from "axios";
import { getAuthMode } from "./platform";
import {
  ApiSchoolStats,
  ApiPendingPayment,
  ApiEnrollment,
  ApiTransaction,
  Paginated,
  ApiNotification,
  ApiNotificationList,
  ApiParentDashboardSummary,
  ApiUser,
  ApiSchoolBankDetails,
  ApiClassFee,
  ApiPaymentStatus,
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
    /**
     * First payments awaiting settlement. `schoolId` narrows to one school —
     * applied server-side because the list is paginated, so filtering a page
     * client-side would page over the wrong set.
     */
    getPendingFirstPayments: async (params?: {
      page?: number;
      limit?: number;
      schoolId?: string;
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
    /**
     * The platform-wide ledger, one page at a time.
     *
     * `status` is sent to the server rather than applied to the returned page:
     * the list is paginated, so filtering here would search only the fetched
     * page and present it as the whole set.
     */
    getAllTransactions: async (params?: {
      includeReceiptSignedUrls?: boolean;
      receiptType?: "ALL" | "FIRST_PAYMENT" | "INSTALLMENT";
      page?: number;
      limit?: number;
      status?: ApiPaymentStatus;
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
    /**
     * One page of the school roster. The endpoint returns a pagination
     * envelope; an older build typed this as a bare array, so the dashboard
     * discarded every response and rendered an empty school. Both shapes are
     * tolerated here so a version skew degrades instead of blanking the screen.
     */
    getStudents: async (params?: {
      search?: string;
      className?: string;
      page?: number;
      limit?: number;
    }) => {
      const response = await apiClient.get<
        Paginated<ApiEnrollment> | ApiEnrollment[]
      >("/school-payments/students", { params });
      return response.data;
    },
    /**
     * The WHOLE roster. Dashboard totals (arrears, active plans, the registry
     * count) must not be computed from page 1 alone, so this walks every page.
     * `PAGE_LIMIT` matches the server's per-page ceiling; `MAX_PAGES` is a
     * runaway guard, and hitting it is reported rather than silently truncating.
     */
    getAllStudents: async (params?: { search?: string; className?: string }) => {
      const PAGE_LIMIT = 200;
      const MAX_PAGES = 50;
      const items: ApiEnrollment[] = [];
      let page = 1;
      let totalPages = 1;
      let total = 0;

      do {
        const data = await BackendAPI.school.getStudents({
          ...params,
          page,
          limit: PAGE_LIMIT,
        });
        if (Array.isArray(data)) {
          // Pre-pagination backend: one shot is the whole roster.
          items.push(...data);
          total = data.length;
          totalPages = 1;
          break;
        }
        items.push(...(data.items ?? []));
        total = data.total ?? items.length;
        totalPages = data.totalPages ?? 1;
        page += 1;
      } while (page <= totalPages && page <= MAX_PAGES);

      return { items, total, truncated: items.length < total };
    },

    /**
     * The school's payment history.
     *
     * Serves both the paged history screen and the monthly CSV export, so it
     * takes a page/status as well as the export's date window and `take`.
     * `status` goes to the server for the same reason as everywhere else: the
     * list is paginated, so filtering here would search one page only.
     */
    getTransactions: async (params?: {
      from?: string;
      to?: string;
      take?: number;
      page?: number;
      status?: ApiPaymentStatus;
    }) => {
      const response = await apiClient.get<
        Paginated<ApiTransaction> | ApiTransaction[]
      >("/school-payments/history", {
        params: { includeReceiptSignedUrls: true, ...params },
      });
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
    /*
     * `updateFee` is gone. It took an optional `schoolId` and put it in the body,
     * which implied a platform admin could rewrite another school's fees — they
     * cannot, and never could: POST /school-payments/fees is SCHOOL_OWNER-only
     * and derives the school from the session, so the field was silently dropped
     * by the server's whitelisting ValidationPipe. Fees are school-owned; a
     * school publishes its own schedule through `setMyFees` (the /school/fees
     * screen), which is scoped to the caller's session and cannot be pointed
     * elsewhere. Nothing rendered `updateFee`.
     */
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
    /**
     * Everything the post-payment screen renders, for either payment rail.
     *
     * Pass `reference` for a Paystack first payment or `paymentId` for an
     * installment. The reference path reconciles server-side before answering,
     * so this replaces the separate verify-on-return call — one round trip, and
     * the response is renderable rather than a bare status string.
     */
    getPaymentOutcome: async (locator: {
      reference?: string;
      paymentId?: string;
    }) => {
      const response = await apiClient.get("/enrollments/payment-outcome", {
        params: locator,
      });
      return response.data as {
        state: "succeeded" | "processing" | "failed" | "cancelled";
        paymentType: string;
        amount: number;
        reference: string | null;
        childName: string | null;
        schoolName: string | null;
        className: string | null;
        reason: string | null;
        enrollmentStatus: string | null;
        remainingBalance: number | null;
        nextInstallmentAmount: number | null;
        nextDueDate: string | null;
      };
    },

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
    /**
     * The caller's own payment history, one page at a time.
     *
     * `status` is sent to the server, not applied to the returned page: the
     * list is paginated, so a client-side filter would search only the fetched
     * page and render it as the complete set.
     */
    getHistory: async (params?: {
      page?: number;
      limit?: number;
      status?: ApiPaymentStatus;
    }) => {
      const response = await apiClient.get<
        Paginated<ApiTransaction> | ApiTransaction[]
      >("/transactions", {
        params: { includeReceiptSignedUrls: true, ...params },
      });
      return response.data;
    },
    /**
     * The dashboard headline (next collection, active plans, outstanding),
     * rolled up by the server across the caller's own plans.
     *
     * The client used to compute this by summing `nextInstallmentAmount` across
     * enrollments and taking the earliest `nextDueDate`, filtering on a locally
     * normalised status — an aggregate no endpoint validated, which counted
     * plans whose first payment had never been collected.
     */
    getDashboardSummary: async () => {
      const response = await apiClient.get<ApiParentDashboardSummary>(
        "/enrollments/summary",
      );
      return response.data;
    },
    // `deleteChild` (DELETE /enrollments/:id) is gone — no such route exists on the
    // backend, and nothing called it. Removing an enrollment would have to unwind
    // settled money, so it is a ledger operation, not a client delete.
  },
  notifications: {
    /**
     * A bounded window of the caller's notifications plus the true unread total.
     *
     * The endpoint used to return the whole history as a bare array. Both shapes
     * are tolerated so a version skew degrades to "no unread badge" instead of an
     * empty notification screen.
     */
    get: async () => {
      const response = await apiClient.get<
        ApiNotificationList | ApiNotification[]
      >("/notifications");
      const data = response.data;
      if (Array.isArray(data)) {
        return {
          items: data,
          unreadCount: data.filter((n) => !n.isRead).length,
          limit: data.length,
        };
      }
      return {
        items: data?.items ?? [],
        unreadCount: data?.unreadCount ?? 0,
        limit: data?.limit ?? 0,
      };
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
