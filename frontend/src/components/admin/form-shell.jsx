import { cloneElement, isValidElement, useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogContentText from '@mui/material/DialogContentText';
import DialogActions from '@mui/material/DialogActions';
import Alert from '@mui/material/Alert';
import CircularProgress from '@mui/material/CircularProgress';
import MuiTextField from '@mui/material/TextField';
import {
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '../ui/form';
import { checkSlugUnique, isAnyUrl, isHttpsUrl, isReservedSlug } from '../../admin/editorial.js';
import {
  DEPARTMENT_ORDER as THEME_DEPARTMENT_ORDER,
  normalizeDepartment as themeNormalizeDepartment,
} from '../../theme/teamTheme.js';
import { MuiInput, MuiSwitchField } from './mui-fields.jsx';
import { focusLinkedField } from './shared.jsx';
import './form-shell.css';

/** MUI-based field components, re-exported here so every detail page
 * imports its form controls from this single wrapper. */
export { MuiInput, MuiSwitchField };

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

const emptyToUndefinedUrl = (message) =>
  z.string().optional().refine((v) => !v || isAnyUrl(v), message);

/**
 * Single zod schema per entity, mirroring backend truth at the same policy
 * level as validateTeam (UX-level only: required presence, URL shape,
 * reserved slugs — see admin/editorial.js). The backend Zod schemas stay the
 * single source of truth for nullability/enums/ranges/cross-field rules;
 * anything not checked here surfaces as the server 400 banner on save.
 */
/**
 * Team department vocabulary — imported from the theme single source of
 * truth (frontend/src/theme/teamTheme.js), the same DEPARTMENT_ORDER the
 * public Officers page and TeamCard render from. Falls back to the pinned
 * six-team list if the theme export is ever missing/empty so the form
 * still builds.
 */
const TEAM_DEPARTMENTS_FALLBACK = [
  'Executive',
  'Operations',
  'Technology',
  'Creatives',
  'Community Development',
  'Finance',
];

export const TEAM_DEPARTMENTS =
  Array.isArray(THEME_DEPARTMENT_ORDER) && THEME_DEPARTMENT_ORDER.length > 0
    ? THEME_DEPARTMENT_ORDER
    : TEAM_DEPARTMENTS_FALLBACK;

const normalizeDeptInput =
  typeof themeNormalizeDepartment === 'function'
    ? themeNormalizeDepartment
    : (v) => String(v ?? '').trim();

/** Theme-backed department normalizer, re-exported for the Team lanes. */
export const normalizeTeamDepartment = (value) => normalizeDeptInput(value);

/**
 * Site-content keys the public Team page reads (documented contract — there
 * is no site-content module/backend table in this repo, so these keys are
 * hardcoded copy in frontend/src/pages/Officers.jsx until a CMS store
 * exists):
 *   team.hero   (visible) — "MEET THE TEAM / The PEOPLE behind the community"
 *   team.values (visible) — "MORE THAN A ROLE: Plan · Connect · Create · Deliver"
 *   team.join   (visible) — "Join Us / There's always room for another builder"
 */

export const teamEditorSchema = z.object({
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  slug: z.string().optional().refine(
    (v) => !v || !isReservedSlug(String(v ?? '')),
    'This slug is reserved.',
  ),
  // Term-row role (member_terms.role, ≤ 80) — what the public card's role
  // pill renders (public `role` ← member_terms.role, NOT team_members).
  role: z.string().max(80, 'Role must be ≤ 80 characters.').optional(),
  bio: z.string().optional(),
  // Legacy CMS rows store free-text ("Executive Board",
  // "Operations Department", …) — normalize through the theme matcher
  // before the enum check so they validate instead of 400ing.
  department: z.preprocess(
    (v) => {
      if (v === '' || v == null) return v;
      const normalized = normalizeDeptInput(v);
      return normalized === 'Team' ? v : normalized;
    },
    z.enum(TEAM_DEPARTMENTS).nullable().optional().or(z.literal('')),
  ),
  program: z.string().optional(),
  yearSection: z.string().optional(),
  profileMediaId: z.string().optional(),
  linkedinUrl: emptyToUndefinedUrl('Must be a valid URL.'),
  githubUrl: emptyToUndefinedUrl('Must be a valid URL.'),
  websiteUrl: emptyToUndefinedUrl('Must be a valid URL.'),
  isFeatured: z.boolean(),
  displayOrder: z.coerce.number().int().min(0, 'Display order must be ≥ 0.'),
  isActive: z.boolean(),
  status: z.string(),
  // Term-aware editing: which S.Y. row the role/order/photo/isActive below target.
  termId: z.string().optional(),
  termDisplayOrder: z.coerce.number().int().min(0, 'Term order must be ≥ 0.').optional(),
  termIsActive: z.boolean().optional(),
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
 * Editor card: stock MUI Card + CardContent (same title/eyebrow/actions
 * API as before — visual-only). The `editor-card` class hook is kept so
 * existing admin.css layout (grid gaps, dots) still applies.
 */
export function EditorCard({ title, eyebrow, actions, children }) {
  return (
    <Card className="editor-card">
      <CardContent>
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
      </CardContent>
    </Card>
  );
}

/**
 * RHF-bound field (spec §6.1). `children` is a render function receiving the
 * Controller `field` ({ value, onChange, onBlur, name, ref }):
 *
 *   <EditorField control={control} name="firstName" label="First name" required>
 *     {(field) => <MuiInput field={field} />}
 *   </EditorField>
 *
 * `required` renders the asterisk AND sets `required` + `aria-required="true"`
 * on the control (forms are `noValidate`, so RHF owns validation and the
 * error summary owns focus). Single ref-forwarding inputs (MuiInput,
 * native input/textarea/select) render inside FormControl, which supplies id
 * + aria-invalid + aria-describedby (hint/error) via Slot. For composite
 * children that cannot take Slot props (MediaPicker, file inputs) pass
 * `plain` — the child renders unwrapped with hint/error text still shown
 * below. Components with their own error UI (MediaPicker) also pass
 * `showMessage={false}` to avoid double errors.
 * When the child is a stock MUI field (`MuiInput`/`MuiSwitchField`) and it
 * currently has a validation error, the message renders as the MUI
 * `helperText` (TextField) / `FormHelperText` (switch) instead of a second
 * line below — one error, in the MUI default slot. Anchors in EditorErrors
 * (`#name`) land on the FormItem wrapper (`anchorId ?? name`) and move focus
 * into the field on click.
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
      render={({ field, fieldState }) => {
        const bound = required ? { ...field, required: true, 'aria-required': 'true' } : field;
        const node = typeof children === 'function' ? children(bound) : children;
        const errMsg = fieldState?.error?.message ?? null;
        // Stock MUI fields own their error slot: surface the message as
        // helperText instead of duplicating it in FormMessage below.
        if (!plain && showMessage && errMsg && isValidElement(node)) {
          if (node.type === MuiInput && node.props.helperText == null) {
            return (
              <FormItem id={anchorId ?? String(name)} className={className ? `editor-field ${className}` : 'editor-field'}>
                <FormLabel className="editor-label">
                  {label} {required ? <span aria-hidden="true">*</span> : null}
                </FormLabel>
                <FormControl required={required ? true : undefined} aria-required={required ? 'true' : undefined}>
                  {cloneElement(node, { error: true, helperText: errMsg })}
                </FormControl>
                {hint ? <FormDescription className="editor-hint">{hint}</FormDescription> : null}
              </FormItem>
            );
          }
          if (node.type === MuiSwitchField && node.props.errorText == null) {
            return (
              <FormItem id={anchorId ?? String(name)} className={className ? `editor-field ${className}` : 'editor-field'}>
                <FormLabel className="editor-label">
                  {label} {required ? <span aria-hidden="true">*</span> : null}
                </FormLabel>
                {cloneElement(node, { errorText: errMsg })}
                {hint ? <FormDescription className="editor-hint">{hint}</FormDescription> : null}
              </FormItem>
            );
          }
        }
        return (
          <FormItem id={anchorId ?? String(name)} className={className ? `editor-field ${className}` : 'editor-field'}>
            <FormLabel className="editor-label">
              {label} {required ? <span aria-hidden="true">*</span> : null}
            </FormLabel>
            {plain ? (
              node
            ) : (
              <FormControl required={required ? true : undefined} aria-required={required ? 'true' : undefined}>
                {node}
              </FormControl>
            )}
            {hint ? <FormDescription className="editor-hint">{hint}</FormDescription> : null}
            {showMessage ? <FormMessage className="editor-error" /> : null}
          </FormItem>
        );
      }}
    />
  );
}

function errorMessage(value) {
  if (!value) return null;
  if (typeof value === 'string') return value;
  return value.message ?? null;
}

/**
 * Error summary (stock MUI Alert): "fix N fields" + anchor links that move
 * focus into the field, focusable via summaryRef (focused on submit).
 * Accepts a flat { field: message } map or RHF formState.errors.
 * `serverError` (backend 400 text) renders as the banner paragraph in the
 * same alert. Same props and semantics as before — visual-only migration.
 */
export function EditorErrors({ errors, serverError, summaryRef, title }) {
  const list = Object.entries(errors ?? {})
    .map(([key, value]) => [key, errorMessage(value)])
    .filter(([, message]) => !!message);
  if (list.length === 0 && !serverError) return null;
  const count = list.length;
  return (
    <Alert ref={summaryRef} tabIndex={-1} role="alert" severity="error" className="editor-errors">
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
    </Alert>
  );
}

/**
 * Action bar: one outlined secondary (save draft, form submit), one
 * contained primary (publish), one outlined-error destructive
 * (archive/delete, hidden for new records). Stock MUI Buttons with a
 * 16px spinner while saving. Same props and semantics — visual-only.
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
  const spinner = <CircularProgress size={16} aria-hidden="true" />;
  return (
    <div className="editor-footer">
      <Button type="submit" variant="outlined" disabled={saving} aria-busy={saving} startIcon={saving ? spinner : null}>
        {saving ? 'Saving…' : saveLabel}
      </Button>
      <Button type="button" variant="contained" disabled={saving} aria-busy={saving} onClick={onPublish} startIcon={saving ? spinner : null}>
        {saving ? 'Publishing…' : publishLabel}
      </Button>
      {!isNew && onArchive ? (
        <Button type="button" variant="outlined" color="error" disabled={saving} aria-busy={saving} onClick={onArchive}>
          {archiveLabel}
        </Button>
      ) : null}
    </div>
  );
}

/**
 * Stock MUI replacement for the custom typed `TypedConfirm` dialog:
 * destructive confirm gated on typing `expected`, with the same props and
 * gate semantics. Focus trap, Esc, and backdrop-close come from MUI Dialog
 * (backdrop/Esc are ignored while `busy`). Visual-only migration — the
 * archive/delete payload logic in the pages is untouched.
 */
export function MuiConfirmDialog({ open, title, body, expected, confirmLabel = 'Confirm', onConfirm, onCancel, busy }) {
  const [typed, setTyped] = useState('');
  useEffect(() => {
    if (open) setTyped('');
  }, [open ]);
  if (!open) return null;
  const matches = typed.trim() === String(expected ?? '').trim();
  return (
    <Dialog
      open
      onClose={(_e, reason) => {
        if (busy) return;
        if (reason === 'backdropClick' || reason === 'escapeKeyDown') onCancel?.();
      }}
      aria-labelledby="mui-confirm-title"
      aria-describedby="mui-confirm-body"
    >
      <DialogTitle id="mui-confirm-title">{title}</DialogTitle>
      <DialogContent>
        <DialogContentText id="mui-confirm-body">{body}</DialogContentText>
        <p className="gdg-confirm-label">
          Type <code className="gdg-code-muted">{expected}</code> to confirm
        </p>
        <MuiTextField
          id="mui-confirm-input"
          value={typed}
          onChange={(e) => setTyped(e.target.value)}
          autoComplete="off"
          fullWidth
          variant="outlined"
          autoFocus
        />
      </DialogContent>
      <DialogActions>
        <Button variant="outlined" onClick={onCancel} disabled={busy}>
          Cancel
        </Button>
        <Button variant="contained" color="error" disabled={!matches || busy} onClick={onConfirm}>
          {busy ? 'Working…' : confirmLabel}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

/**
 * Unsaved-changes guard driven by useDirtyGuard/useBlocker semantics:
 * pass the blocker through, Stay resets it, Discard proceeds.
 * Stock MUI Dialog — same blocker contract, visual-only.
 */
export function DirtyGuardBanner({ blocker }) {
  const blocked = blocker?.state === 'blocked';
  return (
    <Dialog open={blocked} onClose={() => blocker?.reset?.()} aria-labelledby="dirty-guard-title">
      <DialogTitle id="dirty-guard-title">Unsaved changes</DialogTitle>
      <DialogContent>
        <DialogContentText>Stay to keep editing, or discard to leave without saving.</DialogContentText>
      </DialogContent>
      <DialogActions>
        <Button variant="outlined" onClick={() => blocker?.reset?.()}>
          Stay
        </Button>
        <Button variant="contained" color="error" onClick={() => blocker?.proceed?.()}>
          Discard
        </Button>
      </DialogActions>
    </Dialog>
  );
}
