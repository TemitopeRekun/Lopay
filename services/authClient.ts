import { createAuthClient } from "better-auth/client";
import { oneTimeTokenClient } from "better-auth/client/plugins";
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

  /**
   * How a Google sign-in gets its session across the origin boundary.
   *
   * The API is on a different SITE to this app, so a session cookie it sets is
   * third-party here and Safari, Firefox and any Chrome incognito window will
   * not send it back. The OAuth redirect therefore returns a one-time token in
   * the URL fragment instead, and `AuthContext.completeOAuthHandoff` trades it
   * at `/one-time-token/verify` — an ordinary CORS request that needs no cookie
   * at all. The server sets a session cookie on ITS own origin in that
   * response, which is what makes the `bearer` plugin emit `set-auth-token`,
   * which `onSuccess` below then persists exactly like any other sign-in.
   *
   * See the backend's `auth/oauth-handoff.ts` for the full hop-by-hop walk.
   */
  plugins: [oneTimeTokenClient()],

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
