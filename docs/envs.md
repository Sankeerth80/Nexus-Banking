# Environment Setup

Do not commit real secrets. Add secret values in Vercel and Render dashboards, or in local `.env` files that remain ignored by git.

## Vercel Frontend

Set the Vercel project root directory to `frontend/user-portal` or `frontend/admin-portal`.

Required variables:

- `NEXT_PUBLIC_API_BASE_URL`
- `NEXT_PUBLIC_SOCKET_URL`
- `NEXT_PUBLIC_DEMO_MODE`
- `NEXT_PUBLIC_SENTRY_DSN`
- `SENTRY_AUTH_TOKEN`

## Render Backend

Deploy the backend from `backend` using `render.yaml`.

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
- `MINIO_BUCKET_KYC`
- `MINIO_BUCKET_STATEMENTS`
- `MINIO_BUCKET_PHOTOS`
- `MINIO_BUCKET_SIGNATURES`
- `MINIO_BUCKET_REPORTS`
- `BREVO_API_KEY`
- `BREVO_SMTP_USER`
- `BREVO_SMTP_PASSWORD`
- `SENTRY_DSN`

Keep `BANKING_RAILS_MODE=simulation` and `DEMO_BANKING_MODE=true` in every environment.

## Local Files

- Frontend: copy `frontend/user-portal/.env.example` to `frontend/user-portal/.env.local` (and same for `frontend/admin-portal`)
- Backend: copy `backend/.env.example` to `backend/.env`

The pasted credential values from chat should be rotated before production use because they have already been exposed outside the secret manager.
