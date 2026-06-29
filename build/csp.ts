/**
 * The SPA Content-Security-Policy, derived from the configured API origin.
 * Kept in its own module so both vite.config.ts (which injects it at build time)
 * and the CSP smoke test can import the exact same builder.
 *
 * `script-src 'self'` (no `unsafe-inline`/`unsafe-eval`) is the core XSS defense.
 * `connect-src` follows VITE_API_URL so it tracks the deployment.
 */
export function buildCsp(apiUrl: string): string {
  let apiOrigin = "http://localhost:3001";
  try {
    apiOrigin = new URL(apiUrl).origin;
  } catch {
    /* fall back to the default origin */
  }
  const wsOrigin = apiOrigin.replace(/^http/, "ws");
  const directives: Record<string, string[]> = {
    "default-src": ["'self'"],
    // No 'unsafe-inline'/'unsafe-eval' for scripts. Paystack inline-js loads
    // checkout from js.paystack.co.
    "script-src": ["'self'", "https://js.paystack.co"],
    // Tailwind + component inline styles need 'unsafe-inline'; Google Fonts CSS.
    "style-src": ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
    "font-src": ["'self'", "https://fonts.gstatic.com", "data:"],
    // Logos / receipts can be remote (Firebase storage) and data/blob URIs.
    "img-src": ["'self'", "data:", "blob:", "https:"],
    "connect-src": ["'self'", apiOrigin, wsOrigin, "https://api.paystack.co"],
    "frame-src": ["https://checkout.paystack.com"],
    "base-uri": ["'self'"],
    "form-action": ["'self'"],
    "object-src": ["'none'"],
  };
  return Object.entries(directives)
    .map(([k, v]) => `${k} ${v.join(" ")}`)
    .join("; ");
}
