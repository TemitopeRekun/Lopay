import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { BackendAPI } from "../services/backend";
import {
  normalizeChild,
  normalizeNotification,
  normalizeSchool,
  normalizeTransaction,
  normalizeUser,
} from "../services/adapters";
import { School } from "../types";
import type {
  ApiPaymentStatus,
  ApiTransaction,
  Paginated,
  Transaction,
} from "../types";
import type { BreakdownTab } from "../types.admin";
import { useUIStore } from "../store/uiStore";
import { getErrorMessage } from "../utils/errors";
import { logger } from "../utils/logger";

/**
 * Slow safety-net poll for "live" data. Real-time freshness now comes from the
 * WebSocket (see hooks/useRealtime.ts), which invalidates these queries the
 * moment the backend pushes a change. This long interval only covers the rare
 * case where the socket is down (offline / reconnecting).
 */
const FALLBACK_POLL_MS = 1000 * 60 * 5;

// --- Keys ---
export const QUERY_KEYS = {
  user: (id: string) => ["user", id],
  children: ["children"],
  notifications: ["notifications"],
  transactions: ["transactions"],
  globalTransactions: ["globalTransactions"],
  schools: ["schools"],
  schoolStats: ["schoolStats"],
  schoolBankDetails: (schoolId: string) => ["schoolBankDetails", schoolId],
  pendingPayments: ["pendingPayments"],
  schoolTransactions: ["schoolTransactions"],
  schoolStudents: ["schoolStudents"],
  users: ["users"], // Admin
  schoolFees: (schoolId: string) => ["schoolFees", schoolId],
  paymentCalculation: (schoolId: string, totalAmount: number, grade: string) => [
    "paymentCalculation",
    schoolId,
    totalAmount,
    grade,
  ],
  myClassFees: ["myClassFees"],
  parentDashboardSummary: ["parentDashboardSummary"],
  adminPendingFirstPayments: ["adminPendingFirstPayments"],
  adminPendingInstallments: ["adminPendingInstallments"],
  adminPlatformRevenue: ["adminPlatformRevenue"],
  adminStudentsSummary: ["adminStudentsSummary"],
  adminSchoolsSummary: ["adminSchoolsSummary"],
  adminOverview: ["adminOverview"],
  adminBreakdown: ["adminBreakdown"],
  adminSchoolBreakdown: ["adminSchoolBreakdown"],
};

/** A page of normalized transactions plus the server's totals for the filter. */
export interface TransactionPage {
  items: Transaction[];
  total: number;
  page: number;
  totalPages: number;
}

/**
 * Normalize a history response into a page.
 *
 * Tolerates a bare array as well as the envelope: the three history endpoints
 * gained pagination at different times, and a version skew should degrade to a
 * single page rather than blanking the screen.
 */
const toTransactionPage = (
  data: Paginated<ApiTransaction> | ApiTransaction[] | undefined,
  requestedPage: number,
): TransactionPage => {
  if (Array.isArray(data)) {
    return {
      items: data.map(normalizeTransaction),
      total: data.length,
      page: 1,
      totalPages: 1,
    };
  }
  const items = (data?.items ?? []).map(normalizeTransaction);
  return {
    items,
    total: data?.total ?? items.length,
    page: data?.page ?? requestedPage,
    totalPages: data?.totalPages ?? 1,
  };
};

// --- Hooks ---

export const useChildren = (enabled: boolean = true) => {
  return useQuery({
    queryKey: QUERY_KEYS.children,
    queryFn: async () => {
      const data = await BackendAPI.parent.getChildren();
      if (!Array.isArray(data)) {
        logger.error("Unexpected children data format:", data);
        return [];
      }
      return data.map(normalizeChild);
    },
    enabled,
    refetchOnWindowFocus: false,
  });
};

/**
 * The caller's notifications.
 *
 * `unreadCount` is the server's count over the WHOLE table, not over the window
 * returned — the list is bounded, so deriving the badge from `items` would
 * under-report it for anyone with a long history.
 */
export const useNotifications = (userId?: string, enabled: boolean = true) => {
  return useQuery({
    queryKey: QUERY_KEYS.notifications,
    queryFn: async () => {
      const { items, unreadCount } = await BackendAPI.notifications.get();
      return {
        items: items.map(normalizeNotification),
        unreadCount,
      };
    },
    enabled: enabled && !!userId,
    // Notifications arrive live over the socket; this is just a fallback.
    refetchInterval: FALLBACK_POLL_MS,
  });
};

