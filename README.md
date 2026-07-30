<div align="center">

# Lopay 💳

**A school-fee installment payment platform — built with financial integrity as a first-class concern.**

[![GitHub](https://img.shields.io/badge/GitHub-TemitopeRekun/Lopay-181717?style=for-the-badge&logo=github&logoColor=white)](https://github.com/TemitopeRekun/Lopay)

![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=flat-square&logo=typescript&logoColor=white)
![React](https://img.shields.io/badge/React-20232A?style=flat-square&logo=react&logoColor=61DAFB)
![Vite](https://img.shields.io/badge/Vite-646CFF?style=flat-square&logo=vite&logoColor=white)
![Capacitor](https://img.shields.io/badge/Capacitor-119EFF?style=flat-square&logo=capacitor&logoColor=white)

</div>

---

## What is Lopay?

Lopay solves a real problem in education finance:

- **Parents** struggle to pay large school fees in one lump sum
- **Schools** need guaranteed, traceable, confirmed payments
- **The platform** needs controlled onboarding and robust fraud prevention

This repository is the **client app** — a React + Vite web app packaged for
Android with Capacitor. It talks to the LoPay backend (`lopay-backend`, a NestJS
service) over `/api/v1`. All money logic is enforced server-side; the client
never computes fees or trusts its own state for balances.

> **Backend contract:** endpoint types are generated from the backend's committed
> OpenAPI spec into [`src/api.generated.ts`](./src/api.generated.ts) via
> `npm run generate:types`, and a contract test keeps the client in step with the
> spec. See the [API Guide](./API_GUIDE.md).

---

## Key features

- **Financial integrity** — fees are snapshotted at enrollment; balances and the
  2.5% platform fee / 25% minimum first payment are enforced by the API, never
  the client.
- **Paystack payments** — first payments go through the Paystack inline popup
  (`@paystack/inline-js`); installments are receipt-based and school-confirmed.
- **Realtime** — payment/enrollment changes push over Socket.IO so dashboards
  refresh without polling.
- **Push notifications** — device tokens registered via Capacitor for FCM.
- **Role-based UX** — distinct flows for admin, school owner, and parent.

## Roles

| Role | Access | Key capability |
|---|---|---|
| **SUPER_ADMIN** | Login only (no signup) | Onboards schools, receives first payments, global analytics |
| **SCHOOL_OWNER** | Created by an admin | Confirms/reverses payments, manages class fees, marks defaults |
| **PARENT** | Public signup | Enrols children, makes first & installment payments |

## Tech stack

| Layer | Technology |
|---|---|
| UI | React 19 · TypeScript · Vite · Tailwind |
| Native shell | Capacitor (Android) |
| Server state | TanStack Query |
| UI state | Zustand (`store/`) |
| HTTP | axios (`services/`) |
| Auth | Better Auth client (session cookie / bearer) |
| Payments | `@paystack/inline-js` |

## Fee model

```
Platform fee:          2.5% of the total school fee (fixed at enrollment)
Minimum first payment: 25% of the school fee + the 2.5% platform fee
                     = 0.275 × schoolFee
```

## Project structure

```
Lopay/
├── android/            # Capacitor Android project
├── components/         # Reusable UI (incl. ToastHost, Pagination)
├── context/            # React context providers (auth, data)
├── hooks/              # Data + realtime hooks (TanStack Query)
├── pages/              # Screen-level components
├── services/           # API layer: backend.ts, adapters.ts, apiTypes.ts
├── store/              # Zustand stores (uiStore)
├── src/api.generated.ts# Types generated from the backend OpenAPI spec
├── App.tsx · types.ts · types.admin.ts
└── capacitor.config.json
```

## Getting started

Prerequisites: Node 22+, and the backend running (see [`../LOCAL_DEV.md`](../LOCAL_DEV.md)).

```bash
npm install
cp .env.example .env.local   # set VITE_API_URL (local backend: http://localhost:3001)
npm run dev                  # web dev server (http://localhost:5173)
```

Android via Capacitor:

```bash
npm run static-build         # vite build + cap copy
npm run android:open         # open in Android Studio
```

## Scripts

```bash
npm test                     # vitest (unit + the OpenAPI contract test)
npm run generate:types       # regenerate src/api.generated.ts from ./openapi.json
npm run build                # production build
```

## Deployment (Netlify)

The web build is a static SPA — no server, no serverless functions. Netlify
serves `dist/` and the browser talks to `lopay-backend` directly over CORS.
[`netlify.toml`](./netlify.toml) is the whole config: build command, Node 22,
the `/*` → `/index.html` rewrite react-router needs, security headers, and
cache-control.

**Creating the site**

1. Netlify → *Add new site* → *Import an existing project* → GitHub → this repo.
2. **Branch to deploy: `main`.** `main` is the source of truth; nothing else
   publishes to production.
3. Accept the detected build settings — `netlify.toml` overrides the UI anyway
   (build `npm run build`, publish `dist`).
4. Deploy. No environment variables need to be entered by hand: `VITE_API_URL`
   is committed in `netlify.toml` because it is a public origin, and leaving it
   unset would silently build a bundle pointing at `localhost:3001`.

**Continuous deployment**

Netlify's GitHub App watches `main` directly — every push, and every PR squashed
into it, triggers a build and publishes automatically. No workflow file and no
deploy step in CI: the repo is the trigger.

Confirm both of these once, under *Site configuration → Build & deploy*:

| Setting | Value | Where |
|---|---|---|
| Production branch | `main` | *Continuous deployment → Branches and deploy contexts* |
| Auto publish | **enabled** | *Continuous deployment → Deploy status* |

If auto publish is off, builds still run but sit unpublished until released by
hand — the usual cause of "I merged and nothing changed".

Deploy previews are built for every PR against `main`, so a branch is verifiable
on a real URL before it becomes production. Rolling back is *Deploys → select an
earlier deploy → Publish deploy*; no rebuild, and no git revert needed.

**After the first deploy — two things must happen or the app cannot log in:**

- **Backend CORS.** Add the Netlify origin to `CORS_ORIGINS` on the backend
  (comma-separated). It gates REST CORS, the Socket.IO gateway, and Better
  Auth's trusted origins all at once. Include deploy-preview origins only if
  previews need to hit the API.
- **Paystack.** Add the Netlify origin to the allowed domains on the Paystack
  dashboard so the inline checkout popup will open.

**Environment**

`VITE_*` vars are inlined at build time, so a value change needs a redeploy,
not a restart. `VITE_API_URL` also drives `connect-src` in the CSP, which means
a wrong value fails closed with blocked XHRs rather than leaking to a wrong
host. Production, deploy-preview and branch-deploy contexts each get their own
block in `netlify.toml` so production can be pointed at a live API without the
previews following it.

**Security headers**

The full CSP is injected as a `<meta http-equiv>` at build time
([`build/csp.ts`](./build/csp.ts)) so the Capacitor shell — which has no HTTP
server in front of it — gets the same policy as the web build. `netlify.toml`
adds only what a meta tag cannot express: `frame-ancestors`, HSTS,
`Referrer-Policy`, `Permissions-Policy`, `X-Content-Type-Options`.

**Note on the native build:** `npm run static-build` produces the same `dist/`
for Capacitor, so anything added to `public/` ships to Android too.

## API documentation

See [API_GUIDE.md](./API_GUIDE.md) for the integration mental model (auth, base
URL, payment flow) and the generated client for exact request/response types.

---

## Author

**Temitope Ogunrekun**
[temi.dev](https://temi.dev) · [linkedin.com/in/temi-dev](https://linkedin.com/in/temi-dev) · [github.com/TemitopeRekun](https://github.com/TemitopeRekun)
