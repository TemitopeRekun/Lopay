# Contributing — LoPay Frontend

## Setup

See the [README](./README.md) for install and run steps, and
[`../LOCAL_DEV.md`](../LOCAL_DEV.md) for the full local stack. Set `VITE_API_URL`
in `.env.local` to point at your backend (default `http://localhost:3001`).

## Branching & PRs

- Work on a branch; open a PR into `main`. Milestone work uses
  `milestone-N-<theme>` branches and is squash-merged.
- CI (`.github/workflows/ci.yml`) must be green: `tsc --noEmit`, `npm test`, and
  the production build.
- Keep the diff to one coherent change; nothing half-wired left on `main`.

## Types & the API contract

- The backend is the source of truth for API shapes. Regenerate the typed client
  after any backend API change:

  ```bash
  npm run generate:types    # openapi-typescript ./openapi.json -> src/api.generated.ts
  ```

  Commit both `openapi.json` and `src/api.generated.ts`. The contract test
  (`src/api.contract.test.ts`) fails if they drift.
- Use the generated request DTOs (re-exported from `services/apiTypes.ts`) for
  outgoing payloads. Add view-model normalisation in `services/adapters.ts`;
  avoid `as any` — extend the `Api*` types in `types.ts` instead.

## Conventions

- Components stay presentational; data goes through TanStack Query hooks in
  `hooks/`, and UI state through the Zustand store `store/uiStore` (use
  `useUIStore` — there is no `UIContext`).
- Never persist or hand-roll auth tokens; the Better Auth client owns the
  session (cookie on web, bearer on native).
- All money is displayed via the shared currency helpers — the client never
  computes fees or balances; it renders what the API reports.

## Tests

```bash
npm test            # vitest (unit + the OpenAPI contract test)
```

Add Testing Library tests for new components and behaviour.

## Commit style

Short, imperative subject with a scope, e.g. `feat(contract): generate typed
client`. Explain the *why* in the body. Add a [CHANGELOG](./CHANGELOG.md) entry
under *Unreleased*.
