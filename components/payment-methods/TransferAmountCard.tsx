import React from "react";
import type { Child } from "../../types";
import type { BankDetails } from "./types";

interface TransferAmountCardProps {
  bankDetails: BankDetails;
  isEditingAmount: boolean;
  canEditAmount: boolean | undefined;
  paymentAmount: number;
  child: Child | null | undefined;
  onAmountChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onEditAmount: () => void;
}

/** Phase badge + editable transfer amount with outstanding-balance hint. */
export const TransferAmountCard: React.FC<TransferAmountCardProps> = ({
  bankDetails,
  isEditingAmount,
  canEditAmount,
  paymentAmount,
  child,
  onAmountChange,
  onEditAmount,
}) => (
  <div
    className={`mb-6 text-center rounded-[32px] p-6 border-2 transition-all shadow-xl shadow-gray-100 dark:shadow-none animate-fade-in-up ${bankDetails.isLopayEscrow ? "bg-primary/5 border-primary/20" : "bg-success/5 border-success/20"}`}
  >
    <div className="flex justify-center mb-2">
      <span
        className={`px-4 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest ${bankDetails.isLopayEscrow ? "bg-primary text-white" : "bg-success text-white"}`}
      >
        {bankDetails.isLopayEscrow
          ? "Phase 1: Activation"
          : `Phase 2: Direct Payment`}
      </span>
    </div>

    <div className="flex flex-col items-center">
      <p className="text-text-secondary-light dark:text-text-secondary-dark text-[10px] font-bold uppercase tracking-widest mb-1">
        Transfer Amount
      </p>

      {isEditingAmount && canEditAmount ? (
        <div className="relative w-full max-w-[200px] flex items-center justify-center">
          <span className="text-2xl font-black text-success mr-1">₦</span>
          <input
            type="number"
            autoFocus
            value={paymentAmount || ""}
            onChange={onAmountChange}
            className="w-full bg-transparent border-none text-center text-4xl font-black text-success p-0 outline-none"
            placeholder="0.00"
          />
        </div>
      ) : (
        <div className="flex items-center gap-2">
          <p
            className={`text-4xl font-black tracking-tight ${bankDetails.isLopayEscrow ? "text-primary" : "text-success"}`}
          >
            ₦
            {paymentAmount.toLocaleString(undefined, {
              minimumFractionDigits: 2,
            })}
          </p>
          {canEditAmount && (
            <button
              onClick={onEditAmount}
              className="size-8 rounded-full bg-gray-100 dark:bg-white/10 flex items-center justify-center text-text-secondary-light hover:text-success transition-colors"
            >
              <span className="material-symbols-outlined text-sm">edit</span>
            </button>
          )}
        </div>
      )}

      {!bankDetails.isLopayEscrow && child && (
        <p className="text-[9px] font-bold text-text-secondary-light mt-1 uppercase">
          Outstanding Balance: ₦
          {(() => {
            const totalFee = Number.isFinite(child.totalFee)
              ? child.totalFee
              : 0;
            const paidAmount = Number.isFinite(child.paidAmount)
              ? child.paidAmount
              : 0;
            return (totalFee - paidAmount).toLocaleString();
          })()}
        </p>
      )}
    </div>
  </div>
);