/**
 * The parent dashboard's headline figures, computed by the server.
 *
 * Deliberately a separate query from `useChildren`: the card must show the
 * ledger's own aggregate, not a total re-derived from whatever plans the client
 * happens to be holding.
 */
export const useParentDashboardSummary = (enabled: boolean = true) => {
  return useQuery({
    queryKey: QUERY_KEYS.parentDashboardSummary,
    queryFn: BackendAPI.parent.getDashboardSummary,
    enabled,
    staleTime: 1000 * 30,
  });
};

/**
 * The caller's own payment history — a page of it, plus the true total.
 *
 * `status` is a server filter, not a client one, and it is part of the key so
 * switching tabs refetches. The list is paginated: filtering the fetched page
 * here would search only that page and render the result as the whole history,
 * which is exactly how a "Failed" tab comes to look empty for someone who has
 * failed payments further back.
 */
export const useTransactions = (
  userId?: string,
  enabled: boolean = true,
  options: { page?: number; status?: ApiPaymentStatus } = {},
) => {
  const { page = 1, status } = options;
  return useQuery({
    queryKey: [...QUERY_KEYS.transactions, page, status ?? null],
    queryFn: async () => {
      const data = await BackendAPI.parent.getHistory({
        page,
        ...(status ? { status } : {}),
      });
      return toTransactionPage(data, page);
    },
    enabled: enabled && !!userId,
    // Keep the previous page on screen while the next one loads, so paging
    // doesn't blank the list and bounce the scroll position.
    placeholderData: (previous) => previous,
  });
};

export const useGlobalTransactions = (
  enabled: boolean = true,
  options: { page?: number; status?: ApiPaymentStatus } = {},
) => {
  const { page = 1, status } = options;
  return useQuery({
    queryKey: [...QUERY_KEYS.globalTransactions, page, status ?? null],
    queryFn: async () => {
      const data = await BackendAPI.admin.getAllTransactions({
        includeReceiptSignedUrls: true,
        receiptType: "ALL",
        page,
        ...(status ? { status } : {}),
      });
      return toTransactionPage(data, page);
    },
    enabled,
    placeholderData: (previous) => previous,
  });
};

export const useSchools = () => {
  return useQuery({
    queryKey: QUERY_KEYS.schools,
    queryFn: async () => {
      const data = await BackendAPI.public.getSchools();
      return (Array.isArray(data) ? data : []).map(normalizeSchool);
    },
    staleTime: 1000 * 60 * 60, // 1 hour (schools don't change often)
  });
};

export const useSchoolStats = (enabled: boolean = true) => {
  return useQuery({
    queryKey: QUERY_KEYS.schoolStats,
    queryFn: BackendAPI.school.getStats,
    enabled,
    staleTime: 1000 * 30,
    refetchInterval: enabled ? FALLBACK_POLL_MS : false,
    refetchOnWindowFocus: true,
  });
};

export const usePendingPayments = (
  contextKeyOrEnabled: string | boolean = true,
  maybeEnabled?: boolean,
) => {
  let contextKey = "default";
  let enabled: boolean;

  if (typeof contextKeyOrEnabled === "string") {
    contextKey = contextKeyOrEnabled;
    enabled = maybeEnabled ?? true;
  } else {
    enabled = contextKeyOrEnabled ?? true;
  }

  return useQuery({
    queryKey: [...QUERY_KEYS.pendingPayments, contextKey],
    queryFn: async () => {
      const data = await BackendAPI.school.getPendingPayments();
      return (Array.isArray(data) ? data : [])
        .map(normalizeTransaction)
        .filter((t) => t.status === "Pending");
    },
    enabled,
    staleTime: 1000 * 30,
    refetchInterval: enabled ? FALLBACK_POLL_MS : false,
    refetchOnWindowFocus: true,
  });
};

export const useSchoolTransactions = (
  enabled: boolean = true,
  options: { page?: number; status?: ApiPaymentStatus } = {},
) => {
  const { page = 1, status } = options;
  return useQuery({
    queryKey: [...QUERY_KEYS.schoolTransactions, page, status ?? null],
    queryFn: async () => {
      const data = await BackendAPI.school.getTransactions({
        page,
        ...(status ? { status } : {}),
      });
      return toTransactionPage(data, page);
    },
    enabled,
    placeholderData: (previous) => previous,
  });
};

