# Frontend (GDG-CTU website)

This is the website visitors see, plus the private `/admin` dashboard. For the full project guide, setup steps, and troubleshooting, see the **root [`README.md`](../README.md)** and [`docs/GETTING-STARTED.md`](../docs/GETTING-STARTED.md).

## Setup

```bash
cd frontend
npm install
copy .env.example .env
```

(On Mac/Linux: `cp .env.example .env`.)

Fill in `frontend/.env` (see `docs/GETTING-STARTED.md` for the walkthrough):

- `VITE_API_URL` — backend address **including** `/GDGoC-CTU-Main/v0.0.1` (local example: `http://localhost:3000/GDGoC-CTU-Main/v0.0.1`). Sign-in (Better Auth) runs behind this same base — no other frontend keys are needed.

> After changing `.env`, restart the dev server — settings starting with `VITE_` load only at startup.

## Commands (run from `frontend/`)

| Command | What it does |
|---|---|
| `npm run dev` | Starts the site for coding with instant refresh (`vite`, usually at `http://localhost:5173`) |
| `npm run build` | Builds the publish-ready site into `dist/` |
| `npm run preview` | Shows the built site locally before publishing |
| `npm run lint` | Checks code style with `oxlint` (fix warnings before opening a PR) |

## Notes

- Page addresses live in `src/App.jsx` (public pages vs `/admin` pages guarded by `ProtectedRoute`):

  | Address | Page |
  |---|---|
  | `/` | Home |
  | `/about` | About |
  | `/team` | Team (officers) — `/officers` redirects here |
  | `/partners` | Partners |
  | `/gallery`, `/gallery/:slug` | Gallery list / album detail |
  | `/events`, `/events/:slug` | Events list / event detail |
  | `/contact` | Contact |
  | `/admin/login`, `/admin/register` | Open (no session needed) |
  | `/admin` | Dashboard (guarded) |
  | `/admin/events`, `/admin/events/new`, `/admin/events/:id` | Events admin |
  | `/admin/team`, `/admin/team/new`, `/admin/team/:id` | Team admin |
  | `/admin/partners`, `/admin/partners/new`, `/admin/partners/:id` | Partners admin |
  | `/admin/gallery`, `/admin/gallery/albums/new`, `/admin/gallery/albums/:id` | Gallery admin |
  | `/admin/content`, `/admin/content/:sectionKey` | Content admin (list and new share one address) |
  | `/admin/media` | Media admin (list only) |
  | `/admin/invites`, `/admin/users`, `/admin/settings` | Admin management (guarded) |

  The `/admin/*` entity paths are defined once in `src/admin/editorial.js` (`ADMIN_ENTITY_ROUTES`) — don't hardcode them elsewhere.

- All backend calls go through `apiFetch` in `src/api/client.js` (it always sends cookies, so your sign-in session travels with every call). It aborts after 15 s (`error.status = 504`), turns a `204` response into `null`, and attaches `error.status` / `error.body` to failures — read those for user-facing messages.
- Sign-in is handled by Better Auth (`src/lib/auth-client.ts`) — email/password and Google, with the session stored in an HTTP-only cookie on the backend. New admins join via invite: an officer creates a link in `/admin/invites` → invitee opens `/admin/register?token=…` → signs in at `/admin/login` → the guard lets them into `/admin`. If `VITE_API_URL` is missing, every admin page shows the “Admin is not configured” card instead (`AdminDisabled`).
- Guarded pages are double-wrapped: `ProtectedRoute` checks the session (an 8 s timeout shows “Sign-in check timed out” instead of an endless spinner), then `AdminShell` provides the dashboard chrome. No session → straight back to `/admin/login`.
- Public content (home/about/etc. text) is cached for the SPA session — after editing content in the admin, **reload the page** to see it; public visitors always load fresh.
- Page refresh on `/about`, `/events`, etc. works online thanks to `vercel.json` (sends all addresses to `index.html`).
- `layouts/` is a legacy static prototype (plain HTML/CSS) — not imported by the app; ignore it.
- Deploy: backend first (Render), set `FR_ORIGIN` on the backend to the exact Vercel URL (no trailing `/`, or CORS blocks every call), then Vercel (root folder `frontend`, build `npm run build`, output `dist`) with `VITE_API_URL=<backend-url>/GDGoC-CTU-Main/v0.0.1` — full steps in `docs/deployment-plan.md`. Remember: any `VITE_*` change requires restarting the dev server / a fresh build.
