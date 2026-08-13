import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import {
  describeMissingKeys,
  resolveFirebaseWebConfig,
} from './services/push/config';

/**
 * Second build pass: the FCM background service worker.
 *
 * Kept as its own config rather than a second `rollupOptions.input` on the main
 * build, because a service worker has requirements the app bundle does not:
 *
 *  - **One self-contained file.** A worker cannot be code-split; a shared chunk
 *    it tried to import would 404 at install time. `lib` + `inlineDynamicImports`
 *    guarantees a single artifact.
 *  - **Classic script, not ESM.** Module service workers are still not safe to
 *    assume, and `navigator.serviceWorker.register` without `{type:'module'}` —
 *    which is what maximises support — rejects an ESM worker outright. `iife`
 *    is the format that survives everywhere.
 *  - **A fixed, unhashed name at the web root.** FCM looks for
 *    `/firebase-messaging-sw.js` by convention, and a worker URL that changed
 *    per deploy would orphan the previous registration.
 *
 * Ordering matters: this runs AFTER the app build (see the `build` script in
 * package.json) and sets `emptyOutDir: false` so it adds to `dist/` instead of
 * wiping the app that was just written there.
 */
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');

  // The worker needs only the Firebase app identity — it receives messages and
  // never calls getToken, so the VAPID key is irrelevant here (see
  // resolveFirebaseWebConfig). A worker built without that identity still
  // emits; it just installs and does nothing (see sw/firebase-messaging-sw.ts),
  // which keeps `vite dev`, CI smoke builds and any deploy made before the
  // console was configured from failing on a feature that is optional by design.
  const firebaseConfig = resolveFirebaseWebConfig(env);

  if (!firebaseConfig) {
    console.warn(
      '[lopay-sw] No Firebase app config found — emitting an inert messaging ' +
        'service worker. Web push will be unavailable in this build.',
    );
  } else {
    // Name the gap precisely. "No config found" when only the VAPID key is
    // absent sends whoever reads this hunting for the wrong thing.
    const missing = describeMissingKeys(env);
    if (missing.length > 0) {
      console.warn(
        `[lopay-sw] Service worker configured for ${firebaseConfig.projectId}, ` +
          `but the PAGE cannot request a token: missing ${missing.join(', ')}. ` +
          'Web push stays disabled until that is set (and the app rebuilt).',
      );
    }
  }

  return {
    define: {
      __FIREBASE_CONFIG__: JSON.stringify(firebaseConfig),
    },
    build: {
      outDir: 'dist',
      emptyOutDir: false,
      // Service worker global scope; no DOM. es2018 is comfortably below every
      // browser that implements the Push API.
      target: 'es2018',
      lib: {
        entry: path.resolve('sw/firebase-messaging-sw.ts'),
        formats: ['iife'],
        name: 'LopayMessagingServiceWorker',
        fileName: () => 'firebase-messaging-sw.js',
      },
      rollupOptions: {
        output: {
          inlineDynamicImports: true,
        },
      },
    },
  };
});
