import React from "react";

interface SchoolContextBannerProps {
  label: string;
  onExit: () => void;
}

/**
 * Sticky banner shown while a platform admin has scoped themselves to one
 * school. This is a data-scope switch, not identity borrowing — the session is
 * still the admin's own, and user impersonation no longer exists in the app.
 */
export const SchoolContextBanner: React.FC<SchoolContextBannerProps> = ({
  label,
  onExit,
}) => (
  <div className="bg-secondary text-white px-6 py-2.5 flex items-center justify-between shadow-lg sticky top-0 z-50">
    <div className="flex items-center gap-2">
      <span className="material-symbols-outlined text-sm">visibility</span>
      <p className="text-[10px] font-black uppercase tracking-widest">
        Managing {label}
      </p>
    </div>
    <button
      onClick={onExit}
      className="bg-white text-secondary px-3 py-1 rounded-full text-[9px] font-black uppercase shadow-sm active:scale-95"
    >
      Exit School
    </button>
  </div>
);