export const useSchoolStudents = (
  contextKeyOrEnabled: string | boolean = true,
  maybeEnabled?: boolean,
) => {
  let contextKey = "default";
  let enabled: boolean;

  if (typeof contextKeyOrEnabled === "string") {
    contextKey = contextKeyOrEnabled;
    enabled = maybeEnabled ?? true;
  } else {
    enabled = contextKeyOrEnabled ?? true;
  }

  return useQuery({
    queryKey: [...QUERY_KEYS.schoolStudents, contextKey],
    queryFn: async () => {
      const { items, truncated } = await BackendAPI.school.getAllStudents();
      if (truncated) {
        // Never silently show a partial school: totals derived from this list
        // would be wrong and nothing on screen would say so.
        logger.error(
          "School roster truncated by the page guard; totals may be incomplete",
        );
      }
      return items.map(normalizeChild);
    },
    enabled,
  });
};

/**
 * The signed-in school owner's own fee schedule.
 *
 * Session-scoped, so it resolves before the client knows its schoolId. An empty
 * array is the signal that first-run setup has not happened yet — a school
 * cannot accept enrolments until it has published at least one class fee.
 */
export const useMyClassFees = (enabled: boolean = true) => {
  return useQuery({
    queryKey: QUERY_KEYS.myClassFees,
    queryFn: BackendAPI.school.getMyFees,
    enabled,
    staleTime: 1000 * 60,
  });
};

/** Publishes the whole schedule in one request (first-run setup or a revision). */
export const useSetMyClassFees = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (fees: { className: string; feeAmount: number }[]) =>
      BackendAPI.school.setMyFees(fees),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.myClassFees });
      // Parents read fees per-school; drop those too so a newly published
      // schedule is visible immediately rather than after the 5-minute TTL.
      queryClient.invalidateQueries({ queryKey: ["schoolFees"] });
    },
  });
};

export const useSchoolFees = (schoolId: string, enabled: boolean = true) => {
  return useQuery({
    queryKey: QUERY_KEYS.schoolFees(schoolId),
    queryFn: () => BackendAPI.public.getSchoolFees(schoolId),
    enabled: enabled && !!schoolId,
  });
};

/**
 * The server's payment structure for a fee: platform fee, minimum deposit, total
 * initial payment, and the weekly/monthly plan options.
 *
 * Shared by the calculator and the confirm screen so both show the figures the
 * server will actually validate the charge against. It is a pure function of the
 * fee, so it caches for the session.
 */
export const usePaymentCalculation = (
  params: {
    schoolId: string | undefined;
    totalAmount: number;
    feeType: string;
    grade: string;
  },
  enabled: boolean = true,
) => {
  const { schoolId, totalAmount, feeType, grade } = params;
  return useQuery({
    queryKey: QUERY_KEYS.paymentCalculation(schoolId ?? "", totalAmount, grade),
    queryFn: () => {
      if (!schoolId) throw new Error("School ID is required");
      return BackendAPI.public.calculatePaymentPlan({
        schoolId,
        totalAmount,
        feeType,
        grade,
      });
    },
    enabled: enabled && !!schoolId && totalAmount > 0,
    staleTime: 1000 * 60 * 10,
  });
};

export const useSchoolBankDetails = (
  schoolId: string | null | undefined,
  enabled: boolean = true,
) => {
  return useQuery({
    queryKey: schoolId
      ? QUERY_KEYS.schoolBankDetails(schoolId)
      : ["schoolBankDetails", "none"],
    queryFn: async () => {
      if (!schoolId) {
        throw new Error("School ID is required");
      }
      const data = await BackendAPI.public.getSchoolBankDetails(schoolId);
      return data;
    },
    enabled: enabled && !!schoolId,
  });
};

/**
 * First payments awaiting settlement, optionally for one school.
 *
 * `schoolId` is part of the key AND sent to the server: the list is paginated,
 * so a client-side filter would page over the wrong set.
 */
export const useAdminPendingFirstPayments = (
  enabled: boolean = true,
  page: number = 1,
  pollIntervalMs?: number,
  schoolId?: string,
) => {
  return useQuery({
    queryKey: [...QUERY_KEYS.adminPendingFirstPayments, page, schoolId ?? null],
    queryFn: async () => {
      const data = await BackendAPI.admin.getPendingFirstPayments({
        page,
        ...(schoolId ? { schoolId } : {}),
      });
      const items = Array.isArray(data) ? data : (data?.items ?? []);
      return {
        items: items
          .map(normalizeTransaction)
          .filter((t) => t.status === "Pending"),
        total: Array.isArray(data) ? items.length : (data?.total ?? 0),
        totalPages: Array.isArray(data) ? 1 : (data?.totalPages ?? 1),
        page: Array.isArray(data) ? 1 : (data?.page ?? page),
      };
    },
    enabled,
    refetchInterval: enabled ? pollIntervalMs ?? FALLBACK_POLL_MS : false,
    refetchOnWindowFocus: true,
  });
};

