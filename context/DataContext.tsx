import React, { createContext, useContext, ReactNode } from "react";
import { useAuth } from "./AuthContext";
import {
  useChildren,
  useNotifications,
  useSchools,
  useTransactions,
  useGlobalTransactions,
  usePayInstallment,
  useMarkNotificationRead,
  useMarkAllNotificationsRead,
  useConfirmPayment,
  useConfirmFirstPayment,
  useDeclinePayment,
  useSchoolStudents,
  usePendingPayments,
  useSchoolTransactions,
  useSchoolStats,
  useParentDashboardSummary,
} from "../hooks/useQueries";
import {
  Child,
  Notification,
  School,
  Transaction,
  ApiSchoolStats,
  ApiParentDashboardSummary,
} from "../types";
import { useQueryClient } from "@tanstack/react-query";

interface DataContextType {
  isPlatformOwner: boolean;
  isParent: boolean;
  isSchoolContext: boolean;

  childrenData: Child[];
  transactions: Transaction[];
  parentTransactions: Transaction[];
  schoolTransactions: Transaction[];
  globalTransactions: Transaction[];
  notifications: Notification[];
  /**
   * Unread total from the server, NOT `notifications.filter(...)`. The list is a
   * bounded window, so counting it under-reports the badge for anyone with a
   * long history.
   */
  unreadNotificationsCount: number;
  schools: School[];
  isLoading: boolean;
  hasError: boolean;

  // Actions / Mutations
  refreshData: () => Promise<void>;
  refreshParentView: () => Promise<void>;
  refreshSchoolView: () => Promise<void>;
  refreshOwnerView: () => Promise<void>;
  submitPayment: (
    childId: string,
    amount: number,
    receiptUrl?: string,
    idempotencyKey?: string,
  ) => Promise<void>;
  markNotificationRead: (id: string) => Promise<void>;
  markAllNotificationsRead: () => Promise<void>;

  // School Owner Actions
  confirmPayment: (paymentId: string) => Promise<void>;
  confirmFirstPayment: (enrollmentId: string) => Promise<void>;
  declinePayment: (paymentId: string) => Promise<void>;
  /*
   * No `updateFee` here. Fees are school-owned and written only through the
   * session-scoped /school/fees screen (`useSetMyClassFees`) — exposing a
   * schoolId-taking fee write on the shared context implied a platform admin
   * could edit a school's fee, which the SCHOOL_OWNER-only endpoint never
   * allowed.
   */

  // Additional data for school owners (can be null/empty for parents)
  allStudents: Child[];
  pendingPayments: Transaction[];
  schoolStats: ApiSchoolStats | null;
  /** Parent-only. Null for other roles and until the first response lands. */
  parentDashboardSummary: ApiParentDashboardSummary | null;
}

const DataContext = createContext<DataContextType | undefined>(undefined);

/**
 * Shared empty list.
 *
 * A fresh `[]` per render is a new reference, so every consumer memoized on
 * `transactions` would recompute on each render while a history query is
 * loading or disabled.
 */
const EMPTY_TRANSACTIONS: Transaction[] = [];

