/**
 * Light/dark theme, persisted.
 *
 * Nothing applied the `dark` class at boot, so the Settings toggle only held for
 * the current session — reload and the app was light again regardless of what the
 * reader had chosen (or what their OS asks for).
 */
export const THEME_STORAGE_KEY = "lopay:theme";

export type Theme = "light" | "dark";

const readStored = (): Theme | null => {
  try {
    const value = localStorage.getItem(THEME_STORAGE_KEY);
    return value === "dark" || value === "light" ? value : null;
  } catch {
    // Blocked storage (private mode, embedded webview) — fall back to the OS.
    return null;
  }
};

const prefersDark = (): boolean =>
  typeof window !== "undefined" &&
  typeof window.matchMedia === "function" &&
  window.matchMedia("(prefers-color-scheme: dark)").matches;

/** The theme to render: an explicit choice if there is one, else the OS preference. */
export const resolveTheme = (): Theme =>
  readStored() ?? (prefersDark() ? "dark" : "light");

export const applyTheme = (theme: Theme): void => {
  document.documentElement.classList.toggle("dark", theme === "dark");
};

export const storeTheme = (theme: Theme): void => {
  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    // Non-fatal: the toggle still works for this session.
  }
};

/** Call once before render so the first paint is already in the right theme. */
export const applyStoredTheme = (): Theme => {
  const theme = resolveTheme();
  applyTheme(theme);
  return theme;
};
