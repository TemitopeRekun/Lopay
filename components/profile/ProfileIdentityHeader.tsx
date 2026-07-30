import React from "react";

interface ProfileIdentityHeaderProps {
  displayName: string;
  email?: string;
  phoneNumber?: string;
  roleLabel: string;
}

/** Avatar, name, contact details and role badge at the top of the profile. */
export const ProfileIdentityHeader: React.FC<ProfileIdentityHeaderProps> = ({
  displayName,
  email,
  phoneNumber,
  roleLabel,
}) => (
  <div className="p-8 flex flex-col items-center bg-linear-to-b from-gray-50 to-white dark:from-white/5 dark:to-background-dark border-b border-gray-100 dark:border-gray-800">
    <div className="relative mb-4">
      <div className="size-24 rounded-[32px] overflow-hidden border-4 border-white dark:border-gray-800 shadow-2xl rotate-3">
        <img
          src={`https://ui-avatars.com/api/?name=${encodeURIComponent(displayName)}&background=4A90E2&color=fff&size=256&bold=true`}
          alt="Profile"
          className="w-full h-full object-cover"
        />
      </div>
      <div className="absolute -bottom-2 -right-2 size-8 bg-accent rounded-xl flex items-center justify-center text-white border-2 border-white dark:border-background-dark shadow-lg">
        <span className="material-symbols-outlined text-sm filled">
          verified
        </span>
      </div>
    </div>

    <h2 className="text-xl font-black text-text-primary-light dark:text-text-primary-dark tracking-tight text-center">
      {displayName}
    </h2>
    <div className="flex flex-col items-center gap-1 mt-1 mb-4">
      <p className="text-sm text-text-secondary-light dark:text-text-secondary-dark font-medium">
        {email}
      </p>
      {phoneNumber && (
        <p className="text-xs text-text-secondary-light font-bold flex items-center gap-1">
          <span className="material-symbols-outlined text-[14px]">call</span>
          {phoneNumber}
        </p>
      )}
    </div>

    <div className="px-4 py-1.5 rounded-full bg-primary/10 border border-primary/20 text-[10px] font-black text-primary uppercase tracking-[0.2em]">
      {roleLabel}
    </div>
  </div>
);
