/**
 * Narrow an unknown thrown value (axios error, Error, string, API body) to a
 * display string. Single home for the `"message" in error` dance that used to be
 * copy-pasted across every React Query `onError`.
 */
export function getErrorMessage(error: unknown, fallback = "Something went wrong"): string {
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === "string" && error) return error;
  if (
    error &&
    typeof error === "object" &&
    "message" in error &&
    typeof (error as { message: unknown }).message === "string" &&
    (error as { message: string }).message
  ) {
    return (error as { message: string }).message;
  }
  return fallback;
}
