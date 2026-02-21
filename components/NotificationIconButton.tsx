import React from "react";

interface NotificationIconButtonProps {
  unreadCount: number;
  onClick: () => void;
  variant?: "round" | "pill";
}

export const NotificationIconButton: React.FC<NotificationIconButtonProps> = ({
  unreadCount,
  onClick,
  variant = "round",
}) => {
  const hasUnread = unreadCount > 0;

  const baseClasses =
    "size-10 flex items-center justify-center bg-white dark:bg-card-dark border border-gray-100 dark:border-gray-800 text-text-primary-light dark:text-text-primary-dark shadow-sm hover:shadow-md transition-all relative";

  const shapeClasses =
    variant === "round" ? "rounded-full" : "rounded-2xl";

  return (
    <button onClick={onClick} className={`${baseClasses} ${shapeClasses}`}>
      <span className="material-symbols-outlined text-xl">notifications</span>
      {hasUnread && (
        <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 bg-danger text-white text-[10px] font-black rounded-full flex items-center justify-center border-2 border-white dark:border-card-dark">
          {unreadCount > 99 ? "99+" : unreadCount}
        </span>
      )}
    </button>
  );
};
