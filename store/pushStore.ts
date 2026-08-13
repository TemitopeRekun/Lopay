import { create } from 'zustand';
import { BackendAPI } from '../services/backend';
import {
  PushBridge,
  isSoundEnabled,
  setSoundEnabled as persistSoundEnabled,
  unlockSound,
  type PushMessage,
  type PushPermission,
} from '../services/push';
import { logger } from '../utils/logger';

/**
 * Push notification state.
 *
 * Holds the whole opt-in lifecycle so it can be driven from a React component,
 * from the Settings toggle, and from the auth lifecycle hook without any of
 * them duplicating the sequencing — which matters because the order is not
 * obvious: permission, then token, then backend registration, and a failure at
 * any step has to leave the UI telling the truth about which step failed.
 */

/** How long a dismissed soft-ask stays dismissed. */
const SOFT_ASK_COOLDOWN_MS = 14 * 24 * 60 * 60 * 1000;

const SOFT_ASK_KEY = 'lopay:push-softask-dismissed';
/**
 * Last token successfully registered with the backend.
 *
 * FCM returns the same token from cache on every call, and `POST /device-tokens`
 * is an upsert, so re-registering is harmless — but it is also a pointless
 * request on every single app open. More importantly this is what lets sign-out
 * delete the right row: by then `getToken` may already have been torn down.
 */
const TOKEN_KEY = 'lopay:push-token';
/**
 * The account `TOKEN_KEY` was last registered to.
 *
 * Without it the cached token is unattributed — and an unattributed token is
 * indistinguishable from another account's. FCM hands `getToken` the same value
 * back for the life of the install, so a device killed while signed in as one
 * parent (no sign-out, so no `clear()`) and later opened by another would match
 * the cache, skip registration, and leave the backend row pointing at the
 * previous owner: that account's payment alerts arriving on this screen while
 * the toggle claims notifications are on for the new one. Sign-out deletes the
 * token precisely to prevent that; this is what makes the guarantee hold when
 * sign-out never ran.
 */
const TOKEN_OWNER_KEY = 'lopay:push-token-owner';

const readNumber = (key: string): number => {
  try {
    const raw = localStorage.getItem(key);
    const value = raw === null ? NaN : Number(raw);
    return Number.isFinite(value) ? value : 0;
  } catch {
    return 0;
  }
};

const writeStorage = (key: string, value: string | null) => {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch {
    /* storage-blocked browsers still get working push, just no memory of it */
  }
};

const readStorage = (key: string): string | null => {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
};

/** Persist the token and its owner together — never one without the other. */
const rememberToken = (token: string | null, ownerId: string | null) => {
  writeStorage(TOKEN_KEY, token);
  writeStorage(TOKEN_OWNER_KEY, token === null ? null : ownerId);
};

export type PushStatus = 'idle' | 'enabling' | 'enabled' | 'error';

interface PushState {
  /** `null` until the first `refresh()` resolves — "unknown", not "unsupported". */
  supported: boolean | null;
  permission: PushPermission;
  status: PushStatus;
  /** Human-readable reason the last enable attempt failed, for the UI. */
  error: string | null;
  token: string | null;
  /** Account `token` was registered to; `null` when unknown (pre-owner cache). */
  tokenOwnerId: string | null;
  /** The signed-in account, as last reported by the auth lifecycle hook. */
  sessionUserId: string | null;
  soundEnabled: boolean;
  /** The push currently showing in the in-app pop-up, if any. */
  incoming: PushMessage | null;
  softAskDismissedAt: number;

  refresh: () => Promise<void>;
  /** Full opt-in: prompt → token → backend. Returns true only if all three land. */
  enable: () => Promise<boolean>;
  /** Full opt-out: backend row → local token. Cannot revoke OS permission. */
  disable: () => Promise<void>;
  /**
   * Re-sync an already-granted device on sign-in. Never prompts.
   *
   * Takes the account being signed in so the token can be attributed to it.
   */
  syncToken: (userId: string) => Promise<void>;
  /** Sign-out: drop the backend row and this device's token. */
  clear: () => Promise<void>;
  dismissSoftAsk: () => void;
  showIncoming: (message: PushMessage) => void;
  dismissIncoming: () => void;
  setSoundEnabled: (enabled: boolean) => void;
}

