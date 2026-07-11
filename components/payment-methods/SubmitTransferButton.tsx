import React from "react";
import type { BankDetails } from "./types";

interface SubmitTransferButtonProps {
  bankDetails: BankDetails;
  isProcessing: boolean;
  paymentAmount: number;
  onSubmit: () => void;
}

/** Sticky footer confirm button with processing spinner and security note. */
export const SubmitTransferButton: React.FC<SubmitTransferButtonProps> = ({
  bankDetails,
  isProcessing,
  paymentAmount,
  onSubmit,
}) => (
  <div className="mt-auto pt-4">
    <button
      onClick={onSubmit}
      disabled={isProcessing || paymentAmount <= 0}
      className={`w-full h-16 text-white rounded-2xl font-black text-base uppercase tracking-widest shadow-xl disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center transition-all active:scale-95 ${bankDetails.isLopayEscrow ? "bg-primary shadow-primary/20" : "bg-success shadow-success/20"}`}
    >
      {isProcessing ? (
        <div className="flex items-center gap-3">
          <span className="size-5 border-3 border-white/30 border-t-white rounded-full animate-spin"></span>
          <span>Processing...</span>
        </div>
      ) : (
        "I have made this transfer"
      )}
    </button>
    <p className="text-center text-[10px] text-text-secondary-light mt-4 font-bold uppercase tracking-tight">
      256-bit Secure Transaction
    </p>
  </div>
);
