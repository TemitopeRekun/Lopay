import { API_URL } from "./backend";

/**
 * Independent reachability check for the API, used as the second signal behind
 * the offline banner (see `serverReachable` in [[realtimeStore]]).
 *
 * It deliberately does NOT go through `apiClient`: no auth header, no
 * interceptors, no 401 refresh. The question is only whether the network can
 * carry a request to the backend, and mixing in the auth path would make an
 * expired session read as an outage — the exact confusion the banner already
 * suffered from by trusting the socket alone.
 */

/** `/health` is mounted at the server root, outside the `/api/v1` prefix. */
const HEALTH_URL = `${API_URL}/health`;

/**
 * Long enough to survive a slow mobile round-trip, short enough that the banner
 * still resolves while the user is looking at the screen. The free-tier backend
 * cold-starts far slower than this, and that is intended: while it is booting,
 * the app genuinely cannot reach it.
 */
export const REACHABILITY_TIMEOUT_MS = 8000;

/**
 * True when the backend answered at all. Any HTTP status counts, 5xx included:
 * a response proves the request was carried, and a sick handler is not an
 * offline device. Only a transport failure or a timeout reports false.
 */
export const probeServer = async (
  timeoutMs: number = REACHABILITY_TIMEOUT_MS,
): Promise<boolean> => {
  // No fetch means no way to tell. Report reachable rather than accusing the
  // network on the strength of a missing API.
  if (typeof fetch !== "function") return true;

  const controller =
    typeof AbortController === "function" ? new AbortController() : null;
  const timer = setTimeout(() => controller?.abort(), timeoutMs);

  try {
    await fetch(HEALTH_URL, {
      method: "GET",
      cache: "no-store",
      // No credentials: this must stay answerable whether or not a session
      // exists, on both the web origin and the Capacitor native origins (both
      // are in the backend CORS allowlist).
      signal: controller?.signal,
    });
    return true;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
};