export const useAdminPendingInstallments = (
  enabled: boolean = true,
  page: number = 1,
  pollIntervalMs?: number,
) => {
  return useQuery({
    queryKey: [...QUERY_KEYS.adminPendingInstallments, page],
    queryFn: async () => {
      const data = await BackendAPI.admin.getPendingInstallments({ page });
      const items = Array.isArray(data) ? data : (data?.items ?? []);
      return {
        items: items
          .map(normalizeTransaction)
          .filter((t) => t.status === "Pending"),
        total: Array.isArray(data) ? items.length : (data?.total ?? 0),
        totalPages: Array.isArray(data) ? 1 : (data?.totalPages ?? 1),
        page: Array.isArray(data) ? 1 : (data?.page ?? page),
      };
    },
    enabled,
    refetchInterval: enabled ? pollIntervalMs ?? FALLBACK_POLL_MS : false,
    refetchOnWindowFocus: true,
  });
};

export const useAdminPlatformRevenue = (enabled: boolean = true) => {
  return useQuery({
    queryKey: QUERY_KEYS.adminPlatformRevenue,
    queryFn: async () => {
      const data = await BackendAPI.admin.getPlatformRevenue();
      return data;
    },
    enabled,
    staleTime: 1000 * 30,
    refetchInterval: enabled ? FALLBACK_POLL_MS : false,
    refetchOnWindowFocus: true,
  });
};

export const useAdminStudentsSummary = (enabled: boolean = true) => {
  return useQuery({
    queryKey: QUERY_KEYS.adminStudentsSummary,
    queryFn: BackendAPI.admin.getStudentsSummary,
    enabled,
    staleTime: 1000 * 30,
    refetchInterval: enabled ? FALLBACK_POLL_MS : false,
    refetchOnWindowFocus: true,
  });
};

export const useAdminSchoolsSummary = (enabled: boolean = true) => {
  return useQuery({
    queryKey: QUERY_KEYS.adminSchoolsSummary,
    queryFn: BackendAPI.admin.getSchoolsSummary,
    enabled,
    staleTime: 1000 * 60,
    refetchInterval: enabled ? 1000 * 60 * 5 : false,
    refetchOnWindowFocus: false,
  });
};

export const useAdminOverview = (
  enabled: boolean = true,
  range: "monthly" | "weekly" = "monthly",
) => {
  return useQuery({
    // Range is part of the key so switching the chart toggle refetches instead
    // of re-rendering the previously cached bucket set.
    queryKey: [...QUERY_KEYS.adminOverview, range],
    queryFn: async () => {
      const data = await BackendAPI.admin.getOverview(range);
      return {
        ...data,
        recentTransactions: (data?.recentTransactions || []).map(
          normalizeTransaction,
        ),
      };
    },
    enabled,
    staleTime: 1000 * 30,
    refetchInterval: enabled ? FALLBACK_POLL_MS : false,
    refetchOnWindowFocus: true,
  });
};

/**
 * Per-school outstanding / overdue / student counts for the breakdown screen,
 * and the Overdue tile on the admin dashboard.
 *
 * Carries the same safety-net poll as every other admin aggregate. Without it
 * this query's only refresh was a window-focus refetch, so an admin watching the
 * dashboard saw the Overdue figure freeze while every tile beside it moved.
 */
export const useAdminBreakdown = (enabled: boolean = true) => {
  return useQuery({
    queryKey: QUERY_KEYS.adminBreakdown,
    queryFn: BackendAPI.admin.getBreakdownSummary,
    enabled,
    staleTime: 1000 * 30,
    refetchInterval: enabled ? FALLBACK_POLL_MS : false,
    refetchOnWindowFocus: true,
  });
};

/** Per-student rows for one school on one tab. Skipped until a school is chosen. */
export const useAdminSchoolBreakdown = (
  schoolId: string | null,
  tab: BreakdownTab,
  page: number = 1,
  enabled: boolean = true,
) => {
  return useQuery({
    queryKey: [...QUERY_KEYS.adminSchoolBreakdown, schoolId, tab, page],
    queryFn: () => {
      if (!schoolId) {
        throw new Error("School ID is required");
      }
      return BackendAPI.admin.getSchoolBreakdown(schoolId, { tab, page });
    },
    enabled: enabled && !!schoolId,
    staleTime: 1000 * 30,
  });
};

