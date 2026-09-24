# Deployment Plan — GDG-CTU (single Vercel project)

Target: **one Vercel project** serving the React frontend and the backend API
on the same domain. The API runs as a serverless function (`api/index.ts` →
`backend/dist/app.js`); Postgres stays on Neon (pooled URL), images on
Cloudinary. Render is retired after cutover (7-day rollback window).

## 0. Prerequisites (already in the repo)

- `vercel.json` (root) — install/build commands covering both halves
  (`cd backend && npm ci && cd ../frontend && npm ci`; build = backend `tsc`
  then frontend `vite build`), output `frontend/dist`, and rewrites:
  1. `/GDGoC-CTU-Main/v0.0.1/:path*` → `/api` (the API — MUST stay first,
     first matching rewrite wins),
  2. `/(.*)` → `/index.html` (SPA deep-link fallback).
- `package.json` (root, minimal) — pins `engines.node: 22.x` for Vercel's
  Node-version detection in the single-project layout. No dependencies, not a
  workspace.
- `api/index.ts` — serverless entry: dynamically imports the built app,
  logs import failures as structured JSON and rethrows (never serves from a
  half-loaded app).
- Database: a Neon **pooled** connection string (`…-pooler.<region>.neon.tech`).
  Direct (non-pooler) strings exhaust connections under serverless concurrency.

## 1. Vercel project settings (dashboard)

| Setting | Value |
|---|---|
| Root Directory | repo root (empty value — **not** `frontend/`; clear the old frontend-only setting) |
| installCommand / buildCommand / Output | taken from root `vercel.json` (shown above) |
| Node.js version | 22.x — detected from root `package.json` `engines` |

> **Inert file:** `frontend/vercel.json` never applies once Root Directory is the repo root — Vercel reads only the root `vercel.json` above (leave the file in place; it causes no double deploy).

## 2. Environment variables (Settings → Environment Variables)

Set on Production and Preview. Full list:

| Key | Value / notes |
|---|---|
| `DB_URL` | Neon **pooled** URL |
| `FR_ORIGIN` | `https://<domain>` — comma-separated allowlist if several (add `http://localhost:5173` only if you deploy to a shared backend used from local dev) |
| `CLOUDINARY_URL` | `cloudinary://<api_key>:<api_secret>@<cloud_name>` |
| `BETTER_AUTH_SECRET` | generate: `openssl rand -base64 32` |
| `BETTER_AUTH_URL` | `https://<domain>` — same origin as the frontend, no trailing `/` |
| `GOOGLE_CLIENT_ID` | optional — enables Google sign-in (with the secret below) |
| `GOOGLE_CLIENT_SECRET` | optional |
| `ADMIN_USER_IDS` | optional — comma-separated bootstrap admin user IDs |
| `VITE_API_URL` | `https://<domain>/GDGoC-CTU-Main/v0.0.1` — baked in at build; changing it requires a redeploy |
| `NODE_ENV` | leave unset — Vercel sets `production` (production logging = JSON on stdout) |
| `PORT` | not used on Vercel (dev entry only) |

## 3. Database migrations — required manual release step

Migrations never run at boot or deploy (serverless cold starts must not
migrate). After ANY schema change, before shipping the code that needs it:

```sh
cd backend
DB_URL=<pooled-prod-url> npm run db:migrate
```

Run once per release against the pooled production URL. CI only validates the
schema offline (`npm run db:generate`).

## 4. Deploy

1. Merge to `main` with CI green (backend: build + offline smoke + schema
   check; frontend: lint + build) → Vercel builds and deploys automatically.
2. Preview deploys live on `.vercel.app` origins that are **per-deployment**:
   session cookies are not shared across preview/production (and Safari ITP
   blocks workarounds). Run full auth flows on the production domain.
3. Liveness checks: `GET /`, `/health`, and `/GDGoC-CTU-Main/v0.0.1/health`
   all return the same JSON (the prefixed ones reach the function through the
   rewrite).

## 5. Verify end-to-end (production domain)

- [ ] Frontend loads; all public pages render with images.
- [ ] `GET https://<domain>/GDGoC-CTU-Main/v0.0.1/public/events` returns data (API + DB through the rewrite).
- [ ] No CORS errors in the browser console (`FR_ORIGIN` contains the domain; same-origin now).
- [ ] `/admin/login` sign-in reaches the admin dashboard — session cookie is
      SameSite=Lax + Secure on the single domain (Better Auth defaults;
      `BETTER_AUTH_URL` is https, proxy headers trusted).
- [ ] Multipart upload ≤4MB succeeds; a >4MB file returns HTTP 413 with a JSON message.
- [ ] Bulk upload path: `POST /GDGoC-CTU-Main/v0.0.1/media/sign-upload`
      returns signed params; file bytes go straight from the browser to
      Cloudinary (never through the function).
