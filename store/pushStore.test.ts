import { describe, it, expect, vi, beforeEach } from 'vitest';

const bridge = {
  isSupported: vi.fn(async () => true),
  getPermission: vi.fn(async () => 'prompt' as string),
  requestPermission: vi.fn(async () => 'granted' as string),
  acquireToken: vi.fn(
    async (): Promise<{ token: string; platform: string } | null> => ({
      token: 'tok-1',
      platform: 'web',
    }),
  ),
  releaseToken: vi.fn(async () => undefined),
};

vi.mock('../services/push', () => ({
  PushBridge: bridge,
  isSoundEnabled: () => true,
  setSoundEnabled: vi.fn(),
  unlockSound: vi.fn(async () => undefined),
  playNotificationSound: vi.fn(),
}));

const register = vi.fn(async () => ({ id: 'row-1' }));
const unregister = vi.fn(async () => ({}));
vi.mock('../services/backend', () => ({
  BackendAPI: { deviceTokens: { register, unregister } },
}));

const {
  usePushStore,
  shouldShowSoftAsk,
  PUSH_SOFT_ASK_COOLDOWN_MS,
} = await import('./pushStore');

const initial = usePushStore.getState();

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  bridge.isSupported.mockResolvedValue(true);
  bridge.getPermission.mockResolvedValue('prompt');
  bridge.requestPermission.mockResolvedValue('granted');
  bridge.acquireToken.mockResolvedValue({ token: 'tok-1', platform: 'web' });
  usePushStore.setState({
    ...initial,
    supported: null,
    permission: 'prompt',
    status: 'idle',
    error: null,
    token: null,
    tokenOwnerId: null,
    sessionUserId: null,
    incoming: null,
    softAskDismissedAt: 0,
  });
});

describe('enable', () => {
  it('prompts, takes a token, and registers it with the backend', async () => {
    const ok = await usePushStore.getState().enable();

    expect(ok).toBe(true);
    expect(register).toHaveBeenCalledWith({ token: 'tok-1', platform: 'web' });
    expect(usePushStore.getState().status).toBe('enabled');
    expect(usePushStore.getState().token).toBe('tok-1');
    // Remembered so sign-out can delete the right row after the SDK is gone.
    expect(localStorage.getItem('lopay:push-token')).toBe('tok-1');
  });

  /** Unattributed, the token can't be told apart from a previous account's. */
  it('records the opting-in account as the token owner', async () => {
    usePushStore.setState({ sessionUserId: 'user-1' });

    await usePushStore.getState().enable();

    expect(usePushStore.getState().tokenOwnerId).toBe('user-1');
    expect(localStorage.getItem('lopay:push-token-owner')).toBe('user-1');
  });

  it('stops at a denial and explains how to undo it', async () => {
    bridge.requestPermission.mockResolvedValue('denied');
    const ok = await usePushStore.getState().enable();

    expect(ok).toBe(false);
    expect(bridge.acquireToken).not.toHaveBeenCalled();
    expect(register).not.toHaveBeenCalled();
    expect(usePushStore.getState().status).toBe('error');
    expect(usePushStore.getState().error).toMatch(/settings/i);
  });

  it('reports failure when no token can be obtained', async () => {
    bridge.acquireToken.mockResolvedValue(null);
    const ok = await usePushStore.getState().enable();

    expect(ok).toBe(false);
    expect(register).not.toHaveBeenCalled();
    expect(usePushStore.getState().status).toBe('error');
  });

  /**
   * The case worth being strict about: permission granted and FCM holding a
   * token, but our server never learned about it — so no push can ever arrive.
   * Reporting success here would be exactly the lie the old placeholder toggle
   * told.
   */
  it('does NOT claim success when backend registration fails', async () => {
    register.mockRejectedValueOnce(new Error('500'));
    const ok = await usePushStore.getState().enable();

    expect(ok).toBe(false);
    expect(usePushStore.getState().status).toBe('error');
    expect(usePushStore.getState().token).toBeNull();
    expect(localStorage.getItem('lopay:push-token')).toBeNull();
  });
});

describe('disable', () => {
  it('deletes the backend row and drops the local token', async () => {
    await usePushStore.getState().enable();
    await usePushStore.getState().disable();

    expect(unregister).toHaveBeenCalledWith('tok-1');
    expect(bridge.releaseToken).toHaveBeenCalled();
    expect(usePushStore.getState().token).toBeNull();
    expect(usePushStore.getState().status).toBe('idle');
    expect(localStorage.getItem('lopay:push-token')).toBeNull();
  });

  /**
   * If the row survives, pushes keep arriving after the user switched them off.
   * The toggle must stay on and say so rather than lying about the outcome.
   */
  it('keeps the token when the backend delete fails', async () => {
    await usePushStore.getState().enable();
    unregister.mockRejectedValueOnce(new Error('offline'));
    await usePushStore.getState().disable();

    expect(usePushStore.getState().token).toBe('tok-1');
    expect(usePushStore.getState().status).toBe('enabled');
    expect(usePushStore.getState().error).toMatch(/try again/i);
    expect(bridge.releaseToken).not.toHaveBeenCalled();
  });
});

