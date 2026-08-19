import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
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
    reconnectSocket: vi.fn(),
  };
});

const reachabilityMock = vi.hoisted(() => ({ probeServer: vi.fn() }));

const authMock = vi.hoisted(() => ({ isAuthenticated: true }));

vi.mock("../services/socket", () => ({
  connectSocket: socketMock.connectSocket,
  disconnectSocket: socketMock.disconnectSocket,
  reconnectSocket: socketMock.reconnectSocket,
}));

vi.mock("../services/reachability", () => ({
  probeServer: reachabilityMock.probeServer,
  REACHABILITY_TIMEOUT_MS: 8000,
}));

vi.mock("../context/AuthContext", () => ({
  useAuth: () => ({ isAuthenticated: authMock.isAuthenticated }),
}));

import {
  useRealtime,
  REACHABILITY_GRACE_MS,
  REACHABILITY_INTERVAL_MS,
  CONNECT_ERROR_TOLERANCE,
} from "./useRealtime";
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
    socketMock.reconnectSocket.mockClear();
    reachabilityMock.probeServer.mockReset().mockResolvedValue(true);
    socketMock.socket.on.mockClear();
    socketMock.socket.off.mockClear();
    for (const key of Object.keys(socketMock.handlers)) {
      delete socketMock.handlers[key];
    }
    useRealtimeStore.setState({
      status: "disconnected",
      lastEventAt: null,
      serverReachable: null,
    });
    useUIStore.setState({ toasts: [] });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("disconnects and marks disconnected when unauthenticated", () => {
    authMock.isAuthenticated = false;
    const { wrapper } = makeWrapper();
    renderHook(() => useRealtime(), { wrapper });

    expect(socketMock.disconnectSocket).toHaveBeenCalledTimes(1);
    expect(socketMock.connectSocket).not.toHaveBeenCalled();
    expect(useRealtimeStore.getState().status).toBe("disconnected");
  });

  it("drops the reachability verdict on sign-out", () => {
    // Signed out the socket is deliberately down, so the old verdict describes
    // nothing. Left behind, a `false` would be inherited by the next sign-in and
    // could raise the banner before that session had probed anything.
    useRealtimeStore.setState({ serverReachable: false });
    authMock.isAuthenticated = false;
    const { wrapper } = makeWrapper();
    renderHook(() => useRealtime(), { wrapper });

    expect(useRealtimeStore.getState().serverReachable).toBeNull();
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
    // `connect_error`, not just `disconnect`: a handshake that never lands emits
    // only the former, and without it the status sat at "connecting" forever.
    expect(socketMock.socket.on).toHaveBeenCalledWith(
      "connect_error",
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
    /*
     * Paystack configuration health, not money. Each read costs one Paystack
     * lookup PER SCHOOL, so invalidating it on every payment event would put a
     * fan-out of external calls behind ordinary checkout traffic. It changes only
     * when an admin repairs a payout account, and that mutation invalidates it
     * directly.
     */
    "schoolsPayoutStatus",
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
    expect(socketMock.socket.off).toHaveBeenCalledWith(
      "connect_error",
      expect.any(Function),
    );
  });
});

/**
 * A handshake that never lands emits `connect_error` — never `disconnect`, which
 * only fires for a connection that once existed. With no listener for it, a
 * launch against a backend that is asleep or down (the free instance spins down
 * after ~15 minutes idle, so: the first launch of most days) left the status at
 * "connecting" for as long as the app stayed open. That is the state the banner
 * deliberately ignores, so the app went permanently quiet about the one outage
 * the banner exists to report.
 */
