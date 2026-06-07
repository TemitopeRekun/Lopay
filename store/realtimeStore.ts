import { create } from "zustand";

export type ConnectionStatus = "connecting" | "connected" | "disconnected";

interface RealtimeState {
  /** Live status of the shared socket connection. */
  status: ConnectionStatus;
  /** Epoch ms of the last realtime event received (null until the first). */
  lastEventAt: number | null;

  setStatus: (status: ConnectionStatus) => void;
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

  setStatus: (status) => set({ status }),
  markEvent: () => set({ lastEventAt: Date.now() }),
}));
