# Deployment Plan — GDG-CTU (separate backend + frontend)

Target: backend API on Render (or Railway) + React frontend on Vercel.
Order matters: **backend first** (its URL is needed for `FR_ORIGIN` and `VITE_API_URL`).

## 0. Prerequisites (do once)

- `backend/.env` filled with production values — set these in the host dashboard, never commit the file:
  `PORT` (injected by host — just reference it), `NODE_ENV=production`,
  `FR_ORIGIN=https://<frontend-url>` (exact match, no trailing slash),
  `CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY` (same Clerk app as the frontend),
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
| Health Check Path | `/GDGoC-CTU-Main/v0.0.1/admins` (public route) |

- Add all env vars from step 0 in the Render dashboard. `PORT` is injected automatically.
- API base path is `/GDGoC-CTU-Main/v0.0.1`; `/admins` is public, everything else requires Clerk auth.
- CORS allows exactly one origin (`FR_ORIGIN`) with credentials — must equal the Vercel URL.
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
- [ ] `GET <backend>/GDGoC-CTU-Main/v0.0.1/admins` returns data (proves DB + API).
- [ ] No CORS errors in browser console on API calls.
- [ ] `/admin/login` shows the GDG-CTU sign-in form; sign-in reaches the admin dashboard.
- [ ] Authenticated admin request (e.g. list events) succeeds.
