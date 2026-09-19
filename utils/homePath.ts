import type { UserRole } from "../types";

/**
 * Where a signed-in user belongs when no particular screen was asked for.
 *
 * One function, because this mapping was written out three times — in
 * `HomeRedirect`, in `AuthScreen`'s already-authenticated branch, and implicitly
 * wherever a screen hardcoded `/dashboard` as "the dashboard". The third of
 * those is how the enrollment-invite flow broke: `ClaimInviteScreen` sent every
 * successful claimant to `/dashboard`, which is `allowedRoles={["parent"]}`, so
 * a school owner claiming an invite for their own child — the case the API
 * deliberately supports, and says so twice — was bounced to `/home` and could
 * not reach the plan they had just activated.
 *
 * Any screen that wants to send someone "home" should call this rather than
 * naming a route, because "home" depends on who is asking.
 */
export function homePathForRole(role: UserRole | null | undefined): string {
  switch (role) {
    case "owner":
      return "/owner-dashboard";
    case "school_owner":
      return "/school-owner-dashboard";
    case "parent":
      return "/dashboard";
    default:
      // An unknown or not-yet-loaded role. `/dashboard` is the parent's, and a
      // parent is overwhelmingly the common case; `ProtectedRoute` redirects
      // anyone else on to `/home`, which resolves the role properly.
      return "/dashboard";
  }
}
