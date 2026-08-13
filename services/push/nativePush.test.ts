import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

type Listener = (payload: unknown) => void;
const listeners: Record<string, Listener[]> = {};
const removed: string[] = [];

const addListener = vi.fn(async (event: string, cb: Listener) => {
  (listeners[event] ??= []).push(cb);
  return {
    remove: vi.fn(async () => {
      removed.push(event);
    }),
  };
});
const emit = (event: string, payload: unknown) =>
  (listeners[event] ?? []).forEach((cb) => cb(payload));

const PushNotifications = {
  addListener,
  checkPermissions: vi.fn(async () => ({ receive: 'prompt' })),
  requestPermissions: vi.fn(async () => ({ receive: 'granted' })),
  register: vi.fn(async () => undefined),
  unregister: vi.fn(async () => undefined),
  createChannel: vi.fn(async () => undefined),
  removeAllDeliveredNotifications: vi.fn(async () => undefined),
};
vi.mock('@capacitor/push-notifications', () => ({ PushNotifications }));

const {
  acquireNativeToken,
  clearDeliveredNotifications,
  getNativePermission,
  onNativeForegroundMessage,
  onNativeNotificationOpened,
  primeNativePush,
  releaseNativeToken,
  requestNativePermission,
  resetNativePushForTests,
  toPushMessage,
} = await import('./nativePush');

beforeEach(() => {
  vi.clearAllMocks();
  for (const key of Object.keys(listeners)) delete listeners[key];
  removed.length = 0;
  resetNativePushForTests();
  PushNotifications.checkPermissions.mockResolvedValue({ receive: 'prompt' });
  PushNotifications.requestPermissions.mockResolvedValue({ receive: 'granted' });
});

afterEach(() => vi.useRealTimers());

describe('permission mapping', () => {
  it.each([
    ['granted', 'granted'],
    ['denied', 'denied'],
    ['prompt', 'prompt'],
    // Android's rationale state still means we may ask.
    ['prompt-with-rationale', 'prompt'],
  ])('maps %s to %s', async (receive, expected) => {
    PushNotifications.checkPermissions.mockResolvedValue({ receive });
    expect(await getNativePermission()).toBe(expected);
  });

  it('reports unsupported when the plugin is unavailable', async () => {
    PushNotifications.checkPermissions.mockRejectedValue(new Error('web'));
    expect(await getNativePermission()).toBe('unsupported');
  });

  it('denies rather than throwing when the request fails', async () => {
    PushNotifications.requestPermissions.mockRejectedValue(new Error('boom'));
    expect(await requestNativePermission()).toBe('denied');
  });
});

describe('acquireNativeToken', () => {
  it('creates the channel before registering, then resolves the token', async () => {
    const promise = acquireNativeToken();
    await vi.waitFor(() => expect(listeners.registration?.length).toBe(1));
    emit('registration', { value: 'ANDROID-TOKEN' });

    expect(await promise).toBe('ANDROID-TOKEN');
    expect(PushNotifications.createChannel).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'lopay-payments',
        sound: 'lopay_alert.wav',
        importance: 4,
      }),
    );
    expect(PushNotifications.register).toHaveBeenCalled();
  });

  /** Almost always a missing or mismatched google-services.json. */
  it('resolves null on a registration error instead of hanging', async () => {
    const promise = acquireNativeToken();
    await vi.waitFor(() => expect(listeners.registrationError?.length).toBe(1));
    emit('registrationError', { error: 'MISSING_INSTANCEID_SERVICE' });

    expect(await promise).toBeNull();
  });

  /**
   * A build shipped without google-services.json fires NEITHER event. An opt-in
   * that spins forever is worse than one that reports failure.
   */
  it('times out rather than spinning forever when no event ever fires', async () => {
    vi.useFakeTimers();
    const promise = acquireNativeToken();
    await vi.waitFor(() => expect(listeners.registration?.length).toBe(1));

    await vi.advanceTimersByTimeAsync(15_000);
    expect(await promise).toBeNull();
  });

  it('removes both listeners so repeated opt-ins do not stack them', async () => {
    const promise = acquireNativeToken();
    await vi.waitFor(() => expect(listeners.registration?.length).toBe(1));
    emit('registration', { value: 'T' });
    await promise;

    expect(removed).toContain('registrationError');
  });

  it('treats an empty token value as no token', async () => {
    const promise = acquireNativeToken();
    await vi.waitFor(() => expect(listeners.registration?.length).toBe(1));
    emit('registration', { value: '' });
    expect(await promise).toBeNull();
  });
});

