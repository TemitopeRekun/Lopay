import { createAuthClient } from "better-auth/client";
import { API_URL } from "./backend";
import { getAuthMode } from "./platform";

/**
 * Better Auth client. The handler is mounted on the backend at
 * `${API_URL}/api/auth` (outside the /api/v1 prefix).
 *
 * Dual-path auth (M2):
 * - **bearer** (default; the only native-shell path): the server returns a
 *   `set-auth-token` header on every successful auth response, which we persist
 *   to localStorage under `accessToken`. The axios client (services/backend.ts)
 *   replays it as `Authorization: Bearer`.
 * - **cookie** (opt-in for web via VITE_WEB_AUTH_MODE=cookie): rely on Better
 *   Auth's httpOnly session cookie; send credentials on every auth call.
 *
 * See services/platform.ts for how the mode is chosen.
 */
const authMode = getAuthMode();

export const authClient = createAuthClient({
  baseURL: API_URL,
  fetchOptions:
    authMode === "cookie"
      ? {
          // Web cookie path: the browser stores/sends the httpOnly session
          // cookie; nothing auth-related is kept in JS.
          credentials: "include",
        }
      : {
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
