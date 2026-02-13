import React from "react";

type StatusType =
  | "Active"
  | "Pending"
  | "Completed"
  | "Defaulted"
  | "Failed"
  | string;

interface StatusBadgeProps {
  status: StatusType;
  className?: string;
}

const getStatusColor = (status: string) => {
  const normalized = (status || "").toLowerCase();

  if (
    normalized === "active" ||
    normalized === "on track" ||
    normalized === "success"
  ) {
    return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200";
  }
  if (
    normalized === "pending" ||
    normalized === "processing" ||
    normalized === "awaiting approval"
  ) {
    return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200";
  }
  if (
    normalized === "completed" ||
    normalized === "paid" ||
    normalized === "settled"
  ) {
    return "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200";
  }
  if (normalized === "defaulted" || normalized === "overdue") {
    return "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200";
  }
  if (normalized === "failed" || normalized === "rejected") {
    return "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300";
  }
  if (normalized === "not active" || normalized === "inactive") {
    return "bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400";
  }
  return "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300";
};

export const StatusBadge: React.FC<StatusBadgeProps> = ({
  status,
  className = "",
}) => {
  return (
    <span
      className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusColor(
        status,
      )} ${className}`}
    >
      {status}
    </span>
  );
};
