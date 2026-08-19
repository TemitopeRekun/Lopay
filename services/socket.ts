import { io, Socket } from "socket.io-client";
import { API_URL } from "./backend";
import { getAuthMode } from "./platform";

/**
 * The realtime envelope the backend EventsGateway emits on the `"realtime"`
 * event. Mirrors `RealtimeEnvelope` in lopay-backend/src/events/events.gateway.ts.
 */
export type RealtimeEventType =
  | "notification"
  | "payments:changed"
  | "enrollments:changed";

export interface RealtimeEnvelope {
  type: RealtimeEventType;
  payload?: unknown;
}

// Single shared connection for the whole app. The backend gateway lives on the
// default namespace at the server root (not under /api/v1).
let socket: Socket | null = null;

/** The currently connected socket, or null when disconnected. */
export const getSocket = (): Socket | null => socket;

/**
 * Connect (or reuse) the shared socket. The handshake token is resolved lazily
 * from localStorage on every (re)connect, so reconnections automatically pick
 * up a token that the axios layer silently refreshed.
 */
export const connectSocket = (): Socket => {
  if (socket) {
    if (!socket.connected) socket.connect();
    return socket;
  }

  // Auth path mirrors the HTTP client (see services/platform.ts): bearer sends a
  // token in the handshake; cookie sends the httpOnly session cookie via
  // withCredentials. The handshake token is resolved lazily on every (re)connect
  // so reconnections pick up a token the axios layer silently refreshed.
  const cookieMode = getAuthMode() === "cookie";
  socket = io(API_URL, {
    ...(cookieMode
      ? { withCredentials: true }
      : {
          auth: (cb) => cb({ token: localStorage.getItem("accessToken") ?? "" }),
        }),
    transports: ["websocket", "polling"],
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 10000,
    autoConnect: true,
  });

  return socket;
};

/**
 * Nudge an existing socket back up, without creating one.
 *
 * `reconnectionAttempts: Infinity` above does NOT cover every close. When the
 * server ends the connection itself — `client.disconnect(true)` in the gateway,
 * which is how a handshake it cannot validate is refused — socket.io reports
 * `io server disconnect` and deliberately stops retrying, forever. Nothing else
 * in the app reopens it: `connectSocket` is only reached when the useRealtime
 * effect re-runs, i.e. on a sign-in change or a full reload. So a socket killed
 * that way stayed dead for the rest of the session while every HTTP call kept
 * working.
 *
 * This is the recovery path for that state, driven by the two moments a user
 * makes their intent plain (pull-to-refresh, and returning to the app).
 * Deliberately a no-op when no socket exists: signed out it is meant to be
 * down, and reviving it here would connect ahead of the auth gate.
 */
export const reconnectSocket = (): void => {
  // `socket.connect()` is idempotent: it returns early when already connected
  // and leaves an in-flight reconnect alone, so this cannot stack attempts.
  if (!socket || socket.connected) return;
  socket.connect();
};

/** Tear down the shared socket (call on logout). */
export const disconnectSocket = (): void => {
  if (socket) {
    socket.removeAllListeners();
    socket.disconnect();
    socket = null;
  }
};
