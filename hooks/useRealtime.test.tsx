import { describe, it, expect, beforeEach, vi } from "vitest";
import React from "react";
import { renderHook, act } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

/**
 * useRealtime bridges the socket layer to React Query + the Zustand stores.
 * The socket and the auth gate are the only external dependencies, so both are
 * mocked; the realtime + UI stores stay real so we can assert the observable
 * side-effects (status transitions, toast, query invalidation).
 */
const socketMock = vi.hoisted(() => {
  const handlers: Record<string, (arg?: unknown) => void> = {};
  const socket = {
    connected: false,
    on: vi.fn((event: string, cb: (arg?: unknown) => void) => {
      handlers[event] = cb;
    }),
    off: vi.fn(),
    connect: vi.fn(),
  };
  return {
    handlers,
    socket,
    connectSocket: vi.fn(() => socket),
    disconnectSocket: vi.fn(),
  };
});

const authMock = vi.hoisted(() => ({ isAuthenticated: true }));

vi.mock("../services/socket", () => ({
  connectSocket: socketMock.connectSocket,
  disconnectSocket: socketMock.disconnectSocket,
}));

vi.mock("../context/AuthContext", () => ({
  useAuth: () => ({ isAuthenticated: authMock.isAuthenticated }),
}));

import { useRealtime } from "./useRealtime";
import { QUERY_KEYS } from "./useQueries";
import { useRealtimeStore } from "../store/realtimeStore";
import { useUIStore } from "../store/uiStore";

function makeWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  return { queryClient, invalidateSpy, wrapper };
}

