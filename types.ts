export type UserRole =
  | "parent"
  | "owner"
  | "school_owner"
  | "university_student";

export interface User {
  id: string;
  name: string; // Mapped from fullName
  email: string;
  role: UserRole;
  phoneNumber?: string;
  schoolId?: string;
  createdAt: string;
  // Optional fields for registration/context
  password?: string;
  bankName?: string;
  accountName?: string;
  accountNumber?: string;
}

export interface RegisterData {
  email: string;
  password?: string;
  confirmPassword?: string;
  fullName: string;
  phoneNumber: string;
  role: string;
}

export interface EnrollmentData {
  childId?: string;
  childName?: string;
  schoolId: string;
  className: string;
  installmentFrequency: string;
  firstPaymentPaid: number;
  termStartDate: string;
  termEndDate: string;
}

export interface Child {
  id: string; // Enrollment ID
  parentId: string; // Often not present in API, but useful in domain
  name: string; // Mapped from studentName/childName
  school: string; // Mapped from schoolName
  grade: string; // Mapped from className
  totalFee: number; // Derived or fetched
  paidAmount: number; // Derived from payments
  nextInstallmentAmount: number; // Calculated
  nextDueDate: string;
  status: "Active" | "Pending" | "Completed" | "Defaulted" | "Failed";
  avatarUrl: string;
  // Additional fields from API
  remainingBalance?: number;
  schoolId?: string;
}

export interface Transaction {
  id: string;
  userId: string; // Often inferred
  childId?: string;
  childName: string;
  schoolName: string;
  amount: number;
  date: string;
  status: "Successful" | "Pending" | "Failed";
  receiptUrl?: string;
  type?: string;
}

export interface Notification {
  id: string;
  userId?: string;
  type: "payment" | "alert" | "announcement";
  title: string;
  message: string;
  timestamp: string;
  read: boolean;
  link?: string;
  status?: "success" | "warning" | "error" | "info";
}

export interface School {
  id: string;
  name: string;
  address: string;
  email: string;
  phone: string;
  bankName?: string;
  accountName?: string;
  accountNumber?: string;
  sortCode?: string;
}

export interface SchoolFee {
  className: string;
  feeAmount: number;
  schoolId?: string;
  id?: string;
}

export interface PaymentPlan {
  type: "Weekly" | "Monthly";
  amount: number;
  frequencyLabel: string;
  numberOfPayments: number;
}

export interface PaymentPlanOption {
  type: "Weekly" | "Monthly";
  frequencyLabel: string;
  numberOfPayments: number;
  baseAmount: number;
  serviceFee: number;
  totalAmount: number;
}

export interface PaymentCalculationResponse {
  originalAmount: number;
  depositAmount: number;
  depositPercentage: number;
  platformFeePercentage: number;
  remainingBalance: number;
  plans: PaymentPlanOption[];
  platformFeeAmount: number;
  totalPayable: number;
  totalInitialPayment: number;
}

// --- Strict API Response Types ---

export interface ApiUser {
  id: string;
  email: string;
  fullName?: string; // Sometimes returned as name
  name?: string;
  role: string; // API returns uppercase string often
  phoneNumber?: string;
  createdAt: string;
  schoolId?: string;
}

export interface ApiLoginResponse {
  accessToken: string;
  user: ApiUser;
}

export interface ApiTransaction {
  id: string;
  amount: number;
  amountPaid: number; // Alias
  date: string;
  paymentDate: string; // Alias
  status: string; // "SUCCESS", "PENDING", "FAILED"
  type: string;
  paymentType: string; // Alias
  studentName: string;
  childName: string; // Alias
  className: string;
  schoolName: string;
  receiptUrl?: string;
}

export interface ApiPendingPayment {
  id: string;
  amount: number;
  amountPaid: number;
  studentName: string;
  childName: string;
  className: string;
  schoolName: string;
  receiptUrl?: string;
  date: string;
  paymentDate: string;
  type: string;
  paymentType: string;
  status: string;
}

export interface ApiPayment {
  amount: number;
  amountPaid: number;
  date: string;
  paymentDate: string;
  type: string;
  paymentType: string;
}

export interface ApiEnrollment {
  id: string;
  childId: string;
  studentName: string;
  childName: string;
  schoolName: string;
  schoolId: string;
  className: string;
  remainingBalance: number;
  paymentStatus: string; // "ACTIVE", "PENDING", etc.
  nextDueDate: string;
  payments: ApiPayment[];
  child?: {
    id: string;
    fullName: string;
    className: string;
  };
}

export interface ApiSchool {
  id: string;
  name: string;
  email?: string;
  address?: string;
  phone?: string;
  bankName?: string;
  accountName?: string;
  accountNumber?: string;
  sortCode?: string;
}

export interface ApiSchoolStats {
  totalRevenue: number;
  pendingRevenue: number;
  totalStudents: number;
  activeStudents: number;
}

export interface ApiNotification {
  id: string;
  title: string;
  message: string;
  link?: string;
  isRead: boolean;
  createdAt: string;
}