describe("useRealtime — a handshake that never lands", () => {
  beforeEach(() => {
    authMock.isAuthenticated = true;
    socketMock.socket.connected = false;
    socketMock.reconnectSocket.mockClear();
    reachabilityMock.probeServer.mockReset().mockResolvedValue(true);
    for (const key of Object.keys(socketMock.handlers)) {
      delete socketMock.handlers[key];
    }
    useRealtimeStore.setState({
      status: "disconnected",
      lastEventAt: null,
      serverReachable: null,
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  const failHandshake = (times: number) => {
    for (let i = 0; i < times; i += 1) {
      act(() => socketMock.handlers.connect_error());
    }
  };

  it("tolerates a single failure without settling", () => {
    const { wrapper } = makeWrapper();
    renderHook(() => useRealtime(), { wrapper });

    failHandshake(CONNECT_ERROR_TOLERANCE - 1);

    // The first attempt can lose a race with a network that is still coming up.
    expect(useRealtimeStore.getState().status).toBe("connecting");
  });

  it("settles to disconnected once the failures stop looking like a blip", () => {
    const { wrapper } = makeWrapper();
    renderHook(() => useRealtime(), { wrapper });

    failHandshake(CONNECT_ERROR_TOLERANCE);

    expect(useRealtimeStore.getState().status).toBe("disconnected");
  });

  it("shows nothing on its own — it only arms the probe", async () => {
    // This is the whole point of composing the two fixes: a failed handshake
    // settles the status, and the probe still has to fail before the word
    // "Offline" is spent. Here the API answers, so the banner stays down.
    vi.useFakeTimers();
    reachabilityMock.probeServer.mockResolvedValue(true);
    const { wrapper } = makeWrapper();
    renderHook(() => useRealtime(), { wrapper });

    failHandshake(CONNECT_ERROR_TOLERANCE);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(REACHABILITY_GRACE_MS);
    });

    expect(reachabilityMock.probeServer).toHaveBeenCalled();
    expect(useRealtimeStore.getState().serverReachable).toBe(true);
  });

  it("reaches a verdict of offline when the API is down too", async () => {
    // The case that used to be invisible: nothing reachable, and now the app
    // says so instead of claiming to still be connecting.
    vi.useFakeTimers();
    reachabilityMock.probeServer.mockResolvedValue(false);
    const { wrapper } = makeWrapper();
    renderHook(() => useRealtime(), { wrapper });

    failHandshake(CONNECT_ERROR_TOLERANCE);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(REACHABILITY_GRACE_MS);
    });

    expect(useRealtimeStore.getState().status).toBe("disconnected");
    expect(useRealtimeStore.getState().serverReachable).toBe(false);
  });

  it("forgives the earlier failures once a handshake succeeds", () => {
    const { wrapper } = makeWrapper();
    renderHook(() => useRealtime(), { wrapper });

    failHandshake(CONNECT_ERROR_TOLERANCE - 1);
    act(() => socketMock.handlers.connect());
    expect(useRealtimeStore.getState().status).toBe("connected");

    // The tolerance is per run of consecutive failures, so a later single blip
    // must not settle on the strength of one counted before the success.
    failHandshake(CONNECT_ERROR_TOLERANCE - 1);
    expect(useRealtimeStore.getState().status).toBe("connected");
  });
});

/**
 * The reachability probe exists because a down socket is NOT evidence of a down
 * network, and the offline banner used to treat it as one. socket.io never
 * retries a server-initiated close, the free-tier backend drops idle sockets,
 * and a handshake refused over a stale token closes one while every HTTP call
 * still succeeds — all three showed "Offline" over a working connection.
 */
describe("useRealtime — server reachability probe", () => {
  beforeEach(() => {
    authMock.isAuthenticated = true;
    socketMock.socket.connected = false;
    socketMock.reconnectSocket.mockClear();
    reachabilityMock.probeServer.mockReset().mockResolvedValue(true);
    for (const key of Object.keys(socketMock.handlers)) {
      delete socketMock.handlers[key];
    }
    useRealtimeStore.setState({
      status: "disconnected",
      lastEventAt: null,
      serverReachable: null,
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  /** Render, then drop the socket so the probe effect is armed. */
  const renderDisconnected = () => {
    const { wrapper } = makeWrapper();
    const result = renderHook(() => useRealtime(), { wrapper });
    act(() => socketMock.handlers.disconnect());
    return result;
  };

  it("never probes while the socket is up", async () => {
    vi.useFakeTimers();
    const { wrapper } = makeWrapper();
    renderHook(() => useRealtime(), { wrapper });
    act(() => socketMock.handlers.connect());

    await act(async () => {
      await vi.advanceTimersByTimeAsync(REACHABILITY_GRACE_MS * 5);
    });

    expect(reachabilityMock.probeServer).not.toHaveBeenCalled();
  });

  it("waits out the grace period before spending a request", async () => {
    vi.useFakeTimers();
    renderDisconnected();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(REACHABILITY_GRACE_MS - 1);
    });
    // Most drops recover inside socket.io's own backoff; probing instantly would
    // spend a request on every routine blip.
    expect(reachabilityMock.probeServer).not.toHaveBeenCalled();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1);
    });
    expect(reachabilityMock.probeServer).toHaveBeenCalledTimes(1);
  });

  it("records an unreachable API, which is what licenses the banner", async () => {
    vi.useFakeTimers();
    reachabilityMock.probeServer.mockResolvedValue(false);
    renderDisconnected();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(REACHABILITY_GRACE_MS);
    });

    expect(useRealtimeStore.getState().serverReachable).toBe(false);
  });

  it("records a reachable API, so a dead socket alone cannot claim offline", async () => {
    vi.useFakeTimers();
    reachabilityMock.probeServer.mockResolvedValue(true);
    renderDisconnected();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(REACHABILITY_GRACE_MS);
    });

    expect(useRealtimeStore.getState().serverReachable).toBe(true);
  });

  it("keeps re-probing, so a stale banner clears itself without the socket", async () => {
    vi.useFakeTimers();
    reachabilityMock.probeServer.mockResolvedValue(false);
    renderDisconnected();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(REACHABILITY_GRACE_MS);
    });
    expect(useRealtimeStore.getState().serverReachable).toBe(false);

    // The backend comes back but the socket is still down (the stuck-socket
    // state): the banner must still clear.
    reachabilityMock.probeServer.mockResolvedValue(true);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(REACHABILITY_INTERVAL_MS);
    });

    expect(reachabilityMock.probeServer).toHaveBeenCalledTimes(2);
    expect(useRealtimeStore.getState().serverReachable).toBe(true);
  });

  it("drops a verdict that lands after the socket recovered", async () => {
    vi.useFakeTimers();
    let settle: (reachable: boolean) => void = () => {};
    reachabilityMock.probeServer.mockReturnValue(
      new Promise<boolean>((res) => {
        settle = res;
      }),
    );
    renderDisconnected();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(REACHABILITY_GRACE_MS);
    });
    // Socket is back before the probe answers. A late `false` here would raise
    // the banner over a connection that is demonstrably working.
    act(() => socketMock.handlers.connect());
    await act(async () => {
      settle(false);
    });

    expect(useRealtimeStore.getState().serverReachable).toBeNull();
  });

  it("clears the previous verdict on reconnect, so the next drop starts fresh", () => {
    const { wrapper } = makeWrapper();
    renderHook(() => useRealtime(), { wrapper });
    useRealtimeStore.setState({ serverReachable: false });

    act(() => socketMock.handlers.connect());

    expect(useRealtimeStore.getState().serverReachable).toBeNull();
  });

  it("does not probe while signed out", async () => {
    vi.useFakeTimers();
    authMock.isAuthenticated = false;
    const { wrapper } = makeWrapper();
    renderHook(() => useRealtime(), { wrapper });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(REACHABILITY_GRACE_MS * 5);
    });

    expect(reachabilityMock.probeServer).not.toHaveBeenCalled();
  });
});

