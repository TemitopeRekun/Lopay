import { describe, it, expect, beforeEach } from "vitest";
import { useUIStore } from "./uiStore";

describe("useUIStore", () => {
  beforeEach(() => {
    useUIStore.setState({ sidebarOpen: false, toasts: [] });
  });

  it("toggles the sidebar open and closed", () => {
    expect(useUIStore.getState().sidebarOpen).toBe(false);
    useUIStore.getState().toggleSidebar();
    expect(useUIStore.getState().sidebarOpen).toBe(true);
    useUIStore.getState().toggleSidebar();
    expect(useUIStore.getState().sidebarOpen).toBe(false);
  });

  it("adds a toast and removes it by id", () => {
    // duration 0 → no auto-dismiss timer, so the assertion is deterministic.
    useUIStore.getState().showToast("hi", "success", 0);
    const toasts = useUIStore.getState().toasts;
    expect(toasts).toHaveLength(1);
    expect(toasts[0]).toMatchObject({ message: "hi", type: "success" });

    useUIStore.getState().removeToast(toasts[0].id);
    expect(useUIStore.getState().toasts).toHaveLength(0);
  });

  it("toggles theme between light and dark", () => {
    const start = useUIStore.getState().theme;
    useUIStore.getState().toggleTheme();
    expect(useUIStore.getState().theme).not.toBe(start);
  });
});
