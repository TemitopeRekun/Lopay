import React from "react";

type SimulatorRole = "parent" | "owner" | "school_owner";

interface DashboardSimulatorProps {
  userRole: string | null;
  onSwitchRole: (role: SimulatorRole) => void;
}

/** Role-switcher used to preview each dashboard from the admin view. */
export const DashboardSimulator: React.FC<DashboardSimulatorProps> = ({
  userRole,
  onSwitchRole,
}) => (
  <div className="bg-slate-100 dark:bg-white/5 rounded-[32px] p-6 border-2 border-dashed border-gray-200 dark:border-gray-800">
    <h3 className="text-[10px] font-black text-text-secondary-light uppercase tracking-[0.2em] mb-4 text-center">
      Dashboard Simulator
    </h3>
    <div className="flex gap-2">
      <button
        onClick={() => onSwitchRole("owner")}
        className={`flex-1 flex flex-col items-center gap-1.5 p-3 rounded-2xl border-2 transition-all ${userRole === "owner" ? "bg-slate-900 text-white border-slate-900 shadow-lg" : "bg-white dark:bg-card-dark border-gray-100 dark:border-gray-800 text-text-secondary-light"}`}
      >
        <span className="material-symbols-outlined text-lg">
          admin_panel_settings
        </span>
        <span className="text-[9px] font-black uppercase">Admin</span>
      </button>
      <button
        onClick={() => onSwitchRole("parent")}
        className={`flex-1 flex flex-col items-center gap-1.5 p-3 rounded-2xl border-2 transition-all bg-white dark:bg-card-dark border-gray-100 dark:border-gray-800 text-text-secondary-light hover:border-primary/50`}
      >
        <span className="material-symbols-outlined text-lg">
          family_restroom
        </span>
        <span className="text-[9px] font-black uppercase">Parent</span>
      </button>
      <button
        onClick={() => onSwitchRole("school_owner")}
        className={`flex-1 flex flex-col items-center gap-1.5 p-3 rounded-2xl border-2 transition-all bg-white dark:bg-card-dark border-gray-100 dark:border-gray-800 text-text-secondary-light hover:border-secondary/50`}
      >
        <span className="material-symbols-outlined text-lg">school</span>
        <span className="text-[9px] font-black uppercase">Owner</span>
      </button>
    </div>
  </div>
);
