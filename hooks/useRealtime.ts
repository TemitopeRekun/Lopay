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

// Query keys touched when payment/balance data changes server-side. Keys are
// matched by prefix, so contextual variants (e.g. pendingPayments + contextKey)
// are covered too.
const PAYMENT_KEYS = [
  QUERY_KEYS.pendingPayments,
  QUERY_KEYS.schoolStats,
  QUERY_KEYS.schoolTransactions,
  QUERY_KEYS.schoolStudents,
  QUERY_KEYS.globalTransactions,
  QUERY_KEYS.transactions,
  QUERY_KEYS.children,
  QUERY_KEYS.adminPendingFirstPayments,
  QUERY_KEYS.adminPendingInstallments,
  QUERY_KEYS.adminPlatformRevenue,
  QUERY_KEYS.adminStudentsSummary,
  QUERY_KEYS.adminOverview,
];

// Query keys touched when enrollment state changes (PENDING/ACTIVE/COMPLETED/
// DEFAULTED).
const ENROLLMENT_KEYS = [
  QUERY_KEYS.children,
  QUERY_KEYS.schoolStudents,
  QUERY_KEYS.schoolStats,
  QUERY_KEYS.transactions,
  QUERY_KEYS.schoolTransactions,
  QUERY_KEYS.globalTransactions,
  QUERY_KEYS.pendingPayments,
  QUERY_KEYS.adminPendingFirstPayments,
  QUERY_KEYS.adminPendingInstallments,
  QUERY_KEYS.adminStudentsSummary,
  QUERY_KEYS.adminSchoolsSummary,
  QUERY_KEYS.adminOverview,
];

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
  const { token, isAuthenticated } = useAuth();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!isAuthenticated || !token) {
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
  }, [token, isAuthenticated, queryClient]);
};
