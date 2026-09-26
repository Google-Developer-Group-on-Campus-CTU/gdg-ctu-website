import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '../ui/form';
import { checkSlugUnique, isAnyUrl, isHttpsUrl, isReservedSlug } from '../../admin/editorial.js';
import { focusLinkedField } from './shared.jsx';
import './form-shell.css';

/**
 * Shared editor shell — Material 3 (spec §6.1).
 *
 * Migration target for the detail pages. Do NOT restyle
 * shadcn primitives here: EditorField binds them through react-hook-form's
 * Controller via the shadcn FormField/FormItem/FormLabel/FormMessage set,
 * skinned by M3 role tokens (see form-shell.css + .admin-shell in
 * styles/admin.css).
 */

const requiredText = (message) =>
  z.string().refine((v) => v != null && String(v).trim() !== '', message);

const optionalUrl = (message) =>
  z.string().optional().refine((v) => !v || isAnyUrl(v), message);

/**
 * Single zod schema per entity, mirroring backend truth at the same policy
 * level as validateTeam (UX-level only: required presence, URL shape,
 * reserved slugs — see admin/editorial.js). The backend Zod schemas stay the
 * single source of truth for nullability/enums/ranges/cross-field rules;
 * anything not checked here surfaces as the server 400 banner on save.
 */
export const teamEditorSchema = z.object({
  firstName: requiredText('First name is required.'),
  lastName: requiredText('Last name is required.'),
  slug: requiredText('Slug is required.').refine(
    (v) => !isReservedSlug(String(v ?? '')),
    'This slug is reserved.',
  ),
  roleTitle: z.string().refine((v) => !v || v.length <= 80, 'Role title must be ≤ 80 characters.'),
  bio: z.string().optional(),
  department: z.string().optional(),
  program: z.string().optional(),
  yearSection: z.string().optional(),
  profileMediaId: z.string().optional(),
  profileAlt: z.string().optional(),
  linkedin_url: optionalUrl('Must be a valid URL.'),
  github_url: optionalUrl('Must be a valid URL.'),
  website_url: optionalUrl('Must be a valid URL.'),
  is_featured: z.boolean(),
  display_order: z.coerce.number(),
  is_active: z.boolean(),
  status: z.string(),
});

/**
 * Partner schema — same UX-level policy as validatePartner. No nullable trio:
 * the page sends values verbatim (only display_order coerced); websiteUrl
 * requires https, mirroring the backend refine.
 */
export const partnerEditorSchema = z.object({
  name: requiredText('Name is required.'),
  slug: requiredText('Slug is required.').refine(
    (v) => !isReservedSlug(String(v ?? '')),
    'This slug is reserved.',
  ),
  logoMediaId: z.string().optional(),
  logoAlt: z.string().optional(),
  websiteUrl: z.string().optional().refine(
    (v) => {
      if (!v) return true;
      try {
        return new URL(v).protocol === 'https:';
      } catch {
        return false;
      }
    },
    'Website must be a valid https:// URL.',
  ),
  tier: z.string(),
  description: z.string().optional(),
  display_order: z.coerce.number(),
  is_active: z.boolean(),
  status: z.string(),
});

/**
 * Event schema — same UX-level policy as validateEvent. There is no slug
 * input (the slug is auto-derived from the title at save time) and no cover
 * alt / embed-URL inputs (the backend persists neither coverAlt nor a
 * hand-edited embed URL — the embed URL is derived from the location).
 * externalUrl is an optional https URL (https-only when present),
 * timezone is fixed to Asia/Manila
 * (no input — optional with default, the payload always sends the fallback),
 * and ends-at-before-starts-at is rejected here with
 * the same friendly message the backend returns.
 */
