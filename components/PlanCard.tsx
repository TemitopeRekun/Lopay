import React from "react";
import { Child } from "../types";
import { StatusBadge } from "./common/StatusBadge";
import {
  getChildBalance,
  getChildDisplayStatus,
  getChildProgress,
} from "../services/ledger";

interface PlanCardProps {
  child: Child;
  mode: "parent" | "school";
  schoolName?: string;
  entityLabel?: string;
  onQuickPay?: (child: Child, amount: number) => void;
}

export const PlanCard: React.FC<PlanCardProps> = ({
  child,
  mode,
  schoolName,
  entityLabel,
  onQuickPay,
}) => {
  const balance = getChildBalance(child);
  const progressInfo = getChildProgress(child);
  const displayStatus = getChildDisplayStatus(child);

  if (mode === "school") {
    const isCompleted = child.status === "Completed";
    const isDefaulted =
      child.status === "Defaulted" || child.status === "Failed";
    const isActive = child.status === "Active";
    const isPending = child.status === "Pending";

    let bgColor = "bg-warning";

    if (isCompleted) {
      bgColor = "bg-success";
    } else if (isDefaulted) {
      bgColor = "bg-danger";
    } else if (isActive) {
      bgColor = "bg-primary";
    }

    return (
      <div className="group bg-white dark:bg-card-dark p-5 rounded-[32px] border border-gray-100 dark:border-gray-800 shadow-sm transition-all hover:border-secondary/30 hover:shadow-xl hover:shadow-secondary/5 hover:-translate-y-0.5">
        <div className="flex justify-between items-start mb-4">
          <div className="flex items-center gap-4">
            <div className="relative">
              <div className="size-12 rounded-[18px] overflow-hidden border-2 border-gray-100 dark:border-gray-800 shadow-inner group-hover:scale-105 transition-transform">
                <img
                  src={child.avatarUrl}
                  alt={child.name}
                  className="w-full h-full object-cover"
                />
              </div>
              <div
                className={`absolute -bottom-1 -right-1 size-5 rounded-full border-[3px] border-white dark:border-card-dark ${bgColor} ${
                  isPending ? "shadow-lg shadow-warning/30" : ""
                }`}
              ></div>
            </div>
              <div>
              <p className="font-black text-sm text-text-primary-light dark:text-text-primary-dark tracking-tight">
                {child.name}
              </p>
              <div className="flex items-center gap-1.5 mt-1">
                <span className="px-2 py-0.5 rounded-md bg-gray-100 dark:bg-white/5 text-[8px] font-black uppercase text-text-secondary-light tracking-tighter">
                  {child.grade}
                </span>
                <StatusBadge
                  status={child.status}
                  className="text-[9px] font-black uppercase tracking-widest"
                />
              </div>
            </div>
          </div>
          <div className="text-right">
            <p className="font-black text-base text-text-primary-light dark:text-text-primary-dark">
              ₦{balance.paid.toLocaleString()}
            </p>
            <p className="text-[9px] text-text-secondary-light font-bold uppercase tracking-widest opacity-60">
              Settled
            </p>
          </div>
        </div>

        <div className="space-y-2">
          <div className="w-full h-2 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden shadow-inner">
            <div
              className={`h-full rounded-full transition-all duration-1000 ease-out ${bgColor}`}
              style={{ width: `${progressInfo.percent}%` }}
            ></div>
          </div>
          <div className="flex justify-between items-center text-[9px] font-black text-text-secondary-light uppercase tracking-widest">
            <div className="flex items-center gap-1.5 text-secondary">
              <span className="material-symbols-outlined text-[11px] filled">
                auto_awesome
              </span>
              {Math.round(progressInfo.percent)}% Progress
            </div>
            <div className="text-text-primary-light dark:text-text-primary-dark bg-gray-50 dark:bg-white/5 px-1.5 py-0.5 rounded-md">
              ₦{balance.remaining.toLocaleString()}{" "}
              <span className="opacity-50 font-bold ml-0.5">Balance</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const isCompleted = child.status === "Completed";
  const isDefaulted = child.status === "Defaulted" || child.status === "Failed";
  const isActive = child.status === "Active";
  const hasPendingInstallment = !!child.hasPendingInstallment;
  const hasFailedFirstPayment = !!child.hasFailedFirstPayment;
  const hasFailedInstallment = !!child.hasFailedInstallment;
  const isPending = child.status === "Pending" || hasPendingInstallment;
  const isActivating = displayStatus === "Awaiting Approval";
  const isFullyInactive =
    balance.paid === 0 &&
    !isPending &&
    !isActive &&
    !isCompleted &&
    !isDefaulted;

  let progressColor = "bg-secondary";

  if (isCompleted) {
    progressColor = "bg-success";
  } else if (isDefaulted) {
    progressColor = "bg-danger";
  } else if (isActive) {
    progressColor = "bg-primary";
  } else if (isPending) {
    progressColor = "bg-warning";
  } else if (isFullyInactive) {
    progressColor = "bg-gray-300";
  }

  const nextAmount =
    child.nextInstallmentAmount && child.nextInstallmentAmount > 0
      ? child.nextInstallmentAmount
      : 0;

  const payments = child.payments || [];
  const latestPayment = payments
    .filter((p) => p && (p.date || p.paymentDate))
    .slice()
    .sort((a, b) => {
      const dateA = new Date(a.date || a.paymentDate || 0).getTime();
      const dateB = new Date(b.date || b.paymentDate || 0).getTime();
      return dateB - dateA;
    })[0];

  const latestStatus = latestPayment?.status
    ? String(latestPayment.status).toUpperCase()
    : "";

  const latestIsSuccess =
    latestStatus === "SUCCESS" ||
    latestStatus === "SUCCESSFUL" ||
    latestStatus === "PAID" ||
    latestStatus === "COMPLETED";
  const latestIsPending = latestStatus === "PENDING";
  const latestIsFailed =
    latestStatus === "FAILED" ||
    latestStatus === "REJECTED" ||
    latestStatus === "DECLINED";

  const hasPendingPayment = latestIsPending || hasPendingInstallment;
  const hasFailedPayment = latestIsFailed
    ? true
    : latestIsSuccess
      ? false
      : (hasFailedFirstPayment && balance.paid === 0) ||
        (hasFailedInstallment && !hasPendingInstallment);

  const badgeStatus = hasFailedPayment
    ? "Failed"
    : hasPendingPayment
      ? "Pending"
      : isCompleted
        ? "Completed"
        : isActive
          ? "Active"
          : isDefaulted
            ? "Defaulted"
            : "Not Active";

  const entity = entityLabel || "School";

  return (
    <div className="flex flex-col rounded-2xl bg-white dark:bg-card-dark shadow-sm border border-gray-100 dark:border-gray-800 p-0 overflow-hidden group hover:shadow-md transition-all">
      <div className="flex items-center justify-between p-4 pb-2">
        <div className="flex items-center gap-3">
          <div className="relative">
            <img
              src={child.avatarUrl}
              alt={child.name}
              className="size-12 rounded-full object-cover bg-gray-100 ring-2 ring-gray-50 dark:ring-gray-800"
            />
            {isActivating && (
              <div className="absolute -bottom-1 -right-1 size-5 bg-white dark:bg-slate-900 rounded-full flex items-center justify-center shadow-sm">
                <span className="material-symbols-outlined text-xs text-primary animate-spin">
                  sync
                </span>
              </div>
            )}
          </div>
          <div>
            <p className="font-bold text-text-primary-light dark:text-text-primary-dark">
              {child.name}
            </p>
            <p className="text-[10px] text-text-secondary-light dark:text-text-secondary-dark uppercase font-bold">
              {schoolName || child.school || "Unknown School"}
            </p>
          </div>
        </div>
        <div className="flex flex-col items-end gap-1 flex-1">
          <span className="text-[10px] font-bold text-text-secondary-light dark:text-white bg-gray-100 dark:bg-white/10 px-2 py-0.5 rounded-md">
            {child.grade}
          </span>
          <div className="flex items-center gap-2 justify-end w-full">
            <StatusBadge
              status={badgeStatus}
              className="ml-auto text-[10px] font-bold uppercase tracking-wider"
            />
          </div>
        </div>
      </div>

      <div className="px-4 py-2">
        <div className="flex justify-between items-end mb-1.5">
          <span className="text-[10px] text-text-secondary-light font-bold uppercase">
            Installments Paid
          </span>
          <span className="text-xs font-bold dark:text-white">
            <span className={isCompleted ? "text-success" : "text-primary"}>
              ₦{balance.paid.toLocaleString()}
            </span>{" "}
            <span className="text-text-secondary-light font-normal text-[10px]">
              / ₦{balance.total.toLocaleString()}
            </span>
          </span>
        </div>
        <div className="w-full h-1.5 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden shadow-inner">
          <div
            className={`h-full rounded-full transition-all duration-700 ease-out ${progressColor}`}
            style={{ width: `${progressInfo.percent}%` }}
          ></div>
        </div>
      </div>

      <div className="mt-2 p-4 bg-gray-50 dark:bg-white/5 border-top border-t border-gray-100 dark:border-gray-800">
        {isCompleted ? (
          <div className="w-full flex items-center justify-center text-success font-bold gap-2 text-sm">
            <span className="material-symbols-outlined filled text-lg">
              verified
            </span>
            <span>Tuition Fully Settled</span>
          </div>
        ) : isPending ? (
          <div className="w-full flex items-center justify-center text-warning font-bold gap-2 text-sm">
            <span className="size-4 border-2 border-warning/30 border-t-warning rounded-full animate-spin"></span>
            <span>
              {isActivating
                ? "Verifying Activation..."
                : "Processing Payment..."}
            </span>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {hasFailedPayment ? (
              <div className="w-full rounded-xl border border-danger/20 bg-danger/10 px-3 py-2 text-center">
                <p className="text-[10px] text-danger font-bold leading-snug">
                  {hasFailedFirstPayment && balance.paid === 0
                    ? "Your first payment couldnâ€™t be verified (receipt not clear). Please pay again and upload a clearer receipt."
                    : "Your last installment attempt was rejected (receipt not clear). Please pay again with a clearer image."}
                </p>
              </div>
            ) : null}
            <div>
              <p className="text-[10px] text-text-secondary-light dark:text-text-secondary-dark uppercase font-bold">
                {balance.paid === 0 ? "Activation Required" : "Next Payment"}
              </p>
              <p className="font-bold text-sm text-text-primary-light dark:text-text-primary-dark">
                ₦{nextAmount.toLocaleString()}
                <span className="text-[10px] font-normal opacity-70 ml-1">
                  {balance.paid === 0
                    ? "Due Now"
                    : `due ${child.nextDueDate || "Pending"}`}
                </span>
              </p>
            </div>
            <div className="flex flex-col gap-2 w-full">
              {false ? (
                <div className="w-full rounded-xl border border-danger/20 bg-danger/10 px-3 py-2 text-center">
                  <p className="text-[10px] text-danger font-bold leading-snug">
                    {hasFailedFirstPayment && balance.paid === 0
                      ? "Your first payment couldn’t be verified (receipt not clear). Please pay again and upload a clearer receipt."
                      : "Your last installment attempt was rejected (receipt not clear). Please pay again with a clearer image."}
                  </p>
                </div>
              ) : null}
              <div className="flex items-center gap-2 self-end">
                <button
                  onClick={() => {
                    if (onQuickPay) {
                      onQuickPay(child, nextAmount);
                    }
                  }}
                  className={`${
                    balance.paid === 0 ? "bg-primary" : "bg-success"
                  } text-white px-5 py-2.5 rounded-xl text-xs font-bold shadow-md shadow-primary/20 active:scale-95 transition-all hover:opacity-90 flex items-center gap-2`}
                >
                  <span className="material-symbols-outlined text-sm">
                    account_balance
                  </span>
                  Pay {entity}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
