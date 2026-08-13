/**
 * Native (Capacitor / Android) half of the push bridge.
 *
 * The native shell does NOT use the Firebase JS SDK or the service worker. The
 * Android FCM SDK is linked into the APK by the `google-services` Gradle plugin
 * and authenticates from `google-services.json`; `@capacitor/push-notifications`
 * is the thin bridge to it. So there is no VAPID key and no web config on this
 * path — only the plugin.
 *
 * Like the web module, the plugin import is dynamic: the web build must never
 * pull the Capacitor push plugin into its bundle.
 *
 * ## Delivery behaviour worth knowing
 *
 * - App **backgrounded or killed**: Android itself posts the notification from
 *   the FCM payload's `notification` block. None of this code runs. That is why
 *   the channel below — and its sound — has to exist before the first push, and
 *   why the manifest declares the same channel id as the FCM default.
 * - App **foregrounded**: Android posts nothing; the plugin fires
 *   `pushNotificationReceived` instead. The in-app pop-up and the chime are the
 *   entire user-visible response, which is exactly the web foreground story.
 */

import type { PluginListenerHandle } from '@capacitor/core';
import { logger } from '../../utils/logger';
import { ANDROID_CHANNEL_ID } from './config';
import type { PushMessage, PushPermission } from './types';

/** Capacitor's permission states, mapped onto ours. */
function toPermission(receive: string): PushPermission {
  switch (receive) {
    case 'granted':
      return 'granted';
    case 'denied':
      return 'denied';
    default:
      // 'prompt' and 'prompt-with-rationale' both mean we may still ask.
      return 'prompt';
  }
}

async function plugin() {
  const { PushNotifications } = await import('@capacitor/push-notifications');
  return PushNotifications;
}

/**
 * Notifications that arrived before anything subscribed.
 *
 * Tapping a notification while the app is killed LAUNCHES the app and fires
 * `pushNotificationActionPerformed` almost immediately — well before React has
 * mounted, let alone before the 2.8s splash in `AppRoutes` clears. Without this
 * buffer that tap silently does nothing, which is the single most visible push
 * bug there is: the notification says "payment confirmed", the user taps, and
 * lands on the default dashboard. `primeNativePush()` is called from
 * `index.tsx` at startup so the listener is attached as early as possible, and
 * anything caught before a subscriber exists waits here.
 */
const pendingOpens: PushMessage[] = [];
let openSubscriber: ((message: PushMessage) => void) | null = null;
let primed = false;

/** Normalise the plugin's payload into the app's platform-neutral shape. */
export function toPushMessage(notification: {
  title?: string;
  body?: string;
  data?: unknown;
}): PushMessage {
  const data = (notification.data ?? {}) as Record<string, unknown>;
  const str = (v: unknown): string | undefined =>
    typeof v === 'string' && v !== '' ? v : undefined;

  return {
    title: notification.title ?? str(data.title),
    body: notification.body ?? str(data.body),
    link: str(data.link),
    notificationId: str(data.notificationId),
    type: str(data.type),
  };
}

/**
 * Attach the tap listener as early as possible in the app's life.
 *
 * Safe to call on web (no-ops) and safe to call twice. Does NOT request
 * permission or register a token — it only makes sure a cold-start tap is not
 * lost. Everything else waits until the user opts in.
 */
export async function primeNativePush(): Promise<void> {
  if (primed) return;
  primed = true;
  try {
    const PushNotifications = await plugin();
    // Never removed: this listener must live for the whole app lifetime, since
    // its entire job is catching the tap that launched the process.
    await PushNotifications.addListener(
      'pushNotificationActionPerformed',
      (action) => {
        const message = toPushMessage(action.notification);
        if (openSubscriber) openSubscriber(message);
        else pendingOpens.push(message);
      },
    );
  } catch (error) {
    logger.debug('Native push listener priming skipped', error);
  }
}

/** Current permission, without prompting. */
export async function getNativePermission(): Promise<PushPermission> {
  try {
    const PushNotifications = await plugin();
    const status = await PushNotifications.checkPermissions();
    return toPermission(status.receive);
  } catch {
    return 'unsupported';
  }
}

/**
 * Show the OS permission prompt.
 *
 * On Android 13+ (API 33) this surfaces the real `POST_NOTIFICATIONS` dialog —
 * which is why the manifest declares that permission. On Android 12 and below
 * the plugin returns `granted` without prompting, because notifications were
 * ungated then; the soft-ask card in front of this still earns its keep as the
 * moment we register a token.
 */
export async function requestNativePermission(): Promise<PushPermission> {
  try {
    const PushNotifications = await plugin();
    const status = await PushNotifications.requestPermissions();
    return toPermission(status.receive);
  } catch (error) {
    logger.warn('Native push permission request failed', error);
    return 'denied';
  }
}

/**
 * Create the notification channel this app posts to.
 *
 * Android 8+ drops any notification whose channel does not exist, so this must
 * run before the first push — not before the first *foreground* push, before
 * the first push at all, since the background path never executes JS.
 *
 * A channel's sound and importance are IMMUTABLE once created: Android ignores
 * changes on a re-create, by design, so a user's own tweaks in system settings
 * are never overwritten. Changing either therefore requires a NEW channel id,
 * which is why the id is a named constant shared with the backend send path.
 */
