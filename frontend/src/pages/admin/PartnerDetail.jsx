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
  MuiConfirmDialog,
  MuiInput,
  MuiSwitchField,
  focusEditorErrors,
  partnerEditorSchema,
  toEditorPayload,
  useEditorForm,
  useSlugUniqueness,
} from '../../components/admin/form-shell.jsx';
import { ErrorState, LoadingSkeleton } from '../../components/admin/shared.jsx';
import { Form } from '../../components/ui/form';
import Button from '@mui/material/Button';
import MenuItem from '@mui/material/MenuItem';
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
  // The static `/admin/partners/new` route carries no `:id` param
  // (useParams().id is undefined there); the detail route always supplies
  // one. A missing param therefore means "new" — without this, the new
  // form fires partnersApi.get(undefined) and renders the error state.
  const isNew = id === 'new' || id === undefined;
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
        {!isNew ? <Button component={Link} variant="outlined" to={ADMIN_ENTITY_ROUTES.partners.list}>Back to list</Button> : null}
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
              <Button component="a" variant="outlined" href={publicPreview.partners()} target="_blank" rel="noreferrer">
                Public preview
              </Button>
            )}
          >
            <EditorErrors errors={rhfErrors} serverError={serverError} summaryRef={summaryRef} />
            {toast ? <p role="status" aria-live="polite" className="admin-muted">{toast}</p> : null}
            <div className="editor-grid">
              <EditorField control={control} name="name" label="Name" required>
                {(field) => <MuiInput field={field} />}
              </EditorField>
              <EditorField
                control={control}
                name="slug"
                label="Slug"
                required
                hint={slugCheckError ?? (slugDup ? 'Slug is already in use.' : 'Auto-fills from name until edited.')}
              >
                {(field) => <MuiInput field={field} onChange={(e) => { setSlugTouched(true); field.onChange(slugify(e.target.value)); }} />}
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
                {(field) => <MuiInput field={field} value={field.value ?? ''} />}
              </EditorField>
            </div>
            <div className="editor-grid">
              <EditorField control={control} name="websiteUrl" label="Website (https)">
                {(field) => <MuiInput field={field} value={field.value ?? ''} placeholder="https://…" />}
              </EditorField>
              <EditorField control={control} name="tier" label="Tier" required>
                {(field) => (
                  <MuiInput field={field} select value={field.value ?? 'community'}>
                    {PARTNER_TIERS.map((t) => <MenuItem key={t} value={t}>{t}</MenuItem>)}
                  </MuiInput>
                )}
              </EditorField>
              <EditorField control={control} name="display_order" label="Display order">
                {(field) => <MuiInput field={field} type="number" min={0} step={1} />}
              </EditorField>
            </div>
            <EditorField control={control} name="description" label="Description">
              {(field) => <MuiInput field={field} value={field.value ?? ''} multiline rows={4} />}
            </EditorField>
            <EditorField control={control} name="is_active" label="Active" plain>
              {(field) => (
                <MuiSwitchField field={field} id="partner-active" label="Active" />
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
      <MuiConfirmDialog
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
