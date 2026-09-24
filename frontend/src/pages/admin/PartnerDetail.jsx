import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { getId, partnersApi, publicPreview } from '../../api/resources.js';
import { ADMIN_ENTITY_ROUTES, PARTNER_TIERS, slugify, useDirtyGuard } from '../../admin/editorial.js';
import {
  DirtyGuardBanner,
  EditorCard,
  EditorErrors,
  EditorField,
  EditorFooter,
  focusEditorErrors,
  partnerEditorSchema,
  toEditorPayload,
  useEditorForm,
  useSlugUniqueness,
} from '../../components/admin/form-shell.jsx';
import { ErrorState, LoadingSkeleton, Toggle, TypedConfirm } from '../../components/admin/shared.jsx';
import { Form } from '../../components/ui/form';
import { Input } from '../../components/ui/input';
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
  const methods = useEditorForm({ schema: partnerEditorSchema, defaultValues: EMPTY });
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
  const [confirm, setConfirm] = useState(false);
  const [toast, setToast] = useState('');

  const values = watch();
  const dirty = useMemo(() => JSON.stringify(values) !== JSON.stringify(original), [values, original]);
  const blocker = useDirtyGuard(dirty && !saving);

  useEffect(() => {
    if (isNew) return;
    let alive = true;
    partnersApi.get(id).then((item) => {
      if (!alive) return;
      const next = toForm(item);
      reset(next); setOriginal(next); setLoading(false);
    }).catch((err) => { if (!alive) return; setError(err); setLoading(false); });
    return () => { alive = false; };
  }, [id, isNew, loadRetry, reset]);

  // Slug auto-fills from the name until touched (same contract as before).
  const name = watch('name');
  useEffect(() => {
    if (!slugTouched) setValue('slug', slugify(name ?? ''));
  }, [name, slugTouched, setValue]);

  const currentId = isNew ? null : getId(original) ?? id;
  const { slugDup, slugCheckError } = useSlugUniqueness(partnersApi, watch('slug'), currentId);

  if (!isNew && loading) return <section aria-label="Partner editor"><h1>Partner</h1><LoadingSkeleton label="Loading partner…" /></section>;
  // Retry clears the error + shows the loader from the click handler (not the
  // fetch effect) and bumps `loadRetry` — the form state above is untouched.
  const retryLoad = () => {
    setError(null);
    setLoading(true);
    setLoadRetry((n) => n + 1);
  };
  if (!isNew && error) return <section aria-label="Partner editor"><h1>Partner</h1><ErrorState error={error} onRetry={retryLoad} context="load this partner" /></section>;

  const persist = (publish) => async (next) => {
    if (slugCheckError) { setFieldError('slug', { message: slugCheckError }); focusEditorErrors(summaryRef); return; }
    // Client validation runs through the zod schema (same UX-level policy as
    // validatePartner: required presence, https website, reserved slugs) on
    // publish; drafts save unvalidated, exactly like today.
    if (publish && slugDup) { setFieldError('slug', { message: 'Slug is already in use.' }); focusEditorErrors(summaryRef); return; }
    setSaving(true); setServerError(null);
    try {
      const payload = toEditorPayload(publish ? { ...next, status: 'published', is_active: true } : next);
      let saved;
      if (isNew) saved = await partnersApi.create({ ...payload, status: publish ? 'published' : 'draft' });
      else saved = await partnersApi.update(id, payload);
      const fresh = toForm(saved ?? next);
      reset(fresh); setOriginal(fresh); setToast(publish ? 'Published.' : 'Saved as draft.');
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
        <div><h1>{isNew ? 'New partner' : values.name}</h1><p className="admin-muted">Tier-ordered public strip; website must be https://.</p></div>
        {!isNew ? <Link className="gdg-btn gdg-btn-secondary" to={ADMIN_ENTITY_ROUTES.partners.list}>Back to list</Link> : null}
      </div>
      <DirtyGuardBanner blocker={blocker} />
      <Form {...methods}>
        {/* persist(false) is created in the submit handler (not during render)
            so the summaryRef focus path never runs at render time. */}
        <form onSubmit={(e) => handleSubmit(persist(false), () => focusEditorErrors(summaryRef))(e)} noValidate>
          <EditorCard
            title={isNew ? 'New partner' : 'Edit partner'}
            eyebrow="Partners"
            actions={(
              <a className="gdg-btn gdg-btn-secondary" href={publicPreview.partners()} target="_blank" rel="noreferrer">
                Public preview
              </a>
            )}
          >
            <EditorErrors errors={rhfErrors} serverError={serverError} summaryRef={summaryRef} />
            {toast ? <p role="status" aria-live="polite" className="admin-muted">{toast}</p> : null}
            <div className="editor-grid">
              <EditorField control={control} name="name" label="Name" required>
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
            </div>
            <div className="editor-grid">
              <EditorField
                control={control}
                name="logoMediaId"
                label="Logo media"
                plain
                showMessage={false}
                hint="Pick from the Media library below; the ID is stored on save."
              >
                {(field) => (
                  <MediaPicker
                    id="logoMediaId"
                    label="Logo media ID"
                    hint="Pick from the Media library below; the ID is stored on save."
                    error={rhfErrors.logoMediaId?.message}
                    required
                    value={field.value ?? ''}
                    onChange={field.onChange}
                  />
                )}
              </EditorField>
              <EditorField control={control} name="logoAlt" label="Logo alt text" required>
                {(field) => <Input {...field} value={field.value ?? ''} />}
              </EditorField>
            </div>
            <div className="editor-grid">
              <EditorField control={control} name="websiteUrl" label="Website (https)">
                {(field) => <Input {...field} value={field.value ?? ''} placeholder="https://…" />}
              </EditorField>
              <EditorField control={control} name="tier" label="Tier" required plain>
                {(field) => (
                  <select id="tier" value={field.value} onChange={(e) => field.onChange(e.target.value)}>
                    {PARTNER_TIERS.map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>
                )}
              </EditorField>
              <EditorField control={control} name="display_order" label="Display order">
                {(field) => <input type="number" min="0" step="1" {...field} />}
              </EditorField>
            </div>
            <EditorField control={control} name="description" label="Description">
              {(field) => <textarea {...field} value={field.value ?? ''} rows={4} />}
            </EditorField>
            <EditorField control={control} name="is_active" label="Active" plain>
              {(field) => (
                <Toggle id="partner-active" label="Active" checked={!!field.value} onChange={field.onChange} />
              )}
            </EditorField>
            <EditorFooter
              saving={saving}
              isNew={isNew}
              onPublish={() => handleSubmit(persist(true), () => focusEditorErrors(summaryRef))()}
              onArchive={() => setConfirm(true)}
            />
          </EditorCard>
        </form>
      </Form>
      <TypedConfirm
        open={confirm}
        title="Archive partner?"
        body="Archive hides it publicly but keeps it editable (preferred)."
        expected={values.slug}
        confirmLabel="Archive"
        busy={saving}
        onCancel={() => setConfirm(false)}
        onConfirm={async () => {
          setSaving(true);
          try { await partnersApi.update(id, { is_active: false }); navigate(ADMIN_ENTITY_ROUTES.partners.list); }
          catch (err) { setServerError(err?.body?.message ?? err?.message ?? 'Archive failed.'); setSaving(false); setConfirm(false); }
        }}
      />
    </section>
  );
}
