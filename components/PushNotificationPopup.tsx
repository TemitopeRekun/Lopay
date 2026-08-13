import React, { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { usePushStore } from '../store/pushStore';
import { toAppPath } from '../services/push';

/**
 * The in-app pop-up for a push that arrives while the app is open.
 *
 * Neither transport shows anything by itself in the foreground — FCM suppresses
 * the web notification while the tab has focus, and Android suppresses the tray
 * entry while the activity is resumed — so without this a foreground push is
 * completely invisible. It is intentionally richer than the generic
 * `ToastHost`: this one is tappable, routes to the notification's own screen,
 * and carries the money-event framing a parent is waiting on.
 *
 * Positioned bottom-anchored above the tab bar, not top-right like the toast,
 * for two reasons: it must not collide with a toast fired by the same event,
 * and on a phone the bottom of the screen is the only part reachable one-handed.
 */

const AUTO_DISMISS_MS = 8000;

/** Icon per backend `NotificationType`. Falls back to the payment case. */
const iconFor = (type?: string): string => {
  switch (type) {
    case 'ALERT':
      return 'warning';
    case 'ANNOUNCEMENT':
      return 'campaign';
    default:
      return 'account_balance_wallet';
  }
};

export const PushNotificationPopup: React.FC = () => {
  const incoming = usePushStore((s) => s.incoming);
  const dismiss = usePushStore((s) => s.dismissIncoming);
  const navigate = useNavigate();
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!incoming) return;
    // Restart the clock on every new push rather than letting an earlier one's
    // timer cut short the message that replaced it.
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(dismiss, AUTO_DISMISS_MS);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [incoming, dismiss]);

  if (!incoming) return null;

  const open = () => {
    dismiss();
    navigate(toAppPath(incoming.link) ?? '/notifications');
  };

  return (
    <div
      // `pointer-events-none` on the frame so the un-covered part of the screen
      // stays usable while the card is up; the card itself re-enables them.
      className="fixed inset-x-0 bottom-24 z-[9998] flex justify-center px-4 pointer-events-none"
    >
      <div
        role="alert"
        aria-live="assertive"
        className="pointer-events-auto w-full max-w-md animate-fade-in-up rounded-2xl border border-black/5 bg-white/95 shadow-2xl backdrop-blur-md dark:border-white/10 dark:bg-card-dark/95"
      >
        <div className="flex items-start gap-3 p-4">
          <div className="mt-0.5 flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/10">
            <span className="material-symbols-outlined text-primary">
              {iconFor(incoming.type)}
            </span>
          </div>

          {/*
            The whole block is the tap target, not a small "View" link — this
            card appears while the user is mid-task and a precise tap is the
            wrong thing to demand. `text-left` because a <button> centres by
            default and the content is prose.
          */}
          <button
            type="button"
            onClick={open}
            className="min-w-0 flex-1 text-left"
          >
            <p className="truncate text-sm font-bold text-text-primary-light dark:text-text-primary-dark">
              {incoming.title || 'LOPAY'}
            </p>
            {incoming.body ? (
              <p className="mt-0.5 line-clamp-2 text-xs leading-relaxed text-text-secondary-light dark:text-text-secondary-dark">
                {incoming.body}
              </p>
            ) : null}
            <span className="mt-2 inline-flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider text-primary">
              View
              <span className="material-symbols-outlined text-sm">
                chevron_right
              </span>
            </span>
          </button>

          <button
            type="button"
            onClick={dismiss}
            aria-label="Dismiss notification"
            className="-mr-1 -mt-1 rounded-full p-1.5 text-text-secondary-light transition-colors hover:bg-black/5 dark:hover:bg-white/10"
          >
            <span className="material-symbols-outlined text-lg">close</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default PushNotificationPopup;
