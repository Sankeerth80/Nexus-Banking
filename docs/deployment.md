# Nexus Banking Deployment

## GitHub

Repository: `https://github.com/Sankeerth80/Nexus-Banking.git`

Push the source without `outputs/`, `work/`, `.env`, build output, or test reports. Those paths are ignored because they can contain local artifacts or secret paste files.

## Vercel Frontend

Create a Vercel project from the GitHub repo and set the root directory to:

```text
frontend/user-portal
```

or:

```text
frontend/admin-portal
```

Use the variables from `outputs/deployment-envs/vercel.env.txt`.

## Render Backend

Create a Render Blueprint from the GitHub repo:

```text
https://dashboard.render.com/blueprint/new?repo=https://github.com/Sankeerth80/Nexus-Banking
```

Render reads `render.yaml` from the repository and deploys the NestJS API from `backend`.

Use the variables from `outputs/deployment-envs/render.env.txt` for secrets marked `sync: false`.

## Connection Check

After adding real values locally, run:

```bash
npm run check:connections -- --env-file outputs/deployment-envs/render.env.txt
```

To perform live HTTP checks for reachable services:

```bash
npm run check:connections -- --env-file outputs/deployment-envs/render.env.txt --external
```

Live checks require real Neon, Upstash, Brevo, Sentry, and MinIO values.
