# Changelog

All notable changes to the LoPay frontend. Format based on
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/). This project is
pre-1.0; entries are grouped by the roadmap milestone that shipped them.

## [1.0.5] — versionCode 6 — 2026-09-12

No code change. `versionCode` counts uploads rather than features
(VERSIONING.md), and Play rejects a code it has already seen, so this releases
a fresh one for the next store upload of the 1.0.4 photo-picker fix.

## [1.0.4] — versionCode 5 — 2026-09-11

### Fixed
- Receipt selection no longer asks for any media, storage or camera permission.
  Google Play flagged `READ_MEDIA_IMAGES` on a build that never needed it:
  picking goes through `Camera.getPhoto({ source: Photos })`, which has used the
  system photo picker since `@capacitor/camera` 6, and the picker grants access
  to the one item the user chose. `READ_MEDIA_IMAGES`,
  `READ_EXTERNAL_STORAGE` and `WRITE_EXTERNAL_STORAGE` are gone from the
  manifest (they are required only for `saveToGallery: true`, which this app
  never passes), and the screen no longer calls `Camera.requestPermissions` or
  `Filesystem.requestPermissions` first — two dialogs that guarded access the
  app does not use, one of them for a camera this flow never opens.
- Backing out of the photo picker no longer shows "Failed to open photos". A
  cancel rejects exactly as a failure does; `isPickerCancellation` tells them
  apart.

### Added
- The `ModuleDependencies` manifest entry that asks Google Play services to
  install the backported photo picker, so devices on API 24–32 get the real
  picker instead of a document chooser.

### Removed
- `NativeBridge.requestFilesystemPermissions()` — it requested storage
  permissions for a filesystem this app never reads or writes.

## [1.0.3] — versionCode 4 — 2026-08-20

### Added
- `version.json`: a single source of truth for the app version, parsed by
  `android/app/build.gradle` and imported by `utils/version.ts`. `npm run
  version:bump` / `:sync` / `:check` / `:print` (`scripts/version.mjs`).
- CI gates: the version must be consistent everywhere, and any PR that changes
  shipped code must raise `versionCode`.
- `.github/workflows/release-tag.yml` tags every merge to `main` as
  `v<name>+<code>` and publishes a GitHub release, so the shipped version is
  visible without a checkout.
- The deploying commit is injected into the bundle (`APP_COMMIT`) and shown in
  the profile footer, distinguishing two deploys of the same version.
- `VERSIONING.md`, `CLAUDE.md`, and a README section covering when and how to
  bump.

### Fixed
- The version no longer disagrees with itself. It was hand-copied into five
  places: `build.gradle` said 1.0.2 / code 3, `package.json` said 1.0.0, the
  profile footer said v1.0.2, and the Settings screen said "1.0.2 (Build 45)" —
  a build number that never existed.

## [Unreleased] — Milestone 5: contract, docs & observability

### Added
- Typed API client generated from the backend's committed OpenAPI spec
  (`src/api.generated.ts` via `npm run generate:types`) and a contract test that
  fails on client/spec drift.
- `services/apiTypes.ts` re-exporting generated request DTOs, adopted for the
  receipt and payment-reversal payloads in `services/backend.ts`.
- `CONTRIBUTING.md` and this changelog.

### Changed
- Rewrote `README.md` and `API_GUIDE.md` to match the shipped system (React +
  Vite + Capacitor, Better Auth, Paystack, generated client).
- Made the hand-written `Api*` types accurate, removing all 16 `as any` casts in
  `services/adapters.ts`.

### Removed
- The `UIContext` shim — the toast portal moved to `components/ToastHost` and all
  consumers use `useUIStore` directly.

## [Milestone 4] — Scale — 2026-06-30

### Added
- `Paginated<T>` type and a reusable `Pagination` component; admin list screens
  consume the backend's paginated envelopes.

## [Milestone 3] — Ledger contract tests — 2026-06-30

### Added
- Contract tests for the ledger operations (confirm / decline / reverse).

## [Milestone 2] — Secure delivery — 2026-06-29

### Added
- Dual-path (cookie / bearer) auth against Better Auth.

### Security
- Removed a leaked key; added a strict SPA CSP.

## [Milestone 1] — Foundation — 2026-06-29

### Added
- Frontend test harness (vitest + Testing Library) and shared error/logging/
  currency helpers.
