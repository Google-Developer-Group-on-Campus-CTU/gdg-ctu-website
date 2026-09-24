# Admin form shell (shared)

Shared editor infra for the forms phase: window-card chrome + react-hook-form
bindings + validation summary + sticky footer. Lives at
`frontend/src/components/admin/form-shell.jsx` (+ `form-shell.css`, `.editor-*`
scope only). No detail page migrates yet — TeamDetail is the pilot target.

Stack (already installed): `react-hook-form` 7 + `zod` 4 + `@hookform/resolvers`.
shadcn `form.tsx` / `input.tsx` / `label.tsx` / `select.tsx` are consumed
as-is — never restyled, never touched.

## Exports

| Export | Props | Notes |
| --- | --- | --- |
| `EditorCard` | `title` / `eyebrow` / `actions` / `children` | White card, 1.5px `#222`, 16px radius, 4-dot window row, hard `4px` shadow desktop / flat mobile |
| `EditorField` | `control` / `name` / `label` / `hint` / `required` / `anchorId` / `plain` / `showMessage` / `className` / render-`children(field)` | Binds shadcn `FormField`→`FormItem`→`FormLabel`→`FormMessage` through the Controller `field`. Single ref-forwarding inputs render inside `FormControl` (id + `aria-invalid` + `aria-describedby` via Slot); composites (`Select` root, shared `Toggle`, `MediaPicker`, file inputs) pass `plain`. `showMessage={false}` when the child renders its own error (MediaPicker). Anchors (`#name`) land on the item wrapper (`anchorId ?? name`) |
| `EditorErrors` | `errors` / `serverError` / `summaryRef` / `title` | Red card (1.5px `#EA4335`, `#FCE8E6`): "fix N fields" + anchor links, `role="alert"`, focusable. Accepts flat `{ field: msg }` or RHF `formState.errors`. `serverError` (backend 400 text) renders as the banner paragraph in the same card |
| `EditorFooter` | `saving` / `isNew` / `onPublish` / `onArchive` / labels | Sticky bar: Save draft (secondary white pill, form submit), Publish (yellow `#FFC400` pill), Archive/Delete (red outline tertiary, hidden when new). Disabled = opacity `.7` + 16px spinner; all targets ≥ 44px |
| `DirtyGuardBanner` | `blocker` | Renders on `blocker.state === 'blocked'` with Stay (`reset()`) / Discard (`proceed()`) pills |
| `useEditorForm` | `{ schema, defaultValues, ...options }` | `useForm` + `zodResolver` in one call. After fetching, the page calls `reset(toForm(item))` — that is how defaults come from the record |
| `useSlugUniqueness` | `(api, slug, currentId)` | 400ms debounce; 404 = unique; 500/timeout/network → error-blocking message. Returns `{ slugDup, slugCheckError }` for the publish gate |
| `toEditorPayload` | `(values, { nullable })` | `display_order` numeric coercion + nullable trio (`''` → `null`) |
| `focusEditorErrors` | `(ref)` | rAF focus for the submit path (mirrors `focusSummary`) |
| `teamEditorSchema` | zod object | The single team schema, mirroring `validateTeam` policy (required presence, URL shape, reserved slugs) + structural types (`display_order` coerce, booleans) |
| `partnerEditorSchema` | zod object | Mirrors `validatePartner` (name/slug required + reserved, websiteUrl https-only). No nullable trio — the page sends values verbatim |
| `eventEditorSchema` | zod object | Mirrors `validateEvent` presence/URL/reserved policy. `registrationUrl` stays optional here; the enabled-gating lives page-level. The end&lt;start cross-rule is backend truth → 400 banner |
| `speakerEditorSchema` | zod object | Presence-only (first/last/slug), same level as the old inline gate |
| `albumEditorSchema` | zod object | Title required on every save (backend `name` mapping stays in `toApiPayload`); slug reserved-check mirrors `validateAlbum` |
| `contentEditorSchema` | zod object | Mirrors `validateContent` (button URL shape). No slug flow |

## Policy (mirrors `admin/editorial.js`)

- validate* stays UX-level only; backend Zod is truth for nullability, enums,
  ranges, cross-field rules. Never add shell rules stricter than the backend —
  rejected-valid payloads surface as the server 400 banner instead.
