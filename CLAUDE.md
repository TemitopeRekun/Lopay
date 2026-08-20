# Working in this repo

React + Vite SPA, wrapped by Capacitor for Android. `main` auto-deploys to
Netlify (https://lopay.netlify.app); the API lives in the separate
`lopay-backend` repo. See [README.md](README.md) for the tour and
[CONTRIBUTING.md](CONTRIBUTING.md) for the workflow.

## Versioning — read this before you finish a change

**The current version is in [`version.json`](version.json).** It is the single
source of truth: `android/app/build.gradle` parses it, `utils/version.ts` imports
it, `package.json` is synced from it. Nothing else may spell a version out.

**Every PR that changes shipped code must bump it**, because every merge to `main`
is a deploy:

```bash
npm run version:bump          # patch (also: minor, major)
npm run version:check         # fails on any drift — CI runs this
npm run version:print         # what is the version right now
```

Commit `version.json` and `package.json` together with the change. Docs-only,
`.github/`-only and `play-store/`-only PRs are exempt. Full rules, including which
segment to move and where the version surfaces: [VERSIONING.md](VERSIONING.md).

To display a version anywhere in the UI, import from `utils/version.ts`
(`APP_VERSION_LABEL` for users, `APP_BUILD_LABEL` for diagnostics). A version
literal under `pages/` or `components/` fails CI.

## Before opening a PR

```bash
npm run version:check
npm run typecheck
npm run test:cov     # 80% gate on the logic layer
npm run build
```

One squashed commit per PR — `main` is linear. Commit messages describe the
change only; no tool or co-author attribution.
