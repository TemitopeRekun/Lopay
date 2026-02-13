import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { BackendAPI } from "../services/backend";
import {
  normalizeChild,
  normalizeNotification,
  normalizeSchool,
  normalizeTransaction,
  normalizeUser,
} from "../services/adapters";
import {
  User,
  Child,
  Transaction,
  Notification,
  School,
  SchoolFee,
} from "../types";

// --- Keys ---
export const QUERY_KEYS = {
  user: (id: string) => ["user", id],
  children: ["children"],
  notifications: ["notifications"],
  transactions: ["transactions"],
  schools: ["schools"],
  schoolStats: ["schoolStats"],
  pendingPayments: ["pendingPayments"],
  schoolTransactions: ["schoolTransactions"],
  schoolStudents: ["schoolStudents"],
  users: ["users"], // Admin
  schoolFees: (schoolId: string) => ["schoolFees", schoolId],
};

// --- Hooks ---

export const useChildren = (enabled: boolean = true) => {
  return useQuery({
    queryKey: QUERY_KEYS.children,
    queryFn: async () => {
      const data = await BackendAPI.parent.getChildren();
      console.log("Fetched children raw data:", data);

      let list: any[] = [];
      if (Array.isArray(data)) {
        list = data;
      } else if ((data as any)?.data && Array.isArray((data as any).data)) {
        console.warn(
          "Backend returned wrapped data (data.data), unwrapping...",
        );
        list = (data as any).data;
      } else if (
        (data as any)?.enrollments &&
        Array.isArray((data as any).enrollments)
      ) {
        console.warn(
          "Backend returned wrapped data (data.enrollments), unwrapping...",
        );
        list = (data as any).enrollments;
      } else {
        console.error("Unexpected children data format:", data);
      }

      return list.map(normalizeChild);
    },
    enabled,
    staleTime: 1000 * 60, // 1 minute
    refetchInterval: 60000, // Poll every minute
  });
};

export const useNotifications = (userId?: string, enabled: boolean = true) => {
  return useQuery({
    queryKey: QUERY_KEYS.notifications,
    queryFn: async () => {
      const data = await BackendAPI.notifications.get();
      return (Array.isArray(data) ? data : []).map(normalizeNotification);
    },
    enabled: enabled && !!userId,
    refetchInterval: 60000,
  });
};

export const useTransactions = (userId?: string, enabled: boolean = true) => {
  return useQuery({
    queryKey: QUERY_KEYS.transactions,
    queryFn: async () => {
      // Parents get history
      const data = await BackendAPI.parent.getHistory();
      return (Array.isArray(data) ? data : []).map(normalizeTransaction);
    },
    enabled: enabled && !!userId,
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
  });
};

export const usePendingPayments = (enabled: boolean = true) => {
  return useQuery({
    queryKey: QUERY_KEYS.pendingPayments,
    queryFn: async () => {
      const data = await BackendAPI.school.getPendingPayments();
      return (Array.isArray(data) ? data : []).map(normalizeTransaction);
    },
    enabled,
  });
};

export const useSchoolTransactions = (enabled: boolean = true) => {
  return useQuery({
    queryKey: QUERY_KEYS.schoolTransactions,
    queryFn: async () => {
      const data = await BackendAPI.school.getTransactions();
      return (Array.isArray(data) ? data : []).map(normalizeTransaction);
    },
    enabled,
  });
};

export const useSchoolStudents = (enabled: boolean = true) => {
  return useQuery({
    queryKey: QUERY_KEYS.schoolStudents,
    queryFn: async () => {
      const data = await BackendAPI.school.getStudents();
      console.log("Fetched school students raw data:", data);

      let list: any[] = [];
      if (Array.isArray(data)) {
        list = data;
      } else if ((data as any)?.data && Array.isArray((data as any).data)) {
        console.warn(
          "Backend returned wrapped data (data.data), unwrapping...",
        );
        list = (data as any).data;
      } else if (
        (data as any)?.enrollments &&
        Array.isArray((data as any).enrollments)
      ) {
        // Some endpoints might reuse enrollment format
        console.warn(
          "Backend returned wrapped data (data.enrollments), unwrapping...",
        );
        list = (data as any).enrollments;
      } else if (
        (data as any)?.students &&
        Array.isArray((data as any).students)
      ) {
        console.warn(
          "Backend returned wrapped data (data.students), unwrapping...",
        );
        list = (data as any).students;
      } else {
        console.error("Unexpected school students data format:", data);
      }

      return list.map(normalizeChild);
    },
    enabled,
  });
};

export const useSchoolFees = (schoolId: string, enabled: boolean = true) => {
  return useQuery({
    queryKey: QUERY_KEYS.schoolFees(schoolId),
    queryFn: () => BackendAPI.public.getSchoolFees(schoolId),
    enabled: enabled && !!schoolId,
  });
};

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

export const useEnrollChild = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: BackendAPI.parent.enroll,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.children });
    },
  });
};

export const usePayInstallment = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: {
      enrollmentId: string;
      amount: number;
      receiptUrl?: string;
    }) =>
      BackendAPI.parent.payInstallment(
        data.enrollmentId,
        data.amount,
        data.receiptUrl,
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.children });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.transactions });
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

export const useUpdateFee = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: {
      className: string;
      feeAmount: number;
      schoolId?: string;
    }) =>
      BackendAPI.school.updateFee(
        data.className,
        data.feeAmount,
        data.schoolId,
      ),
    onSuccess: (_, variables) => {
      if (variables.schoolId) {
        queryClient.invalidateQueries({
          queryKey: QUERY_KEYS.schoolFees(variables.schoolId),
        });
      }
    },
  });
};

export const useConfirmPayment = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: BackendAPI.school.confirmPayment,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.pendingPayments });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.schoolStats });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.schoolStudents });
    },
  });
};

export const useDeclinePayment = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: BackendAPI.school.declinePayment,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.pendingPayments });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.schoolStats });
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
