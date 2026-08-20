# Versioning

**The current version is in [`version.json`](version.json). That file is the only
place the version lives — read it, don't guess.**

```jsonc
{ "name": "MAJOR.MINOR.PATCH", "code": <integer> }
```

`npm run version:print` prints it. No number is repeated in this file on purpose
— a doc that restates the version is one more thing to go stale.

| Field  | Is                       | Rules                                              |
| ------ | ------------------------ | -------------------------------------------------- |
| `name` | `versionName` / semver   | `MAJOR.MINOR.PATCH`. What users and support quote.  |
| `code` | Android `versionCode`    | Positive integer. **Only ever +1, never reused.** Google Play rejects an upload whose `versionCode` it has already seen. |

## How to bump

```bash
npm run version:bump          # patch: 1.2.3 -> 1.2.4, code n -> n+1
npm run version:bump minor    #        1.2.3 -> 1.3.0, code n -> n+1
npm run version:bump major    #        1.2.3 -> 2.0.0, code n -> n+1
```

`code` always goes up by exactly one, whichever semver segment moved — it counts
uploads, not features. The bump rewrites `version.json` and syncs `package.json`;
commit both in the same PR as the change they describe.

## When to bump

**Every PR that changes what gets shipped.** Merging to `main` triggers a Netlify
deploy, so every merge to `main` is a release — and CI enforces this: the
"Version was bumped" check fails a PR that touches app code without raising
`code`.

Exempt (they ship no bundle): changes confined to `*.md`, `.github/`, or
`play-store/`.

Which segment:

| Change                                          | Bump    |
| ----------------------------------------------- | ------- |
| Bug fix, copy change, styling, dependency bump   | `patch` |
| New screen or feature, new permission, new API   | `minor` |
| Rewritten navigation, dropped platform, breaking | `major` |

## Who reads it

Nothing hardcodes a version. Four things derive it:

| Consumer                    | How                                                              |
| --------------------------- | ---------------------------------------------------------------- |
| `android/app/build.gradle`  | Parses `version.json` at configure time into `versionCode`/`versionName`. |
| `utils/version.ts`          | Imports `version.json`; exports `APP_VERSION`, `APP_BUILD`, `APP_VERSION_LABEL`, `APP_BUILD_LABEL`. The Settings screen and profile footer render these. |
| `package.json`              | A copy — npm needs a literal. Kept in step by `npm run version:sync`. |
| GitHub Releases             | `.github/workflows/release-tag.yml` tags `v<name>+<code>` on every merge to `main`. |

To show a version in the UI, import from `utils/version.ts`. Never type one out:
`npm run version:check` fails the build if anything under `pages/` or
`components/` contains a version literal, if `package.json` has drifted, or if
`build.gradle` has gone back to a hardcoded number.

## What's live

- **Web** — GitHub → Releases shows the newest `v<name>+<code>` and the commit it
  shipped from. In the app, the profile footer shows `v<name> (build <code>) · <commit>`,
  where the last part is the deployed commit (injected at build time from Netlify's
  `COMMIT_REF`; absent in dev). Two deploys of the same version are told apart by
  it.
- **Android** — Play Console shows `versionName (versionCode)`. The next upload
  must exceed the `code` in the newest GitHub release.

## Why this exists

Before this, the version was hand-copied into five places and no two agreed:
`build.gradle` said `1.0.2` / code `3`, `package.json` said `1.0.0`, the profile
footer said `v1.0.2`, and the Settings screen said `1.0.2 (Build 45)` — a build
number that never existed. A user reporting a bug from "v1.0.2" could have been
on any of three builds.
