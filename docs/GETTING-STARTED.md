# Getting Started (for total beginners)

This guide assumes you've never set up a project like this before. Take it one step at a time — each step says what to do, what it means, and how to know it worked.

**Time needed:** about 30–60 minutes the first time (mostly waiting for installs and signing up for free accounts).

## Step 0: Install the tools

You need **Node.js** (runs JavaScript outside the browser) and **Git** (downloads and tracks code changes).

1. Install **Node.js 24 LTS** (LTS = the stable version everyone uses) from [nodejs.org](https://nodejs.org/). Accept the defaults.
2. Install **Git** from [git-scm.com/downloads](https://git-scm.com/downloads). Accept the defaults.
3. Open a terminal (on Windows: search "PowerShell") and check:

   ```bash
   node --version   # should print something like v24.x.x
   npm --version    # npm installs project libraries; it comes with Node
   git --version
   ```

   If a command is "not recognized," restart the terminal (or your computer) after installing and try again.

## Step 1: Download (clone) the project

"Cloning" means copying the project's code from the internet to your computer.

```bash
git clone <repo-url>
cd gdg-ctu-main
```

> Replace `<repo-url>` with the address your officer gives you. `cd` means "go into this folder."

## Step 2: Set up the backend (the server)

The **backend** is the part that stores data (events, team members, photos info) and checks who is allowed to change things. The **frontend** (website) asks the backend for data over the internet.

1. Go into the backend folder and install its libraries (small helper packages the code needs — this downloads them, takes a few minutes):

   ```bash
   cd backend
   npm install
   ```

2. Make your personal settings file. The project ships a blank template called `example.env`; you copy it to `.env` (your private copy — never share or upload it):

   ```bash
   copy example.env .env
   ```

   (On Mac/Linux the command is `cp example.env .env`.)

3. Open `backend/.env` in a text editor (Notepad, VS Code, anything). Fill in each line:

   | Setting | What to put |
   |---|---|
   | `PORT` | `3000` (the "door number" the server listens on — any free number works, `3000` is the usual) |
   | `NODE_ENV` | `development` (means "I'm coding on my own computer") |
   | `DB_URL` | Your database address — see "Free accounts" below (Neon). It looks like `postgresql://user:password@host/dbname` |
   | `FR_ORIGIN` | `http://localhost:5173` (the address of your website while coding — one origin, or several separated by commas; trailing `/` are trimmed automatically) |
   | `CLOUDINARY_URL` | Your image-service login — from Cloudinary, looks like `cloudinary://key:secret@name` |
   | `BETTER_AUTH_SECRET` | A random secret that signs login session cookies — generate one with `openssl rand -base64 32` (or any long random string) |
   | `BETTER_AUTH_URL` | `http://localhost:3000` (the backend's own address — no trailing `/`) |
   | `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | Optional — leave blank for local coding; fill both (from Google Cloud Console) to enable "Sign in with Google" |
   | `ADMIN_USER_IDS` | Optional — comma-separated user IDs treated as admins (see the note below) |

   > **First signup becomes the admin:** when the `user` table is empty, the very first account you create (in Step 5) is automatically promoted to admin. For any later officer, either give them the admin role in the database or add their user ID to `ADMIN_USER_IDS` and restart the backend.

4. Set up the database tables once (only after `DB_URL` is filled in):

   ```bash
   npm run db:generate   # creates the update file (safe, works offline)
   npm run db:migrate    # applies it to your database (needs DB_URL)
   ```

   - `db:generate` = "look at my code and write the database change file."
   - `db:migrate` = "apply those change files to the real database."

5. Start the backend (keep this terminal window open — closing it stops the server):

   ```bash
   npm run dev
   ```

   Success looks like: `Server is running on port 3000` in the terminal.

## Step 3: Free accounts you need (and where to click)

All of these have free plans that are enough for learning:

- **Neon (database — where all text/data is stored):** sign up at [neon.tech](https://neon.tech), create a project, copy the connection string into `DB_URL`. (Drizzle ORM — the tool our code uses to talk to the database — works with this automatically.)
- **Cloudinary (image hosting):** sign up at [cloudinary.com](https://cloudinary.com/), copy your `CLOUDINARY_URL` (found in your Cloudinary dashboard) into the backend `.env`.
- **Google Cloud Console (optional — only for "Sign in with Google"):** login itself needs no account — Better Auth runs inside the backend and stores passwords safely there. If you want the Google button too, create OAuth credentials at [console.cloud.google.com](https://console.cloud.google.com), set the redirect URI to `<BETTER_AUTH_URL>/GDGoC-CTU-Main/v0.0.1/api/auth/callback/google`, and copy the client ID/secret into the backend `.env`.
- Later, for publishing: **Render** (runs the backend online) at [render.com](https://render.com) and **Vercel** (runs the website online) at [vercel.com](https://vercel.com). You don't need these to code locally. Full publish steps: `docs/deployment-plan.md`.

## Step 4: Set up the frontend (the website)

Open a **second** terminal window (leave the backend running in the first one):

```bash
cd frontend
npm install
copy .env.example .env
```

(On Mac/Linux: `cp .env.example .env`.)

Open `frontend/.env` and fill in one line:

| Setting | What to put while coding locally |
|---|---|
| `VITE_API_URL` | `http://localhost:3000/GDGoC-CTU-Main/v0.0.1` — your backend address **including** `/GDGoC-CTU-Main/v0.0.1` (change `3000` if your backend `PORT` is different) |

Then start the website:

```bash
npm run dev
```

Success looks like a line saying `Local: http://localhost:5173/` — open that address in your browser.

> Why two terminals? The backend and frontend are separate programs that talk to each other. Both must be running at the same time.

## Step 5: Check that everything works

1. **Frontend loads:** open `http://localhost:5173` — you should see the GDG-CTU site (Home page).
2. **Backend answers:** open `http://localhost:3000/health` in your browser (change `3000` to your `PORT`). Seeing `"status":"ok"` in the JSON reply means the server works (`GET /` and `GET http://localhost:3000/GDGoC-CTU-Main/v0.0.1/health` answer the same). Seeing "connection refused" means the backend isn't running or the port is wrong.
3. **Login page shows:** open `http://localhost:5173/admin/login` — you should see the GDG-CTU sign-in form (email + password, or continue with Google).
4. **No red CORS errors:** press F12 in the browser → Console tab → click around the site. A "blocked by CORS policy" message means the frontend address isn't in the backend's `FR_ORIGIN` allowlist (one origin, or several separated by commas) — fix it, restart the backend (`Ctrl+C`, then `npm run dev` again).

## If something goes wrong

- Start with the Troubleshooting list in the root `README.md` (covers 401/403 login errors, CORS, blank pages, database errors).
- Frontend settings starting with `VITE_` only load when the site starts — after changing `frontend/.env`, stop (`Ctrl+C`) and re-run `npm run dev`.
- Backend settings load when the server starts — same rule: restart `npm run dev` after changing `backend/.env`.
- Still stuck? Ask in the club chat with: (1) what command you ran, (2) the full error text, (3) a screenshot. Don't paste your `.env` secrets.
