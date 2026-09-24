import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { getId, publicPreview, teamApi } from '../../api/resources.js';
import { ADMIN_ENTITY_ROUTES, MAX_FEATURED_TEAM, slugify, useDirtyGuard } from '../../admin/editorial.js';
import {
  DirtyGuardBanner,
  EditorCard,
  EditorErrors,
  EditorField,
  EditorFooter,
  focusEditorErrors,
  teamEditorSchema,
  toEditorPayload,
  useEditorForm,
  useSlugUniqueness,
} from '../../components/admin/form-shell.jsx';
import { ErrorState, LoadingSkeleton, Toggle, TypedConfirm } from '../../components/admin/shared.jsx';
import { Form } from '../../components/ui/form';
import { Input } from '../../components/ui/input';
import MediaPicker from '../../components/admin/MediaPicker.jsx';

const EMPTY = {
  firstName: '', lastName: '', slug: '', roleTitle: '', bio: '',
  department: '', program: '', yearSection: '', profileMediaId: '', profileAlt: '',
  linkedin_url: '', github_url: '', website_url: '',
  is_featured: false, display_order: 0, is_active: true, status: 'draft',
};

function toForm(item = {}) {
  return {
    firstName: item.firstName ?? item.first_name ?? '', lastName: item.lastName ?? item.last_name ?? '',
    slug: item.slug ?? '', roleTitle: item.roleTitle ?? item.role_title ?? '', bio: item.bio ?? '',
    department: item.department ?? '', program: item.program ?? '',
    yearSection: item.yearSection ?? item.year_section ?? '',
    profileMediaId: item.profileMediaId ?? item.profile_media_id ?? '',
    profileAlt: item.profileAlt ?? item.profile_alt ?? '',
    linkedin_url: item.linkedin_url ?? '', github_url: item.github_url ?? '', website_url: item.website_url ?? '',
    is_featured: !!item.is_featured, display_order: item.display_order ?? 0,
    is_active: item.is_active ?? true, status: String(item.status ?? 'draft').toLowerCase(),
    updated_by: item.updated_by ?? null, updated_at: item.updated_at ?? null,
  };
}

