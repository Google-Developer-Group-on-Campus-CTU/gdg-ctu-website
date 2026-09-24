# GDG-CTU Admin CMS — Website Spec v0.4 (R5 Home feeds locked)

> Status: Home feeds locked 2026-09-10 (Q23=b, Q24=b, Q25=a). V1-Core = Events (Upcoming/Featured/Past), Team (Our Team), Partners, Gallery (albums + featured photos), Site Content, Media. Public nav: Home, About, Our Team, Events (Upcoming, Featured, Past), Partners, Gallery. Build order: backend first. Open: Q19 About keys, Q20 tier order, Q21 album caps, Q22 /officers→/team.

## 1. Goal & Principles

- **Goal:** Give GDG Core Team (5–15 admins) a centralized CMS to manage website content without frontend code changes.
- **Principle (from `docs/gdg_backend_architecture.md` §5):** `CMS writes content. Public website reads content.` CMS controls text/images/links/dates/order/publish state. React controls layout/typography/routing/animations.
- **Home (R5 locked, mostly hardcoded shell + CMS feeds):** order = `hero → Our Team carousel (team `is_featured`, max 8–10, Q23=b) → Recent Events (upcoming-first up to 3, backfill past if short, Q24=b) → Our Partners strip (all active, tier-ordered, Q25=a) → Captured Moments (gallery featured photos, max 8–10, Q25=a) → cta/footer`. Each strip is CMS-fed; layout/animations stay in React.
- **No page-builder.** Fixed schemas for `hero, about, community, cta, footer`. No RBAC, versioning UI, approvals, scheduling, i18n in V1.

## 2. Current State (recon 2026-09-10)

- **Frontend (`frontend/src`):** Public pages (`/, /about, /officers, /gallery, /events, /contact`) are hardcoded, zero `apiFetch` use. Admin (`/admin, /admin/events, /admin/team, /admin/gallery`) are stubs. Reusable: `api/client.js apiFetch` (session cookie via `credentials: 'include'`), `components/ProtectedRoute.jsx`, Better Auth sign-in `pages/admin/Login.jsx`.
- **Backend (`backend/src`, base `/GDGoC-CTU-Main/v0.0.1`):** Full CRUD exists for 13 groups; all behind Better Auth `requireAuth` on the protected router (including `/admins`). Public reads live under `/public/*` (`?scope=upcoming|past|featured|recent` supported); liveness probes answer at `GET /`, `GET /health`, `GET /GDGoC-CTU-Main/v0.0.1/health`.
- **Auth:** Better Auth (email/password + optional Google) — backend keeps scrypt-hashed passwords in `account.password`, browser keeps only an HTTP-only session cookie sent via `credentials: 'include'` (no auth provider in the frontend, no bearer tokens). Server verifies the cookie in `requireAuth` (401 anon, 403 banned/non-admin, 503 lookup failure). Boot requires `BETTER_AUTH_SECRET` + `BETTER_AUTH_URL`; `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET` optional (Google button hidden until both set); `ADMIN_USER_IDS` bootstrap — plus the first signup on an empty `user` table becomes admin. Old `admins` table gone — an admin is a `user` row with `role = "admin"`: `admins = { id: Better Auth user id, email, role, isActive }`, where `isActive` folds to `!banned` and is enforced (`isActive=false` ⇒ 403 "Account deactivated — contact tech/web officer").
- **Drift — must-fix before ship:**
  1. `GET /auth/auth/sync` double prefix — fixed (the old sync endpoint is removed; Better Auth sessions need no user sync).
  2. `site-content updatedBy` validation said `z.uuid` vs actual opaque user id — fixed (validator now accepts any non-empty user-id string).
  3. No public GET routers (contradicts arch §19).
  4. Status: canonical V1 = lowercase `draft/published/archived/cancelled` (Q1=a).
  5. `team_members`: dept trio → nullable + new `roleTitle*` max 80 (Q3=b, Q12).
  6. `events`: add `registrationUrl` alongside `registrationEnabled` (Q2=b, Q11=a).
  7. `event_speakers` junction (doc) vs standalone profiles (code) — use code as truth.
  8. `media` generic (doc) vs Cloudinary-shaped (code) — use code as truth.