export const eventEditorSchema = z.object({
  title: requiredText('Title is required.'),
  short_description: z.string().optional(),
  description: z.string().optional(),
  coverMediaId: z.string().optional(),
  location: z.string().optional(),
  externalUrl: z.string().trim().optional().refine(
    (v) => !v || isHttpsUrl(v),
    'External URL must be a valid https:// URL.',
  ),
  timezone: z.string().trim().optional().default('Asia/Manila'),
  category: z.enum(['Meetup', 'Workshop', 'Talk', 'Competition']),
  startAt: requiredText('Start date/time is required.'),
  endAt: requiredText('End date/time is required.'),
  status: z.string(),
  is_active: z.boolean(),
}).superRefine((v, ctx) => {
  if (v.startAt && v.endAt) {
    const start = new Date(v.startAt);
    const end = new Date(v.endAt);
    if (!Number.isNaN(start.getTime()) && !Number.isNaN(end.getTime()) && end < start) {
      ctx.addIssue({
        code: 'custom',
        path: ['endAt'],
        message: 'Ends at must be the same as or after Starts at.',
      });
    }
  }
});

/**
 * Album schema — title required on every save (not just publish), mirroring
 * the page gate; slug reserved-check mirrors validateAlbum. The title→name
 * mapping and empty→null coercions stay in the page's toApiPayload.
 */
export const albumEditorSchema = z.object({
  title: requiredText('Title is required.'),
  slug: requiredText('Slug is required.').refine(
    (v) => !isReservedSlug(String(v ?? '')),
    'This slug is reserved.',
  ),
  coverMediaId: z.string().optional(),
  eventId: z.string().optional(),
  categoryId: z.string().optional(),
  date: z.string().optional(),
  description: z.string().optional(),
  is_featured: z.boolean(),
  is_active: z.boolean(),
});

/**
 * Gallery-category schema — same UX-level policy as the backend
 * CreateGalleryCategorySchema presence rules (name/slug required, slug
 * reserved-check). displayOrder/isActive mapping stays in the page.
 */
export const galleryCategoryEditorSchema = z.object({
  name: requiredText('Name is required.'),
  slug: requiredText('Slug is required.').refine(
    (v) => !isReservedSlug(String(v ?? '')),
    'This slug is reserved.',
  ),
  display_order: z.coerce.number(),
  is_active: z.boolean(),
});

/**
 * Term schema — mirrors the backend term presence rules (name ≤ 20 chars,
 * start/end dates required; end < start is backend truth via the 400
 * banner). isCurrent promotion unsets every other term server-side.
 */
export const termEditorSchema = z.object({
  name: requiredText('Name is required.').refine(
    (v) => String(v ?? '').trim().length <= 20,
    'Name must be ≤ 20 characters.',
  ),
  startDate: requiredText('Start date is required.'),
  endDate: requiredText('End date is required.'),
  isCurrent: z.boolean(),
});

/**
 * Roster-assignment schema — mirrors CreateMemberTermsSchema presence rules
 * (member + role required; photo/order/active optional). termId comes from
 * the route, never the form.
 */
export const memberTermEditorSchema = z.object({
  memberId: requiredText('Member is required.'),
  role: requiredText('Role is required.'),
  profileMediaId: z.string().optional(),
  display_order: z.coerce.number(),
  is_active: z.boolean(),
});

/** useForm + zodResolver in one call. After fetching, page calls `reset(toForm(item))`. */
export function useEditorForm({ schema, defaultValues, ...options }) {
  return useForm({ resolver: zodResolver(schema), defaultValues, ...options });
}

/**
 * Slug uniqueness with the pilot semantics: 400ms debounce, 404 = unique,
 * 500/timeout/network → error-blocking message (never swallowed).
 * Returns { slugDup, slugCheckError } for the publish gate.
 */
