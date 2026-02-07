export interface User {
  id: string;
  name: string;
  email: string;
  password?: string;
  phoneNumber?: string;
  role: "parent" | "owner" | "school_owner" | "university_student";
  schoolId?: string;
  bankName?: string;
  accountName?: string;
  accountNumber?: string;
  createdAt: string;
}

export interface Child {
  id: string;
  parentId: string;
  name: string;
  school: string;
  grade: string;
  totalFee: number;
  paidAmount: number;
  nextInstallmentAmount: number;
  nextDueDate: string;
  status:
    | "Active"
    | "Pending"
    | "Completed"
    | "Defaulted"
    | "Failed";
  avatarUrl: string;
}

export interface Transaction {
  id: string;
  userId: string;
  childId?: string;
  childName: string;
  schoolName: string;
  amount: number;
  date: string;
  status: "Successful" | "Pending" | "Failed";
  receiptUrl?: string;
}

export interface Notification {
  id: string;
  userId?: string;
  type: "payment" | "alert" | "announcement";
  title: string;
  message: string;
  timestamp: string;
  read: boolean;
  status?: "success" | "warning" | "error" | "info";
}

export interface PaymentPlan {
  type: "Weekly" | "Monthly";
  amount: number;
  frequencyLabel: string;
  numberOfPayments: number;
}

export interface School {
  id: string;
  name: string;
  address: string;
  email: string;
  phone: string;
}

export interface SchoolFee {
  className: string;
  feeAmount: number;
}

export interface PaymentPlanOption {
  type: "Weekly" | "Monthly";
  frequencyLabel: string;
  numberOfPayments: number;
  baseAmount: number; // The amount before fees
  serviceFee: number; // The fee amount per installment
  totalAmount: number; // The total amount the user pays per installment
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

// --- API Response Types ---

export interface LoginResponse {
  accessToken: string;
  user: {
    id: string;
    email: string;
    role: string;
  };
}

export interface SchoolStats {
  totalRevenue: number;
  pendingRevenue: number;
  totalStudents: number;
  activeStudents: number;
}

export interface PendingPayment {
  id: string;
  amountPaid: number;
  studentName: string;
  date: string;
  receiptUrl?: string;
  studentId?: string;
  enrollmentId?: string;
}

export interface EnrolledChild {
  id: string;
  childName: string;
  schoolName: string;
  className: string;
  remainingBalance: number;
  paymentStatus: string;
  payments?: any[];
}
