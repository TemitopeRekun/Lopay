import React from "react";

interface AccountAccessMenuProps {
  isOwnerAccount: boolean;
  userRole: string | null;
  onSwitch: () => void;
  onSettings: () => void;
  onSupport: () => void;
  onDirectory: () => void;
}

/** "Account & Access" menu: role switch plus navigation to settings/support/directory. */
export const AccountAccessMenu: React.FC<AccountAccessMenuProps> = ({
  isOwnerAccount,
  userRole,
  onSwitch,
  onSettings,
  onSupport,
  onDirectory,
}) => (
  <section className="space-y-3">
    <h3 className="text-[10px] font-black text-text-secondary-light uppercase tracking-[0.2em] mb-1 px-1">
      Account & Access
    </h3>

    {isOwnerAccount && (
      <button
        onClick={onSwitch}
        className="w-full p-4 bg-primary/5 border border-primary/20 text-primary rounded-2xl flex items-center justify-between shadow-sm hover:bg-primary/10 transition-all group"
      >
        <div className="flex items-center gap-3">
          <span className="material-symbols-outlined text-xl transition-transform group-hover:rotate-180 duration-500">
            swap_horiz
          </span>
          <span className="text-xs font-black uppercase tracking-wider">
            {userRole === "owner"
              ? "Switch to Parent View"
              : "Switch to Admin Hub"}
          </span>
        </div>
        <span className="material-symbols-outlined text-sm">
          arrow_forward_ios
        </span>
      </button>
    )}

    <div className="bg-white dark:bg-card-dark rounded-3xl border border-gray-100 dark:border-gray-800 overflow-hidden shadow-sm">
      <button
        onClick={onSettings}
        className="w-full p-4 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-white/5 transition-colors border-b border-gray-50 dark:border-gray-800"
      >
        <div className="flex items-center gap-3">
          <span className="material-symbols-outlined text-text-secondary-light text-xl">
            settings
          </span>
          <span className="text-xs font-bold text-text-primary-light dark:text-text-primary-dark">
            App Settings
          </span>
        </div>
        <span className="material-symbols-outlined text-text-secondary-light text-sm">
          chevron_right
        </span>
      </button>

      <button
        onClick={onSupport}
        className="w-full p-4 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-white/5 transition-colors border-b border-gray-50 dark:border-gray-800"
      >
        <div className="flex items-center gap-3">
          <span className="material-symbols-outlined text-text-secondary-light text-xl">
            help_center
          </span>
          <span className="text-xs font-bold text-text-primary-light dark:text-text-primary-dark">
            Support & FAQ
          </span>
        </div>
        <span className="material-symbols-outlined text-text-secondary-light text-sm">
          chevron_right
        </span>
      </button>

      {isOwnerAccount && (
        <button
          onClick={onDirectory}
          className="w-full p-4 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-white/5 transition-colors"
        >
          <div className="flex items-center gap-3">
            <span className="material-symbols-outlined text-text-secondary-light text-xl">
              group
            </span>
            <span className="text-xs font-bold text-text-primary-light dark:text-text-primary-dark">
              Directory Management
            </span>
          </div>
          <span className="material-symbols-outlined text-text-secondary-light text-sm">
            chevron_right
          </span>
        </button>
      )}
    </div>
  </section>
);