describe('cold-start tap buffering', () => {
  /**
   * The bug this exists to prevent: tapping "payment confirmed" on a killed app
   * launches it and fires the event long before React mounts, so without a
   * buffer the tap silently drops the parent on the default dashboard.
   */
  it('replays a tap that arrived before anything subscribed', async () => {
    await primeNativePush();
    emit('pushNotificationActionPerformed', {
      notification: { title: 'Confirmed', data: { link: '/history' } },
    });

    const handler = vi.fn();
    onNativeNotificationOpened(handler);

    expect(handler).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Confirmed', link: '/history' }),
    );
  });

  it('delivers straight through once a subscriber exists', async () => {
    await primeNativePush();
    const handler = vi.fn();
    onNativeNotificationOpened(handler);

    emit('pushNotificationActionPerformed', {
      notification: { title: 'Live', data: {} },
    });
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('drains the buffer so a replayed tap is not delivered twice', async () => {
    await primeNativePush();
    emit('pushNotificationActionPerformed', { notification: { title: 'One' } });

    const first = vi.fn();
    onNativeNotificationOpened(first)();
    const second = vi.fn();
    onNativeNotificationOpened(second);

    expect(first).toHaveBeenCalledTimes(1);
    expect(second).not.toHaveBeenCalled();
  });

  it('primes only once however many times it is called', async () => {
    await primeNativePush();
    await primeNativePush();
    expect(
      addListener.mock.calls.filter(
        ([e]) => e === 'pushNotificationActionPerformed',
      ),
    ).toHaveLength(1);
  });
});

describe('toPushMessage', () => {
  it('reads title/body from the notification and the rest from data', () => {
    expect(
      toPushMessage({
        title: 'Payment confirmed',
        body: '₦25,000 received',
        data: { link: '/history', notificationId: 'n-9', type: 'PAYMENT' },
      }),
    ).toEqual({
      title: 'Payment confirmed',
      body: '₦25,000 received',
      link: '/history',
      notificationId: 'n-9',
      type: 'PAYMENT',
    });
  });

  /** Android hands data values through as strings; anything else is not a link. */
  it('ignores non-string and empty data values', () => {
    expect(
      toPushMessage({
        title: 'T',
        data: { link: '', notificationId: 42, type: null },
      }),
    ).toEqual({
      title: 'T',
      body: undefined,
      link: undefined,
      notificationId: undefined,
      type: undefined,
    });
  });

  it('falls back to data title/body for a data-only send', () => {
    expect(
      toPushMessage({ data: { title: 'From data', body: 'Body' } }),
    ).toMatchObject({ title: 'From data', body: 'Body' });
  });
});

describe('foreground + teardown', () => {
  it('forwards foreground deliveries', async () => {
    const handler = vi.fn();
    await onNativeForegroundMessage(handler);
    emit('pushNotificationReceived', { title: 'Now', data: {} });
    expect(handler).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Now' }),
    );
  });

  it('unregisters the device token', async () => {
    await releaseNativeToken();
    expect(PushNotifications.unregister).toHaveBeenCalled();
  });

  it('clears the OS tray', async () => {
    await clearDeliveredNotifications();
    expect(PushNotifications.removeAllDeliveredNotifications).toHaveBeenCalled();
  });

  it('never throws when the plugin rejects', async () => {
    PushNotifications.unregister.mockRejectedValueOnce(new Error('web'));
    await expect(releaseNativeToken()).resolves.toBeUndefined();
  });
});
