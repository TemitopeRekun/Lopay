import React, { useCallback, useRef, useState } from "react";
import { useData } from "../context/DataContext";
import { useUIStore } from "../store/uiStore";
import { useRealtimeStore } from "../store/realtimeStore";
import { useAuth } from "../context/AuthContext";
import { NativeBridge } from "../services/native";

interface LayoutProps {
  children: React.ReactNode;
  className?: string;
  showBottomNav?: boolean;
}

/** Drag past this many pixels to arm the refresh. */
const PULL_THRESHOLD = 80;
/** Hard cap on the drag, so the content can't be hauled off-screen. */
const PULL_MAX = 120;

export const Layout: React.FC<LayoutProps> = ({
  children,
  className = "",
  showBottomNav = false,
}) => {
  const { refreshData } = useData();
  const { showToast } = useUIStore();
  const { isAuthenticated } = useAuth();
  // The socket knows whether the SERVER is reachable. `navigator.onLine` only
  // knows whether a network interface exists, so a captive portal, dead DNS or a
  // down backend all read as "online" — the banner stayed hidden during exactly
  // the outage it exists to report. See the reachability note below.
  const socketStatus = useRealtimeStore((s) => s.status);
  const [hasInterface, setHasInterface] = useState(() =>
    typeof navigator !== "undefined" ? navigator.onLine : true,
  );
  const [pullDistance, setPullDistance] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const startYRef = useRef<number | null>(null);
  const canPullRef = useRef(false);
  const pullContainerRef = useRef<HTMLDivElement | null>(null);

  /**
   * Offline = no interface, or (while signed in) a socket that is down.
   *
   * The socket is only a reachability signal when it is meant to be up. Signed
   * out it is deliberately disconnected, and "connecting" is its state during
   * every normal startup and reconnect — treating either as offline would flash
   * the banner on each launch. So the socket can only ever report offline via a
   * settled `disconnected` while authenticated; the interface check carries the
   * rest.
   */
  const isOnline =
    hasInterface && !(isAuthenticated && socketStatus === "disconnected");

  React.useEffect(() => {
    if (typeof window === "undefined") return;

    const handleOnline = () => setHasInterface(true);
    const handleOffline = () => setHasInterface(false);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  // Not wrapped in `isCheckingNetwork` state any more: that flag was also in the
  // banner's render condition, so the banner hid itself during every check —
  // including the one on mount — and read as "back online" when it wasn't.
  const checkNetworkStatus = useCallback(async () => {
    if (NativeBridge.isNative()) {
      const status = await NativeBridge.getNetworkStatus();
      setHasInterface(status.connected);
    } else if (typeof navigator !== "undefined") {
      setHasInterface(navigator.onLine);
    }
  }, []);

  React.useEffect(() => {
    if (!NativeBridge.isNative()) return;

    // `cancelled` covers the unmount-before-resolve race: the cleanup below runs
    // synchronously, so assigning the unsubscribe inside .then() alone would
    // leave it undefined and leak the listener. Every screen mounts its own
    // Layout, so that leaked one listener per fast navigation.
    let cancelled = false;
    let unsubscribe: (() => void) | undefined;

    checkNetworkStatus().catch(() => undefined);

    NativeBridge.watchNetworkStatus((status) => {
      setHasInterface(status.connected);
    })
      .then((unsub) => {
        if (cancelled) {
          unsub();
          return;
        }
        unsubscribe = unsub;
      })
      .catch(() => undefined);

    return () => {
      cancelled = true;
      unsubscribe?.();
    };
  }, [checkNetworkStatus]);

  /**
   * Scroll offset of the nearest scrollable ancestor of `el`.
   *
   * Takes an element, not an event: the previous version took `EventTarget` and
   * separated the two with `"target" in target`, but anchors, forms and <area>
   * all carry their own `target` property. Starting a drag on a link therefore
   * assigned a string to the walk variable, exited the loop immediately and fell
   * through to `window.scrollY` — silently skipping the ancestor search this
   * exists to perform.
   */
  const getScrollTop = (target: EventTarget | null) => {
    let el: HTMLElement | null =
      target instanceof HTMLElement ? target : null;
    const container = pullContainerRef.current;

    while (el && el !== container) {
      // clientHeight alone matches plenty of non-scrolling blocks, so require an
      // overflow that actually scrolls.
      const style = window.getComputedStyle(el);
      const scrolls = /(auto|scroll|overlay)/.test(
        style.overflowY + style.overflow,
      );
      if (scrolls && el.scrollHeight > el.clientHeight) return el.scrollTop;
      el = el.parentElement;
    }

    return typeof window !== "undefined" ? window.scrollY : 0;
  };

  const beginPull = (clientY: number, target: EventTarget | null) => {
    if (isRefreshing) return;
    startYRef.current = clientY;
    canPullRef.current = getScrollTop(target) <= 0;
    setPullDistance(0);
  };

  const movePull = (clientY: number) => {
    if (isRefreshing) return;
    if (!canPullRef.current) return;
    if (startYRef.current === null) return;

    const deltaY = clientY - startYRef.current;

    if (deltaY <= 0) {
      setPullDistance(0);
      return;
    }

    // Raw finger travel. PULL_THRESHOLD is expressed in these terms, so the
    // rubber-band damping belongs on the rendered offset (see `translateY`) and
    // must not be applied here — damping the value that is then thresholded
    // makes the threshold silently twice as far away as it reads.
    setPullDistance(Math.min(deltaY, PULL_MAX));
  };

  const endPull = async () => {
    const shouldRefresh =
      !isRefreshing && canPullRef.current && pullDistance >= PULL_THRESHOLD;

    startYRef.current = null;
    canPullRef.current = false;
    setPullDistance(0);

    if (!shouldRefresh) return;

    setIsRefreshing(true);
    try {
      // Re-check FIRST, and unconditionally. This used to return early when
      // `isOnline` was false — so the one gesture a user makes when they think
      // they're back was the single path that refused to find out. A stale
      // offline flag could not be cleared by pulling, no matter how many times.
      await checkNetworkStatus().catch(() => undefined);

      await refreshData();
    } catch {
      // A silent failure is indistinguishable from a successful refresh: same
      // spinner, same stale figures. On a payments screen that is the difference
      // between "your payment hasn't landed" and "we couldn't check".
      showToast("Couldn't refresh. Pull again to retry.", "error");
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleTouchStart = (event: React.TouchEvent<HTMLDivElement>) =>
    beginPull(event.touches[0].clientY, event.target);
  const handleTouchMove = (event: React.TouchEvent<HTMLDivElement>) =>
    movePull(event.touches[0].clientY);

  // Mouse/trackpad path. The gesture was touch-only, so on the web build
  // (lopay.netlify.app) it could not be triggered at all — no drag, no spinner,
  // nothing. Touch events are excluded here because a touchscreen fires both.
  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.pointerType === "touch" || event.button !== 0) return;
    beginPull(event.clientY, event.target);
  };
  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.pointerType === "touch") return;
    if (startYRef.current === null) return;
    movePull(event.clientY);
  };
  const handlePointerUp = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.pointerType === "touch") return;
    void endPull();
  };

  // Rubber-band: the content follows the finger at half speed, so the drag feels
  // resisted without the threshold moving.
  const translateY = pullDistance > 0 ? pullDistance / 2 : 0;
  const spinnerVisible = isRefreshing || pullDistance > 10;

  return (
    <div
      className={`min-h-screen w-full bg-background-light dark:bg-background-dark text-text-primary-light dark:text-text-primary-dark safe-area ${className}`}
    >
      <div
        className={`mx-auto max-w-md min-h-screen relative shadow-2xl bg-white dark:bg-background-dark overflow-hidden flex flex-col ${showBottomNav ? "pb-24" : ""}`}
      >
        <div
          className="flex-1 flex flex-col relative"
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={endPull}
          onTouchCancel={endPull}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          ref={pullContainerRef}
        >
          <div
            className={`absolute top-0 left-0 right-0 z-20 flex items-center justify-center pointer-events-none transition-opacity duration-150 ${
              spinnerVisible ? "opacity-100" : "opacity-0"
            }`}
            style={{ height: 56 }}
            role="status"
            aria-live="polite"
          >
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/90 dark:bg-background-dark/90 shadow-md border border-gray-100 dark:border-gray-800">
              <span className="size-3 border-2 border-primary/30 border-t-primary rounded-full animate-spin"></span>
              <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-primary">
                {isRefreshing
                  ? "Refreshing"
                  : pullDistance >= PULL_THRESHOLD
                    ? "Release to refresh"
                    : "Pull to refresh"}
              </span>
            </div>
          </div>

          {/*
            The offline banner sits OUTSIDE the transformed wrapper below, and so
            does anything else positioned against the viewport. A transform makes
            an element the containing block for every `position: fixed`
            descendant, and this wrapper is `flex-1` in a `min-h-screen` column —
            it grows to the full document height. Nesting the banner (or the
            screens' sticky action bars and modals) inside a transformed box made
            `fixed bottom-0` resolve to the bottom of the document rather than
            the viewport.
          */}
          {!isOnline && !isRefreshing && (
            <div
              className="absolute top-3 left-1/2 -translate-x-1/2 z-30 pointer-events-none"
              role="status"
              aria-live="polite"
            >
              <div className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/15 text-amber-700 border border-amber-500/30 px-3 py-1 text-[9px] font-black uppercase tracking-[0.2em]">
                <span className="size-1.5 rounded-full bg-amber-500"></span>
                Offline
              </div>
            </div>
          )}

          <div
            className="flex-1 flex flex-col"
            style={{
              // `undefined`, never `translateY(0)`. Any transform other than
              // `none` establishes a containing block for fixed descendants, so
              // emitting one at rest broke every sticky bar and modal inside all
              // 26 screens Layout wraps — see the note above.
              transform: translateY > 0 ? `translateY(${translateY}px)` : undefined,
              transition: isRefreshing ? "transform 150ms ease-out" : undefined,
            }}
          >
            {children}
          </div>
        </div>
      </div>
    </div>
  );
};
