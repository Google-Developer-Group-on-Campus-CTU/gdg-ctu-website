import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { getId, teamApi } from '../../api/resources.js';
import { ADMIN_ENTITY_ROUTES, MAX_FEATURED_TEAM, checkSlugUnique, slugify, useDirtyGuard, validateTeam } from '../../admin/editorial.js';
import { ErrorState, Field, FormSummary, LoadingSkeleton, focusSummary, inputProps, Toggle, TypedConfirm } from '../../components/admin/shared.jsx';
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
  const [form, setForm] = useState(EMPTY);
  const [original, setOriginal] = useState(EMPTY);
  const [loading, setLoading] = useState(!isNew);
  const [error, setError] = useState(null);
  // Load retry that preserves form state — bumps the fetch effect below
  // instead of window.location.reload(), which would wipe unsaved edits.
  const [loadRetry, setLoadRetry] = useState(0);
  const [errors, setErrors] = useState({});
  const [serverError, setServerError] = useState(null);
  const [saving, setSaving] = useState(false);
  const [slugTouched, setSlugTouched] = useState(false);
  const [slugDup, setSlugDup] = useState(false);
  const [slugCheckError, setSlugCheckError] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [toast, setToast] = useState('');

  const dirty = useMemo(() => JSON.stringify(form) !== JSON.stringify(original), [form, original]);
  const blocker = useDirtyGuard(dirty && !saving);

  useEffect(() => {
    if (isNew) return;
    let alive = true;
    teamApi.get(id).then((item) => {
      if (!alive) return;
      const next = toForm(item);
      setForm(next); setOriginal(next); setLoading(false);
    }).catch((err) => {
      if (!alive) return;
      setError(err); setLoading(false);
    });
    return () => { alive = false; };
  }, [id, isNew, loadRetry]);

  const set = (key, value) => {
    setForm((f) => {
      const next = { ...f, [key]: value };
      if (!slugTouched && (key === 'firstName' || key === 'lastName')) {
        next.slug = slugify(`${next.firstName} ${next.lastName}`);
      }
      return next;
    });
  };

  useEffect(() => {
    if (!form.slug) { setSlugDup(false); setSlugCheckError(null); return; }
    let alive = true;
    setSlugCheckError(null);
    const t = setTimeout(() => {
      checkSlugUnique(teamApi, form.slug, isNew ? null : getId(original) ?? id)
        .then((unique) => { if (alive) { setSlugDup(!unique); setSlugCheckError(null); } })
        .catch((err) => {
          if (!alive) return;
          if (err?.status === 404) { setSlugDup(false); setSlugCheckError(null); return; }
          // 500/timeout/network: unverifiable — block save with the error.
          setSlugDup(false);
          setSlugCheckError(err?.body?.message ?? err?.message ?? 'Could not verify slug uniqueness.');
        });
    }, 400);
    return () => { alive = false; clearTimeout(t); };
  }, [form.slug, id, isNew, original]);

  if (!isNew && loading) return <section aria-label="Team editor"><h1>Member</h1><LoadingSkeleton label="Loading member…" /></section>;
  // Retry clears the error + shows the loader from the click handler (not the
  // fetch effect) and bumps `loadRetry` — the form state above is untouched.
  const retryLoad = () => {
    setError(null);
    setLoading(true);
    setLoadRetry((n) => n + 1);
  };
  if (!isNew && error) return <section aria-label="Team editor"><h1>Member</h1><ErrorState error={error} onRetry={retryLoad} context="load this member" /></section>;

  const persist = async (publish = false) => {
    if (slugCheckError) { setErrors({ slug: slugCheckError }); focusSummary(summaryRef); return; }
    const next = publish ? { ...form, status: 'published', is_active: true } : form;
    const gate = publish ? { ...validateTeam(next), ...(slugDup ? { slug: 'Slug is already in use.' } : {}) } : {};
    setErrors(gate);
    if (Object.keys(gate).length) { focusSummary(summaryRef); return; }
    if (publish && next.is_featured) {
      try {
        const all = await teamApi.list();
        const others = (Array.isArray(all) ? all : []).filter(
          (m) => m.is_featured && String(getId(m) ?? m.slug) !== String(getId(original) ?? id),
        );
        if (others.length >= MAX_FEATURED_TEAM) {
          setServerError(`Featured cap reached (max ${MAX_FEATURED_TEAM}). Unfeature someone first.`);
          return;
        }
      } catch { /* non-blocking */ }
    }
    setSaving(true); setServerError(null);
    try {
      const payload = {
        ...next, display_order: Number(next.display_order) || 0,
        department: next.department || null, program: next.program || null, yearSection: next.yearSection || null,
      };
      let saved;
      if (isNew) saved = await teamApi.create({ ...payload, status: publish ? 'published' : 'draft' });
      else saved = await teamApi.update(id, payload);
      const fresh = toForm(saved ?? next);
      setForm(fresh); setOriginal(fresh); setToast(publish ? 'Published.' : 'Saved as draft.');
      if (isNew && (getId(saved) ?? saved?.slug)) navigate(ADMIN_ENTITY_ROUTES.team.detail(getId(saved) ?? saved.slug), { replace: true });
    } catch (err) {
      setServerError(err?.body?.message ?? err?.message ?? 'Save failed.');
    } finally { setSaving(false); }
  };

  return (
    <section aria-label={isNew ? 'New member' : 'Edit member'}>
      <div className="admin-page-head">
        <div>
          <h1>{isNew ? 'New member' : `${form.firstName} ${form.lastName}`}</h1>
          <p className="admin-muted">Dept trio nullable · roleTitle required ≤ 80 · Home carousel cap {MAX_FEATURED_TEAM}.</p>
        </div>
        {!isNew ? <Link className="gdg-btn gdg-btn-secondary" to={ADMIN_ENTITY_ROUTES.team.list}>Back to list</Link> : null}
      </div>
      {blocker?.state === 'blocked' ? (
        <div className="admin-summary" role="alert"><h3>Unsaved changes</h3>
          <div className="gdg-btn-row">
            <button type="button" className="gdg-btn gdg-btn-secondary" onClick={() => blocker.reset()}>Stay</button>
            <button type="button" className="gdg-btn gdg-btn-primary admin-danger" onClick={() => blocker.proceed()}>Discard</button>
          </div>
        </div>
      ) : null}
      <FormSummary errors={errors} summaryRef={summaryRef} />
      {serverError ? <div className="admin-summary" role="alert"><p>{serverError}</p></div> : null}
      {toast ? <p role="status" aria-live="polite" className="admin-muted">{toast}</p> : null}
      <form className="admin-form" onSubmit={(e) => { e.preventDefault(); persist(false); }} noValidate>
        <div className="admin-form-grid">
          <Field label="First name" htmlFor="firstName" error={errors.firstName} required>
            <input {...inputProps('firstName', errors.firstName)} value={form.firstName} onChange={(e) => set('firstName', e.target.value)} />
          </Field>
          <Field label="Last name" htmlFor="lastName" error={errors.lastName} required>
            <input {...inputProps('lastName', errors.lastName)} value={form.lastName} onChange={(e) => set('lastName', e.target.value)} />
          </Field>
          <Field label="Slug" htmlFor="slug" error={errors.slug ?? slugCheckError ?? (slugDup ? 'Slug is already in use.' : null)} required>
            <input {...inputProps('slug', errors.slug || slugCheckError || slugDup)} value={form.slug} onChange={(e) => { setSlugTouched(true); set('slug', slugify(e.target.value)); }} />
          </Field>
          <Field label="Role title (≤ 80)" htmlFor="roleTitle" error={errors.roleTitle} required>
            <input {...inputProps('roleTitle', errors.roleTitle)} maxLength={80} value={form.roleTitle} onChange={(e) => set('roleTitle', e.target.value)} />
          </Field>
        </div>
        <Field label="Bio" htmlFor="bio" error={errors.bio}>
          <textarea {...inputProps('bio', errors.bio)} id="bio" rows={4} value={form.bio} onChange={(e) => set('bio', e.target.value)} />
        </Field>
        <div className="admin-form-grid">
          <Field label="Department (nullable)" htmlFor="department" error={errors.department}>
            <input {...inputProps('department', errors.department)} value={form.department} onChange={(e) => set('department', e.target.value)} />
          </Field>
          <Field label="Program (nullable)" htmlFor="program" error={errors.program}>
            <input {...inputProps('program', errors.program)} value={form.program} onChange={(e) => set('program', e.target.value)} />
          </Field>
          <Field label="Year / section (nullable)" htmlFor="yearSection" error={errors.yearSection}>
            <input {...inputProps('yearSection', errors.yearSection)} value={form.yearSection} onChange={(e) => set('yearSection', e.target.value)} />
          </Field>
        </div>
        <div className="admin-form-grid">
          <MediaPicker
            id="profileMediaId"
            label="Profile media ID"
            hint="Pick from the Media library below; the ID is stored on save."
            error={errors.profileMediaId}
            value={form.profileMediaId}
            onChange={(v) => set('profileMediaId', v)}
          />
          <Field label="Photo alt text" htmlFor="profileAlt" error={errors.profileAlt}>
            <input {...inputProps('profileAlt', errors.profileAlt)} value={form.profileAlt} onChange={(e) => set('profileAlt', e.target.value)} />
          </Field>
        </div>
        <div className="admin-form-grid">
          {['linkedin_url', 'github_url', 'website_url'].map((key) => (
            <Field key={key} label={key.replace('_', ' ')} htmlFor={key} error={errors[key]}>
              <input {...inputProps(key, errors[key])} value={form[key]} onChange={(e) => set(key, e.target.value)} placeholder="https://…" />
            </Field>
          ))}
        </div>
        <Toggle id="tm-featured" label={`Featured on Home carousel (max ${MAX_FEATURED_TEAM})`} checked={form.is_featured} onChange={(v) => set('is_featured', v)} />
        <div className="admin-form-grid">
          <Field label="Display order" htmlFor="display_order" error={errors.display_order}>
            <input {...inputProps('display_order', errors.display_order)} type="number" min="0" step="1" value={form.display_order} onChange={(e) => set('display_order', e.target.value)} />
          </Field>
          <Field label="Status" htmlFor="status" error={errors.status}>
            <select {...inputProps('status', errors.status)} value={form.status} onChange={(e) => set('status', e.target.value)}>
              {['draft', 'published', 'archived'].map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </Field>
        </div>
        <Toggle id="tm-active" label="Active" checked={form.is_active} onChange={(v) => set('is_active', v)} />
        <div className="gdg-btn-row">
          <button type="submit" className="gdg-btn gdg-btn-secondary" disabled={saving}>{saving ? 'Saving…' : 'Save draft'}</button>
          <button type="button" className="gdg-btn gdg-btn-primary" disabled={saving} onClick={() => persist(true)}>{saving ? 'Publishing…' : 'Publish'}</button>
          {!isNew ? <button type="button" className="gdg-btn gdg-btn-secondary" onClick={() => setConfirmDelete(true)}>Archive / delete</button> : null}
        </div>
      </form>
      <TypedConfirm open={confirmDelete} title="Archive or delete member?" body="Prefer archive (is_active=false). Hard delete only for never-published drafts." expected={form.slug} confirmLabel="Archive member" busy={saving}
        onCancel={() => setConfirmDelete(false)}
        onConfirm={async () => {
          setSaving(true);
          try {
            await teamApi.update(id, { is_active: false, status: 'archived' });
            navigate(ADMIN_ENTITY_ROUTES.team.list);
          } catch (err) { setServerError(err?.body?.message ?? err?.message ?? 'Archive failed.'); setSaving(false); setConfirmDelete(false); }
        }} />
    </section>
  );
}
