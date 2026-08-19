import { create } from "zustand";

export type ConnectionStatus = "connecting" | "connected" | "disconnected";

interface RealtimeState {
  /** Live status of the shared socket connection. */
  status: ConnectionStatus;
  /** Epoch ms of the last realtime event received (null until the first). */
  lastEventAt: number | null;
  /**
   * Whether an HTTP probe of the API could reach it, or `null` while unknown.
   *
   * A down socket is NOT evidence of a down network: socket.io refuses to retry
   * a server-initiated close at all, the free-tier backend drops idle sockets,
   * and a rejected handshake closes one while every HTTP call still succeeds. So
   * the socket alone cannot be allowed to claim "Offline" — the banner needs a
   * second, independent signal, and this is it. `null` until a probe has
   * actually run, so an unproven suspicion never shows the banner.
   */
  serverReachable: boolean | null;

  setStatus: (status: ConnectionStatus) => void;
  setServerReachable: (reachable: boolean | null) => void;
  markEvent: () => void;
}

/**
 * Global realtime store (Zustand). Tracks the shared socket connection so any
 * screen can show an online/offline indicator. Server data (including the
 * unread-notification count, which is derived from the notifications query)
 * stays in React Query; general UI state lives in [[uiStore]].
 */
export const useRealtimeStore = create<RealtimeState>((set) => ({
  status: "disconnected",
  lastEventAt: null,
  serverReachable: null,

  setStatus: (status) => set({ status }),
  setServerReachable: (serverReachable) => set({ serverReachable }),
  markEvent: () => set({ lastEventAt: Date.now() }),
}));