- `useDirtyGuard` / `useBlocker` + `beforeunload` semantics are preserved
  verbatim: `dirty && !saving` drives the blocker; `DirtyGuardBanner` is the
  only UI change (same Stay/Discard contract as today's `admin-summary` block).
- Slug: auto-fill from name/title until touched, 400ms debounce check,
  `slugCheckError` blocks save, `slugDup` blocks publish.
- `display_order`: `toEditorPayload` coerces (`Number(...) || 0`).
- Nullable trio (team dept/program/year): `''` → `null` via `toEditorPayload`;
  event `registrationUrl` gating (`enabled ? url : null`) stays page-level.
- HTTPS gating for `registrationUrl` (event) / `websiteUrl` (partner) lives in
  the entity schema, mirroring `validateEvent` / `validatePartner`.
- Featured caps are noted, not enforced, in the shell: events 3
  (`MAX_FEATURED_EVENTS`), team 10 (`MAX_FEATURED_TEAM`), photos 8
  (`MAX_FEATURED_PHOTOS`). The pre-publish list-count check stays in the page
  (non-blocking on lookup failure, exactly like today).
- Echo fields (`updated_by` / `updated_at`) in PATCH bodies are **ignored, not
  needed**: all three update routes validate via `validateBody` →
  `schema.safeParse` (no `.strict()`), and the Update schemas `.omit()`
  `id`/`createdAt`/`updatedAt` (partners also `createdBy`/`updatedBy`) — so
  unknown echo keys are silently stripped server-side, and `updatedBy` is set
  from the session user server-side instead. The pages keep the echo fields in
  form state only for the "last edited … by …" header line; no shell
  passthrough was added. Verified read-only in
  `backend/src/modules/{team-members,events,partners}/*.validations.ts` +
  `backend/src/utils/http.ts`.

## TeamDetail pilot sketch (reference — do not implement yet)

```jsx
import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { getId, teamApi } from '../../api/resources.js';
import {
  ADMIN_ENTITY_ROUTES, MAX_FEATURED_TEAM, slugify, useDirtyGuard,
} from '../../admin/editorial.js';
import {
  DirtyGuardBanner, EditorCard, EditorErrors, EditorField, EditorFooter,
  focusEditorErrors, teamEditorSchema, toEditorPayload, useEditorForm,
  useSlugUniqueness,
} from '../../components/admin/form-shell.jsx';
import { ErrorState, LoadingSkeleton, Toggle, TypedConfirm } from '../../components/admin/shared.jsx';
import { Form } from '../../components/ui/form';
import { Input } from '../../components/ui/input';
import MediaPicker from '../../components/admin/MediaPicker.jsx';

const EMPTY = { /* …same shape as today… */ };
const toForm = (item = {}) => ({ /* …same mapping as today… */ });

export default function TeamDetail() {
  const { id } = useParams();
  const isNew = id === 'new';
  const navigate = useNavigate();
  const summaryRef = useRef(null);
  const methods = useEditorForm({ schema: teamEditorSchema, defaultValues: EMPTY });
  const { control, reset, watch, setValue, setError, handleSubmit } = methods;
  const [original, setOriginal] = useState(EMPTY);
  // loading / error / loadRetry / serverError / saving / confirmDelete / toast — as today
  const [slugTouched, setSlugTouched] = useState(false);

  const values = watch();
  const dirty = useMemo(() => JSON.stringify(values) !== JSON.stringify(original), [values, original]);
  const blocker = useDirtyGuard(dirty && !saving);

  useEffect(() => {
    if (isNew) return;
    teamApi.get(id).then((item) => {
      const next = toForm(item);
      reset(next); setOriginal(next); setLoading(false); // defaults from record
    }).catch((err) => { setError(err); setLoading(false); });
  }, [id, isNew, loadRetry, reset]);

  // slug auto-fill until touched (same contract as today's set())
  const firstName = watch('firstName'); const lastName = watch('lastName');
  useEffect(() => {
    if (!slugTouched) setValue('slug', slugify(`${firstName ?? ''} ${lastName ?? ''}`));
  }, [firstName, lastName, slugTouched, setValue]);

  const currentId = isNew ? null : getId(original) ?? id;
  const { slugDup, slugCheckError } = useSlugUniqueness(teamApi, watch('slug'), currentId);

  const persist = (publish) => async (next) => {
    if (slugCheckError) { setError('slug', { message: slugCheckError }); focusEditorErrors(summaryRef); return; }
    if (publish && slugDup) { setError('slug', { message: 'Slug is already in use.' }); focusEditorErrors(summaryRef); return; }
    if (publish && next.is_featured) {
      try {
        const all = await teamApi.list();
        const others = (Array.isArray(all) ? all : []).filter(
          (m) => m.is_featured && String(getId(m) ?? m.slug) !== String(currentId),
        );
        if (others.length >= MAX_FEATURED_TEAM) { setServerError(`Featured cap reached (max ${MAX_FEATURED_TEAM}). Unfeature someone first.`); return; }
      } catch { /* non-blocking */ }
    }
    setSaving(true); setServerError(null);
    try {
      const payload = toEditorPayload(next, { nullable: ['department', 'program', 'yearSection'] });
      const saved = isNew
        ? await teamApi.create({ ...payload, status: publish ? 'published' : 'draft' })
        : await teamApi.update(id, publish ? { ...payload, status: 'published', is_active: true } : payload);
      const fresh = toForm(saved ?? next);
      reset(fresh); setOriginal(fresh); setToast(publish ? 'Published.' : 'Saved as draft.');
      if (isNew && (getId(saved) ?? saved?.slug)) navigate(ADMIN_ENTITY_ROUTES.team.detail(getId(saved) ?? saved.slug), { replace: true });
    } catch (err) {
      setServerError(err?.body?.message ?? err?.message ?? 'Save failed.'); // server 400 → banner
    } finally { setSaving(false); }
  };

  return (
    <section aria-label={isNew ? 'New member' : 'Edit member'}>
      {/* page head + Back link — unchanged */}
      <DirtyGuardBanner blocker={blocker} />
      <Form {...methods}>
        <form onSubmit={handleSubmit(persist(false))} noValidate>
          <EditorCard title={isNew ? 'New member' : 'Edit member'} eyebrow="Team">
            <EditorErrors errors={methods.formState.errors} serverError={serverError} summaryRef={summaryRef} />
            {toast ? <p role="status" aria-live="polite" className="admin-muted">{toast}</p> : null}
            <div className="editor-grid">
              <EditorField control={control} name="firstName" label="First name" required>
                {(field) => <Input {...field} />}
              </EditorField>
              <EditorField control={control} name="lastName" label="Last name" required>
                {(field) => <Input {...field} />}
              </EditorField>
              <EditorField control={control} name="slug" label="Slug" required hint="Auto-fills from name until edited.">
                {(field) => <Input {...field} onChange={(e) => { setSlugTouched(true); field.onChange(slugify(e.target.value)); }} />}
              </EditorField>
              <EditorField control={control} name="roleTitle" label="Role title (≤ 80)" required>
                {(field) => <Input {...field} maxLength={80} />}
              </EditorField>
            </div>
            <EditorField control={control} name="bio" label="Bio">
              {(field) => <textarea {...field} rows={4} />}
            </EditorField>
            <div className="editor-grid">
              {['department', 'program', 'yearSection'].map((key) => (
                <EditorField key={key} control={control} name={key} label={`${key} (nullable)`}>
                  {(field) => <Input {...field} value={field.value ?? ''} />}
                </EditorField>
              ))}
            </div>
            <EditorField control={control} name="profileMediaId" label="Profile media" plain showMessage={false}
              hint="Pick from the Media library below; the ID is stored on save.">
              {(field) => (
                <MediaPicker id="profileMediaId" label="Profile media ID"
                  hint="Pick from the Media library below; the ID is stored on save."
                  error={methods.formState.errors.profileMediaId?.message}
                  value={field.value ?? ''} onChange={field.onChange} />
              )}
            </EditorField>
            {/* linkedin_url / github_url / website_url, featured + active Toggles (plain),
                display_order number, status Select (plain) — same fields as today */}
            <EditorFooter saving={saving} isNew={isNew}
              onPublish={() => handleSubmit(persist(true))()}
              onArchive={() => setConfirmDelete(true)} />
          </EditorCard>
        </form>
      </Form>
      {/* TypedConfirm archive/delete — reused from shared.jsx unchanged */}
    </section>
  );
}
```

Event migration notes (for later): the speaker sub-form becomes a second
`EditorCard` with its own `useEditorForm` + slug hook (same auto-slug +
`checkSlugUnique` against `speakersApi`); the speaker file input is a `plain`
field (`accept="image/*"`, upload wins over media ID, exactly like today);
`profileSrc` media-list resolution is unchanged. No shell changes needed.

## Status

- [x] Shared `form-shell.jsx` + `form-shell.css` (window-card, RHF bindings,
  errors card, sticky footer, dirty banner, slug hook, payload normalizer,
  team schema)
- [x] Pilot migration: `pages/admin/TeamDetail.jsx` — editor wrapped in
  `<EditorCard>` (eyebrow Team + Public preview pill to `/team` in actions);
  all fields via `<EditorField>` + `useEditorForm(teamEditorSchema)` with
  `reset(toForm(item))` defaults (EMPTY/toForm mapping verbatim); photo via
  `MediaPicker` in a plain field (`showMessage={false}`) + photo alt field
  kept; `is_featured`/`is_active` shared `Toggle`s in plain fields; slug with
  auto-fill-until-touched + `useSlugUniqueness` (400ms, error-blocking) and
  live dup/check hint; `<EditorErrors>` (RHF errors + server 400 banner,
  focus on submit); `<EditorFooter>` Save draft (submit) / Publish (gated:
  slug-dup + featured cap `MAX_FEATURED_TEAM` = 10, non-blocking on lookup
  failure) / Archive-delete (hidden when new, `TypedConfirm` expected-slug
  archiving via `is_active=false` + `status='archived'`); `<DirtyGuardBanner>`
  replacing the old `admin-summary` block. Preserved: `validateTeam` policy
  level (now enforced by the schema — `validateTeam` import dropped, no
  behavior widened except the pre-existing ≤80 roleTitle input cap which the
  schema mirrors), `display_order` coercion + nullable trio via
  `toEditorPayload`, create/update/navigate flows, load retry preserving
  edits, toasts, cookie-credential `teamApi` calls. No shell/css changes.
- [ ] Follow-ups: PartnerDetail → EventDetail (+speaker card) → AlbumDetail →
  ContentEditor, one per change, each reusing the shell as-is.
- [x] PartnerDetail migration — same shape as Team (`partnerEditorSchema`,
  no nullable trio); footer Publish (status + active force) / Archive via
  `TypedConfirm`; greenfield-404 save message kept; Public preview pill to
  `/partners`. Preserved: slug auto-fill + uniqueness hook, MediaPicker logo +
  alt, tier select, `display_order` coercion, load retry, toasts, dirty guard.
- [x] EventDetail migration — main `EditorCard` (`eventEditorSchema`,
  registration gating page-level, start/end, featured cap 3, optimistic
  `is_active` toggle preserved verbatim) + second Speakers `EditorCard` with
  its own `useEditorForm(speakerEditorSchema)` + slug hook vs `speakersApi`;
  speaker file is a plain field (upload wins over media ID); speaker list,
  optimistic remove, media resolution, and all three `TypedConfirm`s kept.
  Archive/Delete-draft share the footer tertiary by draft state. Public
  preview pill (slug-aware). Preserved: slug-changed confirm, live publish
  gate indicator, 400 banner, toasts, dirty guard.
- [x] AlbumDetail migration — content tab in `EditorCard` (`albumEditorSchema`,
  title-required-every-save, `toApiPayload` name/null/camelCase mapping +
  `createdBy`-from-session verbatim); settings toggles bound to the same form
  in the settings tab; photos tab (sub-list, picker add, optimistic
  reorder/feature/remove, cap 8) stays outside the card verbatim; archive via
  `isActive: false`. Public preview pill (slug-aware). Preserved: tabs,
  `setTab('content')` on invalid, load retry, toasts, dirty guard.
- [x] ContentEditor migration — `contentEditorSchema`, no slug flow;
  section-key fetch/create-or-update, camelCase payload + `updatedBy` session,
  rowId/notFound flows verbatim; no archive tertiary. Public preview pill per
  section map (hero/about → own routes, rest → `/`). Preserved: immutable-key
  header with last-edited line, load retry, toasts, dirty guard.
