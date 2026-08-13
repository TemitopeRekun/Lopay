/**
 * Firebase Cloud Messaging client configuration.
 *
 * Everything here is read at BUILD time from `VITE_*` vars and inlined into the
 * bundle. None of it is secret: the Firebase web config and the VAPID *public*
 * key are designed to ship to browsers, and are useless without the matching
 * private key that lives only in Firebase's own infrastructure. The service
 * account credentials that let a server SEND pushes stay on the backend
 * (`FIREBASE_PRIVATE_KEY`) and must never appear in a `VITE_*` var.
 *
 * ## Why this resolves to `null` instead of throwing
 *
 * Push is an enhancement, not a dependency. A build with no Firebase config —
 * a local `vite dev`, a CI smoke build, a deploy made before the console was
 * set up — must still produce a working app that simply never offers push,
 * rather than a white screen. Every caller therefore treats `null` as
 * "unsupported" and the UI hides the opt-in entirely (see `pushStore`).
 *
 * The one thing this must NOT do is half-configure: FCM fails in genuinely
 * confusing ways when, say, `appId` is present but `messagingSenderId` is not
 * (`getToken` rejects with an opaque `messaging/token-subscribe-failed`). So a
 * partial config is treated as no config at all, and `describeMissingKeys`
 * exists to say precisely which vars were missing when someone goes looking.
 */

export interface FirebaseWebConfig {
  apiKey: string;
  authDomain: string;
  projectId: string;
  messagingSenderId: string;
  appId: string;
}

export interface PushConfig {
  firebase: FirebaseWebConfig;
  /**
   * Web Push certificate ("Voluntary Application Server Identification") public
   * key, from Firebase console → Project settings → Cloud Messaging → Web
   * configuration. Required by `getToken` on the web; unused on native, where
   * the Android FCM SDK authenticates via `google-services.json` instead.
   */
  vapidKey: string;
}

/** The env var name behind each config field, for diagnostics. */
const ENV_KEYS = {
  apiKey: 'VITE_FIREBASE_API_KEY',
  authDomain: 'VITE_FIREBASE_AUTH_DOMAIN',
  projectId: 'VITE_FIREBASE_PROJECT_ID',
  messagingSenderId: 'VITE_FIREBASE_MESSAGING_SENDER_ID',
  appId: 'VITE_FIREBASE_APP_ID',
  vapidKey: 'VITE_FIREBASE_VAPID_KEY',
} as const;

type EnvRecord = Record<string, string | undefined>;

const read = (env: EnvRecord, key: string): string =>
  typeof env[key] === 'string' ? env[key]!.trim() : '';

/**
 * Which required vars are absent or blank, in declaration order.
 *
 * `authDomain` is deliberately NOT required. Messaging never uses it — it is an
 * Auth concern — and demanding it would block push on an otherwise complete
 * config. It is still read and passed through when present so the same
 * initialised app can back a future Firebase Auth integration.
 */
export function describeMissingKeys(env: EnvRecord): string[] {
  const required = [
    ENV_KEYS.apiKey,
    ENV_KEYS.projectId,
    ENV_KEYS.messagingSenderId,
    ENV_KEYS.appId,
    ENV_KEYS.vapidKey,
  ];
  return required.filter((key) => read(env, key) === '');
}

/**
 * The Firebase app identity alone, with no VAPID key.
 *
 * Split out because the two halves are needed by different runtimes. The
 * service worker initialises Firebase to RECEIVE messages and never calls
 * `getToken`, so it has no use for a VAPID key — gating the worker's config on
 * one would make it inert for a purely page-side reason (and produce a
 * build-time warning claiming no Firebase config exists, when it does).
 *
 * Returns `null` only when the app identity itself is incomplete.
 */
export function resolveFirebaseWebConfig(
  env: EnvRecord,
): FirebaseWebConfig | null {
  const required = [
    ENV_KEYS.apiKey,
    ENV_KEYS.projectId,
    ENV_KEYS.messagingSenderId,
    ENV_KEYS.appId,
  ];
  if (required.some((key) => read(env, key) === '')) return null;

  const projectId = read(env, ENV_KEYS.projectId);
  return {
    apiKey: read(env, ENV_KEYS.apiKey),
    // Falls back to the conventional `<project>.firebaseapp.com` rather than an
    // empty string, which some Firebase code paths treat as a real (and
    // invalid) domain.
    authDomain: read(env, ENV_KEYS.authDomain) || `${projectId}.firebaseapp.com`,
    projectId,
    messagingSenderId: read(env, ENV_KEYS.messagingSenderId),
    appId: read(env, ENV_KEYS.appId),
  };
}

/**
 * Pure resolver, kept free of `import.meta` so it is directly unit-testable.
 * Returns `null` when any required var is missing — see the module note.
 *
 * Stricter than `resolveFirebaseWebConfig` on purpose: this backs the PAGE,
 * which cannot mint a token without a VAPID key. The SDK does fall back to a
 * built-in default key when none is given, but its own docs warn that push
 * services including Chrome's require a non-default key — so a build without
 * one must report "no push", not "push that fails on the primary browser".
 */
export function resolvePushConfig(env: EnvRecord): PushConfig | null {
  if (describeMissingKeys(env).length > 0) return null;

  const firebase = resolveFirebaseWebConfig(env);
  if (!firebase) return null;

  return { firebase, vapidKey: read(env, ENV_KEYS.vapidKey) };
}

const viteEnv = (): EnvRecord =>
  ((import.meta as unknown as { env?: EnvRecord }).env ?? {}) as EnvRecord;

/** This build's push config, or `null` if it was built without one. */
export const getPushConfig = (): PushConfig | null =>
  resolvePushConfig(viteEnv());

/** The vars a build would need to add to enable push. Empty when configured. */
export const getMissingPushKeys = (): string[] => describeMissingKeys(viteEnv());

/**
 * Path of the messaging service worker.
 *
 * Root-scoped on purpose. A service worker can only control pages at or below
 * its own path, and FCM looks for this exact filename at the domain root by
 * convention. It is emitted there by a dedicated Vite build — see
 * `vite.sw.config.ts` — not copied from `public/`, because the worker has to be
 * bundled with the Firebase SDK rather than pulling it from a CDN.
 */
export const PUSH_SERVICE_WORKER_URL = '/firebase-messaging-sw.js';

/**
 * Android notification channel this app posts to.
 *
 * Must match `android.notification.channelId` on the backend send path
 * (`lopay-backend/src/notifications/notifications.service.ts`) and the
 * `default_notification_channel_id` meta-data in AndroidManifest.xml. Android 8+
 * silently drops a notification whose channel does not exist, so the client
 * creates it at registration time.
 */
export const ANDROID_CHANNEL_ID = 'lopay-payments';
