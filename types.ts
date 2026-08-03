export type UserRole =
  | "parent"
  | "owner"
  | "school_owner";

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
  /**
   * Plans across this user's children, counted by the server. Only the admin
   * user list supplies it — undefined elsewhere, never derived client-side.
   */
  enrollmentCount?: number;
}

export interface RegisterData {
  email: string;
  password?: string;
  confirmPassword?: string;
  fullName: string;
  phoneNumber: string;
  role: string;
  schoolId?: string;
}

/*
 * `EnrollmentData` described the body of POST /enrollments — the manual
 * receipt-based first-payment route the backend removed when first payments moved
 * to the Paystack split. Its only consumer was DataContext.addChild, which no
 * screen ever called. The live shape is the argument to
 * `BackendAPI.parent.initiateFirstPayment`.
 */

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
  availableBalance?: number;
  schoolId?: string;
  installmentFrequency?: string;
  installmentAmount?: number;
  /** Schedule slots the parent's money has closed (server-derived, not a payment count). */
  installmentsPaid?: number;
  /** Slots in the plan's schedule (12 weekly / 3 monthly). */
  installmentsTotal?: number;
  /** Paid into the next slot but not enough to close it. */
  creditTowardNextInstallment?: number;
  hasPendingInstallment?: boolean;
  hasFailedFirstPayment?: boolean;
  hasFailedInstallment?: boolean;
  payments?: ApiPayment[];
}

export interface Transaction {
  id: string;
  userId: string; // Often inferred
  childId?: string;
  childName: string;
  schoolId?: string;
  schoolName: string;
  amount: number;
  date: string;
  // "Reversed" is distinct from "Failed": the money did arrive and was confirmed,
  // then undone. Folding it into Pending (as this union used to) contradicted the
  // "Payment Reversed" notification the parent had just received.
  status: "Successful" | "Pending" | "Failed" | "Reversed";
  receiptUrl?: string;
  receiptSignedUrl?: string;
  type?: string;
  className?: string;
  platformFeeAmount?: number;
  platformFeePercentage?: number;
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
  ownerName?: string;
  address: string;
  email: string;
  contactEmail?: string;
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

export interface ApiSchoolBankDetails {
  bankName: string;
  accountName: string;
  accountNumber: string;
}

export interface ApiUser {
  id: string;
  email: string;
  fullName?: string; // Sometimes returned as name
  name?: string;
  role: string; // API returns uppercase string often
  phoneNumber?: string;
  createdAt: string;
  schoolId?: string;
  /**
   * Plans held across this user's children, counted by the server.
   *
   * The admin directory used to derive this in the browser by filtering a school
   * roster on `child.parentId` — a SCHOOL_OWNER-only endpoint (403 for the admin
   * reading it) matched against a field the adapter hard-codes to `""`, so every
   * parent rendered "0 Plans". Only the admin user list supplies it.
   */
  enrollmentCount?: number;
}

export interface ApiLoginResponse {
  accessToken: string;
  user: ApiUser;
}

/**
 * Standard paginated list envelope returned by the admin list endpoints
 * (Milestone 4 — Scale). Mirrors the backend `common/pagination.ts` shape.
 */
export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
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
  schoolId?: string;
  schoolName: string;
  receiptUrl?: string;
  receiptSignedUrl?: string;
  // Fee fields arrive under several names depending on the endpoint; all optional.
  platformFeeAmount?: number;
  platformFee?: number;
  platformFeePercentage?: number;
  platformFeeRate?: number;
}

export interface ApiPendingPayment {
  id: string;
  amount: number;
  amountPaid: number;
  studentName: string;
  childName: string;
  className: string;
  schoolId?: string;
  schoolName: string;
  receiptUrl?: string;
  receiptSignedUrl?: string;
  date: string;
  paymentDate: string;
  type: string;
  paymentType: string;
  status: string;
  platformFeeAmount?: number;
  platformFee?: number;
  platformFeePercentage?: number;
  platformFeeRate?: number;
}

