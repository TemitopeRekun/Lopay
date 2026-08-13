/**
 * Platform-neutral push types.
 *
 * Web FCM and the Capacitor native plugin hand back two different payload
 * shapes for the same server-side send. Everything above `services/push/index`
 * — the store, the hook, the pop-up — speaks only this shape, so no UI code has
 * to know which transport delivered a notification.
 */

/** A push as the app understands it, whichever transport delivered it. */
export interface PushMessage {
  title?: string;
  body?: string;
  /**
   * In-app route to open, e.g. `/notifications`. Comes from the backend
   * `Notification.link` column via the FCM `data` block, so it is always an app
   * path and never an absolute URL — see `toAppPath` in `services/push/index`.
   */
  link?: string;
  /** Row id in the `Notification` table, when the send came from one. */
  notificationId?: string;
  /** `PAYMENT` | `ALERT` | `ANNOUNCEMENT`, mirroring the backend enum. */
  type?: string;
}

/**
 * Permission as the UI needs to reason about it.
 *
 * `prompt` deliberately merges the browser's `default` with Capacitor's
 * `prompt`/`prompt-with-rationale`: all three mean "we may still ask".
 * `unsupported` is distinct from `denied` because the two demand different
 * copy — one is "your browser can't", the other is "you said no, here's how to
 * undo it".
 */
export type PushPermission = 'granted' | 'denied' | 'prompt' | 'unsupported';

/** Which transport produced a token. Matches the backend DTO's `platform` enum. */
export type PushPlatform = 'web' | 'android' | 'ios';

export interface PushRegistration {
  token: string;
  platform: PushPlatform;
}