describe('syncToken', () => {
  it('does nothing without permission', async () => {
    bridge.getPermission.mockResolvedValue('prompt');
    await usePushStore.getState().syncToken('user-1');
    expect(bridge.acquireToken).not.toHaveBeenCalled();
    expect(register).not.toHaveBeenCalled();
  });

  it('skips the request when the token has not moved', async () => {
    bridge.getPermission.mockResolvedValue('granted');
    usePushStore.setState({ token: 'tok-1', tokenOwnerId: 'user-1' });

    await usePushStore.getState().syncToken('user-1');

    expect(register).not.toHaveBeenCalled();
    expect(bridge.releaseToken).not.toHaveBeenCalled();
    expect(usePushStore.getState().status).toBe('enabled');
  });

  /** FCM rotates tokens on reinstall or storage clear; a stale row is a dead device. */
  it('re-registers a rotated token', async () => {
    bridge.getPermission.mockResolvedValue('granted');
    usePushStore.setState({ token: 'tok-OLD', tokenOwnerId: 'user-1' });
    bridge.acquireToken.mockResolvedValue({ token: 'tok-NEW', platform: 'web' });

    await usePushStore.getState().syncToken('user-1');

    expect(register).toHaveBeenCalledWith({ token: 'tok-NEW', platform: 'web' });
    expect(usePushStore.getState().token).toBe('tok-NEW');
  });

  /**
   * The shared-device case, and the reason ownership is tracked at all: the app
   * was killed while signed in as `user-A`, so sign-out never ran, and `user-B`
   * opens it later. FCM returns the SAME token from its cache — matching on the
   * token alone would call nothing a change, leave the backend row owned by
   * `user-A`, and deliver their fee alerts to `user-B`'s screen.
   */
  it("discards a token left behind by another account, even an identical one", async () => {
    bridge.getPermission.mockResolvedValue('granted');
    usePushStore.setState({
      token: 'tok-A',
      tokenOwnerId: 'user-A',
      status: 'enabled',
    });
    // FCM's cache survives the process; the same string comes back.
    bridge.acquireToken.mockResolvedValue({ token: 'tok-A', platform: 'web' });

    await usePushStore.getState().syncToken('user-B');

    // Destroyed at FCM rather than reassigned, so no send can reach this device
    // for `user-A` even if the registration below never lands.
    expect(bridge.releaseToken).toHaveBeenCalled();
    expect(register).toHaveBeenCalledWith({ token: 'tok-A', platform: 'web' });
    expect(usePushStore.getState().tokenOwnerId).toBe('user-B');
    expect(localStorage.getItem('lopay:push-token-owner')).toBe('user-B');
    expect(usePushStore.getState().status).toBe('enabled');
  });

  /** A cache written before owners were tracked could belong to anyone. */
  it('treats a token with no recorded owner as another account’s', async () => {
    bridge.getPermission.mockResolvedValue('granted');
    usePushStore.setState({ token: 'tok-legacy', tokenOwnerId: null });
    bridge.acquireToken.mockResolvedValue({
      token: 'tok-legacy',
      platform: 'web',
    });

    await usePushStore.getState().syncToken('user-1');

    expect(bridge.releaseToken).toHaveBeenCalled();
    expect(register).toHaveBeenCalledWith({
      token: 'tok-legacy',
      platform: 'web',
    });
    expect(usePushStore.getState().tokenOwnerId).toBe('user-1');
  });

  /**
   * Offline while taking over a device. Claiming "on" here would promise pushes
   * that cannot be routed to this account — the exact lie the toggle used to tell.
   */
  it('claims nothing when re-registering a foreign token fails', async () => {
    bridge.getPermission.mockResolvedValue('granted');
    usePushStore.setState({
      token: 'tok-A',
      tokenOwnerId: 'user-A',
      status: 'enabled',
    });
    register.mockRejectedValueOnce(new Error('offline'));

    await usePushStore.getState().syncToken('user-B');

    expect(usePushStore.getState().token).toBeNull();
    expect(usePushStore.getState().status).toBe('idle');
    expect(localStorage.getItem('lopay:push-token')).toBeNull();
  });

  /** `enable()` reads this to attribute a token, so it cannot wait on permission. */
  it('records the session before the permission check can return', async () => {
    bridge.getPermission.mockResolvedValue('denied');
    await usePushStore.getState().syncToken('user-1');
    expect(usePushStore.getState().sessionUserId).toBe('user-1');
  });
});

