# Deployment Plan — GDG-CTU (separate backend + frontend)

Target: backend API on Render (or Railway) + React frontend on Vercel.
Order matters: **backend first** (its URL is needed for `FR_ORIGIN` and `VITE_API_URL`).

## 0. Prerequisites (do once)

- `backend/.env` filled with production values — set these in the host dashboard, never commit the file:
  `PORT` (injected by host — just reference it), `NODE_ENV=production`,
  `FR_ORIGIN=https://<frontend-url>` (one origin, or several comma-separated — each is trimmed and any trailing `/` stripped),
  `BETTER_AUTH_SECRET` (generate: `openssl rand -base64 32`), `BETTER_AUTH_URL=https://<backend-url>` (backend origin, no trailing `/`),
  optional `GOOGLE_CLIENT_ID` + `GOOGLE_CLIENT_SECRET` (enables "Sign in with Google"), optional `ADMIN_USER_IDS` (comma-separated bootstrap admin user IDs),
  `DB_URL` (Neon Postgres), `CLOUDINARY_URL`.
- Run DB migrations against the production database once: `npm run db:migrate` from `backend/`
  (needs `DB_URL` set; or use the host's one-off job / release command feature).
- Push branch `chore/repo-cleanup` (or merge it to `main` first and deploy from `main`).

## 1. Backend → Render

| Setting | Value |
|---|---|
| Root Directory | `backend` |
| Build Command | `npm install && npm run build` (`tsc` → `dist/`) |
| Start Command | `npm start` (`node dist/server.js`) |
| Node version | 20 LTS |
| Health Check Path | `/` (public liveness — Render's default probe; `/health` and `/GDGoC-CTU-Main/v0.0.1/health` return the same JSON) |

- Add all env vars from step 0 in the Render dashboard. `PORT` is injected automatically.
- API base path is `/GDGoC-CTU-Main/v0.0.1`; liveness (`/`, `/health`) and reads under `/public/*` are open, everything else (including `/admins`) requires an active-admin Better Auth session (`401`/`403` otherwise).
- CORS allows only the origin(s) listed in `FR_ORIGIN` (comma-separated allowlist) with credentials — must include the Vercel URL.
- Note: Winston writes to `logs/`; Render's filesystem is ephemeral, so logs don't persist across deploys.

## 2. Frontend → Vercel

| Setting | Value |
|---|---|
| Root Directory | `frontend` — set it on the import screen (Root Directory → Edit). For an existing project: Settings → General → Root Directory. CLI alternative: `cd frontend && vercel` (no dashboard setting needed) |
| Build Command | `npm run build` |
| Output Directory | `dist` |
| Env vars | `VITE_API_URL=https://<render-backend>/GDGoC-CTU-Main/v0.0.1` |

- React Router needs an SPA fallback, otherwise refresh on `/about`, `/events`, etc. returns 404.
  Add `frontend/vercel.json`:
  ```json
  { "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }] }
  ```

## 3. Wire them together

1. Deploy backend → copy its public URL.
2. Set `VITE_API_URL` on Vercel to `<backend-url>/GDGoC-CTU-Main/v0.0.1`, redeploy frontend.
3. Set `FR_ORIGIN` on Render to the exact Vercel URL, redeploy backend.

## 4. Verify end-to-end

- [ ] Frontend loads; all public pages render with images.
- [ ] `GET <backend>/` (or `/health`) returns `{"status":"ok"}` (proves the server is alive); a public read like `GET <backend>/GDGoC-CTU-Main/v0.0.1/public/events` returns data (proves DB + API).
- [ ] No CORS errors in browser console on API calls.
- [ ] `/admin/login` shows the GDG-CTU sign-in form; sign-in reaches the admin dashboard.
- [ ] Authenticated admin request (e.g. list events) succeeds.
