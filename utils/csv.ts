/**
 * CSV building + browser download.
 *
 * Kept separate from the screens so the escaping rules are testable on their
 * own — an export that silently mangles a school name containing a comma is
 * worse than no export.
 */

/** RFC 4180 quoting: wrap when the value holds a comma, quote, or newline. */
export const escapeCsvCell = (value: unknown): string => {
  if (value === null || value === undefined) {
    return "";
  }
  const raw = String(value);
  if (/[",\r\n]/.test(raw)) {
    return `"${raw.replace(/"/g, '""')}"`;
  }
  return raw;
};

export const toCsv = (
  headers: string[],
  rows: (string | number | null | undefined)[][],
): string =>
  [headers, ...rows]
    .map((row) => row.map(escapeCsvCell).join(","))
    .join("\r\n");

/**
 * Hand a CSV string to the browser as a download.
 *
 * Returns false when the platform has no Blob/URL support (SSR, or a webview
 * without them) so the caller can report the failure instead of claiming a
 * success that never happened.
 */
export const downloadCsv = (filename: string, csv: string): boolean => {
  if (
    typeof document === "undefined" ||
    typeof Blob === "undefined" ||
    typeof URL === "undefined" ||
    typeof URL.createObjectURL !== "function"
  ) {
    return false;
  }

  // BOM so Excel opens UTF-8 (₦, accented names) without mojibake.
  const blob = new Blob(["﻿", csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.style.display = "none";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  if (typeof URL.revokeObjectURL === "function") {
    URL.revokeObjectURL(url);
  }
  return true;
};

/** Inclusive month window in ISO form, for the history endpoint's ?from/?to. */
export const monthRange = (
  year: number,
  monthIndex: number,
): { from: string; to: string } => ({
  from: new Date(Date.UTC(year, monthIndex, 1, 0, 0, 0, 0)).toISOString(),
  to: new Date(Date.UTC(year, monthIndex + 1, 0, 23, 59, 59, 999)).toISOString(),
});
