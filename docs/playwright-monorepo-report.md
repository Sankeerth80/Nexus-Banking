# Playwright Monorepo Refactor Report

## Root Cause

The Playwright setup was still shaped like isolated single-app runs. Each portal config started its own temporary Next.js server and the admin portal used `http://127.0.0.1:3102`. That created duplicate dev servers, port conflicts, and webServer startup timeouts when the monorepo services were already running.

After the port refactor, the required `127.0.0.1` Playwright base URLs also exposed a Next.js development-origin block for dev resources. Both portal Next.js configs now explicitly allow `127.0.0.1` in development, which keeps the mandated Playwright host while allowing the apps to hydrate normally.

## Changes Made

- User portal Playwright base URL now uses `http://127.0.0.1:3000`.
- Admin portal Playwright base URL now uses `http://127.0.0.1:3001`.
- Removed the temporary `3102` admin server configuration.
- Removed the temporary `3100` user server configuration.
- Removed Playwright `webServer` blocks from both portal configs.
- Playwright no longer starts the user portal, admin portal, or backend API.
- Playwright does not start the backend API.
- Already-running services are reused because Playwright only navigates to configured `baseURL` values.
- Added `allowedDevOrigins: ["127.0.0.1"]` to both portal Next.js configs so Playwright can use the required host without Next dev resource blocking.
- Enabled artifacts in both portal configs:
  - `trace: "on-first-retry"`
  - `screenshot: "only-on-failure"`
  - `video: "retain-on-failure"`
- Updated E2E CORS mock origins to the real portal ports.

## Final Playwright Architecture

- User Portal E2E: `frontend/user-portal/playwright.config.ts`
  - App: `http://127.0.0.1:3000`
  - Requires the user portal server to be running before E2E starts

- Admin Portal E2E: `frontend/admin-portal/playwright.config.ts`
  - App: `http://127.0.0.1:3001`
  - Requires the admin portal server to be running before E2E starts

- Backend API:
  - Expected runtime URL: `http://127.0.0.1:4000`
  - Not started by Playwright

## Required Runtime Startup

Run these services before `npm run test:e2e`:

- `npm --prefix backend run start:dev`
- `npm --prefix frontend/user-portal run dev`
- `npm --prefix frontend/admin-portal run dev -- --port 3001`

## Verification

- `npm run lint`: passed
- `npm run typecheck`: passed
- `npm run build`: passed
- `npm run test`: passed, 6 Jest suites / 76 tests
- `npm run test:e2e`: passed, 26 user portal tests and 26 admin portal tests