export default function TeamDetail() {
  const { id } = useParams();
  const isNew = id === 'new';
  const navigate = useNavigate();
  const summaryRef = useRef(null);
  const methods = useEditorForm({ schema: teamEditorSchema, defaultValues: EMPTY });
  const {
    control, reset, watch, setValue, setError: setFieldError, handleSubmit,
    formState: { errors: rhfErrors },
  } = methods;
  const [original, setOriginal] = useState(EMPTY);
  const [loading, setLoading] = useState(!isNew);
  const [error, setError] = useState(null);
  // Load retry that preserves form state — bumps the fetch effect below
  // instead of window.location.reload(), which would wipe unsaved edits.
  const [loadRetry, setLoadRetry] = useState(0);
  const [serverError, setServerError] = useState(null);
  const [saving, setSaving] = useState(false);
  const [slugTouched, setSlugTouched] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [toast, setToast] = useState('');

  const values = watch();
  const dirty = useMemo(() => JSON.stringify(values) !== JSON.stringify(original), [values, original]);
  const blocker = useDirtyGuard(dirty && !saving);

  useEffect(() => {
    if (isNew) return;
    let alive = true;
    // teamApi rides apiFetch (cookie credentials) — unchanged from today.
    teamApi.get(id).then((item) => {
      if (!alive) return;
      const next = toForm(item);
      reset(next); setOriginal(next); setLoading(false);
    }).catch((err) => {
      if (!alive) return;
      setError(err); setLoading(false);
    });
    return () => { alive = false; };
  }, [id, isNew, loadRetry, reset]);

  // Slug auto-fills from the name until touched (same contract as before).
  const firstName = watch('firstName');
  const lastName = watch('lastName');
  useEffect(() => {
    if (!slugTouched) setValue('slug', slugify(`${firstName ?? ''} ${lastName ?? ''}`));
  }, [firstName, lastName, slugTouched, setValue]);

  const currentId = isNew ? null : getId(original) ?? id;
  const { slugDup, slugCheckError } = useSlugUniqueness(teamApi, watch('slug'), currentId);

  if (!isNew && loading) return <section aria-label="Team editor"><h1>Member</h1><LoadingSkeleton label="Loading member…" /></section>;
  // Retry clears the error + shows the loader from the click handler (not the
  // fetch effect) and bumps `loadRetry` — the form state above is untouched.
  const retryLoad = () => {
    setError(null);
    setLoading(true);
    setLoadRetry((n) => n + 1);
  };
  if (!isNew && error) return <section aria-label="Team editor"><h1>Member</h1><ErrorState error={error} onRetry={retryLoad} context="load this member" /></section>;

  const persist = (publish) => async (next) => {
    if (slugCheckError) { setFieldError('slug', { message: slugCheckError }); focusEditorErrors(summaryRef); return; }
    // Client validation runs through the zod schema (same UX-level policy as
    // validateTeam: required presence, URL shape, reserved slugs) on publish;
    // drafts save unvalidated, exactly like today.
    if (publish && slugDup) { setFieldError('slug', { message: 'Slug is already in use.' }); focusEditorErrors(summaryRef); return; }
    if (publish && next.is_featured) {
      try {
        const all = await teamApi.list();
        const others = (Array.isArray(all) ? all : []).filter(
          (m) => m.is_featured && String(getId(m) ?? m.slug) !== String(currentId),
        );
        if (others.length >= MAX_FEATURED_TEAM) {
          setServerError(`Featured cap reached (max ${MAX_FEATURED_TEAM}). Unfeature someone first.`);
          return;
        }
      } catch { /* non-blocking on lookup failure, exactly like today */ }
    }
    setSaving(true); setServerError(null);
    try {
      const payload = toEditorPayload(next, { nullable: ['department', 'program', 'yearSection'] });
      let saved;
      if (isNew) saved = await teamApi.create({ ...payload, status: publish ? 'published' : 'draft' });
      else saved = await teamApi.update(id, publish ? { ...payload, status: 'published', is_active: true } : payload);
      const fresh = toForm(saved ?? next);
      reset(fresh); setOriginal(fresh); setToast(publish ? 'Published.' : 'Saved as draft.');
      if (isNew && (getId(saved) ?? saved?.slug)) navigate(ADMIN_ENTITY_ROUTES.team.detail(getId(saved) ?? saved.slug), { replace: true });
    } catch (err) {
      setServerError(err?.body?.message ?? err?.message ?? 'Save failed.');
    } finally { setSaving(false); }
  };

  return (
    <section aria-label={isNew ? 'New member' : 'Edit member'}>
      <div className="admin-page-head">
        <div>
          <h1>{isNew ? 'New member' : `${values.firstName} ${values.lastName}`}</h1>
          <p className="admin-muted">Dept trio nullable · roleTitle required ≤ 80 · Home carousel cap {MAX_FEATURED_TEAM}.</p>
        </div>
        {!isNew ? <Link className="gdg-btn gdg-btn-secondary" to={ADMIN_ENTITY_ROUTES.team.list}>Back to list</Link> : null}
      </div>
      <DirtyGuardBanner blocker={blocker} />
      <Form {...methods}>
        {/* persist(false) is created in the submit handler (not during render)
            so the summaryRef focus path never runs at render time. */}
        <form onSubmit={(e) => handleSubmit(persist(false))(e)} noValidate>
          <EditorCard
            title={isNew ? 'New member' : 'Edit member'}
            eyebrow="Team"
            actions={(
              <a className="gdg-btn gdg-btn-secondary" href={publicPreview.team()} target="_blank" rel="noreferrer">
                Public preview
              </a>
            )}
          >
            <EditorErrors errors={rhfErrors} serverError={serverError} summaryRef={summaryRef} />
            {toast ? <p role="status" aria-live="polite" className="admin-muted">{toast}</p> : null}
            <div className="editor-grid">
              <EditorField control={control} name="firstName" label="First name" required>
                {(field) => <Input {...field} />}
              </EditorField>
              <EditorField control={control} name="lastName" label="Last name" required>
                {(field) => <Input {...field} />}
              </EditorField>
              <EditorField
                control={control}
                name="slug"
                label="Slug"
                required
                hint={slugCheckError ?? (slugDup ? 'Slug is already in use.' : 'Auto-fills from name until edited.')}
              >
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
              <EditorField control={control} name="department" label="Department (nullable)">
                {(field) => <Input {...field} value={field.value ?? ''} />}
              </EditorField>
              <EditorField control={control} name="program" label="Program (nullable)">
                {(field) => <Input {...field} value={field.value ?? ''} />}
              </EditorField>
              <EditorField control={control} name="yearSection" label="Year / section (nullable)">
                {(field) => <Input {...field} value={field.value ?? ''} />}
              </EditorField>
            </div>
            <EditorField
              control={control}
              name="profileMediaId"
              label="Profile media"
              plain
              showMessage={false}
              hint="Pick from the Media library below; the ID is stored on save."
            >
              {(field) => (
                <MediaPicker
                  id="profileMediaId"
                  label="Profile media ID"
                  hint="Pick from the Media library below; the ID is stored on save."
                  error={rhfErrors.profileMediaId?.message}
                  value={field.value ?? ''}
                  onChange={field.onChange}
                />
              )}
            </EditorField>
            <EditorField control={control} name="profileAlt" label="Photo alt text">
              {(field) => <Input {...field} value={field.value ?? ''} />}
            </EditorField>
            <div className="editor-grid">
              {['linkedin_url', 'github_url', 'website_url'].map((key) => (
                <EditorField key={key} control={control} name={key} label={key.replace('_', ' ')}>
                  {(field) => <Input {...field} value={field.value ?? ''} placeholder="https://…" />}
                </EditorField>
              ))}
            </div>
            <EditorField control={control} name="is_featured" label={`Featured on Home carousel (max ${MAX_FEATURED_TEAM})`} plain>
              {(field) => (
                <Toggle id="tm-featured" label={`Featured on Home carousel (max ${MAX_FEATURED_TEAM})`} checked={!!field.value} onChange={field.onChange} />
              )}
            </EditorField>
            <div className="editor-grid">
              <EditorField control={control} name="display_order" label="Display order">
                {(field) => <input type="number" min="0" step="1" {...field} />}
              </EditorField>
              <EditorField control={control} name="status" label="Status" plain>
                {(field) => (
                  <select id="status" {...field}>
                    {['draft', 'published', 'archived'].map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                )}
              </EditorField>
            </div>
            <EditorField control={control} name="is_active" label="Active" plain>
              {(field) => (
                <Toggle id="tm-active" label="Active" checked={!!field.value} onChange={field.onChange} />
              )}
            </EditorField>
            <EditorFooter
              saving={saving}
              isNew={isNew}
              onPublish={() => handleSubmit(persist(true))()}
              onArchive={() => setConfirmDelete(true)}
            />
          </EditorCard>
        </form>
      </Form>
      <TypedConfirm
        open={confirmDelete}
        title="Archive or delete member?"
        body="Prefer archive (is_active=false). Hard delete only for never-published drafts."
        expected={values.slug}
        confirmLabel="Archive member"
        busy={saving}
        onCancel={() => setConfirmDelete(false)}
        onConfirm={async () => {
          setSaving(true);
          try {
            await teamApi.update(id, { is_active: false, status: 'archived' });
            navigate(ADMIN_ENTITY_ROUTES.team.list);
          } catch (err) { setServerError(err?.body?.message ?? err?.message ?? 'Archive failed.'); setSaving(false); setConfirmDelete(false); }
        }}
      />
    </section>
  );
}
