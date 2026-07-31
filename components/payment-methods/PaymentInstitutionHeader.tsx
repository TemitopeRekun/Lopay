import React from "react";
import type { BankDetails } from "./types";

interface PaymentInstitutionHeaderProps {
  bankDetails: BankDetails;
  primaryHeadingLabel: string;
}

/** Compact header naming the school account the payment targets. */
export const PaymentInstitutionHeader: React.FC<
  PaymentInstitutionHeaderProps
> = ({ bankDetails, primaryHeadingLabel }) => (
  <div className="mb-6 p-4 rounded-2xl bg-gray-50 dark:bg-white/5 border border-gray-100 dark:border-gray-800 flex items-center gap-4 animate-fade-in">
    <div className="size-12 rounded-xl flex items-center justify-center text-white shrink-0 shadow-lg bg-success">
      <span className="material-symbols-outlined text-2xl">
        account_balance
      </span>
    </div>
    <div className="overflow-hidden">
      <p className="text-[9px] font-black uppercase tracking-[0.15em] text-text-secondary-light">
        {primaryHeadingLabel}
      </p>
      <h3 className="text-sm font-bold truncate text-text-primary-light dark:text-text-primary-dark">
        {bankDetails.institutionName}
      </h3>
    </div>
  </div>
);
