import { describe, it, expect, vi, beforeEach } from 'vitest';

const CONFIG = {
  firebase: {
    apiKey: 'k',
    authDomain: 'lopay-auth.firebaseapp.com',
    projectId: 'lopay-auth',
    messagingSenderId: '1',
    appId: 'a',
  },
  vapidKey: 'VAPID-PUBLIC',
};

const getPushConfig = vi.fn(() => CONFIG as typeof CONFIG | null);
vi.mock('./config', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./config')>()),
  getPushConfig: () => getPushConfig(),
}));

const initializeApp = vi.fn(() => ({ name: 'lopay-messaging' }));
const getApp = vi.fn(() => ({ name: 'lopay-messaging' }));
const getApps = vi.fn(() => [] as { name: string }[]);
vi.mock('firebase/app', () => ({ initializeApp, getApp, getApps }));

const isSupported = vi.fn(async () => true);
const getMessaging = vi.fn(() => ({ __messaging: true }));
const getToken = vi.fn(async () => 'FCM-TOKEN');
const deleteToken = vi.fn(async () => true);
const onMessage = vi.fn(() => () => undefined);
vi.mock('firebase/messaging', () => ({
  isSupported,
  getMessaging,
  getToken,
  deleteToken,
  onMessage,
}));

const {
  acquireWebToken,
  getWebPermission,
  isWebPushSupported,
  onWebForegroundMessage,
  releaseWebToken,
  requestWebPermission,
  resetWebPushForTests,
  toPushMessage,
} = await import('./webPush');

const REGISTRATION = { scope: '/' } as ServiceWorkerRegistration;
const register = vi.fn(async () => REGISTRATION);

const setPermission = (value: NotificationPermission) => {
  vi.stubGlobal(
    'Notification',
    Object.assign(vi.fn(), {
      permission: value,
      requestPermission: vi.fn(async () => value),
    }),
  );
};

beforeEach(() => {
  vi.clearAllMocks();
  resetWebPushForTests();
  getPushConfig.mockReturnValue(CONFIG);
  isSupported.mockResolvedValue(true);
  getToken.mockResolvedValue('FCM-TOKEN');
  register.mockResolvedValue(REGISTRATION);
  setPermission('granted');
  vi.stubGlobal('navigator', {
    ...navigator,
    serviceWorker: { register, ready: Promise.resolve(REGISTRATION) },
  });
});

describe('isWebPushSupported', () => {
  it('is false without a Firebase config, so an unconfigured build offers nothing', async () => {
    getPushConfig.mockReturnValue(null);
    expect(await isWebPushSupported()).toBe(false);
  });

  /**
   * Defers to the SDK rather than a naive feature test: it also covers the
   * indexedDB and cookie cases (a Firefox private window disables indexedDB,
   * which the Firebase Installations record behind every token requires).
   */
  it('defers to the SDK verdict', async () => {
    isSupported.mockResolvedValue(false);
    expect(await isWebPushSupported()).toBe(false);
  });

  it('is false where there is no service worker at all', async () => {
    vi.stubGlobal('navigator', {});
    expect(await isWebPushSupported()).toBe(false);
  });
});

