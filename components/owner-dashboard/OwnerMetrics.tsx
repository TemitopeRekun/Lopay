import React from "react";

interface OwnerMetricsProps {
  /** Undefined until the admin endpoint answers — rendered as "—", never as 0. */
  displayRevenue?: number;
  totalStudents?: number;
  /** All uncollected fees, on schedule or not. */
  outstandingBalance?: number;
  /** Only what is past due against each plan's schedule. */
  overdueBalance?: number;
  onStudentsClick: () => void;
  onOutstandingClick: () => void;
  onOverdueClick: () => void;
}

/**
 * Full naira, grouped — no "M"/"k" rounding. The previous card divided by 1e6
 * and fixed to one decimal, so every balance under ₦100k rendered as "₦0.0M".
 */
const formatNaira = (value?: number) =>
  typeof value === "number" && Number.isFinite(value)
    ? `₦${Math.round(value).toLocaleString("en-NG")}`
    : "—";

const formatCount = (value?: number) =>
  typeof value === "number" && Number.isFinite(value)
    ? value.toLocaleString("en-NG")
    : "—";

const cardClass =
  "text-left bg-white dark:bg-card-dark p-5 rounded-3xl border border-gray-100 dark:border-gray-800 shadow-sm hover:border-primary/40 transition-all active:scale-[0.98]";

/**
 * Top metric cards. Arrears and Overdue are deliberately separate figures rather
 * than the single conflated "Plan Arrears" number: the first is the whole
 * uncollected book, the second only what is genuinely late. Each drills into the
 * per-school → per-student breakdown for its own metric.
 */
export const OwnerMetrics: React.FC<OwnerMetricsProps> = ({
  displayRevenue,
  totalStudents,
  outstandingBalance,
  overdueBalance,
  onStudentsClick,
  onOutstandingClick,
  onOverdueClick,
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
          {formatNaira(displayRevenue)}
        </h2>
        <p className="mt-3 text-[10px] font-bold text-slate-400 uppercase tracking-[0.15em]">
          Confirmed platform fees, all time
        </p>
      </div>
    </div>

    <button type="button" onClick={onOutstandingClick} className={cardClass}>
      <p className="text-2xl font-black text-primary truncate">
        {formatNaira(outstandingBalance)}
      </p>
      <div className="flex items-center gap-1">
        <p className="text-xs font-bold text-text-secondary-light uppercase tracking-wider">
          Plan Arrears
        </p>
        <span className="material-symbols-outlined text-primary text-sm">
          chevron_right
        </span>
      </div>
      <p className="text-[9px] font-bold text-text-secondary-light/70 uppercase tracking-wider mt-0.5">
        All uncollected
      </p>
    </button>

    <button type="button" onClick={onOverdueClick} className={cardClass}>
      <p className="text-2xl font-black text-danger truncate">
        {formatNaira(overdueBalance)}
      </p>
      <div className="flex items-center gap-1">
        <p className="text-xs font-bold text-text-secondary-light uppercase tracking-wider">
          Overdue
        </p>
        <span className="material-symbols-outlined text-danger text-sm">
          chevron_right
        </span>
      </div>
      <p className="text-[9px] font-bold text-text-secondary-light/70 uppercase tracking-wider mt-0.5">
        Past due now
      </p>
    </button>

    <button
      type="button"
      onClick={onStudentsClick}
      className={`col-span-2 ${cardClass}`}
    >
      <p className="text-2xl font-black text-text-primary-light dark:text-text-primary-dark">
        {formatCount(totalStudents)}
      </p>
      <div className="flex items-center gap-1">
        <p className="text-xs font-bold text-text-secondary-light uppercase tracking-wider">
          Total Students
        </p>
        <span className="material-symbols-outlined text-text-secondary-light text-sm">
          chevron_right
        </span>
      </div>
    </button>
  </div>
);
