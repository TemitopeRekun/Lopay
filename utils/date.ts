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
