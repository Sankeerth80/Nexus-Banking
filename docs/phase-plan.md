# Phase Plan

## Phase 1: Foundation

- Scaffold frontend and backend apps
- Establish safe environment boundaries
- Add two-portal dashboard shell
- Add backend health, metrics, Swagger, security, and env validation
- Add Prisma domain schema
- Add Docker, monitoring, CI, Jest, and Playwright foundations

## Phase 2: Authentication And Security

- Customer and employee login
- JWT access and refresh tokens
- bcrypt password storage
- speakeasy 2FA and QR enrollment
- OTP delivery through Brevo
- Trusted devices and session timeout
- Audit logging middleware

## Phase 3: Customer Banking Workflows

- Accounts, beneficiaries, transfers, statements, notifications, support, profile, and security
- Own account, internal, NEFT, RTGS, IMPS, UPI, and scheduled transfer simulations
- MinIO-backed statements and profile documents

## Phase 4: Cards

- Debit and credit card lifecycle
- Block, unblock, freeze, unfreeze, replace
- Set PIN, change PIN, limits, ATM, online, contactless, and international toggles

## Phase 5: Master Admin

- Customers, employees, branches, KYC, cards, fraud, risk, compliance, audit, reports, support, and settings
- Customer approval workflow from KYC officer through branch manager approval
- Role-based access for all listed employee roles

## Phase 6: Production Readiness

- Background workers with BullMQ
- Socket.IO realtime events
- Sentry performance tracing
- Prometheus and Grafana dashboards
- Full Jest and Playwright coverage
- Deployment hardening for Vercel and Render
