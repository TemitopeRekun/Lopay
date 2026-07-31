export interface ApiPlatformRevenue {
  totalRevenue: number;
}

export interface ApiAdminStudentsSummary {
  totalStudents: number;
  activeStudents: number;
  pendingFirstPayments: number;
  defaultedStudents: number;
  totalOutstandingBalance: number;
}

export interface ApiAdminSchoolSummary {
  schoolId: string;
  schoolName: string;
  totalStudents: number;
  pendingAmount: number;
  collectedAmount: number;
}

export interface ApiAdminOverviewSeriesPoint {
  label: string;
  value: number;
}

/** Which reading of the collections data a breakdown request wants. */
export type BreakdownTab = "students" | "outstanding" | "overdue";

export interface ApiAdminBreakdownSchool {
  schoolId: string;
  schoolName: string;
  /** Every enrollment, settled ones included. */
  totalStudents: number;
  /** Enrollments that still owe money. */
  studentsWithBalance: number;
  /** All uncollected fees, on schedule or not. */
  outstanding: number;
  /** Only what is past due against each plan's schedule. */
  overdue: number;
  overdueStudentCount: number;
}

export interface ApiAdminBreakdownSummary {
  totalOutstanding: number;
  totalOverdue: number;
  totalStudents: number;
  studentsWithBalance: number;
  overdueStudents: number;
  overdueSchools: number;
  schools: ApiAdminBreakdownSchool[];
}

export interface ApiAdminBreakdownStudent {
  childId: string;
  studentName: string;
  className: string;
  parentName: string;
  paymentStatus: string;
  totalFee: number;
  outstanding: number;
  overdue: number;
  paidInstallments: number;
  missedInstallments: number;
  daysOverdue: number;
  termExpired: boolean;
  nextDueDate: string | null;
  installmentFrequency: string;
}

export interface ApiAdminOverview {
  totalRevenue: number;
  totalStudents: number;
  activeStudents: number;
  pendingApprovals: number;
  totalOutstandingBalance: number;
  recentTransactions: import("./types").ApiTransaction[];
  revenueSeries: ApiAdminOverviewSeriesPoint[];
}
