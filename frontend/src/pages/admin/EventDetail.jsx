import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { eventsApi, getId, mediaApi, publicPreview, speakersApi } from '../../api/resources.js';
import { pickImage } from '../../api/public.js';
import {
  ADMIN_ENTITY_ROUTES,
  EVENT_STATUSES, MAX_FEATURED_EVENTS, isHttpsUrl, slugify,
  useDirtyGuard, validateEvent,
} from '../../admin/editorial.js';
import {
  DirtyGuardBanner,
  EditorCard,
  EditorErrors,
  EditorField,
  EditorFooter,
  eventEditorSchema,
  focusEditorErrors,
  speakerEditorSchema,
  toEditorPayload,
  useEditorForm,
  useSlugUniqueness,
} from '../../components/admin/form-shell.jsx';
import { ErrorState, LoadingSkeleton, Toggle, TypedConfirm } from '../../components/admin/shared.jsx';
import { Form } from '../../components/ui/form';
import { Input } from '../../components/ui/input';
import MediaPicker from '../../components/admin/MediaPicker.jsx';

const EMPTY = {
  title: '', slug: '', short_description: '', description: '', coverMediaId: '', coverAlt: '',
  location: '', locationEmbedUrl: '', registrationEnabled: false, registrationUrl: '',
  startAt: '', endAt: '', status: 'draft', is_featured: false, display_order: 0, is_active: true,
};

const SPEAKER_EMPTY = { firstName: '', lastName: '', slug: '', role: '', profileMediaId: '', teamMemberId: '' };

function toForm(item = {}) {
  return {
    title: item.title ?? '', slug: item.slug ?? '',
    short_description: item.short_description ?? item.shortDescription ?? '',
    description: item.description ?? '',
    coverMediaId: item.coverMediaId ?? item.cover_media_id ?? item.cover_url ?? '',
    coverAlt: item.coverAlt ?? item.cover_alt ?? '',
    location: item.location ?? '', locationEmbedUrl: item.locationEmbedUrl ?? item.location_embed_url ?? '',
    registrationEnabled: !!(item.registrationEnabled ?? item.registration_enabled),
    registrationUrl: item.registrationUrl ?? item.registration_url ?? '',
    startAt: (item.startAt ?? item.start_at ?? '').toString().slice(0, 16),
    endAt: (item.endAt ?? item.end_at ?? '').toString().slice(0, 16),
    status: String(item.status ?? 'draft').toLowerCase(),
    is_featured: !!item.is_featured,
    display_order: item.display_order ?? 0, is_active: item.is_active ?? true,
    updated_by: item.updated_by ?? item.updatedBy ?? null, updated_at: item.updated_at ?? item.updatedAt ?? null,
  };
}

