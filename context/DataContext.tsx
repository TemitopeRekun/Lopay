import React, { createContext, useContext, ReactNode } from "react";
import { useAuth } from "./AuthContext";
import {
  QUERY_KEYS,
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
  useUpdateFee,
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
  updateFee: (
    className: string,
    feeAmount: number,
    schoolId?: string,
  ) => Promise<void>;

  // Additional data for school owners (can be null/empty for parents)
  allStudents: Child[];
  pendingPayments: Transaction[];
  schoolStats: ApiSchoolStats | null;
  /** Parent-only. Null for other roles and until the first response lands. */
  parentDashboardSummary: ApiParentDashboardSummary | null;
}

const DataContext = createContext<DataContextType | undefined>(undefined);

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

  const {
    data: parentTransactions = [],
    isLoading: loadingTransactions,
    isError: errorTransactions,
  } = useTransactions(user?.id, isAuthenticated && isParent);

  const {
    data: schoolTransactions = [],
    isLoading: loadingSchoolTransactions,
    isError: errorSchoolTransactions,
  } = useSchoolTransactions(isAuthenticated && isSchoolContext);

  const { data: globalTransactions = [], isError: errorGlobalTransactions } =
    useGlobalTransactions(isAuthenticated && isPlatformOwner);

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
  const updateFeeMutation = useUpdateFee();

  const refreshParentView = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.children }),
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.transactions }),
      queryClient.invalidateQueries({
        queryKey: QUERY_KEYS.parentDashboardSummary,
      }),
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.notifications }),
    ]);
  };

  const refreshSchoolView = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.schoolStudents }),
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.pendingPayments }),
      queryClient.invalidateQueries({
        queryKey: QUERY_KEYS.schoolTransactions,
      }),
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.schoolStats }),
    ]);
  };

  /**
   * Refresh everything the admin dashboard renders.
   *
   * This used to invalidate the transaction/pending lists but NOT `adminOverview`,
   * `adminStudentsSummary`, `adminBreakdown` or `adminPlatformRevenue` — which
   * are the four queries behind every headline figure on the screen. "Retry"
   * therefore left the numbers exactly as they were.
   */
  const refreshOwnerView = async () => {
    await Promise.all(
      [
        QUERY_KEYS.globalTransactions,
        QUERY_KEYS.children,
        QUERY_KEYS.schoolStudents,
        QUERY_KEYS.pendingPayments,
        QUERY_KEYS.schoolTransactions,
        QUERY_KEYS.schoolStats,
        QUERY_KEYS.adminPendingFirstPayments,
        QUERY_KEYS.adminPendingInstallments,
        QUERY_KEYS.adminOverview,
        QUERY_KEYS.adminStudentsSummary,
        QUERY_KEYS.adminSchoolsSummary,
        QUERY_KEYS.adminPlatformRevenue,
        QUERY_KEYS.adminBreakdown,
        QUERY_KEYS.adminSchoolBreakdown,
        QUERY_KEYS.notifications,
      ].map((queryKey) => queryClient.invalidateQueries({ queryKey })),
    );
  };

  const refreshData = async () => {
    if (isPlatformOwner) {
      await refreshOwnerView();
      return;
    }
    if (isSchoolContext) {
      await refreshSchoolView();
      return;
    }
    if (isParent) {
      await refreshParentView();
      return;
    }
    await queryClient.invalidateQueries();
  };

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

  const updateFee = async (
    className: string,
    feeAmount: number,
    schoolId?: string,
  ) => {
    await updateFeeMutation.mutateAsync({ className, feeAmount, schoolId });
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
        updateFee,
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
