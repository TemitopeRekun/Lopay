import React from "react";
import { Transaction } from "../types";

interface RecentTransactionsListProps {
  transactions: Transaction[];
  emptyLabel: string;
  onViewAll?: () => void;
}

export const RecentTransactionsList: React.FC<RecentTransactionsListProps> = ({
  transactions,
  emptyLabel,
  onViewAll,
}) => {
  const hasTransactions =
    Array.isArray(transactions) && transactions.length > 0;
  const items = hasTransactions ? transactions.slice(0, 5) : [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between px-1">
        <h3 className="text-xs font-bold text-text-secondary-light uppercase tracking-wider flex items-center gap-2">
          <div className="size-7 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
            <span className="material-symbols-outlined text-base filled">
              history
            </span>
          </div>
          Recent Payments Log
        </h3>
        {onViewAll && (
          <button
            onClick={onViewAll}
            className="text-[10px] font-black text-primary uppercase tracking-widest"
          >
            View All
          </button>
        )}
      </div>

      <div className="flex flex-col gap-3">
        {!hasTransactions ? (
          <div className="text-center py-8 bg-gray-50 dark:bg-white/5 rounded-2xl border border-dashed border-gray-100 dark:border-gray-800">
            <p className="text-[10px] text-text-secondary-light font-bold uppercase tracking-widest">
              {emptyLabel}
            </p>
          </div>
        ) : (
          items.map((tx) => (
            <div
              key={tx.id}
              className="bg-white dark:bg-card-dark p-4 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm flex justify-between items-center transition-all hover:border-primary/20"
            >
              <div className="flex items-center gap-3">
                <div
                  className={`size-10 rounded-xl flex items-center justify-center text-white ${
                    tx.status === "Successful"
                      ? "bg-success shadow-lg shadow-success/20"
                      : "bg-warning shadow-lg shadow-warning/20"
                  }`}
                >
                  <span className="material-symbols-outlined text-xl">
                    {tx.status === "Successful" ? "check" : "sync"}
                  </span>
                </div>
                <div>
                  <p className="text-xs font-black text-text-primary-light dark:text-text-primary-dark">
                    {tx.childName || (tx as any).reference || "Payment"}
                  </p>
                  <p className="text-[9px] text-text-secondary-light font-bold uppercase tracking-widest">
                    {tx.date}
                  </p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-sm font-black text-text-primary-light dark:text-text-primary-dark">
                  ₦{tx.amount.toLocaleString()}
                </p>
                <p
                  className={`text-[8px] font-black uppercase tracking-[0.15em] ${
                    tx.status === "Successful" ? "text-success" : "text-warning"
                  }`}
                >
                  {tx.status}
                </p>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
