/**
 * Narrow an unknown thrown value (axios error, Error, string, API body) to a
 * display string. Single home for the `"message" in error` dance that used to be
 * copy-pasted across every React Query `onError`.
 *
 * ## The server's words come first, and that ordering is the whole point
 *
 * An axios error IS an `Error`, and its `message` is `"Request failed with
 * status code 400"`. So checking `instanceof Error` first — which read as the
 * obvious, safest order — meant every hand-written refusal the API sends was
 * replaced by that string before anyone saw it.
 *
 * The cost was invisible because nothing breaks: a message still appears, it is
 * merely the useless one. A parent whose invite link had expired was told
 * "Request failed with status code 404" instead of "This invite link is not
 * valid — ask your school to send a new one", and a school owner past their
 * migration deadline got a status code instead of the sentence explaining what
 * migration is for and how to get an extension. Those messages are written
 * carefully, on the server, close to the rule they describe; this function is
 * the one thing standing between them and the user.
 *
 * So `error.response.data.message` is consulted BEFORE `error.message`. Several
 * screens already reached into that path by hand (`AddSchoolScreen`,
 * `ConfirmPlanScreen`, `HistoryScreen`, `SchoolListScreen`) — which is the tell:
 * every author who needed a real message discovered they could not get one from
 * here and wrote their own. They can now delete that.
 */

/** Nest's ValidationPipe returns `message` as an array of field errors. */
function readApiMessage(value: unknown): string | null {
  if (typeof value === "string" && value.trim()) return value;
  if (Array.isArray(value)) {
    const parts = value.filter(
      (part): part is string => typeof part === "string" && !!part.trim(),
    );
    // Joined rather than only the first, because a form rejected on two fields
    // that names one of them sends the user round the loop again.
    if (parts.length) return parts.join(". ");
  }
  return null;
}

export function getErrorMessage(
  error: unknown,
  fallback = "Something went wrong",
): string {
  if (error && typeof error === "object") {
    const response = (error as { response?: { data?: unknown } }).response;
    const data = response?.data;

    // The normal shape: `{ statusCode, message, ... }` from Nest's exception
    // filter, or `{ message: string[] }` from the ValidationPipe.
    if (data && typeof data === "object") {
      const fromBody = readApiMessage((data as { message?: unknown }).message);
      if (fromBody) return fromBody;
      const fromError = readApiMessage((data as { error?: unknown }).error);
      if (fromError) return fromError;
    }
    // A plain-text body, which some proxies and gateways return instead.
    const fromText = readApiMessage(data);
    if (fromText) return fromText;
  }

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
