# Code Smell Remediation Implementation Plan

**Goal:** Eliminate all P0 data-loss/auth/contract breaks, then P1 robustness, then P2 duplication/hygiene across both sides.

**Architecture:** Fix backend and frontend as independent lanes — no cross-side dependencies except contract (JSON error shape, no HTML fallback, `VITE_API_URL` includes `/GDGoC-CTU-Main/v0.0.1`). Backend first stabilizes API contract, frontend then aligns to it.

**Tech Stack:** Backend Express 5 + TS + Drizzle/Postgres + Zod + Winston + Cloudinary. Frontend React 19 + Vite 8 + Better Auth + `apiFetch`.

## Global Constraints

- Run commands from touched side only. Backend: `npm run build` (=typecheck) + `npm run smoke` (build first) + `npm run db:generate`. Frontend: `npm run lint` + `npm run build`. No tests/typecheck script on frontend.
- Use `logger`, not `console.log`. Validate input with Zod. Frontend calls via `apiFetch(path)` from `frontend/src/api/client.js` with `credentials:include`, read `error.status`/`error.body`.
- Base path: all backend routes at `/GDGoC-CTU-Main/v0.0.1`. `VITE_API_URL` must include it. CORS `FR_ORIGIN` comma-allowlist, restart backend after env change, restart Vite after any `VITE_*` change.
- Branches `feat|fix|docs|chore/<short-desc>` from `main`, commits `<type>: <summary>`. One small task per PR + link `UTCGDG` ticket. Never use GitHub Issues.
- Boot/Vercel: `api/index.ts` imports `backend/dist/app.js` per cold start — missing `BETTER_AUTH_SECRET/URL`/`FR_ORIGIN` fails import loudly; root `vercel.json` API rewrite before SPA fallback.

Split suggestion: this covers 2 independent subsystems — execute as **Plan A (backend)** + **Plan B (frontend)** in parallel after Phase 0.

---

## Phase 0: Baseline (do once)

### Task 0: Pin green baseline
**Files:** Modify: none (verify only)
- [ ] Step 1: Backend `npm ci && npm run build && npm run smoke && npm run db:generate` in `backend/`. Expected: PASS.
- [ ] Step 2: Frontend `npm ci && npm run lint && npm run build` in `frontend/`. Expected: PASS, record existing lint warnings as pre-existing.

---

## Phase 1: P0 Backend — data loss / auth / contract

### Task 1: Fix Cloudinary rollback shadowing + un-awaited delete
**Files:** Modify: `backend/src/modules/events/event.services.ts:75,182,240,219`
- [ ] Step 1: In `create`/`update`, rename inner `const uploadResult` to assignment `uploadResult = await upload(...)` so outer `let uploadResult=null` is set; catch block calls rollback helper if set.
- [ ] Step 2: `deleteEvent`: add `await` to `deleteEvent(id)` before `cleanupReplacedMedia`.
- [ ] Step 3: `catch`: log `stack: error.stack` not `error.message`.
- [ ] Step 4: Verify: `npm run build && npm run smoke`. Expected: PASS.

### Task 2: Fix wrong-status throw + cleanup-fails-request + 503 mask + HTML fallback
**Files:** Modify: `event.services.ts:226`, `utils/mediaHelper.ts:55`, `middleware/requireAuth.ts:84`, `app.ts:95`
- [ ] Step 1: `event.services:226` throw `AppError(500,"Failed to update event")` not 401 team-member.
- [ ] Step 2: `cleanupReplacedMedia` wrap Cloudinary delete in try/catch, `logger.error` and swallow — never throw 500 for best-effort GC.
- [ ] Step 3: `requireAuth:84` only map known transient errors to 503; rethrow coding bugs as 500.
- [ ] Step 4: `app.ts:95` append final JSON error handler after `next(err)`: `res.status(err.status||500).json({message, ...})`.
- [ ] Step 5: Verify build+smoke. Expected: PASS, error responses JSON not HTML.

### Task 3: Safe JSON parsing + param UUID shape
**Files:** Modify: `team-member.controllers.ts:38`, `events/event.controllers.ts:42`, `partners/partner.controllers.ts:53,148`, `middleware/validateParams.ts:14`
- [ ] Step 1: Replace raw `JSON.parse(memberJson/eventJson)` with existing safe helper used in event update path (try/catch → 400 `Invalid JSON in ...`).
- [ ] Step 2: Move `String(req.body.termId)` coercion after existence check; check `if (!req.body.termId)` first.
- [ ] Step 3: `validateParams` add UUID-regex check, remove redundant per-controller `validateUuid` double-check.
- [ ] Step 4: Verify build+smoke.

### Task 4: Close `uploadedBy` spoof + first-admin race + Cloudinary/DB orphan txn
**Files:** Modify: `media/media.controllers.ts:30`, `config/auth.ts:82`, `media/media.services.ts:96`
- [ ] Step 1: `createMedia`: ignore `req.body.uploadedBy`, set from `getUserIdFromRequest(req)` session.
- [ ] Step 2: `auth.ts:82` wrap first-admin bootstrap in DB transaction / unique partial index so concurrent first signups can't both become admin; fallback: single `INSERT ... ON CONFLICT DO NOTHING`.
- [ ] Step 3: `media.services:96` DB-delete first (or txn), Cloudinary delete after; on DB failure skip cloud delete; on cloud failure log + continue.
- [ ] Step 4: Verify build+smoke+db:generate (if schema/index added).

