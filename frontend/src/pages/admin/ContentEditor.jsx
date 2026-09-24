import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { contentApi, getId } from '../../api/resources.js';
import { ADMIN_ENTITY_ROUTES, CONTENT_KEYS, useDirtyGuard } from '../../admin/editorial.js';
import {
  contentEditorSchema,
  DirtyGuardBanner,
  EditorCard,
  EditorErrors,
  EditorField,
  EditorFooter,
  focusEditorErrors,
  useEditorForm,
} from '../../components/admin/form-shell.jsx';
import { ErrorState, LoadingSkeleton, Toggle } from '../../components/admin/shared.jsx';
import { Form } from '../../components/ui/form';
import { Input } from '../../components/ui/input';
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

/** Public preview target per section (best-effort mapping — sections render on public routes). */
const SECTION_PREVIEW = { hero: '/', about: '/about', community: '/', cta: '/', footer: '/' };

export default function ContentEditor() {
  const { sectionKey } = useParams();
  const summaryRef = useRef(null);
  const { data: session } = authClient.useSession();
  const validKey = CONTENT_KEYS.includes(sectionKey);
  const methods = useEditorForm({ schema: contentEditorSchema, defaultValues: EMPTY });
  const {
    control, reset, watch, handleSubmit,
    formState: { errors: rhfErrors },
  } = methods;
  const [original, setOriginal] = useState(EMPTY);
  const [rowId, setRowId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [loadError, setLoadError] = useState(null);
  // Load retry that preserves form state — bumps the fetch effect below
  // instead of window.location.reload(), which would wipe unsaved edits.
  const [loadRetry, setLoadRetry] = useState(0);
  const [serverError, setServerError] = useState(null);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState('');

  const values = watch();
  const dirty = useMemo(() => JSON.stringify(values) !== JSON.stringify(original), [values, original]);
  const blocker = useDirtyGuard(dirty && !saving);

  useEffect(() => {
    if (!validKey) { setLoading(false); return undefined; }
    let alive = true;
    contentApi.getBySection(sectionKey)
      .then((item) => {
        if (!alive) return;
        const next = toForm(item);
        reset(next); setOriginal(next); setRowId(getId(item));
        setLoading(false);
      })
      .catch((err) => {
        if (!alive) return;
        if (err?.status === 404) setNotFound(true);
        else setLoadError(err);
        setLoading(false);
      });
    return () => { alive = false; };
  }, [sectionKey, validKey, loadRetry, reset]);

  if (!validKey) {
    return <section aria-label="Content editor"><h1>Unknown section</h1><p>Valid keys: {CONTENT_KEYS.join(', ')}.</p><Link to={ADMIN_ENTITY_ROUTES.content.list}>Back</Link></section>;
  }
  if (loading) return <section aria-label="Content editor"><h1>{sectionKey}</h1><LoadingSkeleton label="Loading section…" /></section>;
  // Retry clears the error + shows the loader from the click handler (not the
  // fetch effect) and bumps `loadRetry` — the form state above is untouched.
  const retryLoad = () => {
    setLoadError(null);
    setNotFound(false);
    setLoading(true);
    setLoadRetry((n) => n + 1);
  };
  if (loadError) return <section aria-label="Content editor"><h1>{sectionKey}</h1><ErrorState error={loadError} onRetry={retryLoad} context="load this section" /></section>;

  const persist = (publish) => async (next) => {
    // Client validation runs through the zod schema (same UX-level policy as
    // validateContent: button URL shape) on every submit, exactly like today.
    const effective = publish ? { ...next, status: 'published', is_active: true } : next;
    setSaving(true); setServerError(null);
    try {
      // Backend CreateSiteContentSchema is camelCase (sectionKey, isActive,
      // updatedBy) — snake_case keys would be silently stripped by Zod.
      const payload = {
        title: effective.title,
        subtitle: effective.subtitle || null,
        body: effective.body || null,
        mediaId: effective.mediaId || null,
        buttonText: effective.buttonText || null,
        buttonUrl: effective.buttonUrl || null,
        isActive: !!effective.is_active,
        status: effective.status,
        sectionKey,
        updatedBy: session?.user?.id ?? '',
      };
      let saved;
      if (rowId) saved = await contentApi.update(rowId, payload);
      else if (notFound) saved = await contentApi.create({ ...payload, status: publish ? 'published' : 'draft' });
      else saved = await contentApi.updateBySection(sectionKey, payload);
      const fresh = toForm(saved ?? effective);
      reset(fresh); setOriginal(fresh);
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
          <p className="admin-muted">sectionKey immutable · {notFound ? 'no row yet — saving creates it' : `row ${rowId ?? ''}`} {values.updated_at ? `· last edited ${values.updated_at}${values.updated_by ? ` by ${values.updated_by}` : ''}` : ''}</p>
        </div>
        <Link className="gdg-btn gdg-btn-secondary" to={ADMIN_ENTITY_ROUTES.content.list}>Back to sections</Link>
      </div>
      <DirtyGuardBanner blocker={blocker} />
      <Form {...methods}>
        {/* persist(false) is created in the submit handler (not during render)
            so the summaryRef focus path never runs at render time. */}
        <form onSubmit={(e) => handleSubmit(persist(false), () => focusEditorErrors(summaryRef))(e)} noValidate>
          <EditorCard
            title={`Edit ${sectionKey}`}
            eyebrow="Content"
            actions={(
              <a className="gdg-btn gdg-btn-secondary" href={SECTION_PREVIEW[sectionKey] ?? '/'} target="_blank" rel="noreferrer">
                Public preview
              </a>
            )}
          >
            <EditorErrors errors={rhfErrors} serverError={serverError} summaryRef={summaryRef} />
            {toast ? <p role="status" aria-live="polite" className="admin-muted">{toast}</p> : null}
            <EditorField control={control} name="title" label="Title">
              {(field) => <Input {...field} value={field.value ?? ''} />}
            </EditorField>
            <EditorField control={control} name="subtitle" label="Subtitle">
              {(field) => <Input {...field} value={field.value ?? ''} />}
            </EditorField>
            <EditorField control={control} name="body" label="Body (markdown)">
              {(field) => <textarea {...field} value={field.value ?? ''} rows={8} />}
            </EditorField>
            <EditorField
              control={control}
              name="mediaId"
              label="Media"
              plain
              showMessage={false}
              hint="Search and select from the Media library below."
            >
              {(field) => (
                <MediaPicker
                  id="mediaId"
                  label="Media ID"
                  hint="Search and select from the Media library below."
                  error={rhfErrors.mediaId?.message}
                  value={field.value ?? ''}
                  onChange={field.onChange}
                />
              )}
            </EditorField>
            <div className="editor-grid">
              <EditorField control={control} name="buttonText" label="Button text">
                {(field) => <Input {...field} value={field.value ?? ''} />}
              </EditorField>
              <EditorField control={control} name="buttonUrl" label="Button URL">
                {(field) => <Input {...field} value={field.value ?? ''} placeholder="https://…" />}
              </EditorField>
            </div>
            <EditorField control={control} name="is_active" label="Active" plain>
              {(field) => (
                <Toggle id="content-active" label="Active" checked={!!field.value} onChange={field.onChange} />
              )}
            </EditorField>
            <EditorFooter
              saving={saving}
              isNew={false}
              onPublish={() => handleSubmit(persist(true), () => focusEditorErrors(summaryRef))()}
            />
          </EditorCard>
        </form>
      </Form>
    </section>
  );
}
