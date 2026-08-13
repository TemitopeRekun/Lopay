/**
 * The push facade. One transport is chosen once, at the platform boundary, and
 * nothing above this module knows which it was.
 *
 * Web goes through the Firebase JS SDK and a service worker; native goes
 * through `@capacitor/push-notifications` and the Android FCM SDK. Both end up
 * registering the same kind of FCM token against the same
 * `POST /device-tokens` endpoint, which is why the backend needs no branch at
 * all — `sendEachForMulticast` fans out to whatever tokens a user has.
 */

import { isNativePlatform } from '../platform';
import {
  acquireWebToken,
  getWebPermission,
  isWebPushSupported,
  onWebForegroundMessage,
  releaseWebToken,
  requestWebPermission,
} from './webPush';
import {
  acquireNativeToken,
  clearDeliveredNotifications,
  getNativePermission,
  onNativeForegroundMessage,
  onNativeNotificationOpened,
  primeNativePush,
  releaseNativeToken,
  requestNativePermission,
} from './nativePush';
import type { PushMessage, PushPermission, PushRegistration } from './types';

export type { PushMessage, PushPermission, PushRegistration } from './types';
export {
  isSoundEnabled,
  setSoundEnabled,
  playNotificationSound,
  unlockSound,
} from './sound';
export { getMissingPushKeys, getPushConfig } from './config';

/** Browser `NotificationPermission` → our four-state enum. */
const fromBrowserPermission = (
  permission: NotificationPermission | 'unsupported',
): PushPermission => {
  if (permission === 'unsupported') return 'unsupported';
  if (permission === 'granted') return 'granted';
  if (permission === 'denied') return 'denied';
  return 'prompt';
};

/**
 * Turn a backend `Notification.link` into something the router can navigate to.
 *
 * The app runs on `HashRouter`, so an in-app route is `/#/notifications` in the
 * address bar but `/notifications` to `navigate()`. The backend stores the bare
 * path. This strips a leading `#`, refuses anything absolute (a link arriving
 * from a push is attacker-influenceable in principle, and `navigate()` on an
 * absolute URL would be an open redirect), and guarantees a leading slash.
 */
export function toAppPath(link: string | undefined): string | null {
  if (!link) return null;
  let path = link.trim();
  if (path === '') return null;

  // `/#/foo`, `#/foo` → `/foo`
  path = path.replace(/^\/?#/, '');

  // Reject absolute URLs and protocol-relative ones outright rather than trying
  // to salvage a path from them.
  if (/^[a-z][a-z0-9+.-]*:/i.test(path) || path.startsWith('//')) return null;

  if (!path.startsWith('/')) path = `/${path}`;
  return path;
}

export const PushBridge = {
  /** True when this platform can deliver push at all. */
  async isSupported(): Promise<boolean> {
    if (isNativePlatform()) {
      return (await getNativePermission()) !== 'unsupported';
    }
    return isWebPushSupported();
  },

  async getPermission(): Promise<PushPermission> {
    if (isNativePlatform()) return getNativePermission();
    if (!(await isWebPushSupported())) return 'unsupported';
    return fromBrowserPermission(getWebPermission());
  },

  /** Show the OS prompt. Only ever called from a user gesture. */
  async requestPermission(): Promise<PushPermission> {
    if (isNativePlatform()) return requestNativePermission();
    if (!(await isWebPushSupported())) return 'unsupported';
    return fromBrowserPermission(await requestWebPermission());
  },

  /** The FCM token for this device, or `null` if one cannot be obtained. */
  async acquireToken(): Promise<PushRegistration | null> {
    if (isNativePlatform()) {
      const token = await acquireNativeToken();
      // The shell only ships for Android today; iOS would report 'ios' here,
      // and the backend DTO already accepts all three.
      return token ? { token, platform: 'android' } : null;
    }
    const token = await acquireWebToken();
    return token ? { token, platform: 'web' } : null;
  },

  /** Drop this device's token locally (the backend row is deleted separately). */
  async releaseToken(): Promise<void> {
    if (isNativePlatform()) return releaseNativeToken();
    return releaseWebToken();
  },

  /** Pushes arriving while the app is open and focused. */
  async onForegroundMessage(
    handler: (message: PushMessage) => void,
  ): Promise<() => void> {
    if (isNativePlatform()) return onNativeForegroundMessage(handler);
    return onWebForegroundMessage(handler);
  },

  /**
   * Taps on a delivered notification.
   *
   * Native only. On the web the service worker owns the click — FCM focuses or
   * opens the tab at `webpush.fcmOptions.link` — so there is nothing for the
   * page to subscribe to, and returning a no-op keeps the caller branch-free.
   */
  onNotificationOpened(handler: (message: PushMessage) => void): () => void {
    if (isNativePlatform()) return onNativeNotificationOpened(handler);
    return () => undefined;
  },

  /** Clear the OS notification tray (native only; no-op on web). */
  async clearTray(): Promise<void> {
    if (isNativePlatform()) await clearDeliveredNotifications();
  },

  /** Attach the cold-start tap listener. Call once, as early as possible. */
  async prime(): Promise<void> {
    if (isNativePlatform()) await primeNativePush();
  },
};