## 3. IA / Layout

- **Shell:** Fixed left sidebar (primary nav) + topbar (search, identity/avatar, sign-out, `+ New`). Mobile: drawer / bottom tabs (top 5). Single nav config.
- **Nav (V1):** Dashboard | Events | Team Members | Partners | Gallery | Site Content | Media | Settings/Profile. Mirrors public nav: Home, About, Our Team, Events (Upcoming/Featured/Past), Partners, Gallery.
- **Pattern:** List → Detail. Breadcrumbs at depth ≥2 (`Events / Title / Edit`). Detail tabs where needed: `Content | Media/SEO | Settings`.

## 4. Screens

### 4.1 Login — `/admin/login`
- Better Auth form: sign-up/sign-in with email + password, plus Google social only when `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET` are set. Anon `/admin/*` → sign-in + return-to (`ProtectedRoute`). Failure: `AdminDisabled` when `VITE_API_URL` missing.

### 4.2 Dashboard — `/admin` (MVP slice Q10=a)
- V1 only: Drafts needing publish + Recent edits (who/when). Deferred: upcoming rollup, missing-alt scan.

### 4.3 Events — `/admin/events`, `/admin/events/new`, `/admin/events/:id`
- List: searchable/sortable table, status pill, cover thumb, start date, `display_order`, `is_active` toggle.
- Fields: `title*`, `slug*` (auto + override), `short_description`, `description*`, `coverMediaId` + alt*, `location`, `locationEmbedUrl`, `registrationEnabled` + `registrationUrl` (required valid `https://` when enabled, empty/null when disabled), `startAt*/endAt*`, `status*` (`draft/published/archived/cancelled`), `is_featured bool (max 3, UI-enforced, Q15=a)`, `display_order ≥0`, `is_active`.
- Speakers: V1 links `event_speakers` standalone profiles only (no hosts/attendees UI).
- Scopes: `upcoming (endAt>=now) | past (endAt<now) | featured (is_featured=true + published, max 3) | recent (Home: upcoming-first up to 3, backfill past, Q24=b)`.

### 4.4 Team — `/admin/team`, `/admin/team/new`, `/admin/team/:id`
- List: photo, name, roleTitle, dept/program/yearSection, `display_order`, `is_active`.
- Fields: `firstName*, lastName*, slug*, roleTitle* (max 80), bio, department/program/yearSection (nullable), profileMediaId` + alt*, `linkedin_url, github_url, website_url` (URL-validated), `is_featured bool (Home carousel, max 8–10, Q23=b)`, `display_order, is_active`. No term/role picker in V1.

### 4.5 Partners — `/admin/partners`, `/admin/partners/new`, `/admin/partners/:id` (Q14=a, new module)
- List: logo thumb, name, tier pill, `display_order`, `is_active` toggle. Group/filter by tier.
- Fields: `name*`, `slug*` (auto + override), `logoMediaId*` + alt*, `websiteUrl` (URL-validated, `https://`), `tier*` (`platinum/gold/silver/community`), `description`, `display_order ≥0`, `is_active`.
- Backend: new `partners` table + protected CRUD + public GET (does not exist yet — greenfield, follows `team-members` pattern).

