/**
 * Structured logging for the web client.
 *
 * ## Two APIs, on purpose
 *
 * `logger.debug/info/warn/error` are the passthrough calls — same signature as
 * `console.*`, so existing call sites keep working. Debug and info are silenced in
 * production builds; warn and error always pass through.
 *
 * `logger.event(name, fields)` is the structured one, and the one to reach for in
 * new code. It emits a single object with a fixed shape — `{ event, level, ts,
 * ...fields }` — so a browser-console session or a future Sentry/analytics bridge
 * can filter on `event` instead of parsing sentences. It is the client-side mirror
 * of the backend's `logAuthEvent`, and the two use the same event names, which is
 * what lets one signup attempt be followed across the boundary.
 *
 * ## Redaction is not optional
 *
 * Every field passes through `redact` before it is emitted. The browser console is
 * not private: it is visible in screen shares, screenshots attached to support
 * tickets, and any extension the parent has installed. An email or password
 * written there has left our control. Passing raw values is fine and expected —
 * that is what the redaction is for.
 */

const isDev = import.meta.env?.DEV ?? true;

/** Keys whose values are dropped entirely. */
const SENSITIVE_KEYS = new Set([
  'password',
  'newPassword',
  'currentPassword',
  'confirmPassword',
  'token',
  'accessToken',
  'refreshToken',
  'secret',
  'authorization',
]);

/** `ada.lovelace@gmail.com` → `a***e@gmail.com` */
function maskEmail(email: string): string {
  const at = email.lastIndexOf('@');
  if (at <= 0) return '<malformed>';
  const local = email.slice(0, at);
  const domain = email.slice(at + 1);
  const masked =
    local.length <= 2 ? '***' : `${local[0]}***${local[local.length - 1]}`;
  return `${masked}@${domain}`;
}

/** `08012345678` → `***5678` */
function maskPhone(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  return digits.length < 4 ? '***' : `***${digits.slice(-4)}`;
}

/** Value type is explicitly optional: an arbitrary key lookup can miss, and
 * without that TypeScript treats every `MASKED_KEYS[key]` as defined. */
const MASKED_KEYS: Record<string, ((value: string) => string) | undefined> = {
  email: maskEmail,
  phone: maskPhone,
  phoneNumber: maskPhone,
};

/**
 * Shallow-redact a bag of log fields. Shallow by design: log payloads should be
 * assembled explicitly, and a deep walk would invite logging whole API responses,
 * which is how PII leaks in the first place.
 */
export function redact(
  fields: Record<string, unknown>,
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(fields)) {
    if (SENSITIVE_KEYS.has(key)) {
      out[key] = '[redacted]';
      continue;
    }
    const mask = MASKED_KEYS[key];
    out[key] = mask && typeof value === 'string' ? mask(value) : value;
  }
  return out;
}

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

/** Event names shared with the backend, so one attempt can be traced across both. */
export const CLIENT_EVENTS = {
  SIGNUP_SUBMITTED: 'signup.submitted',
  SIGNUP_VALIDATION_FAILED: 'signup.validation_failed',
  SIGNUP_REJECTED: 'signup.rejected',
  SIGNUP_SUCCEEDED: 'signup.succeeded',
  LOGIN_SUBMITTED: 'login.submitted',
  LOGIN_REJECTED: 'login.rejected',
  LOGIN_SUCCEEDED: 'login.succeeded',
} as const;

export type ClientEvent = (typeof CLIENT_EVENTS)[keyof typeof CLIENT_EVENTS];

/** Which console method a level maps to, and whether it survives a prod build. */
const LEVEL_SINKS: Record<
  LogLevel,
  { write: (...args: unknown[]) => void; devOnly: boolean }
> = {
  debug: { write: (...a) => console.debug(...a), devOnly: true },
  info: { write: (...a) => console.info(...a), devOnly: true },
  warn: { write: (...a) => console.warn(...a), devOnly: false },
  error: { write: (...a) => console.error(...a), devOnly: false },
};

export const logger = {
  debug: (...args: unknown[]) => {
    if (isDev) console.debug(...args);
  },
  info: (...args: unknown[]) => {
    if (isDev) console.info(...args);
  },
  warn: (...args: unknown[]) => {
    console.warn(...args);
  },
  error: (...args: unknown[]) => {
    console.error(...args);
  },

  /**
   * Emit a structured event.
   *
   * @param event stable name from `CLIENT_EVENTS`
   * @param fields flat bag of context; redacted automatically
   * @param level defaults to `info` — pass `warn` for a rejection, `error` for a
   *   fault. A rejection is the system working, so it is not an error.
   *
   * @example
   * logger.event(CLIENT_EVENTS.SIGNUP_REJECTED, {
   *   reason: 'PHONE_ALREADY_REGISTERED',
   *   field: 'phoneNumber',
   *   email: values.email,   // masked on the way out
   * }, 'warn');
   */
  event: (
    event: ClientEvent,
    fields: Record<string, unknown> = {},
    level: LogLevel = 'info',
  ) => {
    const sink = LEVEL_SINKS[level];
    if (sink.devOnly && !isDev) return;

    sink.write({
      event,
      level,
      ts: new Date().toISOString(),
      ...redact(fields),
    });
  },
};
