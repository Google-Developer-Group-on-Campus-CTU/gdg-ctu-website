import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { getId, partnersApi } from '../../api/resources.js';
import { ADMIN_ENTITY_ROUTES, PARTNER_TIERS, checkSlugUnique, slugify, useDirtyGuard, validatePartner } from '../../admin/editorial.js';
import { ErrorState, Field, FormSummary, LoadingSkeleton, focusSummary, inputProps, Toggle, TypedConfirm } from '../../components/admin/shared.jsx';
import MediaPicker from '../../components/admin/MediaPicker.jsx';

const EMPTY = { name: '', slug: '', logoMediaId: '', logoAlt: '', websiteUrl: '', tier: 'community', description: '', display_order: 0, is_active: true, status: 'draft' };

function toForm(item = {}) {
  return {
    name: item.name ?? '', slug: item.slug ?? '',
    logoMediaId: item.logoMediaId ?? item.logo_media_id ?? '',
    logoAlt: item.logoAlt ?? item.logo_alt ?? '',
    websiteUrl: item.websiteUrl ?? item.website_url ?? '',
    tier: item.tier ?? 'community', description: item.description ?? '',
    display_order: item.display_order ?? 0, is_active: item.is_active ?? true,
    status: String(item.status ?? 'draft').toLowerCase(),
  };
}