### 4.6 Gallery — `/admin/gallery`, `/admin/gallery/albums/new`, `/admin/gallery/albums/:id` (Q16=c, Q17=a)
- Concept: event recap albums (optionally linked to `eventId`) + standalone showcase albums; doubles as press/marketing pool (Q16=c).
- Manual add: admin can manually create albums AND flag featured photos (no auto-sync; explicit curation).
- Structure (reuse `media_collections` pattern — extend, don't fork): `albums = { title*, slug*, coverMediaId + alt*, eventId? (link), date, description, is_featured (album highlight), is_active }` + `album_items = { mediaId*, order ≥0, is_featured (featured-photo strip), caption/alt* }`, all items reuse Media picker (no new upload flow).
- List: albums table (cover, title, event link, photo count, featured star, `is_active`); detail: `Content (meta) | Photos (picker + reorder + feature toggles) | Settings`.
- Rules: album cover required before publish; item alt required; featured photos capped (UI: max 8); `is_active off` hides album publicly.

### 4.7 Site Content — `/admin/content`, `/admin/content/:sectionKey`
- Fixed list only, no custom keys (Q8): `hero, about, community, cta, footer` → per-section editor. `sectionKey` immutable enum.
- Fields: `title, subtitle, body (markdown), mediaId + preview, buttonText, buttonUrl (URL-validated), is_active`.

### 4.8 Media — `/admin/media` (Q7=a)
- Grid with thumb, filename, dims/size, `used_in` count, collection badge (read-only in V1).
- Upload: allow-list `jpeg/png/webp/gif`, ≤5MB, MIME+ext+magic-bytes, server UUID filenames, Cloudinary stays. `alt_text*` required before publish. Edit alt, delete only never-used drafts (typed confirm), else archive.
- System states everywhere: loading skeleton, empty+CTA+docs link, error+retry+requestId.

## 5. API Contract (V1)

Base: `<backend>/GDGoC-CTU-Main/v0.0.1`. `apiFetch` with `credentials: include`.

Reuse protected CRUD as-is:
- `POST/GET /team-members`, `GET /team-members/slug/:slug`, `GET/PATCH/DELETE /team-members/:id` (+ `upload.single(file)` on POST/PATCH)
- `POST/GET /events`, `GET /events/slug/:slug`, `GET/PATCH/DELETE /events/:id`
- `POST/GET /event-speakers` + `/slug/:slug` + `/:id`
- `POST/GET /site-content`, `GET /site-content/section/:sectionKey`, `GET/PATCH/DELETE /:id`
- `POST (+multer)/GET /media`, `/:id` CRUD

**New in V1 (Q4, Q6, R4):**
- `GET /public/team` → active only, safe fields (no user IDs, no emails), slug lookup.
- `GET /public/events?scope=upcoming|past|featured|recent`, `GET /public/events/slug/:slug` (published only). Cutoff: `endAt < now` = past, else upcoming. Featured: `is_featured=true + published`, max 3. Recent (Home): upcoming-first up to 3, backfill past (Q24=b).
- `GET /public/partners` (+ active only, order by `tier, display_order`).
- `GET /public/team?featured=true` (Home carousel: `is_featured` max 8–10, Q23=b).
- `GET /public/gallery/albums`, `GET /public/gallery/albums/slug/:slug` (active only + items ordered), `GET /public/gallery/featured` (flagged photos across albums, max 8).
- `GET /public/content`, `GET /public/content/:sectionKey` (active only).
- `GET /health` (replace `GET /admins` probe).
- Fix `/auth/sync` path, enforce `isActive` in `requireAuth` (403 + "Account deactivated — contact tech/web officer" + sign-out, Q9), fix `updatedBy` validation.

## 6. Editorial Workflow & Validation (Q13)

- Lifecycle: create = `draft`. `draft → published`; terminal `archived/cancelled` read-only except re-activate. Never delete history.
- Publish gate: required fields + types; block + highlight.
- Slug: `lowercase-hyphen-ascii`, unique + inline async check, reserved (`api, admin, media, sitemap.xml`). V1 has no redirects table: slug change on published → warn + require explicit confirm, no silent 404.
- Validation: client fast + server truth; `onBlur` then revalidate onChange; summary `role=alert` + inline `aria-invalid/describedby`; server errors folded in.
- Order: drag + up/down keyboard, explicit Save order, integer persist + renumber.
- Delete: prefer `is_active=false`/archive (hidden public, editable, restorable); hard delete only never-published drafts, typed confirm.
- Guards: unsaved-changes blocker + `beforeunload`. Optimistic only for `is_active`/reorder (rollback + `aria-live`); confirmed + toast for publish/delete/upload.
- A11y: native inputs, label+hint+error association, focus to summary, keyboard-only publish passes, contrast-checked focus, `prefers-color-scheme`.

## 7. Security / Ops

- Client gate = UX only; every mutation verified server-side (Better Auth cookie session via `requireAuth` — no bearer tokens). `401` anon, `403` banned/inactive with tech-officer message.
- Uploads: `limits { fileSize 5MB, files 1–5 }`, multer `fileFilter`, sanitize names, store via Cloudinary, map `400/413/429`.
- Audit: `created_by/updated_by (Better Auth user id), created_at/updated_at, published_at`. Header shows `Last edited by X · time`.
- CORS: single exact `FR_ORIGIN`, `VITE_API_URL=<backend>/GDGoC-CTU-Main/v0.0.1`. SPA fallback `vercel.json` rewrite.

## 8. Out of Scope (V1)

`event_hosts, event_attendees, terms/member_terms`, RBAC/approvals, versioning/history UI, page-builder/blocks, scheduling/expiry, multi-locale, comments, AI preview, analytics, registration/attendance, payments, newsletter. Note: `media_collections` is absorbed into Gallery albums (extend, don't fork); Partners + Gallery ARE in V1-core per R4.

## 9. Acceptance Criteria

- [ ] List loads <2s, server-side search, empty/error states.
- [ ] Create → draft; publish blocked until valid; published visible publicly <60s.
- [ ] Slug dup → inline error, save blocked; live slug change → confirm prompt (no redirect table V1).
- [ ] Reorder persists reload; `is_active off` hides public, stays editable.
- [ ] `.exe/svg-html` → 400 with message; oversize → 413.
- [ ] Dirty leave → confirm; no silent loss.
- [ ] Anon `/admin/*` → sign-in; anon API → 401; inactive → 403 + tech-officer message.
- [ ] `registrationEnabled=true` without valid `https://` URL blocks publish.
- [ ] `roleTitle` required max 80; dept trio nullable.
- [ ] Keyboard-only publish + SR announcements pass.
- [ ] `GET /health` + public GETs return published/active-only, safe fields; `?scope` cutoff uses `endAt`; `featured` respects max-3.
- [ ] Partners CRUD + tier grouping + public list ordered by tier/order.
- [ ] Gallery: manual album create, photo picker add, reorder persists, featured album + featured photos (max 8) surface on public featured feed.

## 10. Next Steps (Q5=a backend first)

1. Backend: public GETs + `/health` + drift fixes (§2) + `registrationUrl`, `roleTitle`/nullable dept, `events.is_featured` + `team_members.is_featured` migrations; greenfield `partners` CRUD; extend `media_collections(+items)` → albums (`eventId?, date, is_active, is_featured` + item `is_featured`).
2. Admin UI: shell + Dashboard (2 cards) + Events (+featured toggle) + Team + Partners + Gallery (albums + photos + feature) + Content + Media.
3. Rewire public pages to public GETs pilot order: Events (upcoming/featured/past) → Our Team → Partners → Gallery; leave Home/About/Contact hardcoded until content keys filled.
4. Verify end-to-end per `docs/deployment-plan.md` §4.

## Appendix — Grilling Log

- R1: Q1=a lowercase status, Q2=b bool+URL, Q3=b optional dept+roleTitle, Q4=public published-only+slug+?scope, Q5=a backend first.
- R2: Q6=b endAt cutoff, Q7=a 5MB/4-mime/alt/Cloudinary, Q8=fixed 5 keys, Q9=403 contact tech/web officer, Q10=a drafts+recent only.
- R3: Q11=a https-required, Q12=roleTitle* max80 + nullable trio, Q13=archive-preferred + confirm on slug change. Frontier empty → locked v0.2.
- R4: Q14=a partners (name/logo+alt/website/tier/order/active), Q15=a `is_featured` max-3 + `?scope=featured`, Q16=c albums link events + standalone, Q17=a albums+items reuse media_collections + manual add + featured photos max-8 → v0.3.
- R5: Home shell + feeds (team carousel → recent → partners → moments). Q23=b team `is_featured` max 8–10, Q24=b recent = upcoming-first up to 3 backfill past, Q25=a partners all-active + moments 8–10 → v0.4. Open: Q19–Q22.
