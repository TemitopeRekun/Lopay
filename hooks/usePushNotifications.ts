import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../context/AuthContext';
import { usePushStore } from '../store/pushStore';
import { PushBridge, playNotificationSound, toAppPath } from '../services/push';
import { QUERY_KEYS } from './useQueries';

/**
 * Binds push notifications to the session and to the router.
 *
 * Mounted once, INSIDE the router (see `PushManager` in App.tsx) — it needs
 * `useNavigate` to act on a notification tap, which is also why it cannot live
 * next to `RealtimeManager`, whose provider sits outside `HashRouter`.
 *
 * ## The two delivery paths, and why both are handled here
 *
 * A notification reaches a signed-in user through the socket (`useRealtime`)
 * when the app is open, and through FCM when it is not. Those overlap in the
 * foreground: a parent with the tab focused can get the same event twice, once
 * from each. The overlap is deliberate rather than a bug to design out — the
 * socket is the fast path and FCM is the one that survives a dropped
 * connection — so the in-app pop-up is keyed on the notification id and the
 * store simply replaces whatever was showing.
 */
export const usePushNotifications = () => {
  const { isAuthenticated, user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const previousUserId = useRef<string | null>(null);
  const userId = user?.id ?? null;

  // Resolve support/permission once, up front, so the Settings screen and the
  // soft-ask card never render against an unknown state.
  useEffect(() => {
    void usePushStore.getState().refresh();
  }, []);

  // Session lifecycle: re-sync an already-granted device on sign-in, and drop
  // the token on sign-out so the next account on this device does not inherit
  // the previous one's notifications.
  //
  // Keyed on the user id, not just on "is anyone signed in". Sign-out is the
  // only path that runs `clear()`, and an app that is force-quit or backgrounded
  // out of existence never takes it — extremely common on a phone. So the id is
  // also what `syncToken` compares the cached token's owner against: whoever
  // signs in next is either the same account (keep the token) or a different one
  // (throw it away). That check is what stops a shared device delivering one
  // parent's fee alerts to another, and it likewise covers switching accounts
  // without a reload, where `isAuthenticated` alone never changes.
  useEffect(() => {
    if (isAuthenticated && userId) {
      previousUserId.current = userId;
      void usePushStore.getState().syncToken(userId);
      return;
    }
    if (previousUserId.current) {
      previousUserId.current = null;
      void usePushStore.getState().clear();
    }
  }, [isAuthenticated, userId]);

  // Foreground deliveries. Neither transport shows anything by itself while the
  // app is focused, so this is the whole user-visible response.
  useEffect(() => {
    if (!isAuthenticated) return;

    let unsubscribe: (() => void) | undefined;
    let cancelled = false;

    void PushBridge.onForegroundMessage((message) => {
      usePushStore.getState().showIncoming(message);
      playNotificationSound();
      // The alerts screen and the unread badge both read this query.
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.notifications });
    }).then((off) => {
      // The subscription resolves asynchronously (the SDK is loaded on demand),
      // so an unmount can win the race. Tear down immediately if it did.
      if (cancelled) off();
      else unsubscribe = off;
    });

    return () => {
      cancelled = true;
      unsubscribe?.();
    };
  }, [isAuthenticated, queryClient]);

  // Taps on a delivered notification (native only — on the web the service
  // worker owns the click and focuses the tab at the link itself).
  useEffect(() => {
    const unsubscribe = PushBridge.onNotificationOpened((message) => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.notifications });
      const path = toAppPath(message.link);
      // Falls back to the alerts list rather than doing nothing: the user
      // explicitly asked to see this, and a tap that goes nowhere reads as a
      // broken app.
      navigate(path ?? '/notifications');
    });
    return unsubscribe;
  }, [navigate, queryClient]);
};
