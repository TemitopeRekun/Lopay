/**
 * The FCM background service worker.
 *
 * ## Why this is a source file and not a static asset
 *
 * Firebase's own documentation has you drop a `firebase-messaging-sw.js` into
 * the web root that pulls the SDK off `gstatic.com` with `importScripts`. This
 * app deliberately does not do that. `index.html` already refuses third-party
 * CDN script loads (see the comment there), the SPA CSP ships `script-src
 * 'self'`, and a worker that fetches its own runtime from another origin is a
 * supply-chain dependency on the notification path.
 *
 * So this is a real TypeScript module, bundled with the Firebase SDK inlined by
 * a dedicated Vite build (`vite.sw.config.ts`) that emits a single classic —
 * NOT ES-module — script at `dist/firebase-messaging-sw.js`. Classic matters:
 * module service workers still are not universally supported, and a worker that
 * fails to install takes every background notification with it.
 *
 * The Firebase config is injected at build time via `define`, because a service
 * worker cannot read `import.meta.env` and cannot ask the page for anything
 * before its first `push` event arrives.
 *
 * ## What actually displays the notification
 *
 * Two different paths, and it is worth being precise because it is the usual
 * source of "why did I get two notifications":
 *
 *  - **Messages carrying a `notification` block** are displayed by the Firebase
 *    SDK's own push handler, installed by `getMessaging()` below. Our
 *    `onBackgroundMessage` callback is NOT invoked for those. The look is
 *    controlled server-side through `webpush.notification` (see the backend's
 *    `notifications.service.ts`), and clicks are routed by
 *    `webpush.fcmOptions.link`.
 *  - **Data-only messages** reach `onBackgroundMessage`, and nothing is shown
 *    unless we show it. The handler below covers that case so a data-only send
 *    still surfaces, instead of the browser posting its own generic "This site
 *    has been updated in the background" notice — which is what Chrome does
 *    when a push wakes a worker that then displays nothing.
 *
 * There is no custom `notificationclick` listener here on purpose: the SDK
 * installs one that honours `fcmOptions.link`, focusing an already-open tab
 * rather than opening a duplicate. Adding a second handler would double-handle
 * the click.
 *
 * Sound is not settable here. The Notification API's `sound` property was never
 * implemented by any shipping browser, so a background web notification always
 * uses the operating system's notification sound. The app's own chime only
 * applies in the foreground, where the page (not the worker) is in control —
 * see `services/push/sound.ts`. Android native has real per-channel sound.
 */

import { initializeApp } from 'firebase/app';
import { getMessaging, onBackgroundMessage } from 'firebase/messaging/sw';
import type { FirebaseWebConfig } from '../services/push/config';

declare const self: ServiceWorkerGlobalScope;

/** Injected by `vite.sw.config.ts` at build time. */
declare const __FIREBASE_CONFIG__: FirebaseWebConfig | null;

const config = __FIREBASE_CONFIG__;

// A worker built without config must install and then do nothing. Throwing here
// would leave a permanently failing registration in the browser's SW list that
// survives the next deploy.
if (config && config.projectId) {
  const app = initializeApp(config);
  const messaging = getMessaging(app);

  onBackgroundMessage(messaging, (payload) => {
    const data = (payload.data ?? {}) as Record<string, string>;

    // Only reached for data-only sends (see the module note). `title` is
    // required by showNotification; falling back to the app name keeps a
    // malformed send visible rather than silently dropped.
    const title = data.title || 'LOPAY';
    const body = data.body || '';

    return self.registration.showNotification(title, {
      body,
      icon: '/icons/notification-icon.png',
      badge: '/icons/notification-badge.png',
      // Collapses repeats of the same subject into one entry instead of
      // stacking. Falls back to a constant so at worst everything collapses —
      // preferable to a parent waking up to fourteen separate rows.
      tag: data.tag || data.notificationId || 'lopay-notification',
      // `data` rides along to the SDK's notificationclick handler, which reads
      // the link from it.
      data: { ...data, FCM_MSG: { fcmOptions: { link: data.link } } },
      requireInteraction: false,
    });
  });
}

// Take over open tabs on the first install so a parent who grants permission
// mid-session is covered without a reload.
self.addEventListener('install', () => {
  void self.skipWaiting();
});
self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});
