import React, { createContext, useContext, ReactNode } from "react";
import { useAuth } from "./AuthContext";
import {
  QUERY_KEYS,
  useChildren,
  useNotifications,
  useSchools,
  useTransactions,
  useGlobalTransactions,
  useEnrollChild,
  usePayInstallment,
  useMarkNotificationRead,
  useConfirmPayment,
  useConfirmFirstPayment,
  useDeclinePayment,
  useSchoolStudents,
  usePendingPayments,
  useSchoolTransactions,
  useUpdateFee,
} from "../hooks/useQueries";
import {
  Child,
  Notification,
  School,
  Transaction,
  User,
  EnrollmentData,
} from "../types";
import { BackendAPI } from "../services/backend";
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
  schools: School[];
  isLoading: boolean;

  // Actions / Mutations
  refreshData: () => Promise<void>;
  refreshParentView: () => Promise<void>;
  refreshSchoolView: () => Promise<void>;
  refreshOwnerView: () => Promise<void>;
  addChild: (data: EnrollmentData, receiptUrl?: string) => Promise<void>;
  submitPayment: (
    childId: string,
    amount: number,
    receiptUrl?: string,
  ) => Promise<void>;
  markNotificationRead: (id: string) => Promise<void>;

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
}

const DataContext = createContext<DataContextType | undefined>(undefined);

export const DataProvider: React.FC<{ children: ReactNode }> = ({
  children,
}) => {
  const { user, isAuthenticated, effectiveRole, activeSchoolId } = useAuth();
  const queryClient = useQueryClient();

  const baseRole = user?.role;
  const isPlatformOwner = baseRole === "owner" && effectiveRole === "owner";

  const isParent =
    effectiveRole === "parent" || effectiveRole === "university_student";

  const isSchoolContext =
    effectiveRole === "school_owner" || baseRole === "school_owner";

  const schoolContextKey = isPlatformOwner
    ? "owner"
    : isSchoolContext
      ? activeSchoolId || "school"
      : "none";

  // --- Queries ---
  const { data: childrenData = [], isLoading: loadingChildren } = useChildren(
    isAuthenticated && isParent,
  );

  const { data: parentTransactions = [], isLoading: loadingTransactions } =
    useTransactions(user?.id, isAuthenticated && isParent);

  const {
    data: schoolTransactions = [],
    isLoading: loadingSchoolTransactions,
  } = useSchoolTransactions(isAuthenticated && isSchoolContext);

  const { data: globalTransactions = [] } = useGlobalTransactions(
    isAuthenticated && isPlatformOwner,
  );

  const { data: notifications = [], isLoading: loadingNotifications } =
    useNotifications(user?.id, isAuthenticated);

  const { data: schools = [], isLoading: loadingSchools } = useSchools();

  // School Owner / Platform Owner Data
  const { data: allStudents = [], isLoading: loadingStudents } =
    useSchoolStudents(
      schoolContextKey,
      isAuthenticated && (isSchoolContext || isPlatformOwner),
    );

  const { data: pendingPayments = [], isLoading: loadingPending } =
    usePendingPayments(
      schoolContextKey,
      isAuthenticated && (isSchoolContext || isPlatformOwner),
    );

  const transactions = isPlatformOwner
    ? globalTransactions
    : isSchoolContext
      ? [...pendingPayments, ...schoolTransactions]
      : parentTransactions;

  // --- Mutations ---
  const enrollChildMutation = useEnrollChild();
  const payInstallmentMutation = usePayInstallment();
  const markReadMutation = useMarkNotificationRead();
  const confirmPaymentMutation = useConfirmPayment();
  const confirmFirstPaymentMutation = useConfirmFirstPayment();
  const declinePaymentMutation = useDeclinePayment();
  const updateFeeMutation = useUpdateFee();

  const refreshParentView = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.children }),
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.transactions }),
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

  const refreshOwnerView = async () => {
    await Promise.all([
      queryClient.invalidateQueries({
        queryKey: QUERY_KEYS.globalTransactions,
      }),
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.children }),
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.schoolStudents }),
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.pendingPayments }),
      queryClient.invalidateQueries({
        queryKey: QUERY_KEYS.schoolTransactions,
      }),
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.schoolStats }),
      queryClient.invalidateQueries({
        queryKey: QUERY_KEYS.adminPendingFirstPayments,
      }),
      queryClient.invalidateQueries({
        queryKey: QUERY_KEYS.adminPendingInstallments,
      }),
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.notifications }),
    ]);
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

  const addChild = async (
    enrollmentData: EnrollmentData,
    receiptUrl?: string,
  ) => {
    await enrollChildMutation.mutateAsync({ ...enrollmentData, receiptUrl });
  };

  const submitPayment = async (
    childId: string,
    amount: number,
    receiptUrl?: string,
  ) => {
    await payInstallmentMutation.mutateAsync({
      enrollmentId: childId,
      amount,
      receiptUrl,
    });
  };

  const markNotificationRead = async (id: string) => {
    await markReadMutation.mutateAsync(id);
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
    ((isSchoolContext || isPlatformOwner) &&
      (loadingStudents || loadingPending || loadingSchoolTransactions));

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
        schools,
        isLoading,
        refreshData,
        refreshParentView,
        refreshSchoolView,
        refreshOwnerView,
        addChild,
        submitPayment,
        markNotificationRead,
        confirmPayment,
        confirmFirstPayment,
        declinePayment,
        updateFee,
        allStudents,
        pendingPayments,
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
