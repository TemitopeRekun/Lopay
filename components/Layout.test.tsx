import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, act, waitFor } from "@testing-library/react";
import { Layout } from "./Layout";
import { useRealtimeStore } from "../store/realtimeStore";

/**
 * Layout wraps all 26 screens and owns pull-to-refresh plus the offline banner.
 * It had no tests. Everything below pins a failure that shipped:
 *
 * - the transform was emitted at rest, which made the wrapper a containing block
 *   for every `position: fixed` descendant in the app;
 * - the gesture was touch-only, so it could not fire at all on the web build;
 * - the offline branch returned before re-checking the network, so the one
 *   gesture a user makes when they think they're back refused to find out;
 * - a failed refresh looked exactly like a successful one.
 */
const H = vi.hoisted(() => ({
  refreshData: vi.fn(),
  showToast: vi.fn(),
  isAuthenticated: true,
  isNative: false,
  getNetworkStatus: vi.fn(),
  watchNetworkStatus: vi.fn(),
  reconnectSocket: vi.fn(),
}));

vi.mock("../context/DataContext", () => ({
  useData: () => ({ refreshData: H.refreshData }),
}));
vi.mock("../context/AuthContext", () => ({
  useAuth: () => ({ isAuthenticated: H.isAuthenticated }),
}));
vi.mock("../store/uiStore", () => ({
  useUIStore: () => ({ showToast: H.showToast }),
}));
vi.mock("../services/native", () => ({
  NativeBridge: {
    isNative: () => H.isNative,
    getNetworkStatus: H.getNetworkStatus,
    watchNetworkStatus: H.watchNetworkStatus,
  },
}));
vi.mock("../services/socket", () => ({
  reconnectSocket: H.reconnectSocket,
}));

const renderLayout = () =>
  render(
    <Layout>
      <p>screen content</p>
    </Layout>,
  );

/** The element carrying the pull transform — the direct parent of the children. */
const pulled = () => screen.getByText("screen content").parentElement!;
/** The element the gesture handlers are bound to. */
const surface = () => pulled().parentElement!;

const touch = (y: number) => ({ touches: [{ clientY: y }] });

/**
 * The genuinely-offline state: socket down AND an HTTP probe that failed.
 *
 * A dead socket alone no longer raises the banner — that was the bug. socket.io
 * refuses to retry a server-initiated close, the free-tier backend drops idle
 * sockets, and a rejected handshake closes one while every HTTP call keeps
 * working, so the socket by itself accused a perfectly good network.
 */
const offline = () =>
  useRealtimeStore.setState({
    status: "disconnected",
    serverReachable: false,
  });

/** Drag from `from` to `to` and release, as a finger would. */
const pull = async (from: number, to: number) => {
  const el = surface();
  await act(async () => {
    fireTouch(el, "touchStart", touch(from));
    fireTouch(el, "touchMove", touch(to));
  });
  await act(async () => {
    fireTouch(el, "touchEnd", { touches: [] });
  });
};

// RTL's fireEvent doesn't synthesise touch lists the way React expects, so build
// the events directly.
const fireTouch = (el: Element, type: string, init: any) => {
  const event = new Event(type.toLowerCase(), { bubbles: true, cancelable: true });
  Object.assign(event, {
    touches: init.touches,
    changedTouches: init.touches,
    targetTouches: init.touches,
  });
  el.dispatchEvent(event);
};