export function useSlugUniqueness(api, slug, currentId = null) {
  const [slugDup, setSlugDup] = useState(false);
  const [slugCheckError, setSlugCheckError] = useState(null);

  useEffect(() => {
    if (!slug) {
      setSlugDup(false);
      setSlugCheckError(null);
      return undefined;
    }
    let alive = true;
    setSlugCheckError(null);
    const t = setTimeout(() => {
      checkSlugUnique(api, slug, currentId)
        .then((unique) => {
          if (alive) {
            setSlugDup(!unique);
            setSlugCheckError(null);
          }
        })
        .catch((err) => {
          if (!alive) return;
          if (err?.status === 404) {
            setSlugDup(false);
            setSlugCheckError(null);
            return;
          }
          setSlugDup(false);
          setSlugCheckError(err?.body?.message ?? err?.message ?? 'Could not verify slug uniqueness.');
        });
    }, 400);
    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, [api, slug, currentId]);

  return { slugDup, slugCheckError };
}

/**
 * Save payload normalizer: display_order numeric coercion (only when the
 * form carries the key — events/terms have no display_order column) +
 * empty→null for UUID/FK fields. Backend `z.uuid().nullable()` rejects '' —
 * so every key ending in MediaId/AlbumId (logoMediaId, coverMediaId,
 * profileMediaId, galleryAlbumId, mediaId, …) maps '' → null, plus any
 * caller-passed `nullable[]` keys (department trio, etc.).
 */
const FK_NULLABLE_PATTERN = /(MediaId|AlbumId)$/i;

export function toEditorPayload(values, { nullable = [] } = {}) {
  const out = { ...values };
  if ('display_order' in out) out.display_order = Number(out.display_order) || 0;
  const keys = new Set([
    ...Object.keys(out).filter((key) => FK_NULLABLE_PATTERN.test(key)),
    ...nullable,
  ]);
  for (const key of keys) {
    if (out[key] === '') out[key] = null;
  }
  return out;
}

export function focusEditorErrors(ref) {
  requestAnimationFrame(() => ref?.current?.focus?.());
}

/**
 * M3 editor card: surface-container-high fill, 1px outline-variant border,
 * medium (12px) shape, elevation 0.
 */
export function EditorCard({ title, eyebrow, actions, children }) {
  return (
    <div className="editor-card">
      <div className="editor-card-dots" aria-hidden="true">
        <i />
        <i />
        <i />
        <i />
      </div>
      {title || eyebrow || actions ? (
        <div className="editor-card-head">
          <div>
            {eyebrow ? <p className="editor-eyebrow">{eyebrow}</p> : null}
            {title ? <h2>{title}</h2> : null}
          </div>
          {actions ? <div className="editor-card-actions">{actions}</div> : null}
        </div>
      ) : null}
      {children}
    </div>
  );
}

/**
 * RHF-bound field (spec §6.1). `children` is a render function receiving the
 * Controller `field` ({ value, onChange, onBlur, name, ref }):
 *
 *   <EditorField control={control} name="firstName" label="First name" required>
 *     {(field) => <Input {...field} />}
 *   </EditorField>
 *
 * `required` renders the asterisk AND sets `required` + `aria-required="true"`
 * on the control (forms are `noValidate`, so RHF owns validation and the
 * error summary owns focus). Single ref-forwarding inputs (shadcn Input,
 * native input/textarea/select) render inside FormControl, which supplies id
 * + aria-invalid + aria-describedby (hint/error) via Slot. For composite
 * children that cannot take Slot props (shadcn Select root, shared Toggle,
 * MediaPicker, file inputs) pass `plain` — the child renders unwrapped with
 * hint/error text still shown below. Components with their own error UI
 * (MediaPicker) also pass `showMessage={false}` to avoid double errors.
 * Anchors in EditorErrors (`#name`) land on the FormItem wrapper
 * (`anchorId ?? name`) and move focus into the field on click.
 */
export function EditorField({
  control,
  name,
  label,
  hint,
  required,
  anchorId,
  plain = false,
  showMessage = true,
  className,
  children,
}) {
  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => (
        <FormItem id={anchorId ?? String(name)} className={className ? `editor-field ${className}` : 'editor-field'}>
          <FormLabel className="editor-label">
            {label} {required ? <span aria-hidden="true">*</span> : null}
          </FormLabel>
          {plain ? (
            typeof children === 'function' ? (
              children(required ? { ...field, required: true, 'aria-required': 'true' } : field)
            ) : (
              children
            )
          ) : (
            <FormControl required={required ? true : undefined} aria-required={required ? 'true' : undefined}>
              {typeof children === 'function'
                ? children(required ? { ...field, required: true, 'aria-required': 'true' } : field)
                : children}
            </FormControl>
          )}
          {hint ? <FormDescription className="editor-hint">{hint}</FormDescription> : null}
          {showMessage ? <FormMessage className="editor-error" /> : null}
        </FormItem>
      )}
    />
  );
}