describe("useRealtime", () => {
  beforeEach(() => {
    authMock.isAuthenticated = true;
    socketMock.socket.connected = false;
    socketMock.connectSocket.mockClear();
    socketMock.disconnectSocket.mockClear();
    socketMock.socket.on.mockClear();
    socketMock.socket.off.mockClear();
    for (const key of Object.keys(socketMock.handlers)) {
      delete socketMock.handlers[key];
    }
    useRealtimeStore.setState({ status: "disconnected", lastEventAt: null });
    useUIStore.setState({ toasts: [] });
  });

  it("disconnects and marks disconnected when unauthenticated", () => {
    authMock.isAuthenticated = false;
    const { wrapper } = makeWrapper();
    renderHook(() => useRealtime(), { wrapper });

    expect(socketMock.disconnectSocket).toHaveBeenCalledTimes(1);
    expect(socketMock.connectSocket).not.toHaveBeenCalled();
    expect(useRealtimeStore.getState().status).toBe("disconnected");
  });

  it("connects and registers listeners when authenticated", () => {
    const { wrapper } = makeWrapper();
    renderHook(() => useRealtime(), { wrapper });

    expect(socketMock.connectSocket).toHaveBeenCalledTimes(1);
    expect(useRealtimeStore.getState().status).toBe("connecting");
    expect(socketMock.socket.on).toHaveBeenCalledWith(
      "connect",
      expect.any(Function),
    );
    expect(socketMock.socket.on).toHaveBeenCalledWith(
      "disconnect",
      expect.any(Function),
    );
    expect(socketMock.socket.on).toHaveBeenCalledWith(
      "realtime",
      expect.any(Function),
    );
  });

  it("sets status connected immediately when the socket is already connected", () => {
    socketMock.socket.connected = true;
    const { wrapper } = makeWrapper();
    renderHook(() => useRealtime(), { wrapper });

    expect(useRealtimeStore.getState().status).toBe("connected");
  });

  it("updates status on connect and disconnect events", () => {
    const { wrapper } = makeWrapper();
    renderHook(() => useRealtime(), { wrapper });

    act(() => socketMock.handlers.connect());
    expect(useRealtimeStore.getState().status).toBe("connected");

    act(() => socketMock.handlers.disconnect());
    expect(useRealtimeStore.getState().status).toBe("disconnected");
  });

  it("on a notification event: invalidates notifications, toasts, and marks the event", () => {
    const { wrapper, invalidateSpy } = makeWrapper();
    renderHook(() => useRealtime(), { wrapper });
    invalidateSpy.mockClear();

    act(() =>
      socketMock.handlers.realtime({
        type: "notification",
        payload: { title: "Payment received", message: "You were paid" },
      }),
    );

    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: QUERY_KEYS.notifications,
    });
    const toasts = useUIStore.getState().toasts;
    expect(toasts).toHaveLength(1);
    expect(toasts[0]).toMatchObject({ message: "Payment received", type: "info" });
    expect(useRealtimeStore.getState().lastEventAt).not.toBeNull();
  });

  it("on a notification event without title/message: marks the event but shows no toast", () => {
    const { wrapper } = makeWrapper();
    renderHook(() => useRealtime(), { wrapper });

    act(() =>
      socketMock.handlers.realtime({ type: "notification", payload: {} }),
    );

    expect(useUIStore.getState().toasts).toHaveLength(0);
    expect(useRealtimeStore.getState().lastEventAt).not.toBeNull();
  });

  /**
   * Every query whose data the SERVER derives must be invalidated by a money or
   * enrollment event.
   *
   * Pinned against QUERY_KEYS rather than hand-listed, because the failure this
   * guards against is a new server-derived query being added and quietly left out
   * of the map: the number renders once and then silently stops tracking the
   * ledger. `adminBreakdown` was missing for exactly that reason, which froze the
   * admin dashboard Overdue tile and the whole collections-breakdown screen on any
   * open tab.
   *
   * The excluded keys below are the ones a payment or enrollment genuinely cannot
   * change. Adding a key to QUERY_KEYS therefore forces a decision here.
   */
  const CLIENT_OR_STATIC_KEYS = [
    // Identity / directory — not money.
    "user",
    "users",
    "schools",
    // Published prices. Invalidated explicitly on a fee write instead.
    "schoolFees",
    "myClassFees",
    "schoolBankDetails",
    // A pure function of a fee, cached for the session.
    "paymentCalculation",
    // Notifications have their own event.
    "notifications",
  ];

  it("invalidates every server-derived query, on both event types", () => {
    // Compared by NAME. Every entry in QUERY_KEYS — array or factory — puts its
    // own name first in the key tuple, and React Query matches by prefix, so the
    // leading segment is exactly what an invalidation has to hit. Working from
    // names also means a factory key never has to be called with placeholder
    // arguments to be checked.
    const serverDerived = Object.keys(QUERY_KEYS).filter(
      (name) => !CLIENT_OR_STATIC_KEYS.includes(name),
    );

    for (const event of ["payments:changed", "enrollments:changed"] as const) {
      const { wrapper, invalidateSpy } = makeWrapper();
      renderHook(() => useRealtime(), { wrapper });
      invalidateSpy.mockClear();

      act(() => socketMock.handlers.realtime({ type: event }));

      const invalidated = invalidateSpy.mock.calls.map((c) =>
        String((c[0] as { queryKey: unknown[] }).queryKey[0]),
      );

      const missing = serverDerived.filter(
        (name) => !invalidated.includes(name),
      );

      // Reported as `[event, ...missing]` so a failure names both the event and
      // the query that would have stopped tracking the ledger.
      expect([event, ...missing]).toEqual([event]);
    }
  });

  it("does not invalidate identity, price or notification queries on a money event", () => {
    const { wrapper, invalidateSpy } = makeWrapper();
    renderHook(() => useRealtime(), { wrapper });
    invalidateSpy.mockClear();

    act(() => socketMock.handlers.realtime({ type: "payments:changed" }));

    const invalidated = invalidateSpy.mock.calls.map((c) =>
      String((c[0] as { queryKey: unknown[] }).queryKey[0]),
    );

    expect(invalidated).not.toContain("schools");
    expect(invalidated).not.toContain("myClassFees");
    // Notifications arrive as their own event; a payment event must not refetch
    // them or every confirm would cost two requests.
    expect(invalidated).not.toContain("notifications");
  });

  it("covers the parent dashboard headline, which is a server aggregate", () => {
    const { wrapper, invalidateSpy } = makeWrapper();
    renderHook(() => useRealtime(), { wrapper });
    invalidateSpy.mockClear();

    act(() => socketMock.handlers.realtime({ type: "payments:changed" }));

    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: QUERY_KEYS.parentDashboardSummary,
    });
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: QUERY_KEYS.adminBreakdown,
    });
  });

  it("ignores an unknown event type but still marks the event", () => {
    const { wrapper, invalidateSpy } = makeWrapper();
    renderHook(() => useRealtime(), { wrapper });
    invalidateSpy.mockClear();

    act(() =>
      socketMock.handlers.realtime({ type: "something:unknown" as never }),
    );

    expect(invalidateSpy).not.toHaveBeenCalled();
    expect(useUIStore.getState().toasts).toHaveLength(0);
    expect(useRealtimeStore.getState().lastEventAt).not.toBeNull();
  });

  it("removes its socket listeners on unmount", () => {
    const { wrapper } = makeWrapper();
    const { unmount } = renderHook(() => useRealtime(), { wrapper });

    unmount();

    expect(socketMock.socket.off).toHaveBeenCalledWith(
      "connect",
      expect.any(Function),
    );
    expect(socketMock.socket.off).toHaveBeenCalledWith(
      "disconnect",
      expect.any(Function),
    );
    expect(socketMock.socket.off).toHaveBeenCalledWith(
      "realtime",
      expect.any(Function),
    );
  });
});
