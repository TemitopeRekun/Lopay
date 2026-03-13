<div align="center">

# Lopay 💳

**A school fee installment payment platform — built with financial integrity as a first-class concern.**

[![GitHub](https://img.shields.io/badge/GitHub-TemitopeRekun/Lopay-181717?style=for-the-badge&logo=github&logoColor=white)](https://github.com/TemitopeRekun/Lopay)

![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=flat-square&logo=typescript&logoColor=white)
![NestJS](https://img.shields.io/badge/NestJS-E0234E?style=flat-square&logo=nestjs&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-4169E1?style=flat-square&logo=postgresql&logoColor=white)
![React](https://img.shields.io/badge/React-20232A?style=flat-square&logo=react&logoColor=61DAFB)
![Firebase](https://img.shields.io/badge/Firebase-FFCA28?style=flat-square&logo=firebase&logoColor=black)

</div>

---

## What is Lopay?

Lopay solves a real problem in education finance:

- **Parents** struggle to pay large school fees in one lump sum
- **Schools** need guaranteed, traceable, confirmed payments
- **The platform** needs controlled onboarding and robust fraud prevention

Lopay bridges all three with a structured installment system, strict financial logic enforced at the API level, and a multi-role access architecture designed for trust and auditability.

> **Note:** This repository contains the frontend application. The backend API is maintained in a separate private repository (`lopay-backend`) — see the [API Integration Guide](./API_GUIDE.md) for endpoint documentation.

---

## Key Features

### 💰 Financial Integrity Engine
- **Fee snapshots at enrollment** — fees are captured at the moment of enrollment, never recalculated after the fact
- **Immutable payment records** — payments are appended, never mutated, providing a complete audit trail
- **Server-side business logic** — the platform fee formula (2.5% + minimum 25% first payment) is calculated and enforced at the API level, never client-side

### 📊 Payment Lifecycle State Machine

All payments follow a strict, backend-controlled status flow:

```
PENDING → ACTIVE → COMPLETED
               ↘ DEFAULTED
```

### 👥 Multi-Role Access Control (RBAC)

| Role | Access | Key Capability |
|---|---|---|
| **SUPER_ADMIN** | Login only (no public signup) | Onboards schools, receives first payments, views global analytics |
| **SCHOOL_OWNER** | Created by Super Admin | Confirms payments, manages class fees, marks defaults |
| **PARENT** | Public signup | Enrolls children, makes first & installment payments |
| **UNIVERSITY_STUDENT** | Public signup | Sets up tuition plans, makes installment payments |

### 🔐 Security Architecture
- **Dual authentication**: Firebase Admin SDK for identity verification + JWT for API session management
- **Identity from server only**: User identity derived strictly from `req.user` — never from the request body
- **Guards**: `JwtAuthGuard` (validates user) + `RolesGuard` (enforces RBAC permissions)

---

## Tech Stack

| Layer | Technology |
|---|---|
| **Frontend** | React Native · TypeScript · Vite · Capacitor |
| **Structure** | `components/` · `context/` · `hooks/` · `pages/` · `services/` · `utils/` |
| **Backend** | NestJS (domain-based modular architecture) · Node.js · TypeScript |
| **Database** | PostgreSQL · Prisma ORM |
| **Authentication** | Firebase Admin SDK (identity) · JWT (API sessions) |
| **Validation** | class-validator · Joi |

---

## Fee Structure

```
Platform Fee:           2.5% of total school fee (fixed at enrollment)
Minimum First Payment:  25% of school fee + 2.5% platform fee
```

**Formula:**
```
minimumDeposit = (0.25 × schoolFee) + (0.025 × schoolFee)
               = 0.275 × schoolFee
```

---

## Project Structure (Frontend)

```
Lopay/
├── android/          # Android native build files
├── assets/           # Static assets (images, fonts, icons)
├── components/       # Reusable UI components
├── context/          # React Context providers (auth, state)
├── hooks/            # Custom React hooks
├── pages/            # Screen-level components
├── services/         # API service layer (Axios/fetch wrappers)
├── utils/            # Helper functions and constants
├── App.tsx           # Root application component
├── types.ts          # Shared TypeScript types
├── types.admin.ts    # Admin-specific TypeScript types
└── capacitor.config.json
```

---

## Getting Started

### Prerequisites

- Node.js 18+
- npm or yarn
- Android Studio (for Android development)
- Backend API running (see [API_GUIDE.md](./API_GUIDE.md))

### Installation

```bash
# Clone the repository
git clone https://github.com/TemitopeRekun/Lopay.git
cd Lopay

# Install dependencies
npm install

# Set up environment variables
cp .env .env.local
# Add your backend API URL and Firebase config
```

### Running the App

```bash
# Web development
npm run dev

# Android build via Capacitor
npx cap sync android
npx cap open android
```

---

## Roadmap

- [x] Multi-role authentication (Firebase Admin + JWT)
- [x] School enrollment & fee management
- [x] Installment payment lifecycle
- [x] Payment confirmation flow (school-side)
- [ ] Paystack / Flutterwave payment gateway integration
- [ ] Automated settlement engine
- [ ] Admin analytics dashboard
- [ ] Penalty handling for defaults
- [ ] Credit scoring module
- [ ] Push notifications
- [ ] Webhooks for payment events

---

## API Documentation

See [API_GUIDE.md](./API_GUIDE.md) for full endpoint documentation, authentication flow, request/response examples, and integration guide for frontend developers.

---

## Author

**Temitope Ogunrekun**  
[temi.dev](https://temi.dev) · [linkedin.com/in/temi-dev](https://linkedin.com/in/temi-dev) · [github.com/TemitopeRekun](https://github.com/TemitopeRekun)
