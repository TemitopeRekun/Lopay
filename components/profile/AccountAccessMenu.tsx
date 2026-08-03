import React from "react";

interface AccountAccessMenuProps {
  isOwnerAccount: boolean;
  onSettings: () => void;
  onSupport: () => void;
  onDirectory: () => void;
}

/**
 * "Account & Access" menu: navigation to settings/support/directory.
 *
 * The "Switch to Parent View" toggle is gone. It set an acting role, which is
 * UI-only state the server never sees, so the parent dashboard it opened
 * immediately 403'd: `GET /enrollments/my-children` is PARENT/SCHOOL_OWNER-only
 * and `GET /transactions` default-denies a SUPER_ADMIN. An admin who genuinely
 * has children signs in as that parent; support reads real data through the admin
 * endpoints. This is the last of the acting-role entry points — the directory
 * previously lost an "impersonate" row for exactly the same reason.
 */
export const AccountAccessMenu: React.FC<AccountAccessMenuProps> = ({
  isOwnerAccount,
  onSettings,
  onSupport,
  onDirectory,
}) => (
  <section className="space-y-3">
    <h3 className="text-[10px] font-black text-text-secondary-light uppercase tracking-[0.2em] mb-1 px-1">
      Account & Access
    </h3>

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