/*
 * `useAdminSchoolStudents` is gone. No screen mounted it — the admin reads one
 * school's students through `useAdminSchoolBreakdown`, which the collections
 * breakdown screen actually renders — and being server-derived but absent from
 * the realtime invalidation map, it was a query that would have rendered once and
 * then silently stopped tracking the ledger. It was also the one roster shape
 * keyed on `childId` rather than the enrollment id, unlike every other list.
 *
 * `BackendAPI.admin.getSchoolStudents` stays: the endpoint is live and tested,
 * and the typed wrapper is the client for it.
 */

export const useUser = (
  userId: string | null | undefined,
  enabled: boolean = true,
) => {
  return useQuery({
    queryKey: QUERY_KEYS.user(userId || ""),
    queryFn: async () => {
      if (!userId) throw new Error("User ID is required");
      const data = await BackendAPI.users.get(userId);
      return normalizeUser(data);
    },
    enabled: enabled && !!userId,
  });
};

export const useUsers = (enabled: boolean = true) => {
  return useQuery({
    queryKey: QUERY_KEYS.users,
    queryFn: async () => {
      const data = await BackendAPI.admin.getUsers();
      return (Array.isArray(data) ? data : []).map(normalizeUser);
    },
    enabled,
  });
};

// --- Mutations ---

/*
 * `useEnrollChild` is gone. It posted to POST /enrollments, the manual
 * receipt-based first-payment route the backend removed when first payments moved
 * to the Paystack split — so it could only ever 404. Nothing rendered it either:
 * enrollment happens on ConfirmPlanScreen via `parent.initiateFirstPayment`, which
 * creates the enrollment and the charge together.
 */

export const usePayInstallment = () => {
  const queryClient = useQueryClient();
  const { showToast } = useUIStore();
  return useMutation({
    mutationFn: (data: {
      enrollmentId: string;
      amount: number;
      receiptUrl?: string;
      idempotencyKey?: string;
    }) =>
      BackendAPI.parent.payInstallment(
        data.enrollmentId,
        data.amount,
        data.receiptUrl,
        data.idempotencyKey,
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.children });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.transactions });
      queryClient.invalidateQueries({
        queryKey: QUERY_KEYS.globalTransactions,
      });
      queryClient.invalidateQueries({
        queryKey: QUERY_KEYS.pendingPayments,
      });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.schoolStudents });
      queryClient.invalidateQueries({
        queryKey: QUERY_KEYS.schoolTransactions,
      });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.schoolStats });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.notifications });
      queryClient.invalidateQueries({
        queryKey: QUERY_KEYS.adminPendingFirstPayments,
      });
      queryClient.invalidateQueries({
        queryKey: QUERY_KEYS.adminPendingInstallments,
      });
    },
    onError: (error: unknown) => {
      const message = getErrorMessage(error, "Payment failed. Please try again.");
      showToast(message, "error");
    },
  });
};

export const useMarkNotificationRead = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: BackendAPI.notifications.markRead,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.notifications });
    },
  });
};

export const useMarkAllNotificationsRead = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: BackendAPI.notifications.markAllRead,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.notifications });
    },
  });
};

/*
 * `useUpdateFee` is gone. It accepted a `schoolId`, which implied a platform
 * admin could rewrite a school's fee — they cannot. Fees are school-owned:
 * POST /school-payments/fees is SCHOOL_OWNER-only and takes the school from the
 * session, so the id was silently discarded server-side. Nothing rendered the
 * hook (its only route, /admin/manage-fees, now redirects to /school/fees), and
 * its `onSuccess` invalidated nothing at all unless a schoolId was passed —
 * never refreshing `myClassFees`, the query the fee screen actually reads.
 *
 * A school publishes its own schedule with `useSetMyClassFees`.
 */

export const useConfirmPayment = () => {
  const queryClient = useQueryClient();
  const { showToast } = useUIStore();
  return useMutation({
    mutationFn: BackendAPI.school.confirmPayment,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.pendingPayments });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.schoolStats });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.schoolStudents });
      queryClient.invalidateQueries({
        queryKey: QUERY_KEYS.schoolTransactions,
      });
      queryClient.invalidateQueries({
        queryKey: QUERY_KEYS.globalTransactions,
      });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.transactions });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.notifications });
    },
    onError: (error: unknown) => {
      const message = getErrorMessage(error, "Failed to confirm payment. Please try again.");
      showToast(message, "error");
    },
  });
};

