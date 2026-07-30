# Changelog

All notable changes to the LoPay frontend. Format based on
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/). This project is
pre-1.0; entries are grouped by the roadmap milestone that shipped them.

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
