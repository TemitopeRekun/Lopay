
export interface User {
  id: string;
  name: string;
  email: string;
  password?: string;
  phoneNumber?: string;
  role: 'parent' | 'owner' | 'school_owner' | 'university_student';
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
  status: 'On Track' | 'Due Soon' | 'Overdue' | 'Completed';
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
  status: 'Successful' | 'Pending' | 'Failed';
  receiptUrl?: string;
}

export interface Notification {
  id: string;
  userId?: string;
  type: 'payment' | 'alert' | 'announcement';
  title: string;
  message: string;
  timestamp: string;
  read: boolean;
  status?: 'success' | 'warning' | 'error' | 'info';
}

export interface PaymentPlan {
  type: 'Weekly' | 'Monthly';
  amount: number;
  frequencyLabel: string;
  numberOfPayments: number;
}

export interface School {
  id: string;
  name: string;
  address: string;
  contactEmail: string;
  studentCount: number;
  feeStructure?: Record<string, number>; // Maps grade names to fee amounts
}
