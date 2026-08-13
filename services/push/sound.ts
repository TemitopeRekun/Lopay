/**
 * The in-app notification chime.
 *
 * ## Where a custom sound is actually possible
 *
 * Only in the foreground, and it is worth stating the boundary plainly because
 * it drives what the Settings copy is allowed to promise:
 *
 *  - **Foreground (this module).** The page is open and running, so it can play
 *    whatever it likes. This covers both a web tab in view and the Capacitor
 *    webview in view — Android suppresses the tray notification while the app
 *    is foregrounded, so without this a foreground push would arrive silently.
 *  - **Android background/killed.** The system plays the sound attached to the
 *    notification CHANNEL (`res/raw/lopay_alert.wav`, bound at channel creation
 *    in `nativePush.ts`). Nothing here runs.
 *  - **Web background.** The operating system's default notification sound, and
 *    that is not negotiable: the Notification API's `sound` option was
 *    specified, never implemented by any shipping browser, and has since been
 *    removed from the standard. A service worker also has no `Audio` and no
 *    `AudioContext`. Any library claiming otherwise is playing audio from a
 *    still-open page, which is exactly this module.
 *
 * ## Autoplay
 *
 * Browsers block audio until the user has interacted with the document. In
 * practice that is satisfied — a push only arrives after someone tapped
 * "Enable notifications" — but a rejected `play()` is a normal outcome, not an
 * error worth surfacing, so it is swallowed. `unlock()` exists to prime the
 * element during that very tap, which is what makes the first chime work.
 */

import { logger } from '../../utils/logger';

const SOUND_URL = '/sounds/lopay-alert.wav';
const PREFERENCE_KEY = 'lopay:push-sound';

/**
 * Minimum gap between chimes.
 *
 * A platform broadcast fans out to every parent at once and the socket layer
 * can deliver several notifications in the same tick; without this the app
 * machine-guns the chime. Deliberately shorter than the clip so a genuine
 * second event still registers as a second sound.
 */
const THROTTLE_MS = 1500;

let audio: HTMLAudioElement | null = null;
let lastPlayedAt = 0;

/** Whether the chime is enabled. Defaults to on; only an explicit opt-out sticks. */
export function isSoundEnabled(): boolean {
  try {
    return localStorage.getItem(PREFERENCE_KEY) !== 'off';
  } catch {
    // Private-mode / storage-blocked browsers: fall back to the default rather
    // than losing the sound entirely.
    return true;
  }
}

export function setSoundEnabled(enabled: boolean): void {
  try {
    localStorage.setItem(PREFERENCE_KEY, enabled ? 'on' : 'off');
  } catch {
    /* preference is a nicety; never fail the caller over storage */
  }
}

function getAudio(): HTMLAudioElement | null {
  if (typeof Audio === 'undefined') return null;
  if (!audio) {
    audio = new Audio(SOUND_URL);
    audio.preload = 'auto';
    // Well below a system notification — this fires while the user is already
    // looking at the screen, so it is a cue, not an alarm.
    audio.volume = 0.5;
  }
  return audio;
}

/**
 * Prime the audio element inside a user gesture.
 *
 * Call from the "Enable notifications" handler. Playing and immediately pausing
 * a muted element is the standard way to satisfy the autoplay policy for later,
 * non-gesture playback; without it the very first push after opt-in is silent
 * on Chrome and Safari.
 */
export async function unlockSound(): Promise<void> {
  const el = getAudio();
  if (!el) return;
  try {
    el.muted = true;
    await el.play();
    el.pause();
    el.currentTime = 0;
  } catch {
    /* blocked anyway — the chime will simply be silent until the next gesture */
  } finally {
    el.muted = false;
  }
}

/** Play the chime, honouring the user preference and the throttle. */
export function playNotificationSound(): void {
  if (!isSoundEnabled()) return;

  const now = Date.now();
  if (now - lastPlayedAt < THROTTLE_MS) return;

  const el = getAudio();
  if (!el) return;

  lastPlayedAt = now;
  try {
    el.currentTime = 0;
    void el.play().catch(() => {
      // Autoplay policy, or the asset 404'd. Either way the notification itself
      // still shows; log at debug so it is findable without being noise.
      logger.debug('Notification chime suppressed by the browser');
    });
  } catch {
    /* `currentTime` can throw before metadata loads; not worth surfacing */
  }
}

/** Test seam: forget the cached element and throttle state. */
export function resetSoundForTests(): void {
  audio = null;
  lastPlayedAt = 0;
}
