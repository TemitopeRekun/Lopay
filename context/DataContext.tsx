import React, { createContext, useContext, ReactNode } from "react";
import { useAuth } from "./AuthContext";
import {
  useChildren,
  useNotifications,
  useSchools,
  useTransactions,
  useEnrollChild,
  usePayInstallment,
  useMarkNotificationRead,
  useConfirmPayment,
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
  childrenData: Child[];
  transactions: Transaction[];
  notifications: Notification[];
  schools: School[];
  isLoading: boolean;

  // Actions / Mutations
  refreshData: () => Promise<void>;
  addChild: (data: EnrollmentData, receiptUrl?: string) => Promise<void>;
  submitPayment: (
    childId: string,
    amount: number,
    receiptUrl?: string,
  ) => Promise<void>;
  markNotificationRead: (id: string) => Promise<void>;

  // School Owner Actions
  confirmPayment: (paymentId: string) => Promise<void>;
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
  const { user, isAuthenticated, role } = useAuth();
  const queryClient = useQueryClient();

  // Use effective role for data fetching logic
  const isParent = role === "parent";
  const isSchoolOwner = role === "school_owner" || role === "owner";

  // --- Queries ---
  const { data: childrenData = [], isLoading: loadingChildren } = useChildren(
    isAuthenticated && isParent,
  );

  const { data: parentTransactions = [], isLoading: loadingTransactions } =
    useTransactions(user?.id, isAuthenticated && isParent);

  const {
    data: schoolTransactions = [],
    isLoading: loadingSchoolTransactions,
  } = useSchoolTransactions(isAuthenticated && isSchoolOwner);

  const { data: notifications = [], isLoading: loadingNotifications } =
    useNotifications(user?.id, isAuthenticated);

  const { data: schools = [], isLoading: loadingSchools } = useSchools();

  // School Owner Data
  const { data: allStudents = [], isLoading: loadingStudents } =
    useSchoolStudents(isAuthenticated && isSchoolOwner);

  const { data: pendingPayments = [], isLoading: loadingPending } =
    usePendingPayments(isAuthenticated && isSchoolOwner);

  const transactions = isSchoolOwner
    ? [...pendingPayments, ...schoolTransactions]
    : parentTransactions;

  // --- Mutations ---
  const enrollChildMutation = useEnrollChild();
  const payInstallmentMutation = usePayInstallment();
  const markReadMutation = useMarkNotificationRead();
  const confirmPaymentMutation = useConfirmPayment();
  const declinePaymentMutation = useDeclinePayment();
  const updateFeeMutation = useUpdateFee();

  // --- Handlers ---

  const refreshData = async () => {
    // Invalidate all relevant queries
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
    (isSchoolOwner &&
      (loadingStudents || loadingPending || loadingSchoolTransactions));

  return (
    <DataContext.Provider
      value={{
        childrenData,
        transactions,
        notifications,
        schools,
        isLoading,
        refreshData,
        addChild,
        submitPayment,
        markNotificationRead,
        confirmPayment,
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