/** A published class fee. `feeAmount` is naira (the API converts from kobo). */
export interface ApiClassFee {
  id?: string;
  className: string;
  feeAmount: number;
  isActive?: boolean;
}

export interface ApiPayment {
  id?: string;
  amount: number;
  amountPaid: number;
  date: string;
  paymentDate: string;
  type: string;
  paymentType: string;
  status?: string;
  isConfirmed?: boolean;
  receiptUrl?: string;
  receiptSignedUrl?: string;
}

export interface ApiEnrollment {
  id: string;
  /** Present on school-roster rows, where `id` is also the enrollment id. */
  enrollmentId?: string;
  childId?: string;
  studentName?: string;
  childName?: string;
  schoolName?: string;
  schoolId?: string;
  className: string;
  remainingBalance: number;
  availableBalance?: number;
  paymentStatus?: string;
  status?: string;
  nextDueDate?: string;
  payments?: ApiPayment[];
  parentName?: string;
  parentEmail?: string;
  parentPhone?: string;
  installmentFrequency?: string;
  /**
   * The server's own next-installment figure: what it takes to close the next
   * slot of the plan's schedule. Authoritative — the client must not re-derive
   * it (see normalizeChild).
   */
  nextInstallmentAmount?: number;
  /** Slots the parent's money has closed. Value-derived, not a payment count. */
  installmentsPaid?: number;
  /** Slots in the plan's schedule (12 weekly / 3 monthly). */
  installmentsTotal?: number;
  /** Paid into the next slot but not enough to close it. */
  creditTowardNextInstallment?: number;
  installmentAmount?: number;
  standardInstallmentAmount?: number;
  paidAmount?: number;
  totalFee?: number;
  totalSchoolFee?: number;
  child?: {
    id: string;
    fullName: string;
    className: string;
  };
}

export interface ApiSchool {
  id: string;
  name: string;
  ownerName?: string;
  email?: string;
  address?: string;
  phone?: string;
  bankName?: string;
  accountName?: string;
  accountNumber?: string;
  sortCode?: string;
}

/**
 * GET /school-payments/stats — the dashboard's headline figures, all computed
 * server-side from the ledger. Mirrors SchoolPaymentsService.getDashboardStats;
 * the client must not re-derive any of these from a page of student rows.
 */
export interface ApiSchoolStats {
  /** Confirmed school share (naira). */
  totalRevenue: number;
  /** Installments awaiting this owner's approval (naira). */
  pendingRevenue: number;
  /** First payments taken but not yet settled by the platform (naira). */
  awaitingActivation: number;
  /** Outstanding balance across DEFAULTED enrollments (naira). */
  defaultedAmount: number;
  totalStudents: number;
  activeStudents: number;
}

export interface ApiNotification {
  id: string;
  title: string;
  message: string;
  /**
   * Persisted kind (`PAYMENT` | `ALERT` | `ANNOUNCEMENT`). Optional so a client
   * built against a pre-migration backend still parses; absent means PAYMENT.
   */
  type?: string;
  link?: string;
  isRead: boolean;
  createdAt: string;
}

/**
 * `GET /notifications` — a bounded window plus the true unread total.
 *
 * The endpoint used to return the caller's entire history as a bare array, which
 * every client polls from every screen. `unreadCount` is counted server-side so
 * the badge stays exact even when the unread rows fall outside the window.
 */
export interface ApiNotificationList {
  items: ApiNotification[];
  unreadCount: number;
  limit: number;
}

/**
 * `GET /enrollments/summary` — the parent dashboard's headline, derived by the
 * server from the same numbers the ledger moves.
 */
export interface ApiParentDashboardSummary {
  nextCollection: {
    amount: number;
    dueDate: string | null;
    enrollmentCount: number;
    /** Set only when exactly one plan contributes, so the card can name it. */
    enrollmentId: string | null;
    childName: string | null;
  };
  activePlans: number;
  totalPlans: number;
  totalOutstanding: number;
}
