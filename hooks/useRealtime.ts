import { useEffect } from "react";
import { useQueryClient, type QueryClient } from "@tanstack/react-query";
import { useAuth } from "../context/AuthContext";
import { useUIStore } from "../store/uiStore";
import { useRealtimeStore } from "../store/realtimeStore";
import {
  connectSocket,
  disconnectSocket,
  type RealtimeEnvelope,
} from "../services/socket";
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

  useEffect(() => {
    // Gate on auth only: the socket layer (services/socket.ts) supplies the
    // right credential per auth mode (bearer token vs cookie).
    if (!isAuthenticated) {
      disconnectSocket();
      useRealtimeStore.getState().setStatus("disconnected");
      return;
    }

    const setStatus = useRealtimeStore.getState().setStatus;
    setStatus("connecting");

    const socket = connectSocket();

    const handleConnect = () => setStatus("connected");
    const handleDisconnect = () => setStatus("disconnected");

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
    socket.on("realtime", handleRealtime);
    if (socket.connected) setStatus("connected");

    return () => {
      socket.off("connect", handleConnect);
      socket.off("disconnect", handleDisconnect);
      socket.off("realtime", handleRealtime);
    };
  }, [isAuthenticated, queryClient]);
};
