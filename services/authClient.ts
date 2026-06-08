import { createAuthClient } from "better-auth/client";
import { API_URL } from "./backend";

/**
 * Better Auth client. The handler is mounted on the backend at
 * `${API_URL}/api/auth` (outside the /api/v1 prefix).
 *
 * Bearer-token mode (works in web + the Capacitor webview): on every successful
 * auth response the server returns a `set-auth-token` header which we persist to
 * localStorage under `accessToken`. The existing axios client (services/backend.ts)
 * already sends `Authorization: Bearer <accessToken>` for all domain API calls,
 * so the same token authenticates everything.
 */
export const authClient = createAuthClient({
  baseURL: API_URL,
  fetchOptions: {
    auth: {
      type: "Bearer",
      token: () => localStorage.getItem("accessToken") || "",
    },
    onSuccess: (ctx) => {
      const token = ctx.response.headers.get("set-auth-token");
      if (token) {
        localStorage.setItem("accessToken", token);
      }
    },
  },
});
