import { useEffect } from "react";
import { useQueryClient, type QueryClient } from "@tanstack/react-query";
import { useAuth } from "../context/AuthContext";
import { useUIStore } from "../store/uiStore";
import { useRealtimeStore } from "../store/realtimeStore";
import {
  connectSocket,
  disconnectSocket,
  reconnectSocket,
  type RealtimeEnvelope,
} from "../services/socket";
import { probeServer } from "../services/reachability";
import { QUERY_KEYS } from "./useQueries";

/**
 * Every server-derived key that a money or enrollment event can invalidate.
 *
 * Both events touch the same set. They were maintained as two hand-curated
 * lists, and each had drifted: `adminBreakdown` was in NEITHER, so the admin
 * dashboard's Overdue tile and the whole collections-breakdown screen never
 * updated on an open tab (that query has no poll either — only a window-focus
 * refetch). `adminPlatformRevenue` was missing from the enrollment list and
 * `adminSchoolsSummary` from the payment list, for no reason either could state.
 *
 * A single list is now shared by both. Over-invalidating a query React Query
 * isn't currently observing costs nothing — it only marks cached data stale, and
 * an unmounted query refetches on its next mount. A MISSING key, by contrast, is
 * a number on screen that silently stops tracking the ledger, which is the whole
 * failure this map exists to prevent.
 *
 * `hooks/useRealtime.test.tsx` pins this against QUERY_KEYS so a new
 * server-derived query cannot be added without landing here.
 */
const SERVER_DERIVED_KEYS = [
  // Parent
  QUERY_KEYS.children,
  QUERY_KEYS.transactions,
  QUERY_KEYS.parentDashboardSummary,
  // The post-payment screen. Listed as a bare prefix so it matches whichever
  // reference/paymentId the parent is currently looking at: an installment sits
  // on "awaiting school confirmation" for as long as the school takes, and this
  // is what flips it to confirmed the moment they act, without a refresh.
  ["paymentOutcome"],
  // School owner
  QUERY_KEYS.pendingPayments,
  QUERY_KEYS.schoolStats,
  QUERY_KEYS.schoolTransactions,
  QUERY_KEYS.schoolStudents,
  // Platform admin
  QUERY_KEYS.globalTransactions,
  QUERY_KEYS.adminPendingFirstPayments,
  QUERY_KEYS.adminPendingInstallments,
  QUERY_KEYS.adminPlatformRevenue,
  QUERY_KEYS.adminStudentsSummary,
  QUERY_KEYS.adminSchoolsSummary,
  QUERY_KEYS.adminOverview,
  QUERY_KEYS.adminBreakdown,
  QUERY_KEYS.adminSchoolBreakdown,
];

// Kept as named exports so the two event types stay legible at the call site
// even though they currently resolve to the same set.
const PAYMENT_KEYS = SERVER_DERIVED_KEYS;
const ENROLLMENT_KEYS = SERVER_DERIVED_KEYS;

export const REALTIME_INVALIDATED_KEYS = SERVER_DERIVED_KEYS;

/**
 * Grace period before the first reachability probe after the socket drops.
 *
 * A dropped socket usually comes back inside socket.io's own backoff, and
 * probing instantly would spend a request on every routine blip. Nothing is
 * hidden by waiting: the banner is gated on a FAILED probe, so it simply stays
 * down for these few seconds instead of flashing.
 */
export const REACHABILITY_GRACE_MS = 3000;
/**
 * Re-probe cadence while the socket is still down. This is also what clears a
 * stale banner on its own: once the backend answers again, `serverReachable`
 * flips back to true whether or not the socket has managed to reconnect.
 */
export const REACHABILITY_INTERVAL_MS = 15000;

/**
 * How many consecutive failed handshakes settle the status to `disconnected`.
 *
 * A handshake that never completes emits `connect_error`, NOT `disconnect`. With
 * no listener for it the status sat at `connecting` for as long as the app was
 * open — the state the banner deliberately ignores — so the one case it most
 * needs to report, launching against a backend that is asleep or down, was the
 * one case it stayed silent through. (The free instance spins down after ~15
 * minutes idle, so this is the ordinary first launch of the day.)
 *
 * Two rather than one because a single failure is a blip: the first attempt can
 * lose a race with a network that is still coming up. Beyond that the retries
 * are socket.io's own, and pretending we are still "connecting" through them
 * only hides the outage. Nothing shows on screen from this alone either — it
 * merely arms the reachability probe, which still has to fail before the word
 * "Offline" is used.
 */
export const CONNECT_ERROR_TOLERANCE = 2;

const invalidate = (queryClient: QueryClient, keys: readonly string[][]) => {
  for (const queryKey of keys) {
    queryClient.invalidateQueries({ queryKey });
  }
};

/**
 * Bridges the realtime socket to React Query + the Zustand stores. Mounted once
 * near the app root (see RealtimeManager in App.tsx). While authenticated it
 * keeps a single socket open and, on each pushed event, invalidates the
 * affected queries so React Query refetches just what changed — replacing the
 * old interval polling.
 */
