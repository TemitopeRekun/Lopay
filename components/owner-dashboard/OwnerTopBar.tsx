import React from "react";
import { NotificationIconButton } from "../NotificationIconButton";

interface OwnerTopBarProps {
  unreadCount: number;
  pendingApprovalsCount: number;
  onNotifications: () => void;
  onApprovals: () => void;
}

/** Admin overview sticky header: title, notifications, and approvals badge. */
export const OwnerTopBar: React.FC<OwnerTopBarProps> = ({
  unreadCount,
  pendingApprovalsCount,
  onNotifications,
  onApprovals,
}) => (
  <div className="sticky top-0 z-10 flex items-center justify-between bg-white dark:bg-background-dark p-6 pb-4 border-b border-gray-100 dark:border-gray-800">
    <h1 className="text-xl font-bold tracking-tight text-text-primary-light dark:text-text-primary-dark">
      Admin Overview
    </h1>
    <div className="flex items-center gap-3">
      <NotificationIconButton
        unreadCount={unreadCount}
        onClick={onNotifications}
      />
      <div className="relative">
        <button
          onClick={onApprovals}
          className="size-10 flex items-center justify-center rounded-full bg-primary/10 text-primary transition-all active:scale-95"
        >
          <span className="material-symbols-outlined filled">
            verified_user
          </span>
        </button>
        {pendingApprovalsCount > 0 && (
          <span className="absolute -top-1 -right-1 size-5 bg-danger text-white text-[10px] font-black rounded-full flex items-center justify-center border-2 border-white dark:border-background-dark">
            {pendingApprovalsCount}
          </span>
        )}
      </div>
    </div>
  </div>
);
