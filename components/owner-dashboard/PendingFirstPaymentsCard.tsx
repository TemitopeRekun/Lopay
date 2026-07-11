import React from "react";

export interface PendingFirstPaymentSchool {
  schoolId: string;
  schoolName: string;
  count: number;
}

interface PendingFirstPaymentsCardProps {
  items: PendingFirstPaymentSchool[];
  onReview: (schoolId: string) => void;
}

/** Schools with pending first payments; each row deep-links into approvals. */
export const PendingFirstPaymentsCard: React.FC<
  PendingFirstPaymentsCardProps
> = ({ items, onReview }) => (
  <div className="bg-white dark:bg-card-dark p-6 rounded-[32px] border border-gray-100 dark:border-gray-800 shadow-sm">
    <div className="flex items-center justify-between mb-4">
      <div>
        <h3 className="text-sm font-black text-text-primary-light dark:text-text-primary-dark uppercase tracking-widest">
          First Payments Overview
        </h3>
        <p className="text-[10px] text-text-secondary-light font-bold">
          Schools with pending first payments
        </p>
      </div>
    </div>
    <div className="space-y-2">
      {items.map((item) => (
        <button
          key={item.schoolId || item.schoolName}
          onClick={() => onReview(item.schoolId)}
          className="w-full flex items-center justify-between px-4 py-3 rounded-2xl border border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-white/5 hover:border-primary/40 hover:bg-primary/5 transition-all"
        >
          <div className="flex flex-col items-start">
            <span className="text-xs font-bold text-text-primary-light dark:text-text-primary-dark">
              {item.schoolName}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-black text-primary uppercase tracking-widest">
              {item.count} Pending
            </span>
            <span className="material-symbols-outlined text-primary text-sm">
              chevron_right
            </span>
          </div>
        </button>
      ))}
    </div>
  </div>
);
