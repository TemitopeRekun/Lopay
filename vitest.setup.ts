// Extends `expect` with DOM matchers (toBeInTheDocument, etc.) for component
// tests. Imported via vitest.config.ts `setupFiles`.
import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

// `globals` is off in vitest.config, so RTL's auto-cleanup isn't registered.
// Unmount rendered trees between tests so queries don't see leftover DOM.
afterEach(() => cleanup());

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
