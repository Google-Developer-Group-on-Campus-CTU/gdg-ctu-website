# AGENTS.md — GDG-CTU Website + Admin CMS

Two separate npm projects, no workspace (the minimal root `package.json` exists only to pin Node 24 for Vercel's version detection). Run commands from the touched side only: `backend/` (Express 5 + TS API) or `frontend/` (React 19 + Vite 8). Node 24 required (CI pins 24).

## Commands (exact)

- Backend: `npm run dev` (nodemon → `ts-node src/server.ts`), `npm run build` (`tsc`, also the typecheck — no lint/test), `npm start` (`node dist/server.js`), `npm run db:generate` (offline schema check), `npm run db:migrate` (needs live `DB_URL`), `npm run smoke` (offline: imports `dist/`, asserts routes — run `npm run build` first).
- Frontend: `npm run dev` (vite), `npm run build` (`vite build`), `npm run lint` (`oxlint`), `npm run preview`. No tests or typecheck script.
- CI (`.github/workflows/ci.yml`, gates `main`): backend `npm ci && npm run build && npm run smoke && npm run db:generate`; frontend `npm ci && npm run lint && npm run build`. Vercel auto-deploys `main` on green (one project serves frontend + API).

## Env (never commit `.env`)

- Backend: `copy example.env .env`. Frontend: `copy .env.example .env`. Keys: backend `PORT,NODE_ENV,DB_URL,FR_ORIGIN,CLOUDINARY_URL,BETTER_AUTH_SECRET,BETTER_AUTH_URL,GOOGLE_CLIENT_ID,GOOGLE_CLIENT_SECRET,ADMIN_USER_IDS`; frontend only `VITE_API_URL`.
- Frontend auth is Better Auth (`frontend/src/lib/auth-client.ts`) pointed at `VITE_API_URL` — session is an HTTP-only cookie, no frontend auth keys. Missing `VITE_API_URL` = admin shows "disabled", public pages still work.
- Restart after any env change: backend `.env` and any `VITE_*` change require stopping + `npm run dev` (Vite bakes `VITE_*` at startup).

## API contract gotchas

- Base path: all backend routes mount at `/GDGoC-CTU-Main/v0.0.1` (`backend/src/app.ts`). `VITE_API_URL` must include it, e.g. `http://localhost:3000/GDGoC-CTU-Main/v0.0.1` (production: `https://<domain>/GDGoC-CTU-Main/v0.0.1`).
- Auth: 401 = not signed in, 403 = signed in but not active admin. Writes go through `requireAuth` / protected router (`backend/src/modules/index.ts`); public reads live under `/public/*` + `/health`.
- CORS: `FR_ORIGIN` is a comma-separated allowlist of frontend origins (local: `http://localhost:5173`); each entry is trimmed and trailing `/` stripped, and in development any `localhost`/`127.0.0.1` loopback port is allowed. Origin missing from the list = browser CORS block; fix + restart backend.
- Frontend calls: use `apiFetch(path, opts)` from `frontend/src/api/client.js` — base is `VITE_API_URL`, always `credentials: 'include'` (the Better Auth session cookie rides along; no Authorization header). Throws with `error.status`/`error.body` on non-OK.
- Boot: the dev entry (`src/server.ts`) runs config checks → imports the app → `connectDB` ping → Cloudinary ping → `listen`, exiting(1) on failure. Vercel has no boot step — `api/index.ts` imports `backend/dist/app.js` per cold start, so missing `BETTER_AUTH_SECRET`/`BETTER_AUTH_URL`/`FR_ORIGIN` fails that import loudly (structured JSON log, invocation errors); wrong `DB_URL` fails the first query; `PORT` is dev-only.

## Code layout

- Backend: `src/app.ts` (side-effect-free Express assembly) + `src/server.ts` (dev entry — listens; the only `process.exit` in `src/`); repo-root `api/index.ts` is the Vercel handler. One dir per domain in `src/modules/` (admins, auth, events, event-*, team-members, media*, site-content, terms, partners, health, public); schema co-located at `src/modules/**/models/*.ts`, migrations emitted to `drizzle/` (postgres). Shared: `src/middleware/` (auth/validation/multer upload), `src/config/` (env/db/cloudinary), `src/utils/` (Winston `logger`, validation). Validate input with Zod, log with `logger` not `console.log`.
- Frontend: `index.html → src/main.jsx` (no auth provider needed) `→ src/App.jsx` (`BrowserRouter`). Public routes `/, /about, /team, /events[/:slug], /gallery[/:slug], /partners, /contact`; admin `/admin/login` open, everything else under `<ProtectedRoute><AdminShell>`. The SPA fallback lives in the ROOT `vercel.json` (`/(.*) → /index.html`, ordered AFTER the API rewrite) or deep links refresh to 404; `frontend/vercel.json` is inert once Root Directory is the repo root.

## DB / deploy

- Schema change: edit `src/modules/**/models/*.ts` → `npm run db:generate` → `npm run db:migrate` (prod, manual release step: run in `backend/` against the pooled `DB_URL` before shipping the code that needs it — migrations never run at boot or deploy).
- Deploy is one Vercel project (Root Directory = repo root, Node 24 via root `engines`): root `vercel.json` installs/builds `backend/` then `frontend/` and rewrites `/GDGoC-CTU-Main/v0.0.1/*` → `/api` BEFORE the SPA fallback `/(.*) → /index.html`. Liveness `GET /` (also `/health` and `/GDGoC-CTU-Main/v0.0.1/health`) answers the same JSON. Full env list + runbook: `docs/deployment-plan.md`.

## Workflow

- Tasks live in GitHub Issues.
- Branches `git checkout -b <type>/<short-desc>` from `main` (`feat/|fix/|docs/|chore/`, lowercase-dash); commits `<type>: <summary>`. One small task per PR, link the GitHub issue, no secrets.
- Domain: single-context — read root `CONTEXT.md` + `docs/adr/` if present, use glossary terms verbatim, flag ADR conflicts. See `docs/agents/domain.md`.
