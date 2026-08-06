// Extends `expect` with DOM matchers (toBeInTheDocument, etc.) for component
// tests. Imported via vitest.config.ts `setupFiles`.
import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

// `globals` is off in vitest.config, so RTL's auto-cleanup isn't registered.
// Unmount rendered trees between tests so queries don't see leftover DOM.
afterEach(() => cleanup());

/**
 * Keep the app's own structured log events out of the test output.
 *
 * `logger.event` (utils/logger.ts) deliberately writes a rejection at `warn` —
 * a rejected login IS the system working, and the event mirrors the backend's
 * `logAuthEvent` so one attempt can be traced across the boundary. Tests that
 * exercise those paths are therefore *supposed* to emit it, and a suite run
 * printed dozens of `login.rejected` objects to stderr. That noise is not free:
 * it buries the console warnings worth reading (React `act`, missing keys, a
 * genuine unhandled rejection) in output that looks like failure but isn't.
 *
 * Matched on the exact shape `logger.event` emits — a single object carrying
 * `event`, `level` and `ts` — so ONLY our own structured events are suppressed.
 * Every other console call, including `logger.warn/error` passthroughs and
 * anything React writes, still prints.
 *
 * A test can still assert the event: `vi.spyOn(console, "warn")` wraps this
 * filter rather than replacing it, so the call is recorded before it is
 * swallowed (see utils/logger.test.ts, which asserts the payload directly).
 */
const isStructuredClientEvent = (args: unknown[]): boolean => {
  if (args.length !== 1) return false;
  const [payload] = args;
  return (
    typeof payload === "object" &&
    payload !== null &&
    "event" in payload &&
    "level" in payload &&
    "ts" in payload
  );
};

for (const level of ["debug", "info", "warn", "error"] as const) {
  const write = console[level].bind(console);
  console[level] = (...args: unknown[]) => {
    if (!isStructuredClientEvent(args)) write(...args);
  };
}

// jsdom doesn't implement matchMedia; stub it so modules that read it at import
// time (e.g. the theme store) don't throw.
if (typeof window !== "undefined" && !window.matchMedia) {
  window.matchMedia = ((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  })) as typeof window.matchMedia;
}
