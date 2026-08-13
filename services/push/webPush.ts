/**
 * Web push (browser / PWA) half of the push bridge.
 *
 * Deliberately the only module in the app that imports `firebase/*` on the page
 * side, so the SDK lands in one lazily-loaded chunk rather than the entry
 * bundle — the Firebase messaging SDK is ~50kB gzipped and the overwhelming
 * majority of sessions (anyone who has not opted in) must never pay for it.
 * That is why every export here is `async` and the imports are dynamic.
 *
 * Nothing in here throws for an unsupported browser. Web push needs a service
 * worker, the Push API, the Notification API and a secure context, and the
 * honest answer on, say, iOS Safari in a normal tab is "not available" — which
 * the UI must render as an absent feature, not an error.
 */

import type { FirebaseApp } from 'firebase/app';
import type { Messaging, MessagePayload } from 'firebase/messaging';
import { logger } from '../../utils/logger';
import { getPushConfig, PUSH_SERVICE_WORKER_URL } from './config';
import type { PushMessage } from './types';

let appPromise: Promise<FirebaseApp | null> | null = null;
let messagingPromise: Promise<Messaging | null> | null = null;
let swRegistration: ServiceWorkerRegistration | null = null;

/**
 * Whether this browser can do web push at all.
 *
 * `isSupported()` from the SDK is the authoritative check — it covers the
 * indexedDB and cookie-availability edge cases that a naive feature test
 * misses (Firefox private windows disable indexedDB, and the SDK needs it for
 * the Firebase Installations record behind every token).
 */
export async function isWebPushSupported(): Promise<boolean> {
  if (typeof window === 'undefined') return false;
  if (!('serviceWorker' in navigator)) return false;
  if (!hasNotificationApi()) return false;
  if (!getPushConfig()) return false;

  try {
    const { isSupported } = await import('firebase/messaging');
    return await isSupported();
  } catch {
    return false;
  }
}

async function getFirebaseApp(): Promise<FirebaseApp | null> {
  if (!appPromise) {
    appPromise = (async () => {
      const config = getPushConfig();
      if (!config) return null;
      const { initializeApp, getApp, getApps } = await import('firebase/app');
      // Named app rather than [DEFAULT]. If Firebase Auth is ever added it will
      // want its own initialisation, and two `initializeApp` calls on the
      // default name with different options throw.
      const NAME = 'lopay-messaging';
      return getApps().some((a) => a.name === NAME)
        ? getApp(NAME)
        : initializeApp(config.firebase, NAME);
    })();
  }
  return appPromise;
}

async function getMessagingInstance(): Promise<Messaging | null> {
  if (!messagingPromise) {
    messagingPromise = (async () => {
      if (!(await isWebPushSupported())) return null;
      const app = await getFirebaseApp();
      if (!app) return null;
      const { getMessaging } = await import('firebase/messaging');
      return getMessaging(app);
    })();
  }
  return messagingPromise;
}

/**
 * Register (or reuse) the messaging service worker.
 *
 * Passed explicitly to `getToken` rather than left to the SDK's own lookup. The
 * SDK's default registers `/firebase-messaging-sw.js` itself, which races with
 * any other worker the app might register later and silently picks whichever
 * won — being explicit means the token is always bound to the worker we built.
 */
async function getServiceWorkerRegistration(): Promise<ServiceWorkerRegistration | null> {
  if (swRegistration) return swRegistration;
  try {
    swRegistration = await navigator.serviceWorker.register(
      PUSH_SERVICE_WORKER_URL,
      // Root scope: the worker must control every route, and the app is served
      // from the origin root on both Netlify and the Capacitor webview.
      { scope: '/' },
    );
    // `getToken` needs an ACTIVE worker. A first-ever registration is still
    // installing at this point, and skipping the wait is the classic cause of
    // an intermittent `messaging/failed-service-worker-registration`.
    await navigator.serviceWorker.ready;
    return swRegistration;
  } catch (error) {
    logger.warn('Messaging service worker registration failed', error);
    return null;
  }
}

