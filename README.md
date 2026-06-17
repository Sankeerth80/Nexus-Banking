# Nexus Banking

Phase 1 scaffold for a demo portfolio banking system. It creates a Next.js user/admin portal shell and a NestJS API foundation with safe environment templates for Vercel and Render.

This project is simulation-only. It must not connect to real UPI, NEFT, RTGS, IMPS, Visa, Mastercard, or other live banking rails.

## Apps

- `apps/web`: Next.js, React, TypeScript, Tailwind CSS, shadcn/ui, Lucide, Playwright
- `apps/api`: NestJS, Prisma, JWT/Passport dependencies, Upstash/MinIO/Brevo integration wiring, BullMQ, Socket.IO, Prometheus, Swagger, Jest

## Run Locally

```bash
npm run dev:web
npm run dev:api
```

Copy the relevant `.env.example` files before running services locally.

```bash
Copy-Item apps/web/.env.example apps/web/.env.local
Copy-Item apps/api/.env.example apps/api/.env
```

## Phase 1 Scope

- Two-portal frontend shell for user net banking and master admin views
- Demo banking domain model in Prisma
- Typed backend environment validation
- Health, metrics, Swagger, CORS, rate limiting, and security headers
- Vercel and Render env templates
- Docker, Prometheus, Grafana, GitHub Actions, Jest, and Playwright foundations