export default function PartnerDetail() {
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
  const [confirm, setConfirm] = useState(false);
  const [toast, setToast] = useState('');

  const dirty = useMemo(() => JSON.stringify(form) !== JSON.stringify(original), [form, original]);
  const blocker = useDirtyGuard(dirty && !saving);

  useEffect(() => {
    if (isNew) return;
    let alive = true;
    partnersApi.get(id).then((item) => {
      if (!alive) return;
      const next = toForm(item);
      setForm(next); setOriginal(next); setLoading(false);
    }).catch((err) => { if (!alive) return; setError(err); setLoading(false); });
    return () => { alive = false; };
  }, [id, isNew, loadRetry]);

  const set = (key, value) => {
    setForm((f) => {
      const next = { ...f, [key]: value };
      if (key === 'name' && !slugTouched) next.slug = slugify(value);
      return next;
    });
  };

  useEffect(() => {
    if (!form.slug) { setSlugDup(false); setSlugCheckError(null); return; }
    let alive = true;
    setSlugCheckError(null);
    const t = setTimeout(() => {
      checkSlugUnique(partnersApi, form.slug, isNew ? null : getId(original) ?? id)
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

  if (!isNew && loading) return <section aria-label="Partner editor"><h1>Partner</h1><LoadingSkeleton label="Loading partner…" /></section>;
  // Retry clears the error + shows the loader from the click handler (not the
  // fetch effect) and bumps `loadRetry` — the form state above is untouched.
  const retryLoad = () => {
    setError(null);
    setLoading(true);
    setLoadRetry((n) => n + 1);
  };
  if (!isNew && error) return <section aria-label="Partner editor"><h1>Partner</h1><ErrorState error={error} onRetry={retryLoad} context="load this partner" /></section>;

  const persist = async (publish = false) => {
    if (slugCheckError) { setErrors({ slug: slugCheckError }); focusSummary(summaryRef); return; }
    const next = publish ? { ...form, status: 'published', is_active: true } : form;
    const gate = publish ? { ...validatePartner(next), ...(slugDup ? { slug: 'Slug is already in use.' } : {}) } : {};
    setErrors(gate);
    if (Object.keys(gate).length) { focusSummary(summaryRef); return; }
    setSaving(true); setServerError(null);
    try {
      const payload = { ...next, display_order: Number(next.display_order) || 0 };
      let saved;
      if (isNew) saved = await partnersApi.create({ ...payload, status: publish ? 'published' : 'draft' });
      else saved = await partnersApi.update(id, payload);
      const fresh = toForm(saved ?? next);
      setForm(fresh); setOriginal(fresh); setToast(publish ? 'Published.' : 'Saved as draft.');
      if (isNew && (getId(saved) ?? saved?.slug)) navigate(ADMIN_ENTITY_ROUTES.partners.detail(getId(saved) ?? saved.slug), { replace: true });
    } catch (err) {
      setServerError(err?.status === 404
        ? 'POST /partners returned 404 — the greenfield partners module has not shipped on the backend yet.'
        : (err?.body?.message ?? err?.message ?? 'Save failed.'));
    } finally { setSaving(false); }
  };

  return (
    <section aria-label={isNew ? 'New partner' : 'Edit partner'}>
      <div className="admin-page-head">
        <div><h1>{isNew ? 'New partner' : form.name}</h1><p className="admin-muted">Tier-ordered public strip; website must be https://.</p></div>
        {!isNew ? <Link className="gdg-btn gdg-btn-secondary" to={ADMIN_ENTITY_ROUTES.partners.list}>Back to list</Link> : null}
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
          <Field label="Name" htmlFor="name" error={errors.name} required>
            <input {...inputProps('name', errors.name)} value={form.name} onChange={(e) => set('name', e.target.value)} />
          </Field>
          <Field label="Slug" htmlFor="slug" error={errors.slug ?? slugCheckError ?? (slugDup ? 'Slug is already in use.' : null)} required>
            <input {...inputProps('slug', errors.slug || slugCheckError || slugDup)} value={form.slug} onChange={(e) => { setSlugTouched(true); set('slug', slugify(e.target.value)); }} />
          </Field>
        </div>
        <div className="admin-form-grid">
          <MediaPicker
            id="logoMediaId"
            label="Logo media ID"
            hint="Pick from the Media library below; the ID is stored on save."
            error={errors.logoMediaId}
            required
            value={form.logoMediaId}
            onChange={(v) => set('logoMediaId', v)}
          />
          <Field label="Logo alt text" htmlFor="logoAlt" error={errors.logoAlt} required>
            <input {...inputProps('logoAlt', errors.logoAlt)} value={form.logoAlt} onChange={(e) => set('logoAlt', e.target.value)} />
          </Field>
        </div>
        <div className="admin-form-grid">
          <Field label="Website (https)" htmlFor="websiteUrl" error={errors.websiteUrl}>
            <input {...inputProps('websiteUrl', errors.websiteUrl)} value={form.websiteUrl} onChange={(e) => set('websiteUrl', e.target.value)} placeholder="https://…" />
          </Field>
          <Field label="Tier" htmlFor="tier" error={errors.tier} required>
            <select {...inputProps('tier', errors.tier)} value={form.tier} onChange={(e) => set('tier', e.target.value)}>
              {PARTNER_TIERS.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </Field>
          <Field label="Display order" htmlFor="display_order" error={errors.display_order}>
            <input {...inputProps('display_order', errors.display_order)} type="number" min="0" step="1" value={form.display_order} onChange={(e) => set('display_order', e.target.value)} />
          </Field>
        </div>
        <Field label="Description" htmlFor="description" error={errors.description}>
          <textarea {...inputProps('description', errors.description)} id="description" rows={4} value={form.description} onChange={(e) => set('description', e.target.value)} />
        </Field>
        <Toggle id="partner-active" label="Active" checked={form.is_active} onChange={(v) => set('is_active', v)} />
        <div className="gdg-btn-row">
          <button type="submit" className="gdg-btn gdg-btn-secondary" disabled={saving}>{saving ? 'Saving…' : 'Save draft'}</button>
          <button type="button" className="gdg-btn gdg-btn-primary" disabled={saving} onClick={() => persist(true)}>{saving ? 'Publishing…' : 'Publish'}</button>
          {!isNew ? <button type="button" className="gdg-btn gdg-btn-secondary" onClick={() => setConfirm(true)}>Archive / delete</button> : null}
        </div>
      </form>
      <TypedConfirm open={confirm} title="Archive partner?" body="Archive hides it publicly but keeps it editable (preferred)." expected={form.slug} confirmLabel="Archive" busy={saving}
        onCancel={() => setConfirm(false)}
        onConfirm={async () => {
          setSaving(true);
          try { await partnersApi.update(id, { is_active: false }); navigate(ADMIN_ENTITY_ROUTES.partners.list); }
          catch (err) { setServerError(err?.body?.message ?? err?.message ?? 'Archive failed.'); setSaving(false); setConfirm(false); }
        }} />
    </section>
  );
}