describe('clear (sign-out)', () => {
  /**
   * Both halves matter. Leaving the backend row means the next account on this
   * device inherits the previous one's notifications; leaving the FCM token
   * means `getToken` hands back the SAME value on next sign-in.
   */
  it('removes the row and the device token', async () => {
    await usePushStore.getState().enable();
    await usePushStore.getState().clear();

    expect(unregister).toHaveBeenCalledWith('tok-1');
    expect(bridge.releaseToken).toHaveBeenCalled();
    expect(usePushStore.getState().token).toBeNull();
  });

  it('never blocks sign-out on a failed cleanup', async () => {
    await usePushStore.getState().enable();
    unregister.mockRejectedValueOnce(new Error('offline'));

    await expect(usePushStore.getState().clear()).resolves.toBeUndefined();
    expect(usePushStore.getState().token).toBeNull();
  });
});

describe('refresh', () => {
  it('reports unsupported without asking for permission', async () => {
    bridge.isSupported.mockResolvedValue(false);
    await usePushStore.getState().refresh();

    expect(usePushStore.getState().supported).toBe(false);
    expect(usePushStore.getState().permission).toBe('unsupported');
    expect(bridge.getPermission).not.toHaveBeenCalled();
  });

  /**
   * Permission alone is not the feature working: a granted browser with no
   * registered token receives nothing.
   */
  it('does not claim enabled on permission alone', async () => {
    bridge.getPermission.mockResolvedValue('granted');
    await usePushStore.getState().refresh();
    expect(usePushStore.getState().status).toBe('idle');

    usePushStore.setState({ token: 'tok-1' });
    await usePushStore.getState().refresh();
    expect(usePushStore.getState().status).toBe('enabled');
  });

  /** A token owned by whoever used this device last reads as ON while the
   * notifications go to them — worse than reporting the feature off. */
  it('does not claim enabled for another account’s token', async () => {
    bridge.getPermission.mockResolvedValue('granted');
    usePushStore.setState({
      token: 'tok-A',
      tokenOwnerId: 'user-A',
      sessionUserId: 'user-B',
    });

    await usePushStore.getState().refresh();

    expect(usePushStore.getState().status).toBe('idle');
  });
});

describe('shouldShowSoftAsk', () => {
  const NOW = Date.UTC(2026, 7, 8);
  const base = {
    supported: true as boolean | null,
    permission: 'prompt' as const,
    softAskDismissedAt: 0,
    now: NOW,
  };

  it('shows for a supported, never-asked, signed-in device', () => {
    expect(shouldShowSoftAsk(base)).toBe(true);
  });

  it('stays hidden while support is still unknown', () => {
    expect(shouldShowSoftAsk({ ...base, supported: null })).toBe(false);
  });

  it('stays hidden where push cannot work at all', () => {
    expect(shouldShowSoftAsk({ ...base, supported: false })).toBe(false);
  });

  /**
   * Neither state can be changed from script — a granted user has nothing to
   * accept, and a denied user cannot be re-prompted, so the card would be a
   * button that provably does nothing.
   */
  it.each(['granted', 'denied', 'unsupported'] as const)(
    'stays hidden when permission is already %s',
    (permission) => {
      expect(shouldShowSoftAsk({ ...base, permission })).toBe(false);
    },
  );

  it('respects the dismissal cooldown, then returns', () => {
    const dismissed = NOW - 1000;
    expect(shouldShowSoftAsk({ ...base, softAskDismissedAt: dismissed })).toBe(
      false,
    );
    expect(
      shouldShowSoftAsk({
        ...base,
        softAskDismissedAt: NOW - PUSH_SOFT_ASK_COOLDOWN_MS,
      }),
    ).toBe(true);
  });
});

describe('in-app pop-up state', () => {
  it('shows and dismisses an incoming push', () => {
    usePushStore.getState().showIncoming({ title: 'Payment confirmed' });
    expect(usePushStore.getState().incoming?.title).toBe('Payment confirmed');

    usePushStore.getState().dismissIncoming();
    expect(usePushStore.getState().incoming).toBeNull();
  });

  it('replaces rather than queues, so the newest event is the one on screen', () => {
    usePushStore.getState().showIncoming({ title: 'First' });
    usePushStore.getState().showIncoming({ title: 'Second' });
    expect(usePushStore.getState().incoming?.title).toBe('Second');
  });
});
