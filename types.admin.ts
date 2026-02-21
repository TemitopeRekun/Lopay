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

export interface ApiAdminOverview {
  totalRevenue: number;
  totalStudents: number;
  activeStudents: number;
  pendingApprovals: number;
  totalOutstandingBalance: number;
  recentTransactions: import("./types").ApiTransaction[];
  revenueSeries: ApiAdminOverviewSeriesPoint[];
}
