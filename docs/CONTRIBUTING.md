# Contributing

Thanks for helping with the GDG-CTU website! This page explains how we work together. If any word is unfamiliar, ask — we'd rather explain than have you guess.

## Where tasks live: GitHub Issues

- **Tasks, bugs, and feature requests live in GitHub Issues.**
- If someone reports a bug in chat, an officer will file it as a GitHub issue. Pick tasks from the issue list, not from chat threads.
- Maintainers triage issues as they come in; link your PR on the issue when you open one.

## Branch naming (name your work clearly)

A **branch** is your private copy of the code to work on without breaking everyone else's. Create one per task from the latest `main`:

```bash
git checkout main
git pull
git checkout -b <type>/<short-description>
```

Branch types:

- `feat/` — a new feature (e.g. `feat/event-search`)
- `fix/` — a bug fix (e.g. `fix/gallery-blank-page`)
- `docs/` — documentation only (e.g. `docs/getting-started-photos`)
- `chore/` — cleanup, settings, tooling (e.g. `chore/update-deps`)

Use lowercase letters and dashes, no spaces.

## Commit style (save your work in small steps)

A **commit** is a saved snapshot of your changes. Write small commits with clear messages:

```text
<type>: <short summary in plain words>
```

- Same types as branches: `feat`, `fix`, `docs`, `chore`.
- Examples: `feat: add event search box`, `fix: handle missing gallery images`, `docs: clarify backend env setup`.
- Commit often; each commit should do one thing.

## Pull request (PR) checklist (asking to merge your work)

A **pull request** is how you ask maintainers to review and merge your branch into `main`. Before opening one:

- [ ] My branch is up to date with `main` (I ran `git pull origin main` and fixed any conflicts)
- [ ] Backend still runs (`cd backend`, `npm run dev`) and/or frontend still runs (`cd frontend`, `npm run dev`) — whichever I touched
- [ ] I ran `npm run lint` in `frontend/` if I changed frontend code, and fixed the warnings
- [ ] I ran `npm run build` in the folder I changed (`backend/` or `frontend/`) to prove it still compiles
- [ ] I didn't commit any `.env` files or secrets
- [ ] I linked the GitHub issue in the PR description
- [ ] Screenshots included if I changed anything visual

Keep PRs small (one task each) so review is fast. A maintainer will review; respond to comments and push fixes to the same branch.

## Code style (keep it consistent)

- **Backend:** TypeScript (JavaScript with type labels that catch mistakes early). Match the existing folder-per-feature layout in `backend/src/modules/`, validate incoming data with Zod (a "shape checker"), and log problems with Winston (the logging tool) instead of `console.log` where a logger exists.
- **Frontend:** plain JSX files (JavaScript + HTML mixed together, e.g. `App.jsx`). Reuse pieces from `src/components/`, call the backend only through `apiFetch` in `src/api/client.js` (it attaches your login token automatically), and keep page addresses in `src/App.jsx`.
- **Linting:** `oxlint` is our style checker (run `npm run lint` in `frontend/`). Fix what it flags before opening a PR.
- When in doubt, copy the style of the nearest existing file rather than inventing a new pattern.
