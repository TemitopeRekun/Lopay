# Changelog

All notable changes to the LoPay frontend. Format based on
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/). This project is
pre-1.0; entries are grouped by the roadmap milestone that shipped them.

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
