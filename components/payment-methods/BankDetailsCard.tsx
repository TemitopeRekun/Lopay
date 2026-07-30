import React from "react";
import type { BankDetails } from "./types";

interface BankDetailsCardProps {
  bankDetails: BankDetails;
  schoolName: string | undefined;
  paymentInfoCopy: string;
  onCopy: (text: string) => void;
}

/** Card listing the destination bank name, account holder and copyable number. */
export const BankDetailsCard: React.FC<BankDetailsCardProps> = ({
  bankDetails,
  schoolName,
  paymentInfoCopy,
  onCopy,
}) => (
  <div
    className={`bg-white dark:bg-card-dark border-2 rounded-[32px] p-6 shadow-sm mb-6 relative overflow-hidden transition-all animate-fade-in-up delay-75 ${bankDetails.isLopayEscrow ? "border-primary/20" : "border-success/20"}`}
  >
    <div className="space-y-4">
      {paymentInfoCopy && (
        <p className="text-[11px] text-text-secondary-light dark:text-text-secondary-dark leading-relaxed">
          {paymentInfoCopy}
        </p>
      )}
      <div className="flex flex-col gap-1">
        <span className="text-[9px] font-black text-text-secondary-light uppercase tracking-[0.2em]">
          {bankDetails.isLopayEscrow
            ? "Pay to LoPay (platform) account"
            : schoolName
              ? `Pay to ${schoolName} account`
              : "Pay to school account"}
        </span>
      </div>
      <div className="flex flex-col gap-1">
        <span className="text-[9px] font-black text-text-secondary-light uppercase tracking-[0.2em]">
          Bank Provider
        </span>
        <span className="font-bold text-text-primary-light dark:text-text-primary-dark text-lg">
          {bankDetails.bankName}
        </span>
      </div>
      <div className="flex flex-col gap-1">
        <span className="text-[9px] font-black text-text-secondary-light uppercase tracking-[0.2em]">
          Account Holder
        </span>
        <span className="font-bold text-text-primary-light dark:text-text-primary-dark text-lg">
          {bankDetails.accountName}
        </span>
      </div>
      <div className="flex flex-col gap-1">
        <span className="text-[9px] font-black text-text-secondary-light uppercase tracking-[0.2em]">
          Account Identifier
        </span>
        <div className="flex items-center justify-between bg-gray-50 dark:bg-white/5 p-4 rounded-2xl border border-dashed border-gray-200 dark:border-gray-700 mt-1">
          <span className="font-mono text-2xl font-black tracking-[0.2em] text-text-primary-light dark:text-text-primary-dark">
            {bankDetails.accountNumber}
          </span>
          <button
            className={`size-11 flex items-center justify-center rounded-xl text-white shadow-lg active:scale-90 transition-all ${bankDetails.isLopayEscrow ? "bg-primary shadow-primary/20" : "bg-success shadow-success/20"}`}
            onClick={() => onCopy(bankDetails.accountNumber)}
          >
            <span className="material-symbols-outlined text-xl">
              content_copy
            </span>
          </button>
        </div>
      </div>
    </div>
  </div>
);
