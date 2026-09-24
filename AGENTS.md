# AGENTS.md — GDG-CTU Website + Admin CMS

Two separate npm projects, no workspace. Run commands from the touched side only: `backend/` (Express 5 + TS API) or `frontend/` (React 19 + Vite 8). Node 20 required (CI pins 20).

## Commands (exact)

- Backend: `npm run dev` (nodemon → `ts-node src/server.ts`), `npm run build` (`tsc`, also the typecheck — no lint/test), `npm start` (`node dist/server.js`), `npm run db:generate` (offline schema check), `npm run db:migrate` (needs live `DB_URL`).
- Frontend: `npm run dev` (vite), `npm run build` (`vite build`), `npm run lint` (`oxlint`), `npm run preview`. No tests or typecheck script.
- CI (`.github/workflows/ci.yml`, gates `main`): backend `npm ci && npm run build && npm run db:generate`; frontend `npm ci && npm run lint && npm run build`. Render/Vercel auto-deploy `main` on green.

## Env (never commit `.env`)

- Backend: `copy example.env .env`. Frontend: `copy .env.example .env`. Keys: backend `PORT,NODE_ENV,DB_URL,FR_ORIGIN,CLOUDINARY_URL,BETTER_AUTH_SECRET,BETTER_AUTH_URL,GOOGLE_CLIENT_ID,GOOGLE_CLIENT_SECRET,ADMIN_USER_IDS`; frontend only `VITE_API_URL`.
- Frontend auth is Better Auth (`frontend/src/lib/auth-client.ts`) pointed at `VITE_API_URL` — session is an HTTP-only cookie, no frontend auth keys. Missing `VITE_API_URL` = admin shows "disabled", public pages still work.
- Restart after any env change: backend `.env` and any `VITE_*` change require stopping + `npm run dev` (Vite bakes `VITE_*` at startup).

## API contract gotchas

- Base path: all backend routes mount at `/GDGoC-CTU-Main/v0.0.1` (`backend/src/server.ts:43`). `VITE_API_URL` must include it, e.g. `http://localhost:3000/GDGoC-CTU-Main/v0.0.1`.
- Auth: 401 = not signed in, 403 = signed in but not active admin. Writes go through `requireAuth` / protected router (`backend/src/modules/index.ts`); public reads live under `/public/*` + `/health`.
- CORS: `FR_ORIGIN` is a comma-separated allowlist of frontend origins (local: `http://localhost:5173`); each entry is trimmed and trailing `/` stripped, and in development any `localhost`/`127.0.0.1` loopback port is allowed. Origin missing from the list = browser CORS block; fix + restart backend.
- Frontend calls: use `apiFetch(path, opts)` from `frontend/src/api/client.js` — base is `VITE_API_URL`, always `credentials: 'include'` (the Better Auth session cookie rides along; no Authorization header). Throws with `error.status`/`error.body` on non-OK.
- Boot is all-or-nothing: `connectDB → Cloudinary → listen`, any failure exits (`server.ts:45-59`). Missing/wrong `DB_URL`/`CLOUDINARY_URL` = server won't start; missing `BETTER_AUTH_SECRET`/`BETTER_AUTH_URL` also exits at boot.

## Code layout

- Backend: `src/server.ts` entry; one dir per domain in `src/modules/` (admins, auth, events, event-*, team-members, media*, site-content, terms, partners, health, public); schema co-located at `src/modules/**/models/*.ts`, migrations emitted to `drizzle/` (postgres). Shared: `src/middleware/` (auth/validation/multer upload), `src/config/` (env/db/cloudinary), `src/utils/` (Winston `logger`, validation). Validate input with Zod, log with `logger` not `console.log`.
- Frontend: `index.html → src/main.jsx` (no auth provider needed) `→ src/App.jsx` (`BrowserRouter`). Public routes `/, /about, /team, /events[/:slug], /gallery[/:slug], /partners, /contact`; admin `/admin/login` open, everything else under `<ProtectedRoute><AdminShell>`. Keep both `vercel.json` SPA rewrites (`/(.*) → /index.html`) or deep links refresh to 404.

## DB / deploy

- Schema change: edit `src/modules/**/models/*.ts` → `npm run db:generate` → `npm run db:migrate` (prod DB once).
- Deploy order is backend-first: Render (`rootDir backend`, build `npm install && npm run build`, start `npm start`, health `/` — also `/health` and `/GDGoC-CTU-Main/v0.0.1/health` answer the same liveness JSON) → set Vercel `VITE_API_URL=<backend-url>/GDGoC-CTU-Main/v0.0.1` (root `vercel.json` builds `frontend/dist`) → set Render `FR_ORIGIN=<vercel-url>` + redeploy.

## Workflow

- Tasks live in Jira project `UTCGDG` — never use GitHub Issues. See `docs/agents/issue-tracker.md`.
- Branches `git checkout -b <type>/<short-desc>` from `main` (`feat/|fix/|docs/|chore/`, lowercase-dash); commits `<type>: <summary>`. One small task per PR, link the `UTCGDG` ticket, no secrets.
- Triage labels (five, as-is): `needs-triage|needs-info|ready-for-agent|ready-for-human|wontfix`. See `docs/agents/triage-labels.md`.
- Domain: single-context — read root `CONTEXT.md` + `docs/adr/` if present, use glossary terms verbatim, flag ADR conflicts. See `docs/agents/domain.md`.