beforeEach(() => {
  H.refreshData.mockReset().mockResolvedValue(undefined);
  H.showToast.mockReset();
  H.isAuthenticated = true;
  H.isNative = false;
  H.getNetworkStatus.mockReset().mockResolvedValue({
    connected: true,
    connectionType: "wifi",
  });
  H.watchNetworkStatus.mockReset().mockResolvedValue(() => {});
  H.reconnectSocket.mockReset();
  useRealtimeStore.setState({
    status: "connected",
    lastEventAt: null,
    serverReachable: null,
  });
  Object.defineProperty(navigator, "onLine", {
    configurable: true,
    value: true,
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("Layout — fixed-position containment", () => {
  it("emits no transform at rest, so fixed children stay viewport-anchored", () => {
    renderLayout();
    // `translateY(0)` is NOT equivalent to none: any transform makes this the
    // containing block for every fixed descendant, and this element grows to the
    // full document height. That detached every sticky action bar and modal in
    // the app from the viewport.
    expect(pulled().style.transform).toBe("");
  });

  it("emits a transform only while the finger is down", async () => {
    renderLayout();
    const el = surface();
    await act(async () => {
      fireTouch(el, "touchStart", touch(0));
      fireTouch(el, "touchMove", touch(60));
    });
    expect(pulled().style.transform).toMatch(/translateY\([\d.]+px\)/);

    await act(async () => {
      fireTouch(el, "touchEnd", { touches: [] });
    });
    expect(pulled().style.transform).toBe("");
  });

  it("keeps the offline banner outside the transformed wrapper", () => {
    offline();
    renderLayout();
    const banner = screen.getByText("Offline").closest("[role='status']")!;
    expect(pulled().contains(banner)).toBe(false);
  });
});

describe("Layout — pull to refresh", () => {
  it("refreshes when dragged past the threshold", async () => {
    renderLayout();
    await pull(0, 100);
    expect(H.refreshData).toHaveBeenCalledTimes(1);
  });

  it("does not refresh on a drag short of the threshold", async () => {
    renderLayout();
    await pull(0, 20);
    expect(H.refreshData).not.toHaveBeenCalled();
  });

  it("does not refresh on an upward drag", async () => {
    renderLayout();
    await pull(100, 0);
    expect(H.refreshData).not.toHaveBeenCalled();
  });

  it("reports a failed refresh instead of showing a silent success", async () => {
    H.refreshData.mockRejectedValue(new Error("network"));
    renderLayout();
    await pull(0, 100);
    await waitFor(() =>
      expect(H.showToast).toHaveBeenCalledWith(
        expect.stringMatching(/couldn't refresh/i),
        "error",
      ),
    );
  });

  it("clears the spinner after a failed refresh", async () => {
    H.refreshData.mockRejectedValue(new Error("network"));
    renderLayout();
    await pull(0, 100);
    await waitFor(() =>
      expect(screen.getByRole("status")).toHaveTextContent(/pull to refresh/i),
    );
  });

  it("works with a mouse, so the web build can refresh at all", async () => {
    renderLayout();
    const el = surface();
    const pointer = (type: string, y: number) => {
      const event = new Event(type, { bubbles: true, cancelable: true });
      Object.assign(event, { clientY: y, pointerType: "mouse", button: 0 });
      el.dispatchEvent(event);
    };
    await act(async () => {
      pointer("pointerdown", 0);
      pointer("pointermove", 100);
    });
    await act(async () => {
      pointer("pointerup", 100);
    });
    expect(H.refreshData).toHaveBeenCalledTimes(1);
  });

  it("re-checks the network even when it believes it is offline", async () => {
    // The old code returned early here, so a stale offline flag could never be
    // cleared by the very gesture a user makes to recover.
    H.isNative = true;
    offline();
    renderLayout();
    H.getNetworkStatus.mockClear();

    await pull(0, 100);

    expect(H.getNetworkStatus).toHaveBeenCalled();
    expect(H.refreshData).toHaveBeenCalled();
  });

  it("revives a socket socket.io has given up on", async () => {
    // Pulling is the gesture of someone who expects fresh data, and it is the
    // only user-reachable way out of `io server disconnect` short of a reload.
    offline();
    renderLayout();

    await pull(0, 100);

    expect(H.reconnectSocket).toHaveBeenCalled();
  });

  it("does not reconnect on a drag short of the threshold", async () => {
    renderLayout();
    await pull(0, 20);
    expect(H.reconnectSocket).not.toHaveBeenCalled();
  });

  it("still refreshes when the socket refuses to reopen", async () => {
    // Refreshing the data is what the pull was for. A throwing socket layer must
    // not skip the refetch and then report "couldn't refresh" over a request
    // that was never made.
    H.reconnectSocket.mockImplementation(() => {
      throw new Error("socket is beyond saving");
    });
    renderLayout();

    await pull(0, 100);

    expect(H.refreshData).toHaveBeenCalledTimes(1);
    expect(H.showToast).not.toHaveBeenCalled();
  });
});

describe("Layout — offline banner", () => {
  it("stays hidden while the socket is connected", () => {
    renderLayout();
    expect(screen.queryByText("Offline")).not.toBeInTheDocument();
  });

  it("shows when the socket reports the server unreachable", () => {
    offline();
    renderLayout();
    expect(screen.getByText("Offline")).toBeInTheDocument();
  });

  it("closes as soon as the socket reconnects", async () => {
    offline();
    renderLayout();
    expect(screen.getByText("Offline")).toBeInTheDocument();

    await act(async () => {
      useRealtimeStore.setState({ status: "connected" });
    });
    expect(screen.queryByText("Offline")).not.toBeInTheDocument();
  });

  it("closes on the window online event", async () => {
    Object.defineProperty(navigator, "onLine", {
      configurable: true,
      value: false,
    });
    renderLayout();
    expect(screen.getByText("Offline")).toBeInTheDocument();

    await act(async () => {
      window.dispatchEvent(new Event("online"));
    });
    expect(screen.queryByText("Offline")).not.toBeInTheDocument();
  });

  it("ignores a disconnected socket when signed out", () => {
    // Signed out the socket is deliberately down; that is not an outage.
    H.isAuthenticated = false;
    offline();
    renderLayout();
    expect(screen.queryByText("Offline")).not.toBeInTheDocument();
  });

  it("does not flash while the socket is still connecting", () => {
    useRealtimeStore.setState({ status: "connecting" });
    renderLayout();
    expect(screen.queryByText("Offline")).not.toBeInTheDocument();
  });

  it("stays hidden on a dead socket the API can still be reached behind", () => {
    // The stuck-socket state: socket.io has given up (`io server disconnect`,
    // which it never retries) but the backend answers every HTTP call. The old
    // condition called this "Offline" for the rest of the session.
    useRealtimeStore.setState({
      status: "disconnected",
      serverReachable: true,
    });
    renderLayout();
    expect(screen.queryByText("Offline")).not.toBeInTheDocument();
  });

  it("stays hidden while no probe has returned a verdict yet", () => {
    useRealtimeStore.setState({
      status: "disconnected",
      serverReachable: null,
    });
    renderLayout();
    // `null` is "not asked yet", not "offline". Claiming an outage on an
    // unproven suspicion is what made the banner flash on every launch.
    expect(screen.queryByText("Offline")).not.toBeInTheDocument();
  });

  it("closes when a later probe reaches the API again", async () => {
    offline();
    renderLayout();
    expect(screen.getByText("Offline")).toBeInTheDocument();

    // The re-probe succeeds while the socket is still down; the banner must not
    // wait for the socket to come back.
    await act(async () => {
      useRealtimeStore.setState({ serverReachable: true });
    });
    expect(screen.queryByText("Offline")).not.toBeInTheDocument();
  });

  it("still shows when the device itself has no interface", () => {
    // No network at all needs no probe: `navigator.onLine` is conclusive here.
    Object.defineProperty(navigator, "onLine", {
      configurable: true,
      value: false,
    });
    useRealtimeStore.setState({
      status: "connected",
      serverReachable: true,
    });
    renderLayout();
    expect(screen.getByText("Offline")).toBeInTheDocument();
  });

  it("is announced to screen readers", () => {
    offline();
    renderLayout();
    const banner = screen.getByText("Offline").closest("[role='status']")!;
    expect(banner).toHaveAttribute("aria-live", "polite");
  });
});

describe("Layout — native network listener", () => {
  it("unsubscribes even when unmounted before the listener resolves", async () => {
    H.isNative = true;
    const unsub = vi.fn();
    let resolveWatch: (fn: () => void) => void = () => {};
    H.watchNetworkStatus.mockReturnValue(
      new Promise<() => void>((res) => {
        resolveWatch = res;
      }),
    );

    const { unmount } = renderLayout();
    unmount();

    // Resolves after cleanup ran: without the cancelled guard the unsubscribe
    // was simply dropped, leaking one listener per navigation.
    await act(async () => {
      resolveWatch(unsub);
    });
    await waitFor(() => expect(unsub).toHaveBeenCalled());
  });
});