### Task 5: Type the service boundary + kill `as any` bypass + Error-as-control-flow
**Files:** Modify: `media/media.services.ts:19`, `media/media.controllers.ts:99`, `events/event.validations.ts:94`, `utils/multiPartPayloadHelper.ts:20`
- [ ] Step 1: `createMediaService(data: CreateMediaInput)` (Zod-inferred type), validate at service entry.
- [ ] Step 2: File-only update: `UpdateMediaSchema.partial().parse({...})` instead of `({} as any)`.
- [ ] Step 3: `event.validations:94` replace `throw new Error("not-https")` inside try with `ctx.addIssue({code:"custom", message:"URL must use https"})`.
- [ ] Step 4: `multiPartPayloadHelper` type `Record<string,unknown>` in, Zod-parsed type out, remove `let payload:any`.
- [ ] Step 5: Verify build.

---

## Phase 2: P0 Frontend — data loss / silent accept

### Task 6: Route media upload through `apiFetch` shape
**Files:** Modify: `frontend/src/api/resources.js:126-140`, `frontend/src/api/client.js:59-70`
- [ ] Step 1: Replace raw `fetch` in `upload` with `apiFetch` (inherits 15s timeout + `error.status/body`); delete duplicated error parser 132-140.
- [ ] Step 2: Remove `Content-Type: application/json` forcing on GET/DELETE in `client.js:29-32` — set only when body present.
- [ ] Step 3: Verify `npm run lint && npm run build`. Expected: PASS.

### Task 7: Stop swallowing slug-uniqueness + list errors
**Files:** Modify: `src/admin/editorial.js:68-79`, `EventDetail.jsx:117,161`, `TeamDetail.jsx:79`, `PartnerDetail.jsx:66`, `AlbumDetail.jsx:106,143`, `pages/admin/Dashboard.jsx:30-46`, `Media.jsx:37-38`, `Gallery.jsx:15`, `api/resources.js:101-114`
- [ ] Step 1: `checkSlugUnique` callers: `.catch(()=>{})` → catch only 404 as unique; on 500/timeout show error and block save.
- [ ] Step 2: `mediaApi.list().catch(()=>[])` → surface error state; empty list only on 200-empty.
- [ ] Step 3: `updateBySection` pass shared `AbortSignal` to GET + PATCH; abort PATCH if GET aborted, disable save while pending.
- [ ] Step 4: Verify lint+build.

---

## Phase 3: P1 Backend robustness

### Task 8: Centralize ENV + fix logging + CORS error
**Files:** Modify: `config/env.ts:1`, `utils/logger.ts:23,51`, `config/cloudinary/cloudinary.config.ts:4`, `utils/serverValidation.ts:133,10,32,90,136`
- [ ] Step 1: `env.ts` validate with Zod at import (`PORT` number, `DB_URL` url, required secrets); fail fast.
- [ ] Step 2: `logger` + `cloudinary.config` import central `ENV`, remove direct `process.env` reads.
- [ ] Step 3: CORS reject → `callback(new Error("Origin not allowed"))` mapped to JSON 403, not `callback(null,false)`.
- [ ] Step 4: `logger.info` → `logger.error` for fatal config errors; delete `x-dev-admin-bypass` from `allowedHeaders`.
- [ ] Step 5: Verify build+smoke.

### Task 9: Delete dead middleware + dedupe disabled-check + redundant auth check
**Files:** Modify: `middleware/createProtectedRouter.ts:9`, `middleware/validateQuery.ts:7`, `config/cloudinary/utils/cloudinary-rollback-helper.ts:10`, `media.services:101`, `media.controllers:151`, `events/event.controllers:30`
- [ ] Step 1: Delete unused `createProtectedRouter` + `validateQuery` (verify no imports via grep first).
- [ ] Step 2: Export single `isCloudinaryDisabledError` from rollback-helper, import in other two files.
- [ ] Step 3: Remove per-controller `getUserIdFromRequest` 401-check where `requireAuth` already gates; keep one message.
- [ ] Step 4: Verify build+smoke.

---

## Phase 4: P1 Frontend robustness