export const useRealtime = () => {
  const { isAuthenticated } = useAuth();
  const queryClient = useQueryClient();
  const socketStatus = useRealtimeStore((s) => s.status);

  useEffect(() => {
    // Gate on auth only: the socket layer (services/socket.ts) supplies the
    // right credential per auth mode (bearer token vs cookie).
    if (!isAuthenticated) {
      disconnectSocket();
      useRealtimeStore.getState().setStatus("disconnected");
      // Drop the previous session's verdict with it. A `false` left lying here
      // would be inherited by the NEXT sign-in and could raise the banner before
      // that session's own probe had run.
      useRealtimeStore.getState().setServerReachable(null);
      return;
    }

    const setStatus = useRealtimeStore.getState().setStatus;
    setStatus("connecting");

    const socket = connectSocket();

    // Consecutive failed handshakes since the last time we were demonstrably
    // connected. Lives in the effect closure, so a re-run (sign-in change) starts
    // it over — which is what a fresh credential deserves.
    let connectErrors = 0;

    const handleConnect = () => {
      connectErrors = 0;
      setStatus("connected");
      // Back to unknown, not true: a socket that is up makes the probe result
      // irrelevant, and clearing it means the NEXT drop starts from no verdict
      // rather than inheriting a `false` that would show the banner instantly.
      useRealtimeStore.getState().setServerReachable(null);
    };
    const handleDisconnect = () => setStatus("disconnected");

    /**
     * A handshake that never landed. Distinct from `disconnect`, which only
     * fires for a connection that existed — so without this, an unreachable
     * backend left the status at `connecting` forever.
     */
    const handleConnectError = () => {
      connectErrors += 1;
      if (connectErrors >= CONNECT_ERROR_TOLERANCE) setStatus("disconnected");
    };

    const handleRealtime = (envelope: RealtimeEnvelope) => {
      useRealtimeStore.getState().markEvent();

      switch (envelope.type) {
        case "notification": {
          // Refetch notifications — the unread badge is derived from that query
          // data, so it updates live without a separate counter.
          invalidate(queryClient, [QUERY_KEYS.notifications]);
          const payload = envelope.payload as
            | { title?: string; message?: string }
            | undefined;
          if (payload?.title || payload?.message) {
            useUIStore
              .getState()
              .showToast(payload.title || payload.message || "", "info");
          }
          break;
        }
        case "payments:changed":
          invalidate(queryClient, PAYMENT_KEYS);
          break;
        case "enrollments:changed":
          invalidate(queryClient, ENROLLMENT_KEYS);
          break;
      }
    };

    socket.on("connect", handleConnect);
    socket.on("disconnect", handleDisconnect);
    socket.on("connect_error", handleConnectError);
    socket.on("realtime", handleRealtime);
    if (socket.connected) handleConnect();

    return () => {
      socket.off("connect", handleConnect);
      socket.off("disconnect", handleDisconnect);
      socket.off("connect_error", handleConnectError);
      socket.off("realtime", handleRealtime);
    };
  }, [isAuthenticated, queryClient]);

  /**
   * Second opinion on "offline".
   *
   * While the socket is down and we are signed in, ask the API directly whether
   * it is reachable. The banner is gated on this failing too, so the three ways
   * a socket dies without the network being at fault — a server-initiated close
   * socket.io will never retry, the free-tier backend dropping an idle
   * connection, a handshake rejected over a stale token — no longer read as
   * "Offline" to a user whose network is working perfectly.
   */
  useEffect(() => {
    if (!isAuthenticated || socketStatus !== "disconnected") return;

    let cancelled = false;
    let interval: ReturnType<typeof setInterval> | undefined;

    const run = async () => {
      const reachable = await probeServer();
      // The status may have recovered while the probe was in flight; a late
      // verdict about a socket that is back up would only mislead the banner.
      if (cancelled) return;
      useRealtimeStore.getState().setServerReachable(reachable);
    };

    const grace = setTimeout(() => {
      void run();
      interval = setInterval(() => void run(), REACHABILITY_INTERVAL_MS);
    }, REACHABILITY_GRACE_MS);

    return () => {
      cancelled = true;
      clearTimeout(grace);
      if (interval) clearInterval(interval);
    };
  }, [isAuthenticated, socketStatus]);

  /**
   * Reopen a dead socket when the user comes back to the app.
   *
   * Returning to a tab or foregrounding the native shell is the clearest signal
   * that someone expects live data, and it is also exactly when the socket is
   * most likely to have been culled while backgrounded. Paired with
   * pull-to-refresh in `components/Layout.tsx`, it gives the stuck-socket state
   * a path out that does not require a reload.
   */
  useEffect(() => {
    if (!isAuthenticated || typeof window === "undefined") return;

    const revive = () => {
      if (document.visibilityState === "hidden") return;
      reconnectSocket();
    };

    window.addEventListener("focus", revive);
    document.addEventListener("visibilitychange", revive);

    return () => {
      window.removeEventListener("focus", revive);
      document.removeEventListener("visibilitychange", revive);
    };
  }, [isAuthenticated]);
};