describe('acquireWebToken', () => {
  it('registers the worker and mints a token bound to it', async () => {
    const token = await acquireWebToken();

    expect(token).toBe('FCM-TOKEN');
    expect(register).toHaveBeenCalledWith('/firebase-messaging-sw.js', {
      scope: '/',
    });
    expect(getToken).toHaveBeenCalledWith(expect.anything(), {
      vapidKey: 'VAPID-PUBLIC',
      serviceWorkerRegistration: REGISTRATION,
    });
  });

  /** Asking FCM for a token without permission is guaranteed to fail. */
  it('does not even try without permission', async () => {
    setPermission('default');
    expect(await acquireWebToken()).toBeNull();
    expect(getToken).not.toHaveBeenCalled();
  });

  it('returns null rather than throwing when the worker will not register', async () => {
    register.mockRejectedValue(new Error('SecurityError'));
    expect(await acquireWebToken()).toBeNull();
    expect(getToken).not.toHaveBeenCalled();
  });

  /**
   * The signature failure of a wrong VAPID key or a blocked FCM endpoint. It
   * must degrade to "no push", never to a broken session.
   */
  it('returns null when getToken rejects', async () => {
    getToken.mockRejectedValue(new Error('messaging/token-subscribe-failed'));
    expect(await acquireWebToken()).toBeNull();
  });

  it('treats an empty token string as no token', async () => {
    getToken.mockResolvedValue('');
    expect(await acquireWebToken()).toBeNull();
  });

  /** A second Firebase app on the same name with different options throws. */
  it('initialises the named app once and reuses it', async () => {
    await acquireWebToken();
    await acquireWebToken();
    expect(initializeApp).toHaveBeenCalledTimes(1);
    expect(initializeApp).toHaveBeenCalledWith(CONFIG.firebase, 'lopay-messaging');
  });

  it('reuses an app the SDK already holds under that name', async () => {
    getApps.mockReturnValue([{ name: 'lopay-messaging' }]);
    await acquireWebToken();
    expect(initializeApp).not.toHaveBeenCalled();
    expect(getApp).toHaveBeenCalledWith('lopay-messaging');
  });
});

describe('permission helpers', () => {
  it('reports unsupported where the Notification API is absent', () => {
    vi.stubGlobal('Notification', undefined);
    expect(getWebPermission()).toBe('unsupported');
  });

  it('reads the current permission without prompting', () => {
    setPermission('denied');
    expect(getWebPermission()).toBe('denied');
  });

  it('denies rather than throwing when requestPermission blows up', async () => {
    vi.stubGlobal(
      'Notification',
      Object.assign(vi.fn(), {
        permission: 'default',
        requestPermission: vi.fn(async () => {
          throw new Error('not allowed');
        }),
      }),
    );
    expect(await requestWebPermission()).toBe('denied');
  });
});

describe('releaseWebToken', () => {
  it('deletes the token so the next account cannot inherit it', async () => {
    await releaseWebToken();
    expect(deleteToken).toHaveBeenCalled();
  });

  it('swallows a delete that fails because the token is already gone', async () => {
    deleteToken.mockRejectedValue(new Error('not found'));
    await expect(releaseWebToken()).resolves.toBeUndefined();
  });
});

describe('toPushMessage', () => {
  it('prefers the notification block — what the user would have seen', () => {
    expect(
      toPushMessage({
        notification: { title: 'Confirmed', body: 'Your payment cleared' },
        data: { title: 'ignored', link: '/history', type: 'PAYMENT' },
      } as never),
    ).toEqual({
      title: 'Confirmed',
      body: 'Your payment cleared',
      link: '/history',
      notificationId: undefined,
      type: 'PAYMENT',
    });
  });

  it('falls back to the data block for a data-only send', () => {
    expect(
      toPushMessage({
        data: { title: 'From data', body: 'Body', notificationId: 'n-1' },
      } as never),
    ).toMatchObject({ title: 'From data', body: 'Body', notificationId: 'n-1' });
  });
});

describe('onWebForegroundMessage', () => {
  it('hands normalised messages to the subscriber', async () => {
    const handler = vi.fn();
    let emit: ((payload: unknown) => void) | undefined;
    onMessage.mockImplementation(((
      _messaging: unknown,
      cb: (p: unknown) => void,
    ) => {
      emit = cb;
      return () => undefined;
    }) as unknown as typeof onMessage);

    await onWebForegroundMessage(handler);
    emit!({ notification: { title: 'Hi' }, data: { link: '/notifications' } });

    expect(handler).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Hi', link: '/notifications' }),
    );
  });

  it('returns a callable no-op when push is unavailable', async () => {
    getPushConfig.mockReturnValue(null);
    const off = await onWebForegroundMessage(vi.fn());
    expect(() => off()).not.toThrow();
  });
});