export default function EventDetail() {
  const { id } = useParams();
  // The static `/admin/events/new` route carries no `:id` param
  // (useParams().id is undefined there); the detail route always supplies
  // one. A missing param therefore means "new" — without this, the new
  // form fires eventsApi.get(undefined) and renders the error state.
  const isNew = id === 'new' || id === undefined;
  const navigate = useNavigate();
  const summaryRef = useRef(null);
  const speakerSummaryRef = useRef(null);
  const methods = useEditorForm({ schema: eventEditorSchema, defaultValues: EMPTY });
  const {
    control, reset, watch, setValue, setError: setFieldError, handleSubmit,
    formState: { errors: rhfErrors },
  } = methods;
  const speakerMethods = useEditorForm({ schema: speakerEditorSchema, defaultValues: SPEAKER_EMPTY });
  const {
    control: speakerControl, reset: speakerReset, watch: speakerWatch, setValue: setSpeakerValue,
    handleSubmit: handleSpeakerSubmit, formState: { errors: speakerRhfErrors },
  } = speakerMethods;
  const [original, setOriginal] = useState(EMPTY);
  const [loading, setLoading] = useState(!isNew);
  const [error, setError] = useState(null);
  // Load retry that preserves form state — bumps the fetch effect below
  // instead of window.location.reload(), which would wipe unsaved edits.
  const [loadRetry, setLoadRetry] = useState(0);
  const [serverError, setServerError] = useState(null);
  const [saving, setSaving] = useState(false);
  const [slugTouched, setSlugTouched] = useState(false);
  const [confirmArchive, setConfirmArchive] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [toast, setToast] = useState('');
  const [speakers, setSpeakers] = useState([]);
  const [speakersLoading, setSpeakersLoading] = useState(!isNew);
  const [speakersError, setSpeakersError] = useState(null);
  const [speakerRetry, setSpeakerRetry] = useState(0);
  const [speakerSlugTouched, setSpeakerSlugTouched] = useState(false);
  const [speakerFile, setSpeakerFile] = useState(null);
  const [speakerError, setSpeakerError] = useState(null);
  const [speakerSaving, setSpeakerSaving] = useState(false);
  const [confirmSpeaker, setConfirmSpeaker] = useState(null);
  const [media, setMedia] = useState([]);
  const [mediaError, setMediaError] = useState(null);
  const activePending = useRef(false);

  const values = watch();
  const dirty = useMemo(() => JSON.stringify(values) !== JSON.stringify(original), [values, original]);
  const blocker = useDirtyGuard(dirty && !saving);
  const isPublished = original.status === 'published';
  const slugChanged = isNew ? false : values.slug !== original.slug;

  useEffect(() => {
    if (isNew) return;
    let alive = true;
    eventsApi.get(id)
      .then((item) => {
        if (!alive) return;
        const next = toForm(item);
        reset(next);
        setOriginal(next);
        setLoading(false);
      })
      .catch((err) => {
        if (!alive) return;
        setError(err);
        setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [id, isNew, loadRetry, reset]);

  // Slug auto-fills from the title until touched (same contract as before).
  const title = watch('title');
  useEffect(() => {
    if (!slugTouched) setValue('slug', slugify(title ?? ''));
  }, [title, slugTouched, setValue]);

  const currentId = isNew ? null : getId(original) ?? id;
  const { slugDup, slugCheckError } = useSlugUniqueness(eventsApi, watch('slug'), currentId);

  // Speaker slug auto-fills from the speaker name until touched.
  const speakerFirstName = speakerWatch('firstName');
  const speakerLastName = speakerWatch('lastName');
  useEffect(() => {
    if (!speakerSlugTouched) setSpeakerValue('slug', slugify(`${speakerFirstName ?? ''} ${speakerLastName ?? ''}`.trim()));
  }, [speakerFirstName, speakerLastName, speakerSlugTouched, setSpeakerValue]);
  const { slugDup: speakerSlugDup, slugCheckError: speakerSlugCheckError } = useSlugUniqueness(
    speakersApi, speakerWatch('slug'), null,
  );

  /* Speakers are per-event: backend list returns everything, filter client-side by eventId. */
  useEffect(() => {
    if (isNew) {
      setSpeakersLoading(false);
      return undefined;
    }
    let alive = true;
    setSpeakersLoading(true);
    setSpeakersError(null);
    speakersApi.list({ limit: 100 })
      .then((rows) => {
        if (!alive) return;
        const mine = (Array.isArray(rows) ? rows : []).filter(
          (s) => String(s.eventId ?? s.event_id ?? '') === String(id),
        );
        setSpeakers(mine);
        setSpeakersLoading(false);
      })
      .catch((err) => {
        if (!alive) return;
        setSpeakersError(err);
        setSpeakersLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [id, isNew, speakerRetry]);

  /* Media library for profile thumbnails (profileSrc resolves profileMediaId → URL, never a raw UUID). */
  useEffect(() => {
    if (isNew) return undefined;
    let alive = true;
    mediaApi.list({ limit: 100 })
      .then((rows) => {
        if (alive) { setMedia(Array.isArray(rows) ? rows : []); setMediaError(null); }
      })
      .catch((err) => {
        if (alive) setMediaError(err);
      });
    return () => {
      alive = false;
    };
  }, [isNew]);

  if (!isNew && loading) return <section aria-label="Event editor"><h1>Event</h1><LoadingSkeleton label="Loading event…" /></section>;
  // Retry clears the error + shows the loader from the click handler (not the
  // fetch effect) and bumps `loadRetry` — the form state above is untouched.
  const retryLoad = () => {
    setError(null);
    setLoading(true);
    setLoadRetry((n) => n + 1);
  };
  if (!isNew && error) return <section aria-label="Event editor"><h1>Event</h1><ErrorState error={error} onRetry={retryLoad} context="load this event" /></section>;

  // Live publish-gate indicator (display only — submit validation runs zod).
  const publishGate = { ...validateEvent(values), ...(slugDup ? { slug: 'Slug is already in use.' } : {}) };

  const persist = (publish) => async (next) => {
    if (slugCheckError) {
      setFieldError('slug', { message: slugCheckError });
      focusEditorErrors(summaryRef);
      return;
    }
    // Client validation runs through the zod schema (same UX-level policy as
    // validateEvent) on every submit; the registration gate below is the
    // page-level cross-rule, exactly like today.
    const effective = publish ? { ...next, status: 'published', is_active: true } : next;
    if (effective.registrationEnabled && !isHttpsUrl(effective.registrationUrl)) {
      setFieldError('registrationUrl', { message: 'Registration URL must be a valid https:// URL when registration is enabled.' });
      focusEditorErrors(summaryRef);
      return;
    }
    if (publish && slugDup) { setFieldError('slug', { message: 'Slug is already in use.' }); focusEditorErrors(summaryRef); return; }
    if (publish && slugChanged && isPublished) {
      if (!window.confirm('You changed the slug of a published event. There are no redirects in V1 — the old URL will 404. Continue?')) return;
    }
    if (publish && effective.is_featured) {
      try {
        const all = await eventsApi.list();
        const others = (Array.isArray(all) ? all : []).filter(
          (e) => e.is_featured && String(getId(e) ?? e.slug) !== String(currentId),
        );
        if (others.length >= MAX_FEATURED_EVENTS) {
          setServerError(`Featured cap reached (max ${MAX_FEATURED_EVENTS}). Unfeature another event first.`);
          return;
        }
      } catch { /* non-blocking */ }
    }
    setSaving(true);
    setServerError(null);
    try {
      const payload = {
        ...toEditorPayload(effective),
        registrationUrl: effective.registrationEnabled ? effective.registrationUrl : null,
      };
      let saved;
      if (isNew) saved = await eventsApi.create({ ...payload, status: publish ? 'published' : 'draft' });
      else saved = await eventsApi.update(id, payload);
      const fresh = toForm(saved ?? effective);
      reset(fresh);
      setOriginal(fresh);
      setToast(publish ? 'Published.' : 'Saved as draft.');
      if (isNew && (getId(saved) ?? saved?.slug)) navigate(ADMIN_ENTITY_ROUTES.events.detail(getId(saved) ?? saved.slug), { replace: true });
    } catch (err) {
      setServerError(err?.body?.message ?? err?.message ?? 'Save failed.');
    } finally {
      setSaving(false);
    }
  };

  const archive = async () => {
    setSaving(true);
    try {
      await eventsApi.update(id, { is_active: false, status: 'archived' });
      setToast('Archived. Hidden publicly, still editable.');
      setOriginal((o) => ({ ...o, is_active: false, status: 'archived' }));
      setValue('is_active', false);
      setValue('status', 'archived');
    } catch (err) {
      setServerError(err?.body?.message ?? err?.message ?? 'Archive failed.');
    } finally {
      setSaving(false);
      setConfirmArchive(false);
    }
  };

  const hardDelete = async () => {
    setSaving(true);
    try {
      await eventsApi.remove(id);
      navigate(ADMIN_ENTITY_ROUTES.events.list);
    } catch (err) {
      setServerError(err?.body?.message ?? err?.message ?? 'Delete failed.');
      setSaving(false);
      setConfirmDelete(false);
    }
  };

  /* Spec §6: is_active is optimistic — persist immediately, roll back + announce on failure.
     New events have no id yet, so the toggle stays form-only until first save. */
  const toggleActive = async (value) => {
    if (isNew) {
      setValue('is_active', value);
      return;
    }
    if (activePending.current || value === values.is_active) return;
    activePending.current = true;
    const prev = values.is_active;
    setValue('is_active', value);
    try {
      await eventsApi.update(id, { is_active: value });
      setOriginal((o) => ({ ...o, is_active: value }));
      setToast(value ? 'Event is active.' : 'Event hidden publicly.');
    } catch (err) {
      setValue('is_active', prev);
      setToast(err?.body?.message ?? err?.message ?? 'Could not save visibility — toggle reverted.');
    } finally {
      activePending.current = false;
    }
  };

  /** Resolve a speaker profileMediaId through the media list; pickImage rejects UUIDs. */
  const profileSrc = (mediaId) => {
    if (!mediaId) return null;
    const record = media.find((m) => String(getId(m)) === String(mediaId));
    const url = pickImage(record);
    return typeof url === 'string' ? url : null;
  };

  const addSpeaker = async (speaker) => {
    if (speakerSlugCheckError) { setSpeakerError(speakerSlugCheckError); return; }
    if (speakerSlugDup) { setSpeakerError('Speaker slug is already in use.'); return; }
    setSpeakerSaving(true);
    setSpeakerError(null);
    try {
      let profileMediaId = (speaker.profileMediaId ?? '').trim() || null;
      if (speakerFile) {
        // Upload parity: backend already stores the file; reuse the Media pipeline and link its ID.
        const uploaded = await mediaApi.upload(speakerFile, `${speaker.firstName} ${speaker.lastName}`.trim());
        const uploadedId = uploaded?.media?.id ?? null;
        if (uploadedId) {
          profileMediaId = uploadedId;
          setMedia((list) => [uploaded.media, ...list]);
        }
      }
      const created = await speakersApi.create({
        eventId: id,
        firstName: speaker.firstName.trim(),
        lastName: speaker.lastName.trim(),
        slug: speaker.slug.trim(),
        role: (speaker.role ?? '').trim() || null,
        profileMediaId,
        teamMemberId: (speaker.teamMemberId ?? '').trim() || null,
      });
      const row = created?.eventSpeaker ?? created;
      setSpeakers((list) => [...list, row]);
      speakerReset(SPEAKER_EMPTY);
      setSpeakerSlugTouched(false);
      setSpeakerFile(null);
      setToast('Speaker added.');
    } catch (err) {
      setSpeakerError(err?.body?.message ?? err?.message ?? 'Could not add speaker.');
    } finally {
      setSpeakerSaving(false);
    }
  };

  const removeSpeaker = async () => {
    const sid = getId(confirmSpeaker);
    if (!sid) {
      setConfirmSpeaker(null);
      return;
    }
    const prev = speakers;
    setSpeakers((list) => list.filter((s) => getId(s) !== sid));
    setSpeakerSaving(true);
    setSpeakerError(null);
    try {
      await speakersApi.remove(sid);
      setToast('Speaker removed.');
      setConfirmSpeaker(null);
    } catch (err) {
      setSpeakers(prev);
      setSpeakerError(err?.body?.message ?? err?.message ?? 'Remove failed — change reverted.');
      setConfirmSpeaker(null);
    } finally {
      setSpeakerSaving(false);
    }
  };

  const isDraft = original.status === 'draft';

  return (
    <section aria-label={isNew ? 'New event' : 'Edit event'}>
      <div className="admin-page-head">
        <div>
          <h1>{isNew ? 'New event' : values.title || 'Event'}</h1>
          <p className="admin-muted">
            {values.updated_at ? `Last edited ${values.updated_at}${values.updated_by ? ` by ${values.updated_by}` : ''} · ` : ''}
            Create = draft · publish gate enforced.
          </p>
        </div>
        {!isNew ? <Link className="gdg-btn gdg-btn-secondary" to={ADMIN_ENTITY_ROUTES.events.list}>Back to list</Link> : null}
      </div>

      <DirtyGuardBanner blocker={blocker} />

      <Form {...methods}>
        {/* persist(false) is created in the submit handler (not during render)
            so the summaryRef focus path never runs at render time. */}
        <form onSubmit={(e) => handleSubmit(persist(false), () => focusEditorErrors(summaryRef))(e)} noValidate>
          <EditorCard
            title={isNew ? 'New event' : 'Edit event'}
            eyebrow="Events"
            actions={(
              <a
                className="gdg-btn gdg-btn-secondary"
                href={values.slug ? publicPreview.eventSlug(values.slug) : publicPreview.events()}
                target="_blank"
                rel="noreferrer"
              >
                Public preview
              </a>
            )}
          >
            <EditorErrors errors={rhfErrors} serverError={serverError} summaryRef={summaryRef} />
            {toast ? <p role="status" aria-live="polite" className="admin-muted">{toast}</p> : null}
            <div className="editor-grid">
              <EditorField control={control} name="title" label="Title" required>
                {(field) => <Input {...field} />}
              </EditorField>
              <EditorField
                control={control}
                name="slug"
                label="Slug"
                required
                hint={slugCheckError ?? (slugDup ? 'Slug is already in use.' : 'Auto from title; override allowed. Lowercase-hyphen-ascii, unique.')}
              >
                {(field) => <Input {...field} onChange={(e) => { setSlugTouched(true); field.onChange(slugify(e.target.value)); }} />}
              </EditorField>
            </div>
            <EditorField control={control} name="short_description" label="Short description">
              {(field) => <Input {...field} value={field.value ?? ''} />}
            </EditorField>
            <EditorField control={control} name="description" label="Description (markdown)" required>
              {(field) => <textarea {...field} value={field.value ?? ''} rows={6} />}
            </EditorField>
            <div className="editor-grid">
              <EditorField
                control={control}
                name="coverMediaId"
                label="Cover media"
                plain
                showMessage={false}
                hint="Pick from the Media library below; the ID is stored on save."
              >
                {(field) => (
                  <MediaPicker
                    id="coverMediaId"
                    label="Cover media ID"
                    hint="Pick from the Media library below; the ID is stored on save."
                    error={rhfErrors.coverMediaId?.message}
                    required
                    value={field.value ?? ''}
                    onChange={field.onChange}
                  />
                )}
              </EditorField>
              <EditorField control={control} name="coverAlt" label="Cover alt text" required>
                {(field) => <Input {...field} value={field.value ?? ''} />}
              </EditorField>
            </div>
            <div className="editor-grid">
              <EditorField control={control} name="location" label="Location">
                {(field) => <Input {...field} value={field.value ?? ''} />}
              </EditorField>
              <EditorField control={control} name="locationEmbedUrl" label="Location embed URL">
                {(field) => <Input {...field} value={field.value ?? ''} placeholder="https://…" />}
              </EditorField>
            </div>
            <EditorField control={control} name="registrationEnabled" label="Registration enabled" plain>
              {(field) => (
                <Toggle
                  id="registrationEnabled"
                  label="Registration enabled"
                  checked={!!field.value}
                  onChange={(v) => { field.onChange(v); if (!v) setValue('registrationUrl', ''); }}
                />
              )}
            </EditorField>
            {values.registrationEnabled ? (
              <EditorField control={control} name="registrationUrl" label="Registration URL (https required)" required>
                {(field) => <Input {...field} value={field.value ?? ''} placeholder="https://…" />}
              </EditorField>
            ) : null}
            <div className="editor-grid">
              <EditorField control={control} name="startAt" label="Starts at" required>
                {(field) => <input type="datetime-local" {...field} />}
              </EditorField>
              <EditorField control={control} name="endAt" label="Ends at" required>
                {(field) => <input type="datetime-local" {...field} />}
              </EditorField>
              <EditorField control={control} name="status" label="Status" required plain>
                {(field) => (
                  <select id="status" value={field.value} onChange={(e) => field.onChange(e.target.value)}>
                    {EVENT_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                )}
              </EditorField>
              <EditorField control={control} name="display_order" label="Display order (≥ 0)">
                {(field) => <input type="number" min="0" step="1" {...field} />}
              </EditorField>
            </div>
            <EditorField control={control} name="is_featured" label={`Featured (max ${MAX_FEATURED_EVENTS})`} plain
              hint="UI-enforced cap; server is truth.">
              {(field) => (
                <Toggle id="is_featured" label={`Featured (max ${MAX_FEATURED_EVENTS})`} checked={!!field.value} onChange={field.onChange} />
              )}
            </EditorField>
            <EditorField control={control} name="is_active" label="Active (off hides publicly)" plain
              hint="Saves immediately for saved events (reverts + announces on failure).">
              {(field) => (
                <Toggle id="is_active" label="Active (off hides publicly)" checked={!!field.value} onChange={toggleActive} />
              )}
            </EditorField>
            <EditorFooter
              saving={saving}
              isNew={isNew}
              onPublish={() => handleSubmit(persist(true), () => focusEditorErrors(summaryRef))()}
              onArchive={() => (isDraft ? setConfirmDelete(true) : setConfirmArchive(true))}
              archiveLabel={isDraft ? 'Delete draft' : 'Archive'}
            />
            {Object.keys(publishGate).length > 0 ? (
              <p className="admin-muted">Publish blocked: {Object.keys(publishGate).length} field(s) need attention.</p>
            ) : (
              <p className="admin-muted">Publish gate: all required fields valid.</p>
            )}
          </EditorCard>
        </form>
      </Form>

      {isNew ? (
        <div className="admin-card">
          <p className="admin-muted">Save the event first, then add speakers.</p>
        </div>
      ) : (
        <Form {...speakerMethods}>
          <EditorCard
            title="Speakers"
            eyebrow="Event"
          >
            <p className="admin-muted">
              Profile via Media ID or direct upload (backend stores the file and links profileMediaId).
              Team-member link is optional. Slug is unique across speakers.
            </p>
            <EditorErrors
              errors={speakerRhfErrors}
              serverError={speakerError}
              summaryRef={speakerSummaryRef}
              title="Fix the speaker fields below"
            />
            {mediaError ? (
              <div className="admin-summary" role="alert">
                <p>Media library failed to load: {mediaError?.body?.message ?? mediaError?.message ?? 'request failed'}.</p>
              </div>
            ) : null}
            {speakersLoading ? <LoadingSkeleton label="Loading speakers…" /> : null}
            {!speakersLoading && speakersError ? (
              <ErrorState error={speakersError} onRetry={() => setSpeakerRetry((t) => t + 1)} context="load speakers" />
            ) : null}
            {!speakersLoading && !speakersError && speakers.length === 0 ? (
              <p className="admin-muted">No speakers yet — add the first one below.</p>
            ) : null}
            {!speakersLoading && !speakersError && speakers.length > 0 ? (
              <div className="admin-table-wrap">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th scope="col">Name</th>
                      <th scope="col">Role</th>
                      <th scope="col">Team member</th>
                      <th scope="col">Profile</th>
                      <th scope="col">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {speakers.map((s, i) => {
                      const sid = getId(s);
                      const src = profileSrc(s.profileMediaId ?? s.profile_media_id);
                      const teamId = s.teamMemberId ?? s.team_member_id;
                      return (
                        <tr key={sid ?? s.slug ?? i}>
                          <td>
                            {s.firstName} {s.lastName}
                            <br />
                            <span className="admin-muted">{s.slug}</span>
                          </td>
                          <td>{s.role || '—'}</td>
                          <td>{teamId ? `${String(teamId).slice(0, 8)}…` : '—'}</td>
                          <td>
                            {src ? (
                              <img className="admin-thumb" src={src} alt="" loading="lazy" />
                            ) : (
                              <span className="admin-muted">—</span>
                            )}
                          </td>
                          <td>
                            <button
                              type="button"
                              className="gdg-btn gdg-btn-secondary admin-danger"
                              disabled={speakerSaving}
                              onClick={() => setConfirmSpeaker(s)}
                            >
                              Remove
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : null}
            <form onSubmit={(e) => handleSpeakerSubmit(addSpeaker, () => focusEditorErrors(speakerSummaryRef))(e)} noValidate>
              <h3>Add speaker</h3>
              <div className="editor-grid">
                <EditorField control={speakerControl} name="firstName" label="First name" required>
                  {(field) => <Input {...field} />}
                </EditorField>
                <EditorField control={speakerControl} name="lastName" label="Last name" required>
                  {(field) => <Input {...field} />}
                </EditorField>
              </div>
              <div className="editor-grid">
                <EditorField
                  control={speakerControl}
                  name="slug"
                  label="Slug"
                  required
                  hint={speakerSlugCheckError ?? (speakerSlugDup ? 'Slug is already in use.' : 'Auto from name; override allowed. Unique across speakers.')}
                >
                  {(field) => <Input {...field} onChange={(e) => { setSpeakerSlugTouched(true); field.onChange(slugify(e.target.value)); }} />}
                </EditorField>
                <EditorField control={speakerControl} name="role" label="Role">
                  {(field) => <Input {...field} value={field.value ?? ''} />}
                </EditorField>
              </div>
              <div className="editor-grid">
                <EditorField
                  control={speakerControl}
                  name="profileMediaId"
                  label="Profile media"
                  plain
                  showMessage={false}
                  hint="Optional — pick an asset below, or upload a photo further down (upload wins)."
                >
                  {(field) => (
                    <MediaPicker
                      id="speakerProfileMediaId"
                      label="Profile media ID"
                      hint="Optional — pick an asset below, or upload a photo further down (upload wins)."
                      error={speakerRhfErrors.profileMediaId?.message}
                      value={field.value ?? ''}
                      onChange={field.onChange}
                    />
                  )}
                </EditorField>
                <EditorField
                  control={speakerControl}
                  name="teamMemberId"
                  label="Team member ID (optional)"
                  hint="Link this speaker to a team-member UUID."
                >
                  {(field) => <Input {...field} value={field.value ?? ''} />}
                </EditorField>
              </div>
              <EditorField
                control={speakerControl}
                name="speakerFile"
                label="Profile photo (optional)"
                plain
                showMessage={false}
                hint="Uploads to Media and uses its ID; overrides the media ID above."
              >
                <input type="file" accept="image/*" onChange={(e) => setSpeakerFile(e.target.files?.[0] ?? null)} />
              </EditorField>
              <div className="editor-btn-row">
                <button type="submit" className="editor-btn editor-btn-primary" disabled={speakerSaving}>
                  {speakerSaving ? (
                    <>
                      <span className="editor-spinner" aria-hidden="true" />
                      Adding…
                    </>
                  ) : (
                    'Add speaker'
                  )}
                </button>
              </div>
            </form>
          </EditorCard>
        </Form>
      )}

      <TypedConfirm open={confirmArchive} title="Archive event?" body="Archive hides it publicly but keeps it editable and restorable (preferred over delete)." expected={values.slug} confirmLabel="Archive" busy={saving} onCancel={() => setConfirmArchive(false)} onConfirm={archive} />
      <TypedConfirm open={confirmDelete} title="Delete never-published draft?" body="Hard delete is only for never-published drafts. This cannot be undone." expected={values.slug} confirmLabel="Delete forever" busy={saving} onCancel={() => setConfirmDelete(false)} onConfirm={hardDelete} />
      <TypedConfirm open={!!confirmSpeaker} title="Remove speaker?" body="Deletes this speaker record from the event. It can be re-added later." expected={confirmSpeaker ? `${confirmSpeaker.firstName} ${confirmSpeaker.lastName}` : ''} confirmLabel="Remove" busy={speakerSaving} onCancel={() => setConfirmSpeaker(null)} onConfirm={removeSpeaker} />
    </section>
  );
}