/**
 * The escape hatch for a socket socket.io has permanently given up on. Without
 * it, `io server disconnect` left realtime dead for the whole session — nothing
 * in the app reopened the socket short of a reload.
 */
describe("useRealtime — reviving a dead socket", () => {
  beforeEach(() => {
    authMock.isAuthenticated = true;
    socketMock.socket.connected = false;
    socketMock.reconnectSocket.mockClear();
    reachabilityMock.probeServer.mockReset().mockResolvedValue(true);
    useRealtimeStore.setState({ status: "connecting", serverReachable: null });
  });

  const setVisibility = (state: DocumentVisibilityState) =>
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      get: () => state,
    });

  it("reconnects when the window regains focus", () => {
    setVisibility("visible");
    const { wrapper } = makeWrapper();
    renderHook(() => useRealtime(), { wrapper });

    act(() => {
      window.dispatchEvent(new Event("focus"));
    });

    expect(socketMock.reconnectSocket).toHaveBeenCalled();
  });

  it("reconnects when the tab becomes visible again", () => {
    setVisibility("visible");
    const { wrapper } = makeWrapper();
    renderHook(() => useRealtime(), { wrapper });

    act(() => {
      document.dispatchEvent(new Event("visibilitychange"));
    });

    expect(socketMock.reconnectSocket).toHaveBeenCalled();
  });

  it("does not reconnect on the way OUT of the app", () => {
    setVisibility("hidden");
    const { wrapper } = makeWrapper();
    renderHook(() => useRealtime(), { wrapper });

    act(() => {
      document.dispatchEvent(new Event("visibilitychange"));
    });

    // Backgrounding fires the same event; reopening a socket the platform is
    // about to cull anyway just burns a handshake.
    expect(socketMock.reconnectSocket).not.toHaveBeenCalled();
  });

  it("does not reconnect while signed out", () => {
    setVisibility("visible");
    authMock.isAuthenticated = false;
    const { wrapper } = makeWrapper();
    renderHook(() => useRealtime(), { wrapper });

    act(() => {
      window.dispatchEvent(new Event("focus"));
    });

    expect(socketMock.reconnectSocket).not.toHaveBeenCalled();
  });

  it("stops listening on unmount", () => {
    setVisibility("visible");
    const { wrapper } = makeWrapper();
    const { unmount } = renderHook(() => useRealtime(), { wrapper });
    unmount();

    act(() => {
      window.dispatchEvent(new Event("focus"));
    });

    expect(socketMock.reconnectSocket).not.toHaveBeenCalled();
  });
});