/**
 * Whether the Notification API is actually usable.
 *
 * `typeof`, not `'Notification' in window`: the `in` check passes whenever the
 * key merely EXISTS, so a browser (or a webview shim, or a privacy extension)
 * that defines it as `undefined` reads as supported and the next property
 * access throws. `typeof` on an undeclared identifier is the one form that is
 * safe in both cases.
 */
const hasNotificationApi = (): boolean =>
  typeof Notification !== 'undefined' && Notification !== null;

/** Current browser permission, without prompting. */
export function getWebPermission(): NotificationPermission | 'unsupported' {
  if (typeof window === 'undefined' || !hasNotificationApi()) {
    return 'unsupported';
  }
  return Notification.permission;
}

/**
 * Show the browser's own permission prompt.
 *
 * Only ever called from a click handler behind the soft-ask card — see
 * `PushPermissionPrompt`. A denial here is permanent for the origin until the
 * user changes it in browser settings, which is precisely why nothing calls
 * this on page load.
 */
export async function requestWebPermission(): Promise<NotificationPermission> {
  if (typeof window === 'undefined' || !hasNotificationApi()) {
    return 'denied';
  }
  try {
    return await Notification.requestPermission();
  } catch {
    return 'denied';
  }
}

/**
 * The FCM registration token for this browser, or `null`.
 *
 * Returns `null` — never throws — when push is unsupported, permission is not
 * granted, or the token call fails. The caller's job is to register a token
 * with the backend if there is one, not to reason about why there isn't.
 */
export async function acquireWebToken(): Promise<string | null> {
  const config = getPushConfig();
  if (!config) return null;
  if (getWebPermission() !== 'granted') return null;

  const messaging = await getMessagingInstance();
  if (!messaging) return null;

  const registration = await getServiceWorkerRegistration();
  if (!registration) return null;

  try {
    const { getToken } = await import('firebase/messaging');
    const token = await getToken(messaging, {
      vapidKey: config.vapidKey,
      serviceWorkerRegistration: registration,
    });
    return token || null;
  } catch (error) {
    // The common causes are a VAPID key that does not belong to the project and
    // a push service that is unreachable. Both are configuration faults that
    // must be visible, but neither should break the session.
    logger.warn('Failed to acquire FCM web token', error);
    return null;
  }
}

/**
 * Delete this browser's FCM token.
 *
 * Called on sign-out, alongside the backend `DELETE /device-tokens`. Doing only
 * the backend half would leave the browser holding a live token that the next
 * `getToken` returns from cache — so the next person to sign in on this device
 * would re-register the SAME token and inherit the previous account's push
 * subscription until FCM rotated it.
 */
export async function releaseWebToken(): Promise<void> {
  try {
    const messaging = await getMessagingInstance();
    if (!messaging) return;
    const { deleteToken } = await import('firebase/messaging');
    await deleteToken(messaging);
  } catch (error) {
    logger.debug('FCM web token deletion failed (already gone?)', error);
  }
}

/** Normalise an FCM web payload into the app's platform-neutral shape. */
export function toPushMessage(payload: MessagePayload): PushMessage {
  const data = (payload.data ?? {}) as Record<string, string>;
  return {
    // A send may carry either block; `notification` wins because that is what
    // the recipient would have seen in the tray.
    title: payload.notification?.title ?? data.title,
    body: payload.notification?.body ?? data.body,
    link: data.link,
    notificationId: data.notificationId,
    type: data.type,
  };
}

/**
 * Subscribe to foreground messages.
 *
 * FCM does NOT display anything while the page has focus — by design, since the
 * app is right there and can do better. This is what feeds the in-app pop-up.
 * Returns a no-op unsubscribe when push is unavailable so callers need no guard.
 */
export async function onWebForegroundMessage(
  handler: (message: PushMessage) => void,
): Promise<() => void> {
  const messaging = await getMessagingInstance();
  if (!messaging) return () => undefined;
  const { onMessage } = await import('firebase/messaging');
  return onMessage(messaging, (payload) => handler(toPushMessage(payload)));
}

/** Test seam: drop the memoised app/messaging/worker handles. */
export function resetWebPushForTests(): void {
  appPromise = null;
  messagingPromise = null;
  swRegistration = null;
}
