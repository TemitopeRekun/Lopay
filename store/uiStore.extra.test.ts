import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { useUIStore } from "./uiStore";

// Tops up the gaps left by uiStore.test.ts: the explicit open/close sidebar
// actions and the auto-dismiss timer path of showToast.
describe("useUIStore (extra coverage)", () => {
  beforeEach(() => {
    useUIStore.setState({ sidebarOpen: false, toasts: [] });
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("opens and closes the sidebar explicitly", () => {
    useUIStore.getState().openSidebar();
    expect(useUIStore.getState().sidebarOpen).toBe(true);
    useUIStore.getState().closeSidebar();
    expect(useUIStore.getState().sidebarOpen).toBe(false);
  });

  it("auto-dismisses a toast once its duration elapses", () => {
    vi.useFakeTimers();
    useUIStore.getState().showToast("bye", "warning", 1000);
    expect(useUIStore.getState().toasts).toHaveLength(1);
    vi.advanceTimersByTime(1000);
    expect(useUIStore.getState().toasts).toHaveLength(0);
  });

  it("defaults to an info toast with the standard 3s duration", () => {
    vi.useFakeTimers();
    useUIStore.getState().showToast("hello");
    const toast = useUIStore.getState().toasts[0];
    expect(toast.type).toBe("info");
    expect(toast.duration).toBe(3000);
    vi.advanceTimersByTime(3000);
    expect(useUIStore.getState().toasts).toHaveLength(0);
  });

  it("toggleTheme flips from both a light and a dark starting state", () => {
    useUIStore.getState().setTheme("light");
    useUIStore.getState().toggleTheme();
    expect(useUIStore.getState().theme).toBe("dark");
    useUIStore.getState().setTheme("dark");
    useUIStore.getState().toggleTheme();
    expect(useUIStore.getState().theme).toBe("light");
  });
});

// getInitialTheme runs once at module load, so it is exercised by re-importing
// the store under different persisted-theme / OS-preference conditions.
describe("getInitialTheme (module initialisation)", () => {
  const originalMatchMedia = window.matchMedia;

  afterEach(() => {
    localStorage.removeItem("lopay-theme");
    window.matchMedia = originalMatchMedia;
    vi.resetModules();
  });

  it("restores a persisted dark theme", async () => {
    localStorage.setItem("lopay-theme", "dark");
    vi.resetModules();
    const mod = await import("./uiStore");
    expect(mod.useUIStore.getState().theme).toBe("dark");
  });

  it("restores a persisted light theme", async () => {
    localStorage.setItem("lopay-theme", "light");
    vi.resetModules();
    const mod = await import("./uiStore");
    expect(mod.useUIStore.getState().theme).toBe("light");
  });

  it("falls back to the OS dark preference when nothing is persisted", async () => {
    localStorage.removeItem("lopay-theme");
    window.matchMedia = ((query: string) => ({
      matches: true,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    })) as typeof window.matchMedia;
    vi.resetModules();
    const mod = await import("./uiStore");
    expect(mod.useUIStore.getState().theme).toBe("dark");
  });
});
