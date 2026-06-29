/**
 * Thin logging wrapper so app code doesn't sprinkle raw `console.*`. Debug/info
 * are silenced in production builds; warn/error always pass through (and are the
 * natural hook point for a Sentry/observability bridge later).
 */
const isDev = import.meta.env?.DEV ?? true;

export const logger = {
  debug: (...args: unknown[]) => {
    if (isDev) console.debug(...args);
  },
  info: (...args: unknown[]) => {
    if (isDev) console.info(...args);
  },
  warn: (...args: unknown[]) => {
    console.warn(...args);
  },
  error: (...args: unknown[]) => {
    console.error(...args);
  },
};