async function ensureChannel(): Promise<void> {
  try {
    const PushNotifications = await plugin();
    await PushNotifications.createChannel({
      id: ANDROID_CHANNEL_ID,
      name: 'Payments & alerts',
      description:
        'Payment confirmations, rejections, reminders and school announcements.',
      // res/raw/lopay_alert.wav — the plugin strips the extension and resolves
      // android.resource://<package>/raw/lopay_alert.
      sound: 'lopay_alert.wav',
      // 4 = IMPORTANCE_HIGH: heads-up banner plus sound. A confirmed or rejected
      // school-fee payment is time-sensitive to a parent; 3 (DEFAULT) would make
      // a sound but never surface a banner over whatever they are doing.
      importance: 4,
      // 1 = VISIBILITY_PUBLIC. Titles and bodies are deliberately free of
      // amounts and child names (see the backend's notification copy), so there
      // is nothing here to redact on a lock screen.
      visibility: 1,
      vibration: true,
      lights: true,
      lightColor: '#4A90E2',
    });
  } catch (error) {
    // Channel creation is Android-only and fails harmlessly elsewhere.
    logger.debug('Notification channel creation skipped', error);
  }
}

/** How long to wait for FCM to hand back a token before giving up. */
const REGISTRATION_TIMEOUT_MS = 15_000;

/**
 * Register with FCM and resolve the device token.
 *
 * `register()` resolves as soon as the request is dispatched — the token
 * arrives asynchronously on the `registration` event, or an error on
 * `registrationError` (most often a missing or mismatched `google-services.json`).
 * Resolves `null` rather than hanging if neither fires: a build shipped without
 * the Google services file gets no event at all, and an opt-in that spins
 * forever is worse than one that reports failure.
 */
export async function acquireNativeToken(): Promise<string | null> {
  let registrationHandle: PluginListenerHandle | undefined;
  let errorHandle: PluginListenerHandle | undefined;

  try {
    const PushNotifications = await plugin();
    await ensureChannel();

    const token = await new Promise<string | null>((resolve) => {
      const timer = setTimeout(() => {
        logger.warn('FCM native registration timed out');
        resolve(null);
      }, REGISTRATION_TIMEOUT_MS);

      const settle = (value: string | null) => {
        clearTimeout(timer);
        resolve(value);
      };

      void PushNotifications.addListener('registration', (t) => {
        registrationHandle = undefined;
        settle(t.value || null);
      }).then((h) => {
        registrationHandle = h;
      });

      void PushNotifications.addListener('registrationError', (err) => {
        logger.warn('FCM native registration failed', err);
        settle(null);
      }).then((h) => {
        errorHandle = h;
      });

      void PushNotifications.register();
    });

    return token;
  } catch (error) {
    logger.warn('Native push registration unavailable', error);
    return null;
  } finally {
    await registrationHandle?.remove().catch(() => undefined);
    await errorHandle?.remove().catch(() => undefined);
  }
}

/**
 * Stop this device receiving pushes.
 *
 * `unregister()` deletes the FCM token natively. The backend row is deleted
 * separately by the caller — both halves are needed, or a signed-out device
 * either keeps receiving another account's notifications (backend row left) or
 * re-registers the same token on next sign-in (native token left).
 */
export async function releaseNativeToken(): Promise<void> {
  try {
    const PushNotifications = await plugin();
    await PushNotifications.unregister();
  } catch (error) {
    logger.debug('Native push unregister failed', error);
  }
}

/** Foreground deliveries (the app is open; Android posts nothing itself). */
export async function onNativeForegroundMessage(
  handler: (message: PushMessage) => void,
): Promise<() => void> {
  try {
    const PushNotifications = await plugin();
    const handle = await PushNotifications.addListener(
      'pushNotificationReceived',
      (notification) => handler(toPushMessage(notification)),
    );
    return () => void handle.remove();
  } catch {
    return () => undefined;
  }
}

/**
 * Taps on a delivered notification, including one that cold-started the app.
 * Replays anything `primeNativePush` buffered before this subscriber existed.
 */
export function onNativeNotificationOpened(
  handler: (message: PushMessage) => void,
): () => void {
  openSubscriber = handler;
  while (pendingOpens.length > 0) {
    handler(pendingOpens.shift()!);
  }
  return () => {
    if (openSubscriber === handler) openSubscriber = null;
  };
}

/** Clear the Android status-bar tray. Called when the alerts screen is opened. */
export async function clearDeliveredNotifications(): Promise<void> {
  try {
    const PushNotifications = await plugin();
    await PushNotifications.removeAllDeliveredNotifications();
  } catch {
    /* not fatal — the tray simply keeps its entries */
  }
}

/** Test seam. */
export function resetNativePushForTests(): void {
  pendingOpens.length = 0;
  openSubscriber = null;
  primed = false;
}