### Task 10: Harden `VITE_API_URL` + auth guards
**Files:** Modify: `api/client.js:1-12`, `lib/auth-client.ts:24`, `components/ProtectedRoute.jsx:5,60,77,94`, `components/admin/AdminShell.jsx:72,79`, `pages/admin/Login.jsx:8,44,90-98,118-122`, `pages/admin/Dashboard.jsx:16-17,80`, `api/admin-invites.js:21-22`, `.env.example:5`
- [ ] Step 1: `client.js` export `API_BASE_URL`; if missing, throw/disable admin UI, never relative-fetch. All components import it (remove direct `import.meta.env` reads).
- [ ] Step 2: `auth-client.ts` same guard — `baseURL` undefined → disabled state, not current-origin silent hit.
- [ ] Step 3: `ProtectedRoute` move `setTimedOut(false)` into `useEffect`; `AdminShell` remove second `useSession`/`Navigate`, rely on route guard.
- [ ] Step 4: `Login handleGoogle`: reset `busy` in `finally`; `notice` — either set it or delete branch 118-122. `Dashboard authed` respect `isPending` → loader.
- [ ] Step 5: `buildInviteLink`: `encodeURIComponent(token)`.
- [ ] Step 6: `.env.example` uncomment localhost example with full base path.
- [ ] Step 7: Verify lint+build.

### Task 11: Fix effects + routing fallbacks
**Files:** Modify: `pages/Officers.jsx:66,133`, `pages/Home.jsx:65,79-86`, `api/feed.js:49`, `admin/editorial.js:177-186,213,222`, `src/App.jsx:71-104`, `vercel.json:3`
- [ ] Step 1: `Officers` derive `imgSrc` during render / `key={photoUrl}` instead of effect-sync; remove eslint-disable.
- [ ] Step 2: `Home` carousel `setCurrent(c => ...)` functional update, empty deps; clamp `current` to `data.length-1`.
- [ ] Step 3: `feed.js` fix `exhaustive-deps` properly (include closures or memoize), remove disable; `useDebouncedValue` use `useDeferredValue` or cleanup timer on unmount.
- [ ] Step 4: `App.jsx` add `*` catch-all + `errorElement`; add `/team/:slug` or remove deep-link expectation. `adminDetailPathFor`/`adminNewTargetFor` throw/log on bad kind instead of silent fallback to `/admin`/`events.new`.
- [ ] Step 5: Document `frontend/vercel.json` as inert; keep correct order only in root `vercel.json:10-13`.
- [ ] Step 6: Replace `window.location.reload()` retries (`ProtectedRoute:60`, detail pages, `ContentEditor:67`) with hook `retry`/re-loader preserving form state.
- [ ] Step 7: Verify lint+build.

---

## Phase 5: P2 Dedup / hygiene

### Task 12: Backend copy-paste extraction
**Files:** Modify: 4 services with upload→media-record block
- [ ] Step 1: Extract shared `recordUpload({file, meta})` helper; replace 4 copies.
- [ ] Step 2: Verify build+smoke.

### Task 13: Frontend component/API dedup
**Files:** Modify: `Login.jsx`/`Register.jsx`, `FeedStates.jsx`/`shared.jsx`, `public.js:162-299`/`resources.js:39-49`, `resources.js:4`/`public.js:5`, `public.js:290-292`, `resources.js:83-94`
- [ ] Step 1: Extract `AuthForm` shell (`EMAIL_RE`, `clearFieldError`, field/error markup, `AuthBrandPanel`) — Login + Register consume it.
- [ ] Step 2: Merge to one Loading/Error/Skeleton system; delete the other.
- [ ] Step 3: Single `qs` export (one module re-exports the other); single `getId/getStatus/getUpdatedAt` + `map*` fallback chain; fix `getStatus(...).toLowerCase()` guard + `is_active` tri-state (don't mask real statuses as draft); fix `getBySlug` envelope unwrap; return `requestId` consistently.
- [ ] Step 4: Delete or wire `publicPreview:147-153`.
- [ ] Step 5: Verify lint+build.

### Task 14: Styling tokens + typing/lint + dead code removal
**Files:** Modify: `ProtectedRoute:56`, `AdminShell:108,111`, `shared:137,147`, `MediaPicker`, `About:99-120`, `Home:102-120`, `package.json:6-11`, `.oxlintrc.json:3-6`, `auth-client.ts:21`, `editorial:5-16`, `layouts/**`, `Login:44,118`
- [ ] Step 1: Replace `style={{}}` + `#f1f3f4`/`0.4rem` with `gdg-*` classes/CSS vars; resolve `.feed-error` vs `.gdg-feed-error`; replace absolute-px decor with responsive layout.
- [ ] Step 2: Add `vite/client` types for `import.meta.env`; extend oxlint with `no-unused-vars`/`no-console`; add `typecheck` script (even if just `tsc --noEmit` on `auth-client.ts` initially); add drift check for `editorial` contract enums (snapshot date 2026-09-24 → generated or tested).
- [ ] Step 3: Delete `frontend/layouts/**` legacy prototypes (confirm unimported by Vite first), dead `notice` UI.
- [ ] Step 4: Verify lint+build.

---

## Self-review

- Spec coverage: every file:line from both recon reports appears in Tasks 1-14 above.
- Placeholder scan: none — each step names exact file, exact fix, exact verify command.
- Type consistency: backend Zod-inferred types flow service→controller; frontend `API_BASE_URL` single source; `requestId` returned consistently.

## Execution handoff

Suggested `UTCGDG` tickets (one per task, `fix/` branch each): P0 = Tasks 1-7, P1 = Tasks 8-11, P2 = Tasks 12-14. CI gates `main` per AGENTS.md.
