import { Child } from "../types";

export type ChildStatus = Child["status"];

export interface ChildBalance {
  total: number;
  paid: number;
  remaining: number;
}

export interface ChildProgress {
  percent: number;
  status: ChildStatus;
}

export type ChildDisplayStatus =
  | "Awaiting Approval"
  | "Not Active"
  | "Completed"
  | "Active"
  | "Pending"
  | "Defaulted"
  | "Failed";

export const getChildBalance = (child: Child): ChildBalance => {
  const total = Number.isFinite(child.totalFee) ? child.totalFee : 0;
  const paid = Number.isFinite(child.paidAmount) ? child.paidAmount : 0;
  const derivedRemaining = total - paid;
  const remainingBase =
    typeof child.remainingBalance === "number" && child.remainingBalance >= 0
      ? child.remainingBalance
      : derivedRemaining;
  const remaining = remainingBase > 0 ? remainingBase : 0;

  return {
    total: total > 0 ? total : paid + remaining,
    paid,
    remaining,
  };
};

export const getChildProgress = (child: Child): ChildProgress => {
  const balance = getChildBalance(child);
  const percent =
    balance.total > 0 ? Math.min((balance.paid / balance.total) * 100, 100) : 0;

  return {
    percent,
    status: child.status,
  };
};

export const getChildDisplayStatus = (child: Child): ChildDisplayStatus => {
  const balance = getChildBalance(child);
  const isCompleted = child.status === "Completed";
  const isDefaulted =
    child.status === "Defaulted" || child.status === "Failed";
  const isActive = child.status === "Active";
  const isPending = child.status === "Pending";
  const isFullyInactive =
    balance.paid === 0 &&
    !isPending &&
    !isActive &&
    !isCompleted &&
    !isDefaulted;

  if (isPending && balance.paid === 0) {
    return "Awaiting Approval";
  }

  if (isFullyInactive) {
    return "Not Active";
  }

  if (isCompleted) {
    return "Completed";
  }

  if (isDefaulted) {
    return child.status;
  }

  if (isActive || isPending) {
    return child.status;
  }

  return child.status;
};