export const DataProvider: React.FC<{ children: ReactNode }> = ({
  children,
}) => {
  const { user, isAuthenticated } = useAuth();
  const queryClient = useQueryClient();

  // Derived from the session's real role. The acting-role override (and the
  // activeSchoolId scope that rode with it) is gone — it never reached the
  // server, so every "previewed" context rendered fabricated data.
  const role = user?.role ?? null;
  const isPlatformOwner = role === "owner";
  const isParent = role === "parent";
  const isSchoolContext = role === "school_owner";

  const schoolContextKey = isPlatformOwner
    ? "owner"
    : isSchoolContext
      ? "school"
      : "none";

  // --- Queries ---
  const {
    data: childrenData = [],
    isLoading: loadingChildren,
    isError: errorChildren,
  } = useChildren(isAuthenticated && isParent);

  /*
   * The first, unfiltered page of each history.
   *
   * The dashboards render a "recent transactions" strip off these, so page 1
   * newest-first is exactly right. The history SCREEN does not read them: it
   * owns its own page and status filter, both of which go to the server (see
   * HistoryScreen). Keeping that state out of the shared context is what stops
   * one screen's paging from moving another screen's list.
   */
  const {
    data: parentTransactionPage,
    isLoading: loadingTransactions,
    isError: errorTransactions,
  } = useTransactions(user?.id, isAuthenticated && isParent);
  const parentTransactions = parentTransactionPage?.items ?? EMPTY_TRANSACTIONS;

  const {
    data: schoolTransactionPage,
    isLoading: loadingSchoolTransactions,
    isError: errorSchoolTransactions,
  } = useSchoolTransactions(isAuthenticated && isSchoolContext);
  const schoolTransactions = schoolTransactionPage?.items ?? EMPTY_TRANSACTIONS;

  const { data: globalTransactionPage, isError: errorGlobalTransactions } =
    useGlobalTransactions(isAuthenticated && isPlatformOwner);
  const globalTransactions = globalTransactionPage?.items ?? EMPTY_TRANSACTIONS;

  // The list is a bounded window; `unreadCount` is the server's count over the
  // whole table, so the badge stays exact for a long-lived account whose unread
  // rows fall outside the window.
  const {
    data: notificationData,
    isLoading: loadingNotifications,
    isError: errorNotifications,
  } = useNotifications(user?.id, isAuthenticated);
  const notifications = notificationData?.items ?? [];
  const unreadNotificationsCount = notificationData?.unreadCount ?? 0;

  // The parent dashboard's headline, rolled up server-side rather than summed
  // across whatever plans this client happens to hold.
  const { data: parentDashboardSummary = null } = useParentDashboardSummary(
    isAuthenticated && isParent,
  );

  const {
    data: schools = [],
    isLoading: loadingSchools,
    isError: errorSchools,
  } = useSchools();

  // School Owner / Platform Owner Data
  const {
    data: allStudents = [],
    isLoading: loadingStudents,
    isError: errorStudents,
  } = useSchoolStudents(
    schoolContextKey,
    isAuthenticated && isSchoolContext,
  );

  const {
    data: pendingPayments = [],
    isLoading: loadingPending,
    isError: errorPending,
  } = usePendingPayments(
    schoolContextKey,
    isAuthenticated && isSchoolContext,
  );

  const {
    data: schoolStats = null,
    isLoading: loadingStats,
    isError: errorStats,
  } = useSchoolStats(isAuthenticated && isSchoolContext);

  const transactions = isPlatformOwner
    ? globalTransactions
    : isSchoolContext
      ? schoolTransactions
      : parentTransactions;

  // --- Mutations ---
  const payInstallmentMutation = usePayInstallment();
  const markReadMutation = useMarkNotificationRead();
  const markAllReadMutation = useMarkAllNotificationsRead();
  const confirmPaymentMutation = useConfirmPayment();
  const confirmFirstPaymentMutation = useConfirmFirstPayment();
  const declinePaymentMutation = useDeclinePayment();

  /**
   * Reload everything the current screen is actually rendering.
   *
   * This was three hand-maintained lists of query keys, one per role, and the
   * approach failed twice. First on the admin dashboard: the lists invalidated
   * the transaction/pending queries but not `adminOverview`,
   * `adminStudentsSummary`, `adminBreakdown` or `adminPlatformRevenue` — the
   * four behind every headline figure — so "Retry" left the numbers exactly as
   * they were. Appending those four fixed that screen and left the mechanism
   * intact, so the same failure simply moved: `["schools"]` (SchoolListScreen),
   * `["users"]` (UsersListScreen), `["auditLogs", …]` (AuditLogsScreen) and
   * `["myClassFees"]` (SchoolSetupScreen) appear in no list, so on those four
   * screens a pull-to-refresh ran the spinner and fetched nothing.
   *
   * `refetchQueries({ type: "active" })` asks React Query which queries are
   * mounted right now and refetches those. A screen's data is refreshed because
   * the screen is on it, not because someone remembered to add its key here —
   * so a new query cannot be born stale.
   *
   * `refetch`, not `invalidate`: invalidation only marks data stale and resolves
   * as soon as it has done so, which let the spinner stop before any response
   * arrived. Awaiting the refetch means the gesture ends when the data lands.
   *
   * `throwOnError` is required for this to reject. query-core catches each
   * query's failure with `noop` unless it is set, so the returned promise
   * resolves whether the network succeeded or failed — a caller that reports
   * errors (Layout's pull-to-refresh) would never see one.
   */
  const refreshData = async () => {
    await queryClient.refetchQueries({ type: "active" }, { throwOnError: true });
  };

  // Role-scoped aliases. Every caller wants "reload what I'm looking at", which
  // is what refreshData does regardless of role; these are kept because call
  // sites grew up naming them. They are deliberately the same function rather
  // than three drifting key lists.
  const refreshParentView = refreshData;
  const refreshSchoolView = refreshData;
  const refreshOwnerView = refreshData;

  const submitPayment = async (
    childId: string,
    amount: number,
    receiptUrl?: string,
    idempotencyKey?: string,
  ) => {
    await payInstallmentMutation.mutateAsync({
      enrollmentId: childId,
      amount,
      receiptUrl,
      idempotencyKey,
    });
  };

  const markNotificationRead = async (id: string) => {
    await markReadMutation.mutateAsync(id);
  };

  const markAllNotificationsRead = async () => {
    await markAllReadMutation.mutateAsync();
  };

  const confirmPayment = async (paymentId: string) => {
    await confirmPaymentMutation.mutateAsync(paymentId);
  };

  const confirmFirstPayment = async (enrollmentId: string) => {
    await confirmFirstPaymentMutation.mutateAsync(enrollmentId);
  };

  const declinePayment = async (paymentId: string) => {
    await declinePaymentMutation.mutateAsync(paymentId);
  };

  const isLoading =
    loadingChildren ||
    loadingTransactions ||
    loadingNotifications ||
    loadingSchools ||
    (isSchoolContext &&
      (loadingStudents ||
        loadingPending ||
        loadingSchoolTransactions ||
        loadingStats));

  const hasError =
    !!errorChildren ||
    !!errorTransactions ||
    !!errorNotifications ||
    !!errorSchools ||
    !!errorGlobalTransactions ||
    !!errorSchoolTransactions ||
    (isSchoolContext && (!!errorStudents || !!errorPending || !!errorStats));

  return (
    <DataContext.Provider
      value={{
        isPlatformOwner,
        isParent,
        isSchoolContext,
        childrenData,
        transactions,
        parentTransactions,
        schoolTransactions,
        globalTransactions,
        notifications,
        unreadNotificationsCount,
        schools,
        isLoading,
        hasError,
        refreshData,
        refreshParentView,
        refreshSchoolView,
        refreshOwnerView,
        submitPayment,
        markNotificationRead,
        markAllNotificationsRead,
        confirmPayment,
        confirmFirstPayment,
        declinePayment,
        allStudents,
        pendingPayments,
        schoolStats,
        parentDashboardSummary,
      }}
    >
      {children}
    </DataContext.Provider>
  );
};

export const useData = () => {
  const context = useContext(DataContext);
  if (context === undefined) {
    throw new Error("useData must be used within a DataProvider");
  }
  return context;
};

export const useParentData = () => {
  const context = useData();
  if (!context.isParent) {
    throw new Error(
      "useParentData must be used in a parent or student context",
    );
  }
  return context;
};

export const useSchoolData = () => {
  const context = useData();
  if (!context.isSchoolContext && !context.isPlatformOwner) {
    throw new Error("useSchoolData must be used in a school or owner context");
  }
  return context;
};

export const useOwnerData = () => {
  const context = useData();
  if (!context.isPlatformOwner) {
    throw new Error("useOwnerData must be used in a platform owner context");
  }
  return context;
};
