/**
 * The SPA Content-Security-Policy, derived from the configured API origin.
 * Kept in its own module so both vite.config.ts (which injects it at build time)
 * and the CSP smoke test can import the exact same builder.
 *
 * `script-src 'self'` (no `unsafe-inline`/`unsafe-eval`) is the core XSS defense.
 * `connect-src` follows VITE_API_URL so it tracks the deployment.
 *
 * `storageUrl` (VITE_SUPABASE_URL) must be supplied wherever receipts are
 * uploaded. Receipt uploads do NOT go through the API: the backend mints a
 * Supabase signed upload URL and the browser PUTs the file straight to
 * `https://<ref>.supabase.co`. That is a cross-origin fetch, so omitting the
 * storage origin here makes the browser block every upload with an opaque
 * "Failed to fetch" — which surfaces to the parent as "Receipt upload failed"
 * and cannot be reproduced in `vite dev`, where no CSP is injected at all.
 * Reading receipts back is unaffected (they render via `img-src https:`), so the
 * gap only ever shows up on the write path.
 */
export function buildCsp(apiUrl: string, storageUrl?: string): string {
  let apiOrigin = "http://localhost:3001";
  try {
    apiOrigin = new URL(apiUrl).origin;
  } catch {
    /* fall back to the default origin */
  }
  const wsOrigin = apiOrigin.replace(/^http/, "ws");

  // Absent or malformed → contribute nothing rather than an "undefined" token,
  // which would silently widen the directive to a host named `undefined`.
  let storageOrigin: string | null = null;
  if (storageUrl) {
    try {
      storageOrigin = new URL(storageUrl).origin;
    } catch {
      storageOrigin = null;
    }
  }

  /**
   * Firebase Cloud Messaging's control plane.
   *
   * Exactly two hosts, and both are required before a single web push can be
   * delivered:
   *   - `firebaseinstallations.googleapis.com` mints the Firebase Installation
   *     ID that every FCM token is derived from.
   *   - `fcmregistrations.googleapis.com` exchanges the browser's PushManager
   *     subscription for the FCM registration token we send to the backend.
   *
   * Omitting them fails exactly like the Supabase gap above: `getToken()`
   * rejects with an opaque `messaging/token-subscribe-failed` in the BUILT app
   * only, because `vite dev` injects no CSP at all. Note this is the page's
   * policy — the delivery leg runs inside the service worker over the browser's
   * own push channel, which CSP does not govern.
   */
  const FCM_ORIGINS = [
    "https://firebaseinstallations.googleapis.com",
    "https://fcmregistrations.googleapis.com",
  ];

  const directives: Record<string, string[]> = {
    "default-src": ["'self'"],
    // No 'unsafe-inline'/'unsafe-eval' for scripts. Paystack inline-js loads
    // checkout from js.paystack.co.
    "script-src": ["'self'", "https://js.paystack.co"],
    // Tailwind + component inline styles need 'unsafe-inline'; Google Fonts CSS.
    "style-src": ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
    "font-src": ["'self'", "https://fonts.gstatic.com", "data:"],
    // Logos / receipts can be remote (Supabase storage) and data/blob URIs.
    "img-src": ["'self'", "data:", "blob:", "https:"],
    "connect-src": [
      "'self'",
      apiOrigin,
      wsOrigin,
      "https://api.paystack.co",
      ...FCM_ORIGINS,
      ...(storageOrigin ? [storageOrigin] : []),
    ],
    "frame-src": ["https://checkout.paystack.com"],
    // The FCM background worker (`/firebase-messaging-sw.js`). Same-origin
    // because it is bundled locally rather than pulled from gstatic — stated
    // explicitly rather than left to the script-src fallback, since that
    // fallback chain is easy to break by editing an unrelated directive.
    "worker-src": ["'self'"],
    "base-uri": ["'self'"],
    "form-action": ["'self'"],
    "object-src": ["'none'"],
  };
  return Object.entries(directives)
    .map(([k, v]) => `${k} ${v.join(" ")}`)
    .join("; ");
}
