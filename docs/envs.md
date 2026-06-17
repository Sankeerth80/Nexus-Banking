# Environment Setup

Do not commit real secrets. Add secret values in Vercel and Render dashboards, or in local `.env` files that remain ignored by git.

## Vercel Frontend

Set the Vercel project root directory to `apps/web`.

Required variables:

- `NEXT_PUBLIC_API_BASE_URL`
- `NEXT_PUBLIC_SOCKET_URL`
- `NEXT_PUBLIC_DEMO_MODE`
- `NEXT_PUBLIC_SENTRY_DSN`
- `SENTRY_AUTH_TOKEN`

## Render Backend

Deploy the backend from `apps/api` using `render.yaml`.

Required runtime variables:

- `DATABASE_URL`
- `DIRECT_URL`
- `JWT_ACCESS_SECRET`
- `JWT_REFRESH_SECRET`
- `SESSION_SECRET`
- `UPSTASH_REDIS_REST_URL`
- `UPSTASH_REDIS_REST_TOKEN`
- `MINIO_ENDPOINT`
- `MINIO_ACCESS_KEY`
- `MINIO_SECRET_KEY`
- `BREVO_API_KEY`
- `BREVO_SMTP_USER`
- `BREVO_SMTP_PASSWORD`
- `SENTRY_DSN`

Keep `BANKING_RAILS_MODE=simulation` and `DEMO_BANKING_MODE=true` in every environment.

## Local Files

- Frontend: copy `apps/web/.env.example` to `apps/web/.env.local`
- Backend: copy `apps/api/.env.example` to `apps/api/.env`

The pasted credential values from chat should be rotated before production use because they have already been exposed outside the secret manager.
