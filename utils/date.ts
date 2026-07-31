export const calculateNextDueDate = (
  termStartDate: string | undefined,
  frequency: string | undefined,
  paymentsCount: number
): string => {
  if (!termStartDate) return "Pending";

  const start = new Date(termStartDate);
  if (isNaN(start.getTime())) return "Pending";

  const freq = (frequency || "MONTHLY").toUpperCase();
  const nextDate = new Date(start);

  // If 0 payments made, due date is term start date (or today if passed)
  // If 1 payment made, due date is start + 1 period
  const periodsToAdd = paymentsCount;

  if (freq === "WEEKLY") {
    nextDate.setDate(start.getDate() + periodsToAdd * 7);
  } else if (freq === "BIWEEKLY" || freq === "FORTNIGHTLY") {
    nextDate.setDate(start.getDate() + periodsToAdd * 14);
  } else {
    // Default to Monthly
    nextDate.setMonth(start.getMonth() + periodsToAdd);
  }

  return nextDate.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
};

export const formatDate = (dateString: string | undefined): string => {
  if (!dateString) return "-";
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return "-";
  return date.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
};

/**
 * A short "when did this happen" label for list rows.
 *
 * Recent events read better relative ("2h ago" — was this payment just now or
 * last week?), older ones as a date. Anything unparseable falls back to "-" rather
 * than rendering the raw string: these fields carry ISO timestamps straight off the
 * API, and printing `2026-07-31T09:14:02.318Z` in a notification row is what this
 * replaces.
 */
export const formatRelativeTime = (
  dateString: string | undefined,
  now: Date = new Date(),
): string => {
  if (!dateString) return "-";
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return "-";

  const diffMs = now.getTime() - date.getTime();
  const minutes = Math.floor(diffMs / 60000);

  // Clock skew (or a future-dated row) shouldn't render as "-43m ago".
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;

  const days = Math.floor(hours / 24);
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days}d ago`;

  // Older than a week: the calendar date is more useful than "23d ago".
  return date.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    ...(date.getFullYear() === now.getFullYear() ? {} : { year: "numeric" }),
  });
};

/**
 * Date + time, for a single record's detail view where the exact moment matters
 * (e.g. "when exactly was this payment submitted").
 */
export const formatDateTime = (dateString: string | undefined): string => {
  if (!dateString) return "-";
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return "-";
  return date.toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};