export const useConfirmFirstPayment = () => {
  const queryClient = useQueryClient();
  const { showToast } = useUIStore();
  return useMutation({
    mutationFn: BackendAPI.school.confirmFirstPayment,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.children });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.schoolStudents });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.schoolStats });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.transactions });
      queryClient.invalidateQueries({
        queryKey: QUERY_KEYS.schoolTransactions,
      });
      queryClient.invalidateQueries({
        queryKey: QUERY_KEYS.globalTransactions,
      });
      queryClient.invalidateQueries({
        queryKey: QUERY_KEYS.pendingPayments,
      });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.notifications });
    },
    onError: (error: unknown) => {
      const message = getErrorMessage(error, "Failed to confirm first payment. Please try again.");
      showToast(message, "error");
    },
  });
};

export const useSettleFirstPayment = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: BackendAPI.admin.settleFirstPayment,
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: QUERY_KEYS.adminPendingFirstPayments,
      });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.children });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.schoolStudents });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.schoolStats });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.transactions });
      queryClient.invalidateQueries({
        queryKey: QUERY_KEYS.schoolTransactions,
      });
      queryClient.invalidateQueries({
        queryKey: QUERY_KEYS.globalTransactions,
      });
      queryClient.invalidateQueries({
        queryKey: QUERY_KEYS.pendingPayments,
      });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.notifications });
    },
  });
};

export const useRejectFirstPayment = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: BackendAPI.admin.rejectFirstPayment,
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: QUERY_KEYS.adminPendingFirstPayments,
      });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.children });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.schoolStudents });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.schoolStats });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.transactions });
      queryClient.invalidateQueries({
        queryKey: QUERY_KEYS.schoolTransactions,
      });
      queryClient.invalidateQueries({
        queryKey: QUERY_KEYS.globalTransactions,
      });
      queryClient.invalidateQueries({
        queryKey: QUERY_KEYS.pendingPayments,
      });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.notifications });
    },
  });
};

export const useDeclinePayment = () => {
  const queryClient = useQueryClient();
  const { showToast } = useUIStore();
  return useMutation({
    mutationFn: BackendAPI.school.declinePayment,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.pendingPayments });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.schoolStats });
      queryClient.invalidateQueries({
        queryKey: QUERY_KEYS.schoolTransactions,
      });
      queryClient.invalidateQueries({
        queryKey: QUERY_KEYS.globalTransactions,
      });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.transactions });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.notifications });
    },
    onError: (error: unknown) => {
      const message = getErrorMessage(error, "Failed to decline payment. Please try again.");
      showToast(message, "error");
    },
  });
};

// Admin Mutations
export const useAddSchool = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: BackendAPI.admin.onboardSchool,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.schools });
    },
  });
};

export const useUpdateSchool = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: School) => BackendAPI.admin.updateSchool(data), // Assuming ID is in data
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.schools });
      queryClient.invalidateQueries({ queryKey: ["schoolBankDetails"] });
    },
  });
};

export const useDeleteSchool = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: BackendAPI.admin.deleteSchool,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.schools });
    },
  });
};

export const useDeleteAllSchools = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      // Loop to handle pagination and ensure all schools are deleted
      while (true) {
        const allSchools = await BackendAPI.public.getSchools();
        if (allSchools.length === 0) break;

        // Use allSettled to ensure one failure doesn't stop the rest
        const results = await Promise.allSettled(
          allSchools.map((s) => BackendAPI.admin.deleteSchool(s.id)),
        );

        // If we failed to delete any in this batch, throw to avoid infinite loop
        const successCount = results.filter(
          (r) => r.status === "fulfilled",
        ).length;
        if (successCount === 0) {
          throw new Error(
            "Failed to delete schools. Please check permissions or network.",
          );
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.schools });
    },
  });
};

export const useBroadcast = () => {
  return useMutation({
    mutationFn: (data: { title: string; message: string }) =>
      BackendAPI.admin.broadcast(data.title, data.message),
  });
};

export const useDeleteUser = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: BackendAPI.admin.deleteUser,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.users });
    },
  });
};

export const useUpdateUser = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: BackendAPI.users.update,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.users });
    },
  });
};

export const useUpdateChildStatus = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: { childId: string; status: string }) =>
      BackendAPI.school.updateStudentStatus(data.childId, data.status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.schoolStudents });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.children }); // If parents view it
    },
  });
};
