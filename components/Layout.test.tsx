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
  useRealtimeStore.setState({ status: "connected", lastEventAt: null });
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
    useRealtimeStore.setState({ status: "disconnected" });
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
    useRealtimeStore.setState({ status: "disconnected" });
    renderLayout();
    H.getNetworkStatus.mockClear();

    await pull(0, 100);

    expect(H.getNetworkStatus).toHaveBeenCalled();
    expect(H.refreshData).toHaveBeenCalled();
  });
});

describe("Layout — offline banner", () => {
  it("stays hidden while the socket is connected", () => {
    renderLayout();
    expect(screen.queryByText("Offline")).not.toBeInTheDocument();
  });

  it("shows when the socket reports the server unreachable", () => {
    useRealtimeStore.setState({ status: "disconnected" });
    renderLayout();
    expect(screen.getByText("Offline")).toBeInTheDocument();
  });

  it("closes as soon as the socket reconnects", async () => {
    useRealtimeStore.setState({ status: "disconnected" });
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
    useRealtimeStore.setState({ status: "disconnected" });
    renderLayout();
    expect(screen.queryByText("Offline")).not.toBeInTheDocument();
  });

  it("does not flash while the socket is still connecting", () => {
    useRealtimeStore.setState({ status: "connecting" });
    renderLayout();
    expect(screen.queryByText("Offline")).not.toBeInTheDocument();
  });

  it("is announced to screen readers", () => {
    useRealtimeStore.setState({ status: "disconnected" });
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
