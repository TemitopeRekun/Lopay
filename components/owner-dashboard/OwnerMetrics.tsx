import React from "react";

interface OwnerMetricsProps {
  displayRevenue: number;
  totalStudents: number;
  pendingAmount: number;
}

/** Top metric cards: platform revenue, total students, plan arrears. */
export const OwnerMetrics: React.FC<OwnerMetricsProps> = ({
  displayRevenue,
  totalStudents,
  pendingAmount,
}) => (
  <div className="grid grid-cols-2 gap-4">
    <div className="col-span-2 bg-slate-900 text-white p-7 rounded-3xl shadow-xl relative overflow-hidden">
      <div className="absolute right-0 top-0 p-4 opacity-10">
        <span className="material-symbols-outlined text-9xl">
          account_balance_wallet
        </span>
      </div>
      <div className="relative z-10">
        <p className="text-slate-400 text-xs font-bold uppercase tracking-[0.2em] mb-2">
          Total Platform Revenue
        </p>
        <h2 className="text-4xl font-black tracking-tighter">
          ₦{displayRevenue.toLocaleString()}
        </h2>
        <div className="mt-4 flex items-center gap-2">
          <span className="px-2 py-1 rounded bg-accent/20 text-accent text-[9px] font-black uppercase tracking-widest border border-accent/20">
            Active Scaling
          </span>
        </div>
      </div>
    </div>

    <div className="bg-white dark:bg-card-dark p-5 rounded-3xl border border-gray-100 dark:border-gray-800 shadow-sm">
      <p className="text-2xl font-black text-text-primary-light dark:text-text-primary-dark">
        {totalStudents}
      </p>
      <p className="text-xs font-bold text-text-secondary-light uppercase tracking-wider">
        Total Students
      </p>
    </div>

    <div className="bg-white dark:bg-card-dark p-5 rounded-3xl border border-gray-100 dark:border-gray-800 shadow-sm">
      <p className="text-2xl font-black text-primary">
        ₦{(pendingAmount / 1000000).toFixed(1)}M
      </p>
      <p className="text-xs font-bold text-text-secondary-light uppercase tracking-wider">
        Plan Arrears
      </p>
    </div>
  </div>
);
