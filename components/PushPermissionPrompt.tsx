import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useUIStore } from '../store/uiStore';
import { shouldShowSoftAsk, usePushStore } from '../store/pushStore';

/**
 * The pre-permission ("soft-ask") card.
 *
 * The browser and Android both give an origin exactly ONE shot at the real
 * permission dialog: a denial is permanent until the user digs into system
 * settings, and no amount of later product work can re-open it. So the native
 * prompt is never fired on load — this card explains what the notifications are
 * for first, and only an explicit "Turn on" reaches
 * `Notification.requestPermission()`.
 *
 * "Not now" is free and repeatable: it sets a fortnight cooldown
 * (`shouldShowSoftAsk`) rather than burning the prompt, so a parent who is
 * mid-payment can dismiss it and still be offered push later.
 *
 * Only shown to signed-in users. A push is worthless before there is an account
 * to attach the device token to, and asking on the welcome screen is the
 * classic way to collect denials.
 */
export const PushPermissionPrompt: React.FC = () => {
  const { isAuthenticated } = useAuth();
  const supported = usePushStore((s) => s.supported);
  const permission = usePushStore((s) => s.permission);
  const softAskDismissedAt = usePushStore((s) => s.softAskDismissedAt);
  const status = usePushStore((s) => s.status);
  const enable = usePushStore((s) => s.enable);
  const dismissSoftAsk = usePushStore((s) => s.dismissSoftAsk);
  const showToast = useUIStore((s) => s.showToast);
  const [busy, setBusy] = useState(false);

  const visible =
    isAuthenticated &&
    shouldShowSoftAsk({
      supported,
      permission,
      softAskDismissedAt,
      now: Date.now(),
    });

  if (!visible) return null;

  const handleEnable = async () => {
    setBusy(true);
    try {
      const ok = await enable();
      if (ok) {
        showToast('Notifications are on', 'success');
        // Dismiss regardless of outcome below, but on success the card is gone
        // for good because `permission` is no longer 'prompt'.
        return;
      }
      // `enable()` records why in the store; surface it rather than a generic
      // failure, since "blocked in settings" and "network" need different fixes.
      showToast(
        usePushStore.getState().error ?? 'Could not turn on notifications',
        'error',
      );
      dismissSoftAsk();
    } finally {
      setBusy(false);
    }
  };

  const pending = busy || status === 'enabling';

  return (
    <div className="mx-4 mb-4 animate-fade-in-up rounded-2xl border border-primary/20 bg-primary/5 p-4 dark:border-primary/30 dark:bg-primary/10">
      <div className="flex items-start gap-3">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/15">
          <span className="material-symbols-outlined text-primary">
            notifications_active
          </span>
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold text-text-primary-light dark:text-text-primary-dark">
            Know the moment a payment clears
          </p>
          {/*
            Concrete and honest about what is sent. Vague "stay updated" copy is
            what makes people deny — they cannot tell what they are agreeing to.
          */}
          <p className="mt-1 text-xs leading-relaxed text-text-secondary-light dark:text-text-secondary-dark">
            Get an alert when your school confirms or rejects a payment, and
            before an installment is due. No marketing.
          </p>

          <div className="mt-3 flex items-center gap-2">
            <button
              type="button"
              onClick={handleEnable}
              disabled={pending}
              className="rounded-full bg-primary px-4 py-2 text-xs font-bold text-white transition-transform active:scale-95 disabled:opacity-60"
            >
              {pending ? 'Turning on…' : 'Turn on'}
            </button>
            <button
              type="button"
              onClick={dismissSoftAsk}
              disabled={pending}
              className="rounded-full px-4 py-2 text-xs font-bold text-text-secondary-light transition-colors hover:bg-black/5 disabled:opacity-60 dark:hover:bg-white/10"
            >
              Not now
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PushPermissionPrompt;
