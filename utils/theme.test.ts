import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import {
  THEME_STORAGE_KEY,
  applyStoredTheme,
  applyTheme,
  resolveTheme,
  storeTheme,
} from "./theme";

const setPrefersDark = (matches: boolean) => {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    configurable: true,
    value: vi.fn().mockReturnValue({ matches }),
  });
};

describe("theme", () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.classList.remove("dark");
    setPrefersDark(false);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("resolveTheme", () => {
    it("honours a stored choice over the OS preference", () => {
      setPrefersDark(true);
      localStorage.setItem(THEME_STORAGE_KEY, "light");
      expect(resolveTheme()).toBe("light");
    });

    it("falls back to the OS preference when nothing is stored", () => {
      setPrefersDark(true);
      expect(resolveTheme()).toBe("dark");
    });

    it("defaults to light when neither is available", () => {
      expect(resolveTheme()).toBe("light");
    });

    it("ignores a garbage stored value", () => {
      localStorage.setItem(THEME_STORAGE_KEY, "banana");
      expect(resolveTheme()).toBe("light");
    });
  });

  describe("applyTheme", () => {
    it("adds and removes the dark class", () => {
      applyTheme("dark");
      expect(document.documentElement.classList.contains("dark")).toBe(true);
      applyTheme("light");
      expect(document.documentElement.classList.contains("dark")).toBe(false);
    });
  });

  describe("applyStoredTheme", () => {
    it("puts the page in the stored theme before render", () => {
      // Nothing applied `dark` at boot, so the Settings toggle only held for the
      // session — this is what makes the choice survive a reload.
      localStorage.setItem(THEME_STORAGE_KEY, "dark");

      expect(applyStoredTheme()).toBe("dark");
      expect(document.documentElement.classList.contains("dark")).toBe(true);
    });
  });

  describe("storeTheme", () => {
    it("persists the choice", () => {
      storeTheme("dark");
      expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe("dark");
    });

    it("does not throw when storage is unavailable", () => {
      const spy = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
        throw new Error("blocked");
      });
      expect(() => storeTheme("dark")).not.toThrow();
      spy.mockRestore();
    });
  });
});
