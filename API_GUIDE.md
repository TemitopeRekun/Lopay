# LoPay Frontend — API Integration Guide

How this client talks to the LoPay backend. For the **mental model** of the API
(auth, receipts, the payment flow), read the backend's
[API Guide](../lopay-backend/API_GUIDE.md). For **exact endpoint types**, use the
generated client below. This doc covers the frontend-specific wiring only.

---

## Base URL

The API base comes from `VITE_API_URL` (see `.env` / `.env.local`), defaulting to
`http://localhost:3001`. All app endpoints live under **`/api/v1`**; Better Auth
is at **`/api/auth/*`**.

## Typed client (generated from the contract)

`src/api.generated.ts` is generated from the backend's committed `openapi.json`:

```bash
npm run generate:types      # openapi-typescript ./openapi.json -> src/api.generated.ts
```

- Import request-body types from `services/apiTypes.ts` (a thin re-export of the
  generated request DTOs) so outgoing payloads track the backend automatically.
- `src/api.contract.test.ts` fails if the committed client drifts from the
  committed spec — regenerate and commit both when the API changes.
- When the backend and frontend repos are checked out side by side, the
  backend's `npm run generate:swagger` also refreshes this repo's `openapi.json`.

## Service layer

- `services/backend.ts` — the axios client and one method per endpoint. It
  attaches auth and returns typed data; components never call axios directly.
- `services/adapters.ts` — normalises backend shapes into the app's view models
  (`normalizeUser`, `normalizeTransaction`, `normalizeChild`, …).
- `services/platform.ts` — resolves the auth transport (cookie vs. bearer) per
  platform (web vs. Capacitor native).
- Data is fetched through TanStack Query hooks in `hooks/`; UI state (toasts,
  theme) lives in the Zustand store `store/uiStore` (use `useUIStore`).

## Authentication

Auth uses the **Better Auth** client against `/api/auth/*`. The session is carried
by cookie on web and by bearer token on native (Capacitor). Never persist or
send a hand-rolled token; let the auth client manage the session. The backend
derives identity from the session, so the client only needs to be signed in.

## Payments

- **First payment:** enrol via `backend.ts`, then complete the charge with the
  Paystack inline popup (`@paystack/inline-js`). The backend reconciles via its
  webhook — the client just reflects the resulting state.
- **Installments:** upload a receipt through the signed-URL flow (see the backend
  guide), submit the payment, and render the `PENDING → confirmed` state the
  backend reports.

## Realtime

Payment/enrollment changes arrive over Socket.IO; the realtime hooks invalidate
the relevant TanStack Query caches so dashboards refresh without polling.

---

For anything endpoint-specific, the generated client and the backend's
`openapi.json` are the source of truth.
