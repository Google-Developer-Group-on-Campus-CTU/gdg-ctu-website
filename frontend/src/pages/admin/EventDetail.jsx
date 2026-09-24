import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { eventsApi, getId, mediaApi, publicPreview, speakersApi } from '../../api/resources.js';
import { pickImage } from '../../api/public.js';
import {
  ADMIN_ENTITY_ROUTES,
  EVENT_STATUSES, MAX_FEATURED_EVENTS, checkSlugUnique, slugify,
  useDirtyGuard, validateEvent,
} from '../../admin/editorial.js';
import { ErrorState, Field, FormSummary, LoadingSkeleton, focusSummary, inputProps, Toggle, TypedConfirm } from '../../components/admin/shared.jsx';
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
  const [confirmArchive, setConfirmArchive] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [toast, setToast] = useState('');
  const [speakers, setSpeakers] = useState([]);
  const [speakersLoading, setSpeakersLoading] = useState(!isNew);
  const [speakersError, setSpeakersError] = useState(null);
  const [speakerRetry, setSpeakerRetry] = useState(0);
  const [speaker, setSpeaker] = useState(SPEAKER_EMPTY);
  const [speakerErrors, setSpeakerErrors] = useState({});
  const [speakerError, setSpeakerError] = useState(null);
  const [speakerSaving, setSpeakerSaving] = useState(false);
  const [speakerSlugTouched, setSpeakerSlugTouched] = useState(false);
  const [speakerFile, setSpeakerFile] = useState(null);
  const [confirmSpeaker, setConfirmSpeaker] = useState(null);
  const [media, setMedia] = useState([]);
  const [mediaError, setMediaError] = useState(null);
  const activePending = useRef(false);

  const dirty = useMemo(() => JSON.stringify(form) !== JSON.stringify(original), [form, original]);
  const blocker = useDirtyGuard(dirty && !saving);
  const isPublished = original.status === 'published';
  const slugChanged = isNew ? false : form.slug !== original.slug;

  useEffect(() => {
    if (isNew) return;
    let alive = true;
    eventsApi.get(id)
      .then((item) => {
        if (!alive) return;
        const next = toForm(item);
        setForm(next);
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
  }, [id, isNew, loadRetry]);

  const set = (key, value) => {
    setForm((f) => {
      const next = { ...f, [key]: value };
      if (key === 'title' && !slugTouched) next.slug = slugify(value);
      if (key === 'registrationEnabled' && !value) next.registrationUrl = '';
      return next;
    });
  };

  useEffect(() => {
    if (!form.slug) {
      setSlugDup(false);
      setSlugCheckError(null);
      return;
    }
    let alive = true;
    setSlugCheckError(null);
    const t = setTimeout(() => {
      checkSlugUnique(eventsApi, form.slug, isNew ? null : getId(original) ?? id)
        .then((unique) => {
          if (alive) { setSlugDup(!unique); setSlugCheckError(null); }
        })
        .catch((err) => {
          if (!alive) return;
          if (err?.status === 404) { setSlugDup(false); setSlugCheckError(null); return; }
          // 500/timeout/network: the slug is unverifiable — block save with the error.
          setSlugDup(false);
          setSlugCheckError(err?.body?.message ?? err?.message ?? 'Could not verify slug uniqueness.');
        });
    }, 400);
    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, [form.slug, id, isNew, original]);

  /* Speakers are per-event: backend list returns everything, filter client-side by eventId. */
  useEffect(() => {
    if (isNew) {
      setSpeakersLoading(false);
      return;
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
    if (isNew) return;
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

  const publishGate = { ...validateEvent(form), ...(slugDup ? { slug: 'Slug is already in use.' } : {}) };

  const persist = async (next, { publish = false } = {}) => {
    if (slugCheckError) {
      setErrors({ slug: slugCheckError });
      focusSummary(summaryRef);
      return false;
    }
    const gate = publish ? { ...validateEvent(next), ...(slugDup ? { slug: 'Slug is already in use.' } : {}) } : {};
    setErrors(gate);
    if (Object.keys(gate).length) {
      focusSummary(summaryRef);
      return false;
    }
    if (publish && slugChanged && isPublished) {
      if (!window.confirm('You changed the slug of a published event. There are no redirects in V1 — the old URL will 404. Continue?')) return false;
    }
    if (publish && next.is_featured) {
      try {
        const all = await eventsApi.list();
        const others = (Array.isArray(all) ? all : []).filter(
          (e) => e.is_featured && String(getId(e) ?? e.slug) !== String(getId(original) ?? id),
        );
        if (others.length >= MAX_FEATURED_EVENTS) {
          setServerError(`Featured cap reached (max ${MAX_FEATURED_EVENTS}). Unfeature another event first.`);
          return false;
        }
      } catch { /* non-blocking */ }
    }
    setSaving(true);
    setServerError(null);
    try {
      const payload = {
        ...next,
        display_order: Number(next.display_order) || 0,
        registrationUrl: next.registrationEnabled ? next.registrationUrl : null,
      };
      let saved;
      if (isNew) saved = await eventsApi.create({ ...payload, status: publish ? 'published' : 'draft' });
      else saved = await eventsApi.update(id, payload);
      const fresh = toForm(saved ?? next);
      setForm(fresh);
      setOriginal(fresh);
      setToast(publish ? 'Published.' : 'Saved as draft.');
      if (isNew && (getId(saved) ?? saved?.slug)) navigate(ADMIN_ENTITY_ROUTES.events.detail(getId(saved) ?? saved.slug), { replace: true });
      return true;
    } catch (err) {
      setServerError(err?.body?.message ?? err?.message ?? 'Save failed.');
      return false;
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
      setForm((f) => ({ ...f, is_active: false, status: 'archived' }));
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
      set('is_active', value);
      return;
    }
    if (activePending.current || value === form.is_active) return;
    activePending.current = true;
    const prev = form.is_active;
    setForm((f) => ({ ...f, is_active: value }));
    try {
      await eventsApi.update(id, { is_active: value });
      setOriginal((o) => ({ ...o, is_active: value }));
      setToast(value ? 'Event is active.' : 'Event hidden publicly.');
    } catch (err) {
      setForm((f) => ({ ...f, is_active: prev }));
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

  const setSpeakerField = (key, value) => {
    setSpeaker((s) => {
      const next = { ...s, [key]: value };
      if ((key === 'firstName' || key === 'lastName') && !speakerSlugTouched) {
        next.slug = slugify(`${next.firstName} ${next.lastName}`.trim());
      }
      return next;
    });
  };

  const addSpeaker = async (e) => {
    e.preventDefault();
    const gate = {};
    if (!speaker.firstName.trim()) gate.firstName = 'Required.';
    if (!speaker.lastName.trim()) gate.lastName = 'Required.';
    if (!speaker.slug.trim()) gate.slug = 'Required.';
    setSpeakerErrors(gate);
    if (Object.keys(gate).length) return;
    setSpeakerSaving(true);
    setSpeakerError(null);
    try {
      let profileMediaId = speaker.profileMediaId.trim() || null;
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
        role: speaker.role.trim() || null,
        profileMediaId,
        teamMemberId: speaker.teamMemberId.trim() || null,
      });
      const row = created?.eventSpeaker ?? created;
      setSpeakers((list) => [...list, row]);
      setSpeaker(SPEAKER_EMPTY);
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

  return (
    <section aria-label={isNew ? 'New event' : 'Edit event'}>
      <div className="admin-page-head">
        <div>
          <h1>{isNew ? 'New event' : form.title || 'Event'}</h1>
          <p className="admin-muted">
            {form.updated_at ? `Last edited ${form.updated_at}${form.updated_by ? ` by ${form.updated_by}` : ''} · ` : ''}
            Create = draft · publish gate enforced · <a href={form.slug ? publicPreview.eventSlug(form.slug) : publicPreview.events()} target="_blank" rel="noreferrer">public preview</a>
          </p>
        </div>
        {!isNew ? <Link className="gdg-btn gdg-btn-secondary" to={ADMIN_ENTITY_ROUTES.events.list}>Back to list</Link> : null}
      </div>

      {blocker?.state === 'blocked' ? (
        <div className="admin-summary" role="alert">
          <h3>Unsaved changes</h3>
          <p>Leave without saving?</p>
          <div className="gdg-btn-row">
            <button type="button" className="gdg-btn gdg-btn-secondary" onClick={() => blocker.reset()}>Stay</button>
            <button type="button" className="gdg-btn gdg-btn-primary admin-danger" onClick={() => blocker.proceed()}>Discard</button>
          </div>
        </div>
      ) : null}

      <FormSummary errors={errors} summaryRef={summaryRef} />
      {serverError ? <div className="admin-summary" role="alert"><p>{serverError}</p></div> : null}
      {toast ? <p role="status" aria-live="polite" className="admin-muted">{toast}</p> : null}

      <form className="admin-form" onSubmit={(e) => { e.preventDefault(); persist(form); }} noValidate>
        <div className="admin-form-grid">
          <Field label="Title" htmlFor="title" error={errors.title} required>
            <input {...inputProps('title', errors.title)} value={form.title} onChange={(e) => set('title', e.target.value)} onBlur={() => setErrors(validateEvent(form))} />
          </Field>
          <Field label="Slug" hint="Auto from title; override allowed. Lowercase-hyphen-ascii, unique." htmlFor="slug" error={errors.slug ?? slugCheckError ?? (slugDup ? 'Slug is already in use.' : null)} required>
            <input {...inputProps('slug', errors.slug || slugCheckError || slugDup)} value={form.slug} onChange={(e) => { setSlugTouched(true); set('slug', slugify(e.target.value)); }} />
          </Field>
        </div>
        <Field label="Short description" htmlFor="short_description" error={errors.short_description}>
          <input {...inputProps('short_description', errors.short_description)} value={form.short_description} onChange={(e) => set('short_description', e.target.value)} />
        </Field>
        <Field label="Description (markdown)" htmlFor="description" error={errors.description} required>
          <textarea {...inputProps('description', errors.description)} id="description" rows={6} value={form.description} onChange={(e) => set('description', e.target.value)} />
        </Field>
        <div className="admin-form-grid">
          <MediaPicker
            id="coverMediaId"
            label="Cover media ID"
            hint="Pick from the Media library below; the ID is stored on save."
            error={errors.coverMediaId}
            required
            value={form.coverMediaId}
            onChange={(v) => set('coverMediaId', v)}
          />
          <Field label="Cover alt text" htmlFor="coverAlt" error={errors.coverAlt} required>
            <input {...inputProps('coverAlt', errors.coverAlt)} value={form.coverAlt} onChange={(e) => set('coverAlt', e.target.value)} />
          </Field>
        </div>
        <div className="admin-form-grid">
          <Field label="Location" htmlFor="location" error={errors.location}>
            <input {...inputProps('location', errors.location)} value={form.location} onChange={(e) => set('location', e.target.value)} />
          </Field>
          <Field label="Location embed URL" htmlFor="locationEmbedUrl" error={errors.locationEmbedUrl}>
            <input {...inputProps('locationEmbedUrl', errors.locationEmbedUrl)} value={form.locationEmbedUrl} onChange={(e) => set('locationEmbedUrl', e.target.value)} placeholder="https://…" />
          </Field>
        </div>
        <Toggle id="registrationEnabled" label="Registration enabled" checked={form.registrationEnabled} onChange={(v) => set('registrationEnabled', v)} />
        {form.registrationEnabled ? (
          <Field label="Registration URL (https required)" htmlFor="registrationUrl" error={errors.registrationUrl} required>
            <input {...inputProps('registrationUrl', errors.registrationUrl)} value={form.registrationUrl} onChange={(e) => set('registrationUrl', e.target.value)} placeholder="https://…" />
          </Field>
        ) : null}
        <div className="admin-form-grid">
          <Field label="Starts at" htmlFor="startAt" error={errors.startAt} required>
            <input {...inputProps('startAt', errors.startAt)} type="datetime-local" value={form.startAt} onChange={(e) => set('startAt', e.target.value)} />
          </Field>
          <Field label="Ends at" htmlFor="endAt" error={errors.endAt} required>
            <input {...inputProps('endAt', errors.endAt)} type="datetime-local" value={form.endAt} onChange={(e) => set('endAt', e.target.value)} />
          </Field>
          <Field label="Status" htmlFor="status" error={errors.status} required>
            <select {...inputProps('status', errors.status)} value={form.status} onChange={(e) => set('status', e.target.value)}>
              {EVENT_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </Field>
          <Field label="Display order (≥ 0)" htmlFor="display_order" error={errors.display_order}>
            <input {...inputProps('display_order', errors.display_order)} type="number" min="0" step="1" value={form.display_order} onChange={(e) => set('display_order', e.target.value)} />
          </Field>
        </div>
        <Toggle id="is_featured" label={`Featured (max ${MAX_FEATURED_EVENTS})`} checked={form.is_featured} onChange={(v) => set('is_featured', v)} hint="UI-enforced cap; server is truth." />
        <Toggle id="is_active" label="Active (off hides publicly)" checked={form.is_active} onChange={toggleActive} hint="Saves immediately for saved events (reverts + announces on failure)." />

        <div className="gdg-btn-row">
          <button type="submit" className="gdg-btn gdg-btn-secondary" disabled={saving}>{saving ? 'Saving…' : 'Save draft'}</button>
          <button type="button" className="gdg-btn gdg-btn-primary" disabled={saving} onClick={() => persist({ ...form, status: 'published', is_active: true }, { publish: true })}>
            {saving ? 'Publishing…' : 'Publish'}
          </button>
          {!isNew && original.status !== 'draft' ? (
            <button type="button" className="gdg-btn gdg-btn-secondary" onClick={() => setConfirmArchive(true)}>Archive</button>
          ) : null}
          {!isNew && original.status === 'draft' ? (
            <button type="button" className="gdg-btn gdg-btn-secondary" onClick={() => setConfirmDelete(true)}>Delete draft</button>
          ) : null}
        </div>
        {Object.keys(publishGate).length > 0 ? (
          <p className="admin-muted">Publish blocked: {Object.keys(publishGate).length} field(s) need attention.</p>
        ) : (
          <p className="admin-muted">Publish gate: all required fields valid.</p>
        )}
      </form>

      {isNew ? (
        <div className="admin-card">
          <p className="admin-muted">Save the event first, then add speakers.</p>
        </div>
      ) : (
        <>
          <div className="admin-card">
            <h2>Speakers</h2>
            <p className="admin-muted">
              Profile via Media ID or direct upload (backend stores the file and links profileMediaId).
              Team-member link is optional. Slug is unique across speakers.
            </p>
            {speakerError ? (
              <div className="admin-summary" role="alert">
                <p>{speakerError}</p>
              </div>
            ) : null}
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
          </div>

          <form className="admin-form" onSubmit={addSpeaker} noValidate>
            <h3>Add speaker</h3>
            <div className="admin-form-grid">
              <Field label="First name" htmlFor="speakerFirstName" error={speakerErrors.firstName} required>
                <input {...inputProps('speakerFirstName', speakerErrors.firstName)} value={speaker.firstName} onChange={(e) => setSpeakerField('firstName', e.target.value)} />
              </Field>
              <Field label="Last name" htmlFor="speakerLastName" error={speakerErrors.lastName} required>
                <input {...inputProps('speakerLastName', speakerErrors.lastName)} value={speaker.lastName} onChange={(e) => setSpeakerField('lastName', e.target.value)} />
              </Field>
            </div>
            <div className="admin-form-grid">
              <Field label="Slug" hint="Auto from name; override allowed. Unique across speakers." htmlFor="speakerSlug" error={speakerErrors.slug} required>
                <input {...inputProps('speakerSlug', speakerErrors.slug)} value={speaker.slug} onChange={(e) => { setSpeakerSlugTouched(true); setSpeakerField('slug', slugify(e.target.value)); }} />
              </Field>
              <Field label="Role" htmlFor="speakerRole" error={speakerErrors.role}>
                <input {...inputProps('speakerRole', speakerErrors.role)} value={speaker.role} onChange={(e) => setSpeakerField('role', e.target.value)} />
              </Field>
            </div>
            <div className="admin-form-grid">
              <MediaPicker
                id="speakerProfileMediaId"
                label="Profile media ID"
                hint="Optional — pick an asset below, or upload a photo further down (upload wins)."
                error={speakerErrors.profileMediaId}
                value={speaker.profileMediaId}
                onChange={(v) => setSpeakerField('profileMediaId', v)}
              />
              <Field label="Team member ID (optional)" hint="Link this speaker to a team-member UUID." htmlFor="speakerTeamMemberId" error={speakerErrors.teamMemberId}>
                <input {...inputProps('speakerTeamMemberId', speakerErrors.teamMemberId)} value={speaker.teamMemberId} onChange={(e) => setSpeakerField('teamMemberId', e.target.value)} />
              </Field>
            </div>
            <Field label="Profile photo (optional)" hint="Uploads to Media and uses its ID; overrides the media ID above." htmlFor="speakerFile" error={speakerErrors.file}>
              <input {...inputProps('speakerFile', speakerErrors.file)} type="file" accept="image/*" onChange={(e) => setSpeakerFile(e.target.files?.[0] ?? null)} />
            </Field>
            <div className="gdg-btn-row">
              <button type="submit" className="gdg-btn gdg-btn-primary" disabled={speakerSaving}>
                {speakerSaving ? 'Adding…' : 'Add speaker'}
              </button>
            </div>
          </form>
        </>
      )}

      <TypedConfirm open={confirmArchive} title="Archive event?" body="Archive hides it publicly but keeps it editable and restorable (preferred over delete)." expected={form.slug} confirmLabel="Archive" busy={saving} onCancel={() => setConfirmArchive(false)} onConfirm={archive} />
      <TypedConfirm open={confirmDelete} title="Delete never-published draft?" body="Hard delete is only for never-published drafts. This cannot be undone." expected={form.slug} confirmLabel="Delete forever" busy={saving} onCancel={() => setConfirmDelete(false)} onConfirm={hardDelete} />
      <TypedConfirm open={!!confirmSpeaker} title="Remove speaker?" body="Deletes this speaker record from the event. It can be re-added later." expected={confirmSpeaker ? `${confirmSpeaker.firstName} ${confirmSpeaker.lastName}` : ''} confirmLabel="Remove" busy={speakerSaving} onCancel={() => setConfirmSpeaker(null)} onConfirm={removeSpeaker} />
    </section>
  );
}
