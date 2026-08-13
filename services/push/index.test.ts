import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const isNativePlatform = vi.fn(() => false);
vi.mock('../platform', () => ({
  isNativePlatform: () => isNativePlatform(),
  getAuthMode: () => 'bearer',
}));

const web = {
  isWebPushSupported: vi.fn(async () => true),
  getWebPermission: vi.fn(() => 'granted' as NotificationPermission),
  requestWebPermission: vi.fn(async () => 'granted' as NotificationPermission),
  acquireWebToken: vi.fn(async () => 'web-token'),
  releaseWebToken: vi.fn(async () => undefined),
  onWebForegroundMessage: vi.fn(async () => () => undefined),
};
vi.mock('./webPush', () => web);

const native = {
  getNativePermission: vi.fn(async () => 'granted'),
  requestNativePermission: vi.fn(async () => 'granted'),
  acquireNativeToken: vi.fn(async () => 'native-token'),
  releaseNativeToken: vi.fn(async () => undefined),
  onNativeForegroundMessage: vi.fn(async () => () => undefined),
  onNativeNotificationOpened: vi.fn(() => () => undefined),
  clearDeliveredNotifications: vi.fn(async () => undefined),
  primeNativePush: vi.fn(async () => undefined),
};
vi.mock('./nativePush', () => native);

const { PushBridge, toAppPath } = await import('./index');

beforeEach(() => {
  isNativePlatform.mockReturnValue(false);
  vi.clearAllMocks();
});
afterEach(() => vi.clearAllMocks());

/**
 * `link` arrives from a push payload, so it is influenced by whatever the
 * server was told to send. It is fed straight to `navigate()`, and `navigate()`
 * on an absolute URL is an open redirect — hence the rejection rules here.
 */
describe('toAppPath', () => {
  it('passes an ordinary app route through', () => {
    expect(toAppPath('/notifications')).toBe('/notifications');
  });

  it('adds the leading slash react-router needs', () => {
    expect(toAppPath('history')).toBe('/history');
  });

  it('strips the HashRouter fragment marker in either form', () => {
    expect(toAppPath('/#/payment-status')).toBe('/payment-status');
    expect(toAppPath('#/payment-status')).toBe('/payment-status');
  });

  it('preserves a query string on the route', () => {
    expect(toAppPath('/payment-status?reference=abc123')).toBe(
      '/payment-status?reference=abc123',
    );
  });

  it.each([
    'https://evil.example/steal',
    'http://evil.example',
    '//evil.example/steal',
    'javascript:alert(1)',
    'data:text/html,<script>',
  ])('refuses the absolute/scheme URL %s', (link) => {
    expect(toAppPath(link)).toBeNull();
  });

  it.each([undefined, '', '   '])('returns null for %p', (link) => {
    expect(toAppPath(link)).toBeNull();
  });
});

describe('PushBridge transport selection', () => {
  it('uses the web path off-device', async () => {
    expect(await PushBridge.acquireToken()).toEqual({
      token: 'web-token',
      platform: 'web',
    });
    expect(native.acquireNativeToken).not.toHaveBeenCalled();
  });

  it('uses the native path inside the Capacitor shell', async () => {
    isNativePlatform.mockReturnValue(true);
    expect(await PushBridge.acquireToken()).toEqual({
      token: 'native-token',
      platform: 'android',
    });
    expect(web.acquireWebToken).not.toHaveBeenCalled();
  });

  it('reports no registration rather than a null token', async () => {
    web.acquireWebToken.mockResolvedValueOnce(null as unknown as string);
    expect(await PushBridge.acquireToken()).toBeNull();
  });

  it('reports unsupported on the web when the SDK says so', async () => {
    web.isWebPushSupported.mockResolvedValueOnce(false);
    expect(await PushBridge.getPermission()).toBe('unsupported');
  });

  it('maps the browser default state to prompt', async () => {
    web.getWebPermission.mockReturnValueOnce('default');
    expect(await PushBridge.getPermission()).toBe('prompt');
  });

  it('maps a browser denial through unchanged', async () => {
    web.getWebPermission.mockReturnValueOnce('denied');
    expect(await PushBridge.getPermission()).toBe('denied');
  });

  /**
   * On the web the service worker owns the click, so there is nothing for the
   * page to subscribe to. It must still hand back a callable unsubscribe or
   * every caller needs a platform branch.
   */
  it('returns a no-op notification-open unsubscribe on the web', () => {
    const off = PushBridge.onNotificationOpened(() => undefined);
    expect(native.onNativeNotificationOpened).not.toHaveBeenCalled();
    expect(() => off()).not.toThrow();
  });

  it('subscribes to native taps inside the shell', () => {
    isNativePlatform.mockReturnValue(true);
    PushBridge.onNotificationOpened(() => undefined);
    expect(native.onNativeNotificationOpened).toHaveBeenCalledTimes(1);
  });

  it('only primes and clears the tray on native', async () => {
    await PushBridge.prime();
    await PushBridge.clearTray();
    expect(native.primeNativePush).not.toHaveBeenCalled();
    expect(native.clearDeliveredNotifications).not.toHaveBeenCalled();

    isNativePlatform.mockReturnValue(true);
    await PushBridge.prime();
    await PushBridge.clearTray();
    expect(native.primeNativePush).toHaveBeenCalledTimes(1);
    expect(native.clearDeliveredNotifications).toHaveBeenCalledTimes(1);
  });
});
