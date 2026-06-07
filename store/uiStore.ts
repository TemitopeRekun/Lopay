import { create } from "zustand";

export type Theme = "light" | "dark";

export interface ToastMessage {
  id: string;
  message: string;
  type: "success" | "error" | "info" | "warning";
  duration?: number;
}

const THEME_KEY = "lopay-theme";

const getInitialTheme = (): Theme => {
  if (typeof window === "undefined") return "light";
  const saved = localStorage.getItem(THEME_KEY);
  if (saved === "light" || saved === "dark") return saved;
  if (window.matchMedia("(prefers-color-scheme: dark)").matches) return "dark";
  return "light";
};

const applyThemeClass = (theme: Theme) => {
  if (typeof document === "undefined") return;
  document.documentElement.classList.toggle("dark", theme === "dark");
};

interface UIState {
  // Sidebar / drawer
  sidebarOpen: boolean;
  toggleSidebar: () => void;
  openSidebar: () => void;
  closeSidebar: () => void;

  // Theme
  theme: Theme;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;

  // Toasts
  toasts: ToastMessage[];
  showToast: (
    message: string,
    type?: ToastMessage["type"],
    duration?: number,
  ) => void;
  removeToast: (id: string) => void;
}

/**
 * Global UI store (Zustand). Holds transient, non-server UI state so any part of
 * the app — including non-React code such as the realtime socket layer — can
 * read it or fire a toast via `useUIStore.getState()`.
 */
export const useUIStore = create<UIState>((set, get) => ({
  sidebarOpen: false,
  toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
  openSidebar: () => set({ sidebarOpen: true }),
  closeSidebar: () => set({ sidebarOpen: false }),

  theme: getInitialTheme(),
  setTheme: (theme) => {
    if (typeof window !== "undefined") localStorage.setItem(THEME_KEY, theme);
    applyThemeClass(theme);
    set({ theme });
  },
  toggleTheme: () => {
    const next: Theme = get().theme === "light" ? "dark" : "light";
    get().setTheme(next);
  },

  toasts: [],
  removeToast: (id) =>
    set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
  showToast: (message, type = "info", duration = 3000) => {
    const id = Math.random().toString(36).substring(2, 9);
    const toast: ToastMessage = { id, message, type, duration };
    set((s) => ({ toasts: [...s.toasts, toast] }));
    if (duration > 0) {
      setTimeout(() => get().removeToast(id), duration);
    }
  },
}));

// Apply the persisted theme class as soon as the store module loads.
applyThemeClass(useUIStore.getState().theme);
