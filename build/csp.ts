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
      ...(storageOrigin ? [storageOrigin] : []),
    ],
    "frame-src": ["https://checkout.paystack.com"],
    "base-uri": ["'self'"],
    "form-action": ["'self'"],
    "object-src": ["'none'"],
  };
  return Object.entries(directives)
    .map(([k, v]) => `${k} ${v.join(" ")}`)
    .join("; ");
}
