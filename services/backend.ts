import axios from "axios";
import {
  LoginResponse,
  SchoolStats,
  PendingPayment,
  EnrolledChild,
} from "../types";

const API_URL = "http://localhost:3000";

export const apiClient = axios.create({
  baseURL: API_URL,
  headers: {
    "Content-Type": "application/json",
  },
});

// Automatically add the token to every request if it exists, except for public endpoints
apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem("accessToken");
  if (token && config.url !== "/schools") {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export const BackendAPI = {
  auth: {
    login: async (idToken: string) => {
      const response = await apiClient.post<LoginResponse>("/auth/login", {
        idToken,
      });
      return response.data;
    },
    register: async (data: {
      email: string;
      password?: string;
      confirmPassword?: string;
      fullName: string;
      phoneNumber: string;
      role: string;
    }) => {
      const response = await apiClient.post("/auth/register", data);
      return response.data;
    },
  },
  users: {
    get: async (id: string) => {
      const response = await apiClient.get(`/users/${id}`);
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
    updateUser: async (user: Partial<import("../types").User>) => {
      const response = await apiClient.patch(`/users/${user.id}`, user);
      return response.data;
    },
    getUsers: async () => {
      const response = await apiClient.get<import("../types").User[]>("/users");
      return response.data;
    },
    broadcast: async (title: string, message: string) => {
      const response = await apiClient.post("/notifications/broadcast", {
        title,
        message,
      });
      return response.data;
    },
  },
  school: {
    getStats: async () => {
      const response = await apiClient.get<SchoolStats>(
        "/school-payments/stats",
      );
      return response.data;
    },
    getPendingPayments: async () => {
      const response = await apiClient.get<PendingPayment[]>(
        "/school-payments/pending",
      );
      return response.data;
    },
    getStudents: async (params?: { search?: string; className?: string }) => {
      const response = await apiClient.get<any[]>("/school-payments/students", {
        params,
      });
      return response.data;
    },
    getTransactions: async () => {
      const response = await apiClient.get<any[]>("/transactions");
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
      // Assuming endpoint exists based on requirement
      const response = await apiClient.patch(
        `/school-payments/students/${studentId}/status`,
        { status },
      );
      return response.data;
    },
  },
  public: {
    getSchools: async () => {
      const response =
        await apiClient.get<import("../types").School[]>("/schools");
      return response.data;
    },
    getSchoolFees: async (schoolId: string) => {
      const response = await apiClient.get<
        { className: string; feeAmount: number }[]
      >(`/school-payments/fees/${schoolId}`);
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
      const response = await apiClient.get<EnrolledChild[]>(
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
    }) => {
      const response = await apiClient.post("/enrollments", data);
      return response.data;
    },
    payInstallment: async (
      enrollmentId: string,
      amountPaid: number,
      receiptUrl?: string,
    ) => {
      const response = await apiClient.post("/enrollments/pay-installment", {
        enrollmentId,
        amountPaid,
        receiptUrl,
      });
      return response.data;
    },
    getHistory: async () => {
      const response = await apiClient.get<any[]>("/transactions");
      return response.data;
    },
    deleteChild: async (childId: string) => {
      const response = await apiClient.delete(`/enrollments/${childId}`);
      return response.data;
    },
  },
  notifications: {
    get: async () => {
      const response = await apiClient.get<any[]>("/notifications");
      return response.data;
    },
    markRead: async (id: string) => {
      const response = await apiClient.patch(`/notifications/${id}/read`);
      return response.data;
    },
  },
};
