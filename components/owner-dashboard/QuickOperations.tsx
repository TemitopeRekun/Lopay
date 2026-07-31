import React from "react";

interface QuickOperationsProps {
  pendingApprovalsCount: number;
  onApprovals: () => void;
  onAddSchool: () => void;
  onSchools: () => void;
  onUsers: () => void;
  onBroadcast: () => void;
  onAuditLogs: () => void;
}

/** Admin quick-action grid: approvals, new school, schools, users, broadcast, audit log. */
export const QuickOperations: React.FC<QuickOperationsProps> = ({
  pendingApprovalsCount,
  onApprovals,
  onAddSchool,
  onSchools,
  onUsers,
  onBroadcast,
  onAuditLogs,
}) => (
  <div className="grid grid-cols-2 gap-3">
    <button
      onClick={onApprovals}
      className="col-span-2 flex items-center justify-between p-5 bg-primary/5 border-2 border-primary/20 rounded-[24px] hover:bg-primary/10 transition-all relative group"
    >
      <div className="flex items-center gap-4">
        <div className="size-12 rounded-2xl bg-primary flex items-center justify-center text-white shadow-lg shadow-primary/20">
          <span className="material-symbols-outlined text-2xl filled">
            verified_user
          </span>
        </div>
        <div className="text-left">
          <p className="text-sm font-black text-primary uppercase tracking-widest">
            Verify Approvals
          </p>
          <p className="text-[10px] text-primary/60 font-bold uppercase">
            {pendingApprovalsCount} Requests Pending
          </p>
        </div>
      </div>
      <span className="material-symbols-outlined text-primary group-hover:translate-x-1 transition-transform">
        chevron_right
      </span>
    </button>

    <button
      onClick={onAddSchool}
      className="flex flex-col items-center justify-center gap-2 p-5 bg-white dark:bg-card-dark border-2 border-gray-100 dark:border-gray-800 rounded-[28px] hover:border-primary/40 transition-all group"
    >
      <div className="size-10 rounded-full bg-gray-50 dark:bg-white/5 flex items-center justify-center text-text-secondary-light group-hover:text-primary transition-colors">
        <span className="material-symbols-outlined">add_business</span>
      </div>
      <span className="text-[10px] font-black text-text-primary-light dark:text-text-primary-dark uppercase tracking-widest">
        New School
      </span>
    </button>

    <button
      onClick={onSchools}
      className="flex flex-col items-center justify-center gap-2 p-5 bg-white dark:bg-card-dark border-2 border-gray-100 dark:border-gray-800 rounded-[28px] hover:border-primary/40 transition-all group"
    >
      <div className="size-10 rounded-full bg-gray-50 dark:bg-white/5 flex items-center justify-center text-text-secondary-light group-hover:text-primary transition-colors">
        <span className="material-symbols-outlined">school</span>
      </div>
      <span className="text-[10px] font-black text-text-primary-light dark:text-text-primary-dark uppercase tracking-widest">
        All Schools
      </span>
    </button>

    <button
      onClick={onUsers}
      className="flex flex-col items-center justify-center gap-2 p-5 bg-white dark:bg-card-dark border-2 border-gray-100 dark:border-gray-800 rounded-[28px] hover:border-primary/40 transition-all group"
    >
      <div className="size-10 rounded-full bg-gray-50 dark:bg-white/5 flex items-center justify-center text-text-secondary-light group-hover:text-primary transition-colors">
        <span className="material-symbols-outlined">group</span>
      </div>
      <span className="text-[10px] font-black text-text-primary-light dark:text-text-primary-dark uppercase tracking-widest">
        Users Directory
      </span>
    </button>

    <button
      onClick={onBroadcast}
      className="flex flex-col items-center justify-center gap-2 p-5 bg-white dark:bg-card-dark border-2 border-gray-100 dark:border-gray-800 rounded-[28px] hover:border-primary/40 transition-all group"
    >
      <div className="size-10 rounded-full bg-gray-50 dark:bg-white/5 flex items-center justify-center text-text-secondary-light group-hover:text-primary transition-colors">
        <span className="material-symbols-outlined">campaign</span>
      </div>
      <span className="text-[10px] font-black text-text-primary-light dark:text-text-primary-dark uppercase tracking-widest">
        Broadcast
      </span>
    </button>

    <button
      onClick={onAuditLogs}
      className="flex flex-col items-center justify-center gap-2 p-5 bg-white dark:bg-card-dark border-2 border-gray-100 dark:border-gray-800 rounded-[28px] hover:border-primary/40 transition-all group"
    >
      <div className="size-10 rounded-full bg-gray-50 dark:bg-white/5 flex items-center justify-center text-text-secondary-light group-hover:text-primary transition-colors">
        <span className="material-symbols-outlined">history</span>
      </div>
      <span className="text-[10px] font-black text-text-primary-light dark:text-text-primary-dark uppercase tracking-widest">
        Audit Log
      </span>
    </button>
  </div>
);
