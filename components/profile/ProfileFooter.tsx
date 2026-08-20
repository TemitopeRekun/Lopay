import React from "react";
import { APP_BUILD_LABEL } from "@/utils/version";

interface ProfileFooterProps {
  onLogout: () => void;
  userId?: string;
  userRole: string | null;
  rawRole?: string;
}

/** Secure log-out action plus the diagnostic user/version footer. */
export const ProfileFooter: React.FC<ProfileFooterProps> = ({
  onLogout,
  userId,
  userRole,
  rawRole,
}) => (
  <>
    <button
      onClick={onLogout}
      className="w-full h-14 bg-danger/5 text-danger border border-danger/10 rounded-2xl font-black text-xs uppercase tracking-[0.2em] shadow-sm hover:bg-danger/10 active:scale-[0.98] transition-all flex items-center justify-center gap-2"
    >
      <span className="material-symbols-outlined text-lg">logout</span>
      Secure Log Out
    </button>

    <div className="text-center mt-4 opacity-30 hover:opacity-100 transition-opacity cursor-default">
      <p className="text-[9px] font-mono text-text-secondary-light select-all">
        User ID: {userId}
        <br />
        System Role: {userRole} (Raw: {rawRole})<br />
        v{APP_BUILD_LABEL}
      </p>
    </div>
  </>
);
