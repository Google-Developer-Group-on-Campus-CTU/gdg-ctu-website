import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { contentApi, getId } from '../../api/resources.js';
import { ADMIN_ENTITY_ROUTES, CONTENT_KEYS, useDirtyGuard, validateContent } from '../../admin/editorial.js';
import { ErrorState, Field, FormSummary, LoadingSkeleton, focusSummary, inputProps, Toggle } from '../../components/admin/shared.jsx';
import MediaPicker from '../../components/admin/MediaPicker.jsx';
import { authClient } from '../../lib/auth-client';

const EMPTY = { title: '', subtitle: '', body: '', mediaId: '', buttonText: '', buttonUrl: '', is_active: true, status: 'draft' };

function toForm(item = {}) {
  return {
    title: item.title ?? '', subtitle: item.subtitle ?? '', body: item.body ?? '',
    mediaId: item.mediaId ?? item.media_id ?? '',
    buttonText: item.buttonText ?? item.button_text ?? '',
    buttonUrl: item.buttonUrl ?? item.button_url ?? '',
    // Backend (Drizzle) returns camelCase; keep snake fallbacks for old payloads.
    is_active: item.is_active ?? item.isActive ?? true,
    status: String(item.status ?? 'draft').toLowerCase(),
    updated_by: item.updated_by ?? item.updatedBy ?? null,
    updated_at: item.updated_at ?? item.updatedAt ?? null,
  };
}

export default function ContentEditor() {
  const { sectionKey } = useParams();
  const summaryRef = useRef(null);
  const { data: session } = authClient.useSession();
  const validKey = CONTENT_KEYS.includes(sectionKey);
  const [form, setForm] = useState(EMPTY);
  const [original, setOriginal] = useState(EMPTY);
  const [rowId, setRowId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [loadError, setLoadError] = useState(null);
  const [errors, setErrors] = useState({});
  const [serverError, setServerError] = useState(null);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState('');

  const dirty = useMemo(() => JSON.stringify(form) !== JSON.stringify(original), [form, original]);
  const blocker = useDirtyGuard(dirty && !saving);

  useEffect(() => {
    if (!validKey) { setLoading(false); return; }
    let alive = true;
    contentApi.getBySection(sectionKey)
      .then((item) => {
        if (!alive) return;
        const next = toForm(item);
        setForm(next); setOriginal(next); setRowId(getId(item));
        setLoading(false);
      })
      .catch((err) => {
        if (!alive) return;
        if (err?.status === 404) setNotFound(true);
        else setLoadError(err);
        setLoading(false);
      });
    return () => { alive = false; };
  }, [sectionKey, validKey]);

  if (!validKey) {
    return <section aria-label="Content editor"><h1>Unknown section</h1><p>Valid keys: {CONTENT_KEYS.join(', ')}.</p><Link to={ADMIN_ENTITY_ROUTES.content.list}>Back</Link></section>;
  }
  if (loading) return <section aria-label="Content editor"><h1>{sectionKey}</h1><LoadingSkeleton label="Loading section…" /></section>;
  if (loadError) return <section aria-label="Content editor"><h1>{sectionKey}</h1><ErrorState error={loadError} onRetry={() => window.location.reload()} context="load this section" /></section>;

  const set = (key, value) => setForm((f) => ({ ...f, [key]: value }));

  const persist = async (publish = false) => {
    const next = publish ? { ...form, status: 'published', is_active: true } : form;
    const gate = { ...validateContent(next) };
    setErrors(gate);
    if (Object.keys(gate).length) { focusSummary(summaryRef); return; }
    setSaving(true); setServerError(null);
    try {
      // Backend CreateSiteContentSchema is camelCase (sectionKey, isActive,
      // updatedBy) — snake_case keys would be silently stripped by Zod.
      const payload = {
        title: next.title,
        subtitle: next.subtitle || null,
        body: next.body || null,
        mediaId: next.mediaId || null,
        buttonText: next.buttonText || null,
        buttonUrl: next.buttonUrl || null,
        isActive: !!next.is_active,
        status: next.status,
        sectionKey,
        updatedBy: session?.user?.id ?? '',
      };
      let saved;
      if (rowId) saved = await contentApi.update(rowId, payload);
      else if (notFound) saved = await contentApi.create({ ...payload, status: publish ? 'published' : 'draft' });
      else saved = await contentApi.updateBySection(sectionKey, payload);
      const fresh = toForm(saved ?? next);
      setForm(fresh); setOriginal(fresh);
      if (getId(saved)) setRowId(getId(saved));
      setNotFound(false);
      setToast(publish ? 'Published.' : 'Saved as draft.');
    } catch (err) {
      setServerError(err?.body?.message ?? err?.message ?? 'Save failed.');
    } finally { setSaving(false); }
  };

  return (
    <section aria-label={`Edit ${sectionKey}`}>
      <div className="admin-page-head">
        <div>
          <h1>{sectionKey}</h1>
          <p className="admin-muted">sectionKey immutable · {notFound ? 'no row yet — saving creates it' : `row ${rowId ?? ''}`} {form.updated_at ? `· last edited ${form.updated_at}${form.updated_by ? ` by ${form.updated_by}` : ''}` : ''}</p>
        </div>
        <Link className="gdg-btn gdg-btn-secondary" to={ADMIN_ENTITY_ROUTES.content.list}>Back to sections</Link>
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
        <Field label="Title" htmlFor="title" error={errors.title}>
          <input {...inputProps('title', errors.title)} value={form.title} onChange={(e) => set('title', e.target.value)} />
        </Field>
        <Field label="Subtitle" htmlFor="subtitle" error={errors.subtitle}>
          <input {...inputProps('subtitle', errors.subtitle)} value={form.subtitle} onChange={(e) => set('subtitle', e.target.value)} />
        </Field>
        <Field label="Body (markdown)" htmlFor="body" error={errors.body}>
          <textarea {...inputProps('body', errors.body)} id="body" rows={8} value={form.body} onChange={(e) => set('body', e.target.value)} />
        </Field>
        <MediaPicker
          id="mediaId"
          label="Media ID"
          hint="Search and select from the Media library below."
          error={errors.mediaId}
          value={form.mediaId}
          onChange={(v) => set('mediaId', v)}
        />
        <div className="admin-form-grid">
          <Field label="Button text" htmlFor="buttonText" error={errors.buttonText}>
            <input {...inputProps('buttonText', errors.buttonText)} value={form.buttonText} onChange={(e) => set('buttonText', e.target.value)} />
          </Field>
          <Field label="Button URL" htmlFor="buttonUrl" error={errors.buttonUrl}>
            <input {...inputProps('buttonUrl', errors.buttonUrl)} value={form.buttonUrl} onChange={(e) => set('buttonUrl', e.target.value)} placeholder="https://…" />
          </Field>
        </div>
        <Toggle id="content-active" label="Active" checked={form.is_active} onChange={(v) => set('is_active', v)} />
        <div className="gdg-btn-row">
          <button type="submit" className="gdg-btn gdg-btn-secondary" disabled={saving}>{saving ? 'Saving…' : 'Save draft'}</button>
          <button type="button" className="gdg-btn gdg-btn-primary" disabled={saving} onClick={() => persist(true)}>{saving ? 'Publishing…' : 'Publish'}</button>
        </div>
      </form>
    </section>
  );
}
