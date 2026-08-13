import React, { useState } from 'react';
import { useUIStore } from '../store/uiStore';
import { usePushStore } from '../store/pushStore';
import { playNotificationSound } from '../services/push';

/**
 * The real Settings controls for push notifications.
 *
 * Replaces a pair of toggles that were local `useState` only — they changed a
 * switch colour and nothing else. The rule this section is built around is that
 * a control must never claim more than it does, so each state renders different
 * copy and different affordances:
 *
 *  - **unsupported** — no toggle at all, and a line saying why. A switch that
 *    cannot work is worse than an absent one.
 *  - **denied** — no toggle either, because a page cannot re-open the OS prompt.
 *    Offering one would be a button that provably does nothing; instead the copy
 *    points at the only place the decision can be reversed.
 *  - **prompt / granted** — a working switch, whose "on" position means a device
 *    token is registered with the backend, not merely that permission exists.
 *
 * The sound row is separate and stays usable even with device push off, because
 * it also governs the chime for alerts arriving over the realtime socket while
 * the app is open.
 */

const Switch: React.FC<{
  checked: boolean;
  onChange: () => void;
  disabled?: boolean;
  label: string;
}> = ({ checked, onChange, disabled, label }) => (
  <button
    type="button"
    role="switch"
    aria-checked={checked}
    aria-label={label}
    disabled={disabled}
    onClick={onChange}
    className={`relative h-7 w-12 shrink-0 rounded-full transition-colors disabled:opacity-50 ${
      checked ? 'bg-primary' : 'bg-gray-200 dark:bg-gray-700'
    }`}
  >
    <div
      className={`absolute top-1 size-5 rounded-full bg-white transition-all ${
        checked ? 'left-6' : 'left-1'
      }`}
    />
  </button>
);

export const PushSettingsSection: React.FC = () => {
  const supported = usePushStore((s) => s.supported);
  const permission = usePushStore((s) => s.permission);
  const status = usePushStore((s) => s.status);
  const soundEnabled = usePushStore((s) => s.soundEnabled);
  const enable = usePushStore((s) => s.enable);
  const disable = usePushStore((s) => s.disable);
  const setSoundEnabled = usePushStore((s) => s.setSoundEnabled);
  const showToast = useUIStore((s) => s.showToast);
  const [busy, setBusy] = useState(false);

  const pushOn = status === 'enabled';
  const pending = busy || status === 'enabling';

  const togglePush = async () => {
    setBusy(true);
    try {
      if (pushOn) {
        await disable();
        const error = usePushStore.getState().error;
        showToast(error ?? 'Device notifications turned off', error ? 'error' : 'info');
        return;
      }
      const ok = await enable();
      showToast(
        ok
          ? 'Device notifications turned on'
          : (usePushStore.getState().error ?? 'Could not turn on notifications'),
        ok ? 'success' : 'error',
      );
    } finally {
      setBusy(false);
    }
  };

  const toggleSound = () => {
    const next = !soundEnabled;
    setSoundEnabled(next);
    // Play it on the way ON, from inside the click, so the choice is auditioned
    // rather than described — and so the browser's autoplay gate is satisfied by
    // the very gesture that enabled it.
    if (next) playNotificationSound();
  };

  return (
    <section>
      <h3 className="mb-4 text-sm font-bold uppercase tracking-wider text-text-secondary-light">
        Notifications
      </h3>
      <div className="overflow-hidden rounded-xl border border-gray-100 bg-white dark:border-gray-800 dark:bg-card-dark">
        {/* Device push */}
        <div className="flex items-start justify-between gap-3 border-b border-gray-100 p-4 dark:border-gray-800">
          <div className="flex min-w-0 items-start gap-3">
            <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-blue-50 dark:bg-blue-900/20">
              <span className="material-symbols-outlined text-primary">
                notifications_active
              </span>
            </div>
            <div className="min-w-0">
              <p className="font-medium text-text-primary-light dark:text-text-primary-dark">
                Device notifications
              </p>
              <p className="mt-1 text-xs leading-relaxed text-text-secondary-light">
                {supported === false
                  ? 'This browser or device cannot receive push notifications. In-app alerts still work.'
                  : permission === 'denied'
                    ? 'Blocked. To turn these back on, allow notifications for LOPAY in your browser or device settings.'
                    : 'Get alerted when a payment is confirmed or rejected, and before an installment is due — even when the app is closed.'}
              </p>
            </div>
          </div>
          {supported === true && permission !== 'denied' ? (
            <Switch
              checked={pushOn}
              onChange={() => void togglePush()}
              disabled={pending}
              label="Device notifications"
            />
          ) : null}
        </div>

        {/* Sound */}
        <div className="flex items-start justify-between gap-3 p-4">
          <div className="flex min-w-0 items-start gap-3">
            <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-blue-50 dark:bg-blue-900/20">
              <span className="material-symbols-outlined text-primary">
                {soundEnabled ? 'volume_up' : 'volume_off'}
              </span>
            </div>
            <div className="min-w-0">
              <p className="font-medium text-text-primary-light dark:text-text-primary-dark">
                Notification sound
              </p>
              <p className="mt-1 text-xs leading-relaxed text-text-secondary-light">
                {/*
                  Deliberately precise. The app controls the chime only while it
                  is open; a notification that arrives with the app closed uses
                  the sound the operating system assigns — on Android that is
                  this app's own channel, on the web it is the system default,
                  and no web API can change it.
                */}
                Play a chime for alerts that arrive while the app is open. When
                the app is closed, your device&apos;s own notification sound is
                used.
              </p>
            </div>
          </div>
          <Switch
            checked={soundEnabled}
            onChange={toggleSound}
            label="Notification sound"
          />
        </div>
      </div>
    </section>
  );
};

export default PushSettingsSection;
