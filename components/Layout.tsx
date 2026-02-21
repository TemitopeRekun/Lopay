import React, { useRef, useState } from "react";
import { useData } from "../context/DataContext";
import { useUI } from "../context/UIContext";
import { NativeBridge } from "../services/native";

interface LayoutProps {
  children: React.ReactNode;
  className?: string;
  showBottomNav?: boolean;
}

export const Layout: React.FC<LayoutProps> = ({
  children,
  className = "",
  showBottomNav = false,
}) => {
  const { refreshData } = useData();
  const { showToast } = useUI();
  const [isOnline, setIsOnline] = useState(() =>
    typeof navigator !== "undefined" ? navigator.onLine : true,
  );
  const [pullDistance, setPullDistance] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isCheckingNetwork, setIsCheckingNetwork] = useState(false);
  const startYRef = useRef<number | null>(null);
  const canPullRef = useRef(false);
  const pullContainerRef = useRef<HTMLDivElement | null>(null);

  React.useEffect(() => {
    if (typeof window === "undefined") return;

    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  const checkNetworkStatus = async () => {
    setIsCheckingNetwork(true);
    try {
      if (NativeBridge.isNative()) {
        const status = await NativeBridge.getNetworkStatus();
        setIsOnline(status.connected);
      } else if (typeof navigator !== "undefined") {
        setIsOnline(navigator.onLine);
      }
    } finally {
      setIsCheckingNetwork(false);
    }
  };

  React.useEffect(() => {
    if (!NativeBridge.isNative()) return;

    let cleanup: (() => void) | undefined;

    checkNetworkStatus().catch(() => undefined);

    NativeBridge.watchNetworkStatus((status) => {
      setIsOnline(status.connected);
    }).then((unsub) => {
      cleanup = unsub;
    });

    return () => {
      cleanup?.();
    };
  }, []);

  const getScrollTop = (target: EventTarget | null) => {
    let el =
      target && "target" in (target as any)
        ? ((target as any).target as HTMLElement | null)
        : (target as HTMLElement | null);
    const container = pullContainerRef.current;

    while (el && el !== container) {
      if (el.scrollHeight > el.clientHeight) {
        return el.scrollTop;
      }
      el = el.parentElement;
    }

    return typeof window !== "undefined" ? window.scrollY : 0;
  };

  const handleTouchStart = (event: React.TouchEvent<HTMLDivElement>) => {
    if (isRefreshing) return;
    const touch = event.touches[0];
    startYRef.current = touch.clientY;
    canPullRef.current = getScrollTop(event.target) <= 0;
    setPullDistance(0);
  };

  const handleTouchMove = (event: React.TouchEvent<HTMLDivElement>) => {
    if (isRefreshing) return;
    if (!canPullRef.current) return;
    if (startYRef.current === null) return;

    const touch = event.touches[0];
    const deltaY = touch.clientY - startYRef.current;

    if (deltaY <= 0) {
      setPullDistance(0);
      return;
    }

    const limited = Math.min(deltaY, 120);
    setPullDistance(limited);
  };

  const handleTouchEnd = async () => {
    if (isRefreshing) {
      setPullDistance(0);
      startYRef.current = null;
      canPullRef.current = false;
      return;
    }

    const threshold = 80;
    const shouldRefresh = canPullRef.current && pullDistance >= threshold;

    startYRef.current = null;
    canPullRef.current = false;

    if (!shouldRefresh) {
      setPullDistance(0);
      return;
    }

    if (!isOnline) {
      setPullDistance(0);
      showToast("You're offline. Showing cached data.", "info");
      return;
    }

    setIsRefreshing(true);
    setPullDistance(0);

    try {
      await refreshData();
      await checkNetworkStatus();
    } finally {
      setIsRefreshing(false);
    }
  };

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
          onTouchEnd={handleTouchEnd}
          ref={pullContainerRef}
        >
          <div
            className={`absolute top-0 left-0 right-0 z-20 flex items-center justify-center pointer-events-none transition-opacity duration-150 ${
              spinnerVisible ? "opacity-100" : "opacity-0"
            }`}
            style={{ height: 56 }}
          >
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/90 dark:bg-background-dark/90 shadow-md border border-gray-100 dark:border-gray-800">
              <span className="size-3 border-2 border-primary/30 border-t-primary rounded-full animate-spin"></span>
              <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-primary">
                Refreshing
              </span>
            </div>
          </div>

          <div
            className="flex-1 flex flex-col"
            style={{
              transform: `translateY(${translateY}px)`,
              transition: isRefreshing ? "transform 150ms ease-out" : undefined,
            }}
          >
            {!isOnline && !isRefreshing && !isCheckingNetwork && (
              <div className="absolute top-3 left-1/2 -translate-x-1/2 z-30 pointer-events-none">
                <div className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/15 text-amber-700 border border-amber-500/30 px-3 py-1 text-[9px] font-black uppercase tracking-[0.2em]">
                  <span className="size-1.5 rounded-full bg-amber-500"></span>
                  Offline
                </div>
              </div>
            )}
            {children}
          </div>
        </div>
      </div>
    </div>
  );
};
