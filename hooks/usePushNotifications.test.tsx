import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const navigate = vi.fn();
vi.mock('react-router-dom', async (importOriginal) => ({
  ...(await importOriginal<typeof import('react-router-dom')>()),
  useNavigate: () => navigate,
}));

let authed = true;
let userId = 'user-1';
vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({
    isAuthenticated: authed,
    user: authed ? { id: userId } : null,
  }),
}));

let foregroundHandler: ((m: unknown) => void) | undefined;
let openedHandler: ((m: unknown) => void) | undefined;
const offForeground = vi.fn();
const offOpened = vi.fn();

const PushBridge = {
  onForegroundMessage: vi.fn(async (h: (m: unknown) => void) => {
    foregroundHandler = h;
    return offForeground;
  }),
  onNotificationOpened: vi.fn((h: (m: unknown) => void) => {
    openedHandler = h;
    return offOpened;
  }),
};
const playNotificationSound = vi.fn();

vi.mock('../services/push', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../services/push')>()),
  PushBridge,
  playNotificationSound,
}));

const refresh = vi.fn(async () => undefined);
const syncToken = vi.fn(async () => undefined);
const clear = vi.fn(async () => undefined);
const showIncoming = vi.fn();
vi.mock('../store/pushStore', () => ({
  usePushStore: {
    getState: () => ({ refresh, syncToken, clear, showIncoming }),
  },
}));

const { usePushNotifications } = await import('./usePushNotifications');

const Probe = () => {
  usePushNotifications();
  return null;
};

const renderHook = () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const invalidate = vi.spyOn(queryClient, 'invalidateQueries');
  const utils = render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <Probe />
      </MemoryRouter>
    </QueryClientProvider>,
  );
  return { ...utils, invalidate };
};

beforeEach(() => {
  vi.clearAllMocks();
  authed = true;
  userId = 'user-1';
  foregroundHandler = undefined;
  openedHandler = undefined;
});

describe('session lifecycle', () => {
  it('resolves support once on mount', async () => {
    renderHook();
    await waitFor(() => expect(refresh).toHaveBeenCalledTimes(1));
  });

  /**
   * The id is the point: the store compares the cached token's owner against it,
   * which is the only thing standing between a shared device and one parent's
   * alerts landing on another's screen when the app was killed, not signed out.
   */
  it('re-syncs an already-granted device for the signed-in account', async () => {
    renderHook();
    await waitFor(() => expect(syncToken).toHaveBeenCalledTimes(1));
    expect(syncToken).toHaveBeenCalledWith('user-1');
    expect(clear).not.toHaveBeenCalled();
  });

  /** Switching accounts in one app lifetime never flips `isAuthenticated`. */
  it('re-syncs when a different account takes over the session', async () => {
    const { rerender } = renderHook();
    await waitFor(() => expect(syncToken).toHaveBeenCalledWith('user-1'));

    userId = 'user-2';
    rerender(
      <QueryClientProvider client={new QueryClient()}>
        <MemoryRouter>
          <Probe />
        </MemoryRouter>
      </QueryClientProvider>,
    );

    await waitFor(() => expect(syncToken).toHaveBeenCalledWith('user-2'));
  });

  /**
   * Signed out, there is nothing to clear yet — calling `clear` on a first
   * mount would fire a DELETE for a token that was never registered.
   */
  it('does not clear on a first mount that was never authenticated', async () => {
    authed = false;
    renderHook();
    await waitFor(() => expect(refresh).toHaveBeenCalled());
    expect(clear).not.toHaveBeenCalled();
    expect(syncToken).not.toHaveBeenCalled();
  });

  /**
   * The important half: without this the next account to sign in on a shared
   * device inherits the previous one's push notifications.
   */
  it('clears the token on sign-out', async () => {
    const { rerender } = renderHook();
    await waitFor(() => expect(syncToken).toHaveBeenCalled());

    authed = false;
    rerender(
      <QueryClientProvider client={new QueryClient()}>
        <MemoryRouter>
          <Probe />
        </MemoryRouter>
      </QueryClientProvider>,
    );

    await waitFor(() => expect(clear).toHaveBeenCalledTimes(1));
  });
});

describe('foreground delivery', () => {
  it('pops the card, chimes, and refreshes the alerts query', async () => {
    const { invalidate } = renderHook();
    await waitFor(() => expect(foregroundHandler).toBeDefined());

    foregroundHandler!({ title: 'Payment confirmed', link: '/history' });

    expect(showIncoming).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Payment confirmed' }),
    );
    expect(playNotificationSound).toHaveBeenCalledTimes(1);
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['notifications'] });
  });

  it('does not subscribe while signed out', async () => {
    authed = false;
    renderHook();
    await waitFor(() => expect(refresh).toHaveBeenCalled());
    expect(PushBridge.onForegroundMessage).not.toHaveBeenCalled();
  });

  it('tears the subscription down on unmount', async () => {
    const { unmount } = renderHook();
    await waitFor(() => expect(foregroundHandler).toBeDefined());
    unmount();
    await waitFor(() => expect(offForeground).toHaveBeenCalled());
  });
});

describe('notification taps', () => {
  it('navigates to the notification’s own route', async () => {
    renderHook();
    await waitFor(() => expect(openedHandler).toBeDefined());

    openedHandler!({ title: 'Confirmed', link: '/payment-status' });
    expect(navigate).toHaveBeenCalledWith('/payment-status');
  });

  /** A tap that goes nowhere reads as a broken app. */
  it('falls back to the alerts list when there is no link', async () => {
    renderHook();
    await waitFor(() => expect(openedHandler).toBeDefined());

    openedHandler!({ title: 'Confirmed' });
    expect(navigate).toHaveBeenCalledWith('/notifications');
  });

  it('refuses an absolute URL rather than open-redirecting', async () => {
    renderHook();
    await waitFor(() => expect(openedHandler).toBeDefined());

    openedHandler!({ link: 'https://evil.example/steal' });
    expect(navigate).toHaveBeenCalledWith('/notifications');
  });

  /** Taps must still route when the app was launched by one while signed out. */
  it('subscribes to taps regardless of auth state', async () => {
    authed = false;
    renderHook();
    await waitFor(() => expect(PushBridge.onNotificationOpened).toHaveBeenCalled());
  });
});
