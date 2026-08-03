import React from "react";

export interface LinkedAccountsSectionProps {
  /** True once a Google identity is attached to this account. */
  isGoogleLinked: boolean;
  /** True when a password credential exists — false for Google-only accounts. */
  isPasswordEnabled: boolean;
  /** Still reading which providers are attached. */
  isLoading: boolean;
  /** Start the link flow. Redirects to Google and returns to this screen. */
  onConnectGoogle: () => void;
  /** In flight between the click and the redirect. */
  isConnecting: boolean;
  /** Inline failure message, already mapped to human wording. */
  error: string | null;
}

/**
 * "Sign-in methods" — shows which ways this account can be used to sign in, and
 * offers to attach Google.
 *
 * ## Why linking lives here and not on the sign-in screen
 *
 * Better Auth will not attach a Google identity to an existing email/password
 * account at sign-in time unless that account's email is verified
 * (`requireLocalEmailVerified`, on by default). This app has no mail domain and sends
 * no verification, so no account is ever verified and that path dead-ends on the
 * API's own error page — the user clicks "Continue with Google", leaves the app, and
 * lands on a JSON error with no way back.
 *
 * Signing in first inverts the proof. `/link-social` treats the session as evidence
 * of ownership and skips the `emailVerified` check entirely, so linking works with no
 * email infrastructure at all — while the default that blocks the pre-hijack attack
 * (an attacker pre-registering someone's address and waiting for them to arrive via
 * Google) stays on. That is why the fix is a screen here rather than a config flag.
 */
export const LinkedAccountsSection: React.FC<LinkedAccountsSectionProps> = ({
  isGoogleLinked,
  isPasswordEnabled,
  isLoading,
  onConnectGoogle,
  isConnecting,
  error,
}) => (
  <section className="space-y-3">
    <h3 className="text-[10px] font-black text-text-secondary-light uppercase tracking-[0.2em] mb-1 px-1">
      Sign-in Methods
    </h3>

    <div className="bg-white dark:bg-card-dark rounded-3xl border border-gray-100 dark:border-gray-800 overflow-hidden shadow-sm">
      <div className="w-full p-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="material-symbols-outlined text-text-secondary-light text-xl">
            mail
          </span>
          <div className="text-left">
            <p className="text-xs font-bold text-text-primary-light dark:text-text-primary-dark">
              Email &amp; Password
            </p>
            {/* Derived, never assumed: an account created through Google has no
                credential row, and claiming it has a password would be a lie the
                user cannot act on — there is no reset flow to correct it. */}
            <p className="text-[10px] text-text-secondary-light">
              {isLoading
                ? "Checking…"
                : isPasswordEnabled
                  ? "Active"
                  : "Not set"}
            </p>
          </div>
        </div>
        {!isLoading && isPasswordEnabled && (
          <span className="material-symbols-outlined text-green-600 text-lg">
            check_circle
          </span>
        )}
      </div>

      <div className="w-full p-4 flex items-center justify-between border-t border-gray-50 dark:border-gray-800">
        <div className="flex items-center gap-3">
          <span className="material-symbols-outlined text-text-secondary-light text-xl">
            account_circle
          </span>
          <div className="text-left">
            <p className="text-xs font-bold text-text-primary-light dark:text-text-primary-dark">
              Google
            </p>
            <p className="text-[10px] text-text-secondary-light">
              {isLoading
                ? "Checking…"
                : isGoogleLinked
                  ? "Connected"
                  : "Not connected"}
            </p>
          </div>
        </div>

        {/* No button while loading: offering "Connect" before we know the answer
            invites a pointless round trip through Google for an account that is
            already linked. */}
        {isLoading ? null : isGoogleLinked ? (
          <span className="material-symbols-outlined text-green-600 text-lg">
            check_circle
          </span>
        ) : (
          <button
            type="button"
            onClick={onConnectGoogle}
            disabled={isConnecting}
            className="px-3 py-2 rounded-xl bg-primary/5 border border-primary/20 text-primary text-[10px] font-black uppercase tracking-wider hover:bg-primary/10 transition-all disabled:opacity-70"
          >
            {isConnecting ? "Connecting…" : "Connect"}
          </button>
        )}
      </div>
    </div>

    {error && (
      <p
        role="alert"
        className="text-[11px] font-semibold text-red-600 dark:text-red-400 px-1"
      >
        {error}
      </p>
    )}
  </section>
);
