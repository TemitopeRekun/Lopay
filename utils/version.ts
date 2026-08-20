import versionInfo from "@/version.json";

/**
 * The running app's version, read from the one file that defines it
 * (`version.json` at the repo root — see VERSIONING.md). Nothing in the UI may
 * spell a version out as a literal: `npm run version:check` fails the build if
 * anything under pages/ or components/ does, because that is exactly how the
 * settings screen came to advertise a build number ("Build 45") that no build
 * ever had.
 */

/** Marketing version, e.g. "1.0.3". Matches Play Store "App version". */
export const APP_VERSION: string = versionInfo.name;

/** Android versionCode — the integer Play orders uploads by. Only goes up. */
export const APP_BUILD: number = versionInfo.code;

/**
 * The commit this bundle was built from, injected at build time (Netlify's
 * COMMIT_REF / GitHub's GITHUB_SHA — see vite.config.ts). Empty in dev and
 * under vitest, where there is no deploy to identify.
 */
export const APP_COMMIT: string = (
  import.meta.env.VITE_COMMIT_REF ?? ""
).slice(0, 7);

/** "1.0.3 (build 4)" — what a user reads back to support. */
export const APP_VERSION_LABEL = `${APP_VERSION} (build ${APP_BUILD})`;

/**
 * The same, plus the commit, for diagnostics. The commit is what distinguishes
 * two deploys that share a version — every push to main produces a new one.
 */
export const APP_BUILD_LABEL = APP_COMMIT
  ? `${APP_VERSION_LABEL} · ${APP_COMMIT}`
  : APP_VERSION_LABEL;
