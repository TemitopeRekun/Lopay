import { Capacitor } from "@capacitor/core";

/** True inside the Capacitor native shell (Android/iOS webview). */
export const isNativePlatform = (): boolean => Capacitor.isNativePlatform();

export type AuthMode = "bearer" | "cookie";

/**
 * Pure auth-path decision (M2 dual-path). Kept free of `import.meta.env` /
 * Capacitor so it is directly unit-testable.
 *
 * - **bearer** (default; the only native-shell path): a Better Auth token kept
 *   in localStorage and sent as `Authorization: Bearer`. Cross-origin cookies
 *   are unreliable in the Capacitor webview, and bearer is the proven web path —
 *   so it stays the default until the cookie path is verified in staging (the
 *   web bearer path is then retired in M5).
 * - **cookie**: rely on Better Auth's httpOnly+Secure session cookie. Opt in for
 *   the web origin by building with `VITE_WEB_AUTH_MODE=cookie`. Never on native.
 */
export function resolveAuthMode(opts: {
  native: boolean;
  webAuthModeEnv?: string;
}): AuthMode {
  if (opts.native) return "bearer";
  return opts.webAuthModeEnv === "cookie" ? "cookie" : "bearer";
}

/** How this client authenticates to the API. Resolved once at module load. */
export const getAuthMode = (): AuthMode =>
  resolveAuthMode({
    native: isNativePlatform(),
    webAuthModeEnv: (import.meta as unknown as { env?: Record<string, string> })
      .env?.VITE_WEB_AUTH_MODE,
  });
