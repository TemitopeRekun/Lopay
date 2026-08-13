import { describe, it, expect } from 'vitest';
import {
  describeMissingKeys,
  resolveFirebaseWebConfig,
  resolvePushConfig,
} from './config';

const COMPLETE = {
  VITE_FIREBASE_API_KEY: 'AIzaSyExample',
  VITE_FIREBASE_PROJECT_ID: 'lopay-auth',
  VITE_FIREBASE_MESSAGING_SENDER_ID: '1234567890',
  VITE_FIREBASE_APP_ID: '1:1234567890:web:abc123',
  VITE_FIREBASE_VAPID_KEY: 'BKagOny0KF_2pCJQ3m',
};

describe('resolvePushConfig', () => {
  it('builds the Firebase config from a complete env', () => {
    const config = resolvePushConfig(COMPLETE);
    expect(config).not.toBeNull();
    expect(config!.firebase.projectId).toBe('lopay-auth');
    expect(config!.firebase.appId).toBe('1:1234567890:web:abc123');
    expect(config!.vapidKey).toBe('BKagOny0KF_2pCJQ3m');
  });

  /**
   * A partial config is the dangerous case. FCM does not fail loudly on it — it
   * fails with an opaque `messaging/token-subscribe-failed` deep inside
   * `getToken`, long after the app has already told the user notifications are
   * on. Treating it as absent turns that into a visibly missing feature.
   */
  it.each(Object.keys(COMPLETE))('returns null when %s is missing', (key) => {
    const env = { ...COMPLETE, [key]: undefined };
    expect(resolvePushConfig(env)).toBeNull();
    expect(describeMissingKeys(env)).toEqual([key]);
  });

  it('treats a blank or whitespace-only var as missing', () => {
    expect(resolvePushConfig({ ...COMPLETE, VITE_FIREBASE_APP_ID: '' })).toBeNull();
    expect(
      resolvePushConfig({ ...COMPLETE, VITE_FIREBASE_APP_ID: '   ' }),
    ).toBeNull();
  });

  it('trims values so a stray newline from a host UI cannot corrupt the key', () => {
    const config = resolvePushConfig({
      ...COMPLETE,
      VITE_FIREBASE_VAPID_KEY: '  BKagOny0KF_2pCJQ3m\n',
    });
    expect(config!.vapidKey).toBe('BKagOny0KF_2pCJQ3m');
  });

  /**
   * authDomain is an Auth concern that messaging never reads, so demanding it
   * would block push on an otherwise complete config.
   */
  it('defaults authDomain rather than requiring it', () => {
    const config = resolvePushConfig(COMPLETE);
    expect(describeMissingKeys(COMPLETE)).toEqual([]);
    expect(config!.firebase.authDomain).toBe('lopay-auth.firebaseapp.com');
  });

  it('honours an explicit authDomain', () => {
    const config = resolvePushConfig({
      ...COMPLETE,
      VITE_FIREBASE_AUTH_DOMAIN: 'auth.lopay.com',
    });
    expect(config!.firebase.authDomain).toBe('auth.lopay.com');
  });

  it('reports every missing key at once, in declaration order', () => {
    expect(describeMissingKeys({})).toEqual([
      'VITE_FIREBASE_API_KEY',
      'VITE_FIREBASE_PROJECT_ID',
      'VITE_FIREBASE_MESSAGING_SENDER_ID',
      'VITE_FIREBASE_APP_ID',
      'VITE_FIREBASE_VAPID_KEY',
    ]);
  });
});

/**
 * The service worker receives messages and never calls `getToken`, so it needs
 * the Firebase app identity but not the VAPID key. Conflating the two made the
 * worker inert — and the build warn "no Firebase config found" — whenever only
 * the page-side key was absent.
 */
describe('resolveFirebaseWebConfig', () => {
  it('resolves without a VAPID key, unlike the page-side config', () => {
    const env = { ...COMPLETE, VITE_FIREBASE_VAPID_KEY: '' };

    expect(resolvePushConfig(env)).toBeNull();
    expect(resolveFirebaseWebConfig(env)).toEqual({
      apiKey: 'AIzaSyExample',
      authDomain: 'lopay-auth.firebaseapp.com',
      projectId: 'lopay-auth',
      messagingSenderId: '1234567890',
      appId: '1:1234567890:web:abc123',
    });
  });

  it.each([
    'VITE_FIREBASE_API_KEY',
    'VITE_FIREBASE_PROJECT_ID',
    'VITE_FIREBASE_MESSAGING_SENDER_ID',
    'VITE_FIREBASE_APP_ID',
  ])('still returns null when the identity field %s is missing', (key) => {
    expect(resolveFirebaseWebConfig({ ...COMPLETE, [key]: undefined })).toBeNull();
  });

  it('agrees with resolvePushConfig on a complete env', () => {
    expect(resolveFirebaseWebConfig(COMPLETE)).toEqual(
      resolvePushConfig(COMPLETE)!.firebase,
    );
  });
});