function errorMessage(value) {
  if (!value) return null;
  if (typeof value === 'string') return value;
  return value.message ?? null;
}

/**
 * M3 error-container summary (small 8px, icon + text): "fix N fields" +
 * anchor links that move focus into the field, focusable via summaryRef
 * (focused on submit). Accepts a flat { field: message } map or RHF
 * formState.errors. `serverError` (backend 400 text) renders as the banner
 * paragraph in the same card.
 */
export function EditorErrors({ errors, serverError, summaryRef, title }) {
  const list = Object.entries(errors ?? {})
    .map(([key, value]) => [key, errorMessage(value)])
    .filter(([, message]) => !!message);
  if (list.length === 0 && !serverError) return null;
  const count = list.length;
  return (
    <div ref={summaryRef} tabIndex={-1} role="alert" className="editor-errors">
      {count > 0 ? (
        <>
          <h3>{title ?? `Please fix ${count} ${count === 1 ? 'field' : 'fields'} before publishing`}</h3>
          <ul>
            {list.map(([key, message]) => (
              <li key={key}>
                <a href={`#${key}`} onClick={(e) => focusLinkedField(e, key)}>{String(message)}</a>
              </li>
            ))}
          </ul>
        </>
      ) : null}
      {serverError ? <p className="editor-errors-server">{String(serverError)}</p> : null}
    </div>
  );
}

/**
 * Sticky action bar (spec §6.1): one filled primary (publish, M3 medium 56px),
 * one outlined secondary (save draft, form submit), one outlined-error
 * destructive (archive/delete, hidden for new records). State layers only,
 * disabled at opacity 0.38 with a 16px spinner.
 */
export function EditorFooter({
  saving = false,
  isNew = false,
  onPublish,
  onArchive,
  saveLabel = 'Save draft',
  publishLabel = 'Publish',
  archiveLabel = 'Archive / delete',
}) {
  return (
    <div className="editor-footer">
      <button type="submit" className="editor-btn editor-btn-secondary" disabled={saving} aria-busy={saving}>
        {saving ? (
          <>
            <span className="editor-spinner" aria-hidden="true" />
            Saving…
          </>
        ) : (
          saveLabel
        )}
      </button>
      <button type="button" className="editor-btn editor-btn-primary" disabled={saving} aria-busy={saving} onClick={onPublish}>
        {saving ? (
          <>
            <span className="editor-spinner" aria-hidden="true" />
            Publishing…
          </>
        ) : (
          publishLabel
        )}
      </button>
      {!isNew && onArchive ? (
        <button type="button" className="editor-btn editor-btn-danger" disabled={saving} aria-busy={saving} onClick={onArchive}>
          {archiveLabel}
        </button>
      ) : null}
    </div>
  );
}

/**
 * Unsaved-changes banner driven by useDirtyGuard/useBlocker semantics:
 * pass the blocker through, Stay resets it, Discard proceeds.
 */
export function DirtyGuardBanner({ blocker }) {
  if (blocker?.state !== 'blocked') return null;
  return (
    <div className="editor-dirty" role="alert">
      <h3>Unsaved changes</h3>
      <p>Stay to keep editing, or discard to leave without saving.</p>
      <div className="editor-btn-row">
        <button type="button" className="editor-btn editor-btn-secondary" onClick={() => blocker.reset()}>
          Stay
        </button>
        <button type="button" className="editor-btn editor-btn-danger" onClick={() => blocker.proceed()}>
          Discard
        </button>
      </div>
    </div>
  );
}
