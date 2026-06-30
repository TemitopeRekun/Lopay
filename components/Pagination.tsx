import React from "react";

interface PaginationProps {
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}

/**
 * Prev/next page controls for the admin lists (Milestone 4). Renders nothing
 * for a single page, and disables the edge buttons on the first / last page so
 * the caller can't request an out-of-range page.
 */
export const Pagination: React.FC<PaginationProps> = ({
  page,
  totalPages,
  onPageChange,
}) => {
  if (totalPages <= 1) return null;

  const canPrev = page > 1;
  const canNext = page < totalPages;

  return (
    <nav
      aria-label="Pagination"
      className="flex items-center justify-between gap-3 mt-6"
    >
      <button
        type="button"
        aria-label="Previous page"
        disabled={!canPrev}
        onClick={() => canPrev && onPageChange(page - 1)}
        className={`px-4 py-2 rounded-xl border border-gray-200 dark:border-gray-700 text-xs font-bold ${
          canPrev
            ? "bg-white dark:bg-white/5 text-text-primary-light dark:text-text-primary-dark"
            : "opacity-40 cursor-not-allowed"
        }`}
      >
        Previous
      </button>
      <span className="text-xs font-bold text-text-secondary-light dark:text-text-secondary-dark">
        Page {page} of {totalPages}
      </span>
      <button
        type="button"
        aria-label="Next page"
        disabled={!canNext}
        onClick={() => canNext && onPageChange(page + 1)}
        className={`px-4 py-2 rounded-xl border border-gray-200 dark:border-gray-700 text-xs font-bold ${
          canNext
            ? "bg-white dark:bg-white/5 text-text-primary-light dark:text-text-primary-dark"
            : "opacity-40 cursor-not-allowed"
        }`}
      >
        Next
      </button>
    </nav>
  );
};
