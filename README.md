# GDG-CTU Website + Admin CMS

Welcome! This is the official website for **Google Developer Groups on Campus – Cebu Technological University (GDG-CTU)**, plus a built-in **Admin CMS** (Content Management System — a private dashboard where officers can edit website content without touching code).

**New here and a student?** Start with [`docs/GETTING-STARTED.md`](docs/GETTING-STARTED.md) — it walks you through everything step by step, no experience needed.

## What this project is

A public club website (home, about, team, events, gallery, partners, contact) whose content is edited through a private `/admin` dashboard. Officers log in, update events/photos/text, and the public pages show the changes automatically.

## Features

- Public pages: Home, About, Team/Officers, Events, Gallery, Partners, Contact
- Admin dashboard at `/admin`: manage events, team members, partners, gallery albums, site text, media uploads, and settings
- Login with Better Auth (email/password + Google — the backend keeps passwords, the browser keeps the session cookie)
- Public reads, login-required writes: anyone can view the site, only signed-in active admins can change things
- Image uploads with Cloudinary (an image-hosting service) with a 4 MB file limit
- Versioned API (application programming interface — the backend's set of URLs the frontend calls), so future changes don't break the current site

## Tech stack

| Area | Tools |
|---|---|
| Frontend (what visitors see) | React 19, React Router 7, Vite 8, Better Auth React (sign-in form) |
| Backend (the server that stores data) | Node + Express 5, TypeScript, Drizzle ORM (tool that talks to the database) + Postgres (Neon), Better Auth (checks logins — HTTP-only session cookie), Cloudinary (image storage), Zod (checks that incoming data has the right shape), Winston (writes server logs) |
| Hosting (where it runs online) | One Vercel project for frontend + API; database on Neon, images on Cloudinary |

## Prerequisites

You need these installed before starting (all free):

- **Node.js 22 LTS** (LTS = Long-Term Support, the stable version) — [download](https://nodejs.org/)
- **npm** (comes with Node.js — it installs project libraries)
- **Git** — [download](https://git-scm.com/downloads)

You will also need free accounts later (explained in Getting Started): Neon (database), Cloudinary (images), Vercel (hosting — frontend and API on one project). Login itself needs no account — Better Auth runs inside the backend — but a Google Cloud Console project is optional if you want "Sign in with Google".

Check your setup:

```bash
node --version   # should show v22.x
npm --version
git --version
```

## 5-minute quickstart

```bash
# 1. Clone the project (downloads the code to your computer)
git clone <repo-url>
cd gdg-ctu-main

# 2. Install the backend (server) libraries
cd backend
npm install

# 3. Create the backend settings file and fill it in (see docs/GETTING-STARTED.md)
copy example.env .env

# 4. Start the backend (leave this terminal window running)
npm run dev

# 5. Open a NEW terminal window, then install and start the frontend (website)
cd frontend
npm install
copy .env.example .env
npm run dev
```

Then open:

- Frontend (website): `http://localhost:5173` (Vite's default address — check your terminal if different)
- Backend check: `http://localhost:<PORT>/health` (replace `<PORT>` with the `PORT` value in your backend `.env`, e.g. `3000`). If you see `"status":"ok"` in the JSON reply, the backend works. (`GET /` and `GET /GDGoC-CTU-Main/v0.0.1/health` answer the same — pick whichever your host probes.)

> New to all this? Follow [`docs/GETTING-STARTED.md`](docs/GETTING-STARTED.md) instead — it explains every step including how to fill in the `.env` files.

## Project structure

```text
gdg-ctu-main/
├── README.md                  ← you are here
├── backend/                   ← server (stores data, checks logins, serves the API)
│   ├── example.env            ← template for backend settings (copy to .env)
│   ├── package.json           ← backend libraries + scripts
│   └── src/
│       ├── server.ts          ← starts the server, connects everything at /GDGoC-CTU-Main/v0.0.1
│       ├── config/            ← database, Cloudinary, settings setup
│       ├── modules/           ← one folder per feature (events, team, gallery, ...)
│       ├── middleware/        ← checks that run before requests (login checks, etc.)
│       └── utils/             ← helpers (logs, validation)
├── frontend/                  ← website visitors see (React app)
│   ├── .env.example           ← template for frontend settings (copy to .env)
│   ├── vercel.json            ← lets page refresh work on About/Events/etc.
│   └── src/
│       ├── main.jsx           ← starts the app (auth needs no provider)
│       ├── App.jsx            ← page addresses (public pages vs /admin pages)
│       ├── api/client.js      ← apiFetch helper the pages use to call the backend
│       ├── pages/             ← one file per page (Home, Events, admin screens, ...)
│       └── components/        ← reusable pieces (Navbar, Footer, ProtectedRoute, ...)
└── docs/                      ← guides and plans (see Docs links below)
```

## Environment variables (settings files)

Never commit real `.env` files — they hold secrets like passwords and keys.

**Backend** (`backend/example.env` → copy to `backend/.env`):

| Variable | What it is |
|---|---|
| `PORT` | Which door number the server listens on (e.g. `3000`) |
| `NODE_ENV` | `development` on your computer, `production` when live online |
| `DB_URL` | Connection address for the Postgres database (from Neon) |
| `FR_ORIGIN` | Frontend address(es) allowed to call the backend — one origin, or several separated by commas (e.g. `http://localhost:5173`); trailing slashes are trimmed automatically |
| `CLOUDINARY_URL` | Login address for image uploads (from Cloudinary) |
| `BETTER_AUTH_SECRET` | Secret that signs/encrypts login session cookies — generate once with `openssl rand -base64 32` |
| `BETTER_AUTH_URL` | Public backend address, e.g. `http://localhost:3000` (no path, or the full `/GDGoC-CTU-Main/v0.0.1/api/auth` path) |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | Optional — from Google Cloud Console; "Sign in with Google" stays hidden until both are set |
| `ADMIN_USER_IDS` | Optional — comma-separated Better Auth user IDs treated as admins (bootstrap for later officers) |

**Frontend** (`frontend/.env.example` → copy to `frontend/.env`):

| Variable | What it is |
|---|---|
| `VITE_API_URL` | Full backend address **including** `/GDGoC-CTU-Main/v0.0.1` (e.g. `http://localhost:3000/GDGoC-CTU-Main/v0.0.1`) — sign-in (Better Auth) runs behind this base too |

## Scripts (commands you can run)

**Backend** (run from `backend/`):

| Command | What it does |
|---|---|
| `npm run dev` | Starts the server for coding (auto-restarts when you save; uses `nodemon`) |
| `npm run build` | Converts TypeScript to JavaScript into `dist/` (needed before going live) |
| `npm start` | Runs the built server (`node dist/server.js`) |
| `npm run db:generate` | Creates a database update file from your code changes (needs no live DB) |
| `npm run db:migrate` | Applies update files to the real database (needs `DB_URL` set) |

**Frontend** (run from `frontend/`):

| Command | What it does |
|---|---|
| `npm run dev` | Starts the website for coding with instant refresh (`vite`) |
| `npm run build` | Builds the final website into `dist/` for publishing |
| `npm run preview` | Shows you the built website locally before publishing |
| `npm run lint` | Checks your code style with `oxlint` (reports mistakes, doesn't run the site) |

## Auth + data in 5 lines

1. Visitors browse public pages freely; editing anything needs an admin sign-in.
2. Not logged in = error `401`; logged in but not an active admin = error `403`.
3. Every backend URL starts with `/GDGoC-CTU-Main/v0.0.1` (the versioned base path).
4. The backend only answers the frontend address(es) listed in `FR_ORIGIN` — a comma-separated allowlist (this is CORS — a browser safety rule), and the frontend must point `VITE_API_URL` at the backend.
5. Data lives in Postgres via Drizzle (reads go straight to the database), images in Cloudinary (4 MB max per request; bulk uses signed direct-to-Cloudinary uploads); pages find things by `slug` (URL-friendly name) and `site_content` keys, and items have a `status` (e.g. draft/published).

## Docs links

- [`docs/GETTING-STARTED.md`](docs/GETTING-STARTED.md) — total-beginner setup walkthrough
- [`docs/ARCHITECTURE-OVERVIEW.md`](docs/ARCHITECTURE-OVERVIEW.md) — how the pieces fit together (student summary)
- [`docs/gdg_backend_architecture.md`](docs/gdg_backend_architecture.md) — full backend design (24 modules, diagrams, database tables)
- [`docs/admin-cms-spec.md`](docs/admin-cms-spec.md) — Admin CMS rules (spec v0.4)
- [`docs/deployment-plan.md`](docs/deployment-plan.md) — how to publish (single Vercel project)
- [`docs/CONTRIBUTING.md`](docs/CONTRIBUTING.md) — how to contribute

## Contributing

We'd love your help! Please read [`docs/CONTRIBUTING.md`](docs/CONTRIBUTING.md) first. Quick note: **tasks live in Jira (project `UTCGDG`) — do NOT use GitHub Issues.** See `docs/agents/issue-tracker.md` for the Jira site address.

## Deploy (3 lines)

1. Everything ships from **one Vercel project** (Root Directory = repo root): root `vercel.json` installs and builds `backend/` (TypeScript → `dist/`) then `frontend/`, and routes `/GDGoC-CTU-Main/v0.0.1/*` to the API function before the SPA fallback — push to `main` deploys.
2. Set the Vercel env vars from the deployment plan (`DB_URL` = Neon **pooled** URL, `VITE_API_URL=https://<domain>/GDGoC-CTU-Main/v0.0.1`, `FR_ORIGIN=https://<domain>`, Better Auth + Cloudinary keys); after any schema change run `npm run db:migrate` in `backend/` against the pooled URL — once per release, by hand.
3. Full steps, env list, and checklist: [`docs/deployment-plan.md`](docs/deployment-plan.md).

## Troubleshooting (5 common errors)

1. **`401 Unauthorized` from the API** — you're not signed in (or the Better Auth session cookie is missing/expired — sessions last 7 days). Sign in through `/admin/login` and retry.
2. **`403 Forbidden` after logging in** — your account isn't an active admin. Ask an officer to activate your account.
3. **CORS error in the browser console** (`blocked by CORS policy`) — the frontend origin isn't in the backend's `FR_ORIGIN` allowlist (one origin, or several separated by commas; trailing `/` are trimmed). Fix `.env` and restart the backend.
4. **Blank page / API calls fail after editing `.env`** — frontend env vars starting with `VITE_` are baked in at startup: restart `npm run dev` and check `VITE_API_URL` includes `/GDGoC-CTU-Main/v0.0.1`.
5. **Backend won't start / DB errors** — `DB_URL` (or `CLOUDINARY_URL`) is missing or wrong. Compare with `backend/example.env`, check for typos/extra spaces, then run `npm run db:migrate` once the database address is correct.

## License

No license file yet — all rights reserved by default. (Maintainers: add a `LICENSE` file to state reuse terms.)