/**
 * Whether the cached token cannot be proven to belong to the current session.
 *
 * True both for a token registered by a different account and for one with no
 * owner recorded at all (written by a build from before ownership was tracked).
 * Those are the same situation: "this may be someone else's subscription". With
 * no session yet there is nothing to compare against, so nothing is foreign —
 * `syncToken` is what resolves it, the moment an account is known.
 */
const isForeignToken = (state: {
  token: string | null;
  tokenOwnerId: string | null;
  sessionUserId: string | null;
}): boolean =>
  state.token !== null &&
  state.sessionUserId !== null &&
  state.tokenOwnerId !== state.sessionUserId;

export const usePushStore = create<PushState>((set, get) => ({
  supported: null,
  permission: 'prompt',
  status: 'idle',
  error: null,
  token: readStorage(TOKEN_KEY),
  tokenOwnerId: readStorage(TOKEN_OWNER_KEY),
  sessionUserId: null,
  soundEnabled: isSoundEnabled(),
  incoming: null,
  softAskDismissedAt: readNumber(SOFT_ASK_KEY),

  refresh: async () => {
    const supported = await PushBridge.isSupported();
    const permission = supported ? await PushBridge.getPermission() : 'unsupported';
    set({
      supported,
      permission,
      // Only claim "enabled" when a token is actually registered TO THIS
      // ACCOUNT. Permission alone is not the feature working — a granted
      // browser with no token receives nothing, and that gap is exactly what
      // the old fake Settings toggle hid — and a token belonging to whoever
      // used this device last is worse than none: it reads as ON while the
      // pushes go to them.
      status:
        permission === 'granted' && get().token && !isForeignToken(get())
          ? 'enabled'
          : get().status,
    });
  },

  enable: async () => {
    set({ status: 'enabling', error: null });

    // Prime the audio element inside the same user gesture that opened the
    // prompt — see `unlockSound`. Without this the first chime is silenced by
    // the autoplay policy.
    void unlockSound();

    const permission = await PushBridge.requestPermission();
    set({ permission });

    if (permission !== 'granted') {
      set({
        status: 'error',
        error:
          permission === 'denied'
            ? 'Notifications are blocked for this app. Turn them back on in your browser or device settings.'
            : 'Notification permission was not granted.',
      });
      return false;
    }

    const registration = await PushBridge.acquireToken();
    if (!registration) {
      set({
        status: 'error',
        error:
          'Could not reach the notification service. Check your connection and try again.',
      });
      return false;
    }

    try {
      await BackendAPI.deviceTokens.register(registration);
    } catch (error) {
      // Permission is granted and FCM holds a token, but our server does not
      // know about it — so no push will ever arrive. Reporting success here
      // would be the same lie the previous placeholder toggle told.
      logger.warn('Device token registration failed', error);
      set({
        status: 'error',
        error: 'Could not save your notification settings. Please try again.',
      });
      return false;
    }

    // Attributed to the session that opted in, so a later sign-in by someone
    // else on this device is recognised as a different owner rather than a match.
    const ownerId = get().sessionUserId;
    rememberToken(registration.token, ownerId);
    set({
      token: registration.token,
      tokenOwnerId: ownerId,
      status: 'enabled',
      error: null,
    });
    return true;
  },

  disable: async () => {
    const token = get().token;
    if (token) {
      try {
        await BackendAPI.deviceTokens.unregister(token);
      } catch (error) {
        // Leaving the row behind would keep pushes coming after the user turned
        // them off, so this failure must not be swallowed silently.
        logger.warn('Device token removal failed', error);
        set({
          error: 'Could not turn notifications off. Please try again.',
        });
        return;
      }
    }
    await PushBridge.releaseToken();
    rememberToken(null, null);
    set({ token: null, tokenOwnerId: null, status: 'idle', error: null });
  },

  syncToken: async (userId) => {
    // Recorded before anything can return early: `enable()` stamps ownership
    // from this, and the permission check below exits on every launch by someone
    // who has not opted in yet.
    set({ sessionUserId: userId });

    if ((await PushBridge.getPermission()) !== 'granted') return;

    // A token this session cannot claim is destroyed, not reused. Merely
    // re-registering it would work — `POST /device-tokens` reassigns the row to
    // the caller — but only when the request succeeds: offline, the previous
    // owner keeps this device's subscription, which is the whole failure being
    // guarded against. Deleting the token invalidates it at FCM instead, so
    // sends to it fail and the backend prunes the row on the next one. This is
    // the sign-out cleanup, run late.
    if (isForeignToken(get())) {
      logger.debug('Discarding a device token registered to another account');
      rememberToken(null, null);
      set({ token: null, tokenOwnerId: null, status: 'idle' });
      await PushBridge.releaseToken();
    }

    const registration = await PushBridge.acquireToken();
    if (!registration) return;

    // FCM rotates tokens (reinstall, storage clear, push-service change). Skip
    // the request when nothing moved; register when it did, so a rotated token
    // does not silently strand the device. A discarded foreign token left
    // `token` null above, so this can never short-circuit an ownership change —
    // FCM handing back the very same string still re-registers it.
    if (registration.token === get().token) {
      set({ status: 'enabled' });
      return;
    }

    try {
      await BackendAPI.deviceTokens.register(registration);
      rememberToken(registration.token, userId);
      set({
        token: registration.token,
        tokenOwnerId: userId,
        status: 'enabled',
        error: null,
      });
    } catch (error) {
      // Nothing is claimed on failure: state still holds no token, so the UI
      // reads OFF rather than promising pushes the backend cannot route here.
      logger.warn('Device token re-sync failed', error);
    }
  },

  clear: async () => {
    const token = get().token;
    if (token) {
      // Best-effort: sign-out must never block on this. The backend also prunes
      // tokens FCM reports as permanently invalid on the next send.
      await BackendAPI.deviceTokens
        .unregister(token)
        .catch((error) => logger.debug('Sign-out token cleanup failed', error));
    }
    await PushBridge.releaseToken();
    rememberToken(null, null);
    set({
      token: null,
      tokenOwnerId: null,
      sessionUserId: null,
      status: 'idle',
      incoming: null,
      error: null,
    });
  },

  dismissSoftAsk: () => {
    const now = Date.now();
    writeStorage(SOFT_ASK_KEY, String(now));
    set({ softAskDismissedAt: now });
  },

  showIncoming: (message) => set({ incoming: message }),
  dismissIncoming: () => set({ incoming: null }),

  setSoundEnabled: (enabled) => {
    persistSoundEnabled(enabled);
    set({ soundEnabled: enabled });
  },
}));

/**
 * Whether to show the soft-ask card.
 *
 * Pure so the policy is testable without a store or a DOM. The rule: only when
 * push is genuinely available, only while the OS prompt is still winnable, and
 * not for a fortnight after someone said "not now". A user who has denied at
 * the OS level is never nagged — that prompt cannot be re-shown from script, so
 * the card would be a button that does nothing.
 */
export function shouldShowSoftAsk(input: {
  supported: boolean | null;
  permission: PushPermission;
  softAskDismissedAt: number;
  now: number;
}): boolean {
  if (input.supported !== true) return false;
  if (input.permission !== 'prompt') return false;
  return input.now - input.softAskDismissedAt >= SOFT_ASK_COOLDOWN_MS;
}

export const PUSH_SOFT_ASK_COOLDOWN_MS = SOFT_ASK_COOLDOWN_MS;
