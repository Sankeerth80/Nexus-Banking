# Performance Report

## Scope

Phase 13 focused only on performance optimization for the User Net Banking Portal, Master Admin Portal, backend APIs, database access, Redis caching, MinIO usage, Socket.IO, and observability. No banking features, workflow steps, or API contracts were added.

## Improvements Made

- Enabled stable Next.js production optimizations in both portals: compression, disabled `X-Powered-By`, production console stripping, AVIF/WebP image formats, and long-lived image cache TTLs.
- Lazy-loaded the Socket.IO client in the user portal so realtime code is downloaded only after an approved authenticated customer reaches the dashboard.
- Parallelized user dashboard startup data requests for accounts, beneficiaries, and transfer history.
- Limited realtime notification state to the latest 10 entries to prevent long-running dashboard memory growth.
- Added Redis JSON read-through caching helpers with fail-open behavior.
- Added short TTL Redis caching for high-read account, beneficiary, transfer, audit, and risk-review list endpoints.
- Added cache invalidation after account, beneficiary, transfer, audit, and review mutations.
- Bounded customer and admin list queries to prevent unbounded dashboard payloads.
- Replaced collection-loading ownership checks with targeted indexed ownership lookups.
- Bounded card transaction history and admin card list payloads.
- Switched card number/CVV generation from `Math.random()` to `crypto.randomInt()`.
- Bounded KYC pending queues and customer account lists.
- Resolved KYC MinIO presigned URLs in parallel.
- Bounded notification and support ticket/comment history.
- Added MinIO upload content-type validation and a 10 MB file-size guard.
- Tuned the Neon/PostgreSQL pool with connect timeout, idle timeout, and idle exit behavior.
- Added Socket.IO connection metrics and conservative gateway limits for message size, ping interval, and ping timeout.
- Added Prometheus/Grafana coverage for realtime connections, database query latency, and API throughput.

## Bottlenecks Fixed

- Sequential dashboard fetches were converted to parallel fetches.
- Socket.IO was part of the initial dashboard bundle path; it is now dynamically imported only when needed.
- Admin/customer list APIs had unbounded query results; they now return bounded payloads.
- Card endpoints loaded every transaction for every card; they now cap nested transaction history.
- Statement generation selected unnecessary transfer fields; it now selects only statement fields.
- Ownership checks loaded full account/beneficiary collections; they now use targeted indexed checks.
- KYC document URL generation was sequential; it now resolves independent URLs concurrently.
- Support and notification endpoints could return large histories; they now use explicit limits.
- Realtime observability did not expose active connection load; it now exports a Prometheus gauge.

## Database Optimizations

- Added composite indexes for customer account timelines, account status views, beneficiary customer/activity lookups, card customer timelines, card status views, transfer customer history, scheduled transfer processing, KYC queue sorting, card transaction history, notification history, ticket timelines, and audit log timelines.
- Added a Prisma migration for the new indexes: `20260619093000_performance_indexes`.
- Fixed Prisma CLI resolution for the monorepo workspace so schema generation can run from the root script reliably.
- Kept relations and constraints intact; no schema behavior was changed beyond indexes.

## Cache Strategy

- OTP, sessions, and rate limiting continue to use Redis.
- Application read caching now covers short-lived dashboard and admin list data.
- Cache entries use conservative TTLs to preserve freshness in banking simulation workflows.
- Cache failures do not block requests.

## Monitoring Updates

- Existing CPU, memory, API latency, database, error rate, transaction volume, pending approvals, pending KYC, and fraud alert panels remain in place.
- Added realtime connections.
- Added database query latency using infrastructure health latency.
- Added API throughput by route.

## Verification

Required commands for this phase:

- `npm run lint`
- `npm run typecheck`
- `npm run build`
- `npm run test`
- `npm run test:e2e`
- `npm run audit`

Final command results are recorded in the assistant completion message after validation.
