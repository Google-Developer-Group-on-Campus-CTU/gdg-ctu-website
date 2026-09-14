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

- `VITE_API_URL` — backend address **including** `/GDGoC-CTU-Main/v0.0.1` (local example: `http://localhost:3000/GDGoC-CTU-Main/v0.0.1`)
- `VITE_CLERK_PUBLISHABLE_KEY` — from the SAME Clerk app the backend uses

> After changing `.env`, restart the dev server — settings starting with `VITE_` load only at startup.

## Commands (run from `frontend/`)

| Command | What it does |
|---|---|
| `npm run dev` | Starts the site for coding with instant refresh (`vite`, usually at `http://localhost:5173`) |
| `npm run build` | Builds the publish-ready site into `dist/` |
| `npm run preview` | Shows the built site locally before publishing |
| `npm run lint` | Checks code style with `oxlint` (fix warnings before opening a PR) |

## Notes

- Page addresses live in `src/App.jsx` (public pages vs `/admin` pages guarded by `ProtectedRoute`).
- All backend calls go through `apiFetch` in `src/api/client.js` (it adds your login token automatically).
- Page refresh on `/about`, `/events`, etc. works online thanks to `vercel.json` (sends all addresses to `index.html`).
- Deploy goes to Vercel (root folder `frontend`, build `npm run build`, output `dist`) — full steps in `docs/deployment-plan.md`.
