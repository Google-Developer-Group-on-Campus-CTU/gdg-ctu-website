import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { apiFetch } from '../../api/client.js';
import { albumItemsApi, albumsApi, getId, mediaApi } from '../../api/resources.js';
import { ADMIN_ENTITY_ROUTES, MAX_FEATURED_PHOTOS, checkSlugUnique, slugify, useDirtyGuard, validateAlbum } from '../../admin/editorial.js';
import { ErrorState, Field, FormSummary, LoadingSkeleton, focusSummary, inputProps, Toggle, TypedConfirm } from '../../components/admin/shared.jsx';
import { authClient } from '../../lib/auth-client';

const EMPTY = { title: '', slug: '', coverMediaId: '', eventId: '', date: '', description: '', is_featured: false, is_active: true };

/**
 * Backend row → form state. Single-row responses are wrapped `{ success, collection }`,
 * the album's primary field is `name` (not `title`), flags are camelCase, and there is
 * no coverAlt/status column (spec alt is backend-pending; visibility is `isActive`).
 */
function toForm(item = {}) {
  const src = item?.collection ?? item;
  return {
    title: src.name ?? src.title ?? '', slug: src.slug ?? '',
    coverMediaId: src.coverMediaId ?? src.cover_media_id ?? '',
    eventId: src.eventId ?? src.event_id ?? '',
    date: (src.date ?? '').toString().slice(0, 10),
    description: src.description ?? '',
    is_featured: !!(src.is_featured ?? src.isFeatured),
    is_active: (src.is_active ?? src.isActive) !== false,
  };
}

/**
 * Form state → CreateMediaCollectionSchema / UpdateMediaCollectionSchema body
 * (backend/src/modules/media-collections/media-collections.validations.ts).
 * `title` maps to required `name`; empty uuid/date fields become `null` (an empty
 * string fails `z.uuid()`/`z.coerce.date()`); flags map to camelCase. `createdBy`
 * is added at the create call site from the Better Auth session.
 */
function toApiPayload(v = {}) {
  return {
    name: v.title,
    slug: v.slug,
    description: v.description ?? '',
    coverMediaId: v.coverMediaId || null,
    eventId: v.eventId || null,
    date: v.date || null,
    isFeatured: !!v.is_featured,
    isActive: v.is_active !== false,
  };
}

/** Composite identity: backend routes are /media-collection-items/:collectionId/:mediaId (two params). */
function itemPath(collectionId, mediaId) {
  return `/media-collection-items/${encodeURIComponent(collectionId)}/${encodeURIComponent(mediaId)}`;
}

/** Map local patch keys to the backend update body (caption/altText/displayOrder/isFeatured). */
function toItemBody(patch = {}) {
  const body = {};
  if ('order' in patch) body.displayOrder = patch.order;
  if ('is_featured' in patch) body.isFeatured = !!patch.is_featured;
  if ('caption' in patch) body.caption = patch.caption;
  if ('altText' in patch) body.altText = patch.altText;
  return body;
}

/** Normalize backend rows (camelCase composite PK, no single id) to the shape the Photos table reads. */
function normalizeItem(item = {}, collectionId = '') {
  return {
    ...item,
    collection_id: item.collection_id ?? item.collectionId ?? collectionId,
    media_id: item.media_id ?? item.mediaId ?? '',
    order: item.order ?? item.displayOrder ?? 0,
    is_featured: !!(item.is_featured ?? item.isFeatured),
  };
}

export default function AlbumDetail() {
  const { id } = useParams();
  const isNew = id === 'new';
  const navigate = useNavigate();
  const summaryRef = useRef(null);
  const { data: session } = authClient.useSession();
  const [tab, setTab] = useState('content');
  const [form, setForm] = useState(EMPTY);
  const [original, setOriginal] = useState(EMPTY);
  const [photos, setPhotos] = useState([]);
  const [media, setMedia] = useState([]);
  const [pickerId, setPickerId] = useState('');
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
  const [mediaError, setMediaError] = useState(null);
  const [confirm, setConfirm] = useState(false);
  const [toast, setToast] = useState('');

  const dirty = useMemo(() => JSON.stringify(form) !== JSON.stringify(original), [form, original]);
  const blocker = useDirtyGuard(dirty && !saving);
  const albumId = isNew ? null : id;
  const featuredCount = photos.filter((p) => p.is_featured).length;

  useEffect(() => {
    let alive = true;
    mediaApi.list({ limit: 100 }).then((rows) => {
      if (alive) { setMedia(Array.isArray(rows) ? rows : []); setMediaError(null); }
    }).catch((err) => {
      if (alive) setMediaError(err);
    });
    if (isNew) return () => { alive = false; };
    Promise.all([
      albumsApi.get(id),
      albumItemsApi.list().catch(() => []),
    ]).then(([albumRes, allItems]) => {
      if (!alive) return;
      const album = albumRes?.collection ?? albumRes;
      const next = toForm(album);
      setForm(next); setOriginal(next);
      const mine = (Array.isArray(allItems) ? allItems : []).filter((it) => {
        const key = it.collection_id ?? it.collectionId ?? it.album_id ?? it.albumId;
        return String(key) === String(getId(album) ?? id);
      }).map((it) => normalizeItem(it, String(getId(album) ?? id)))
        .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
      setPhotos(mine);
      setLoading(false);
    }).catch((err) => {
      if (!alive) return;
      setError(err); setLoading(false);
    });
    return () => { alive = false; };
  }, [id, isNew, loadRetry]);

  const set = (key, value) => {
    setForm((f) => {
      const next = { ...f, [key]: value };
      if (key === 'title' && !slugTouched) next.slug = slugify(value);
      return next;
    });
  };

  useEffect(() => {
    if (!form.slug) { setSlugDup(false); setSlugCheckError(null); return; }
    let alive = true;
    setSlugCheckError(null);
    const t = setTimeout(() => {
      checkSlugUnique(albumsApi, form.slug, isNew ? null : getId(original) ?? id)
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

  if (!isNew && loading) return <section aria-label="Album editor"><h1>Album</h1><LoadingSkeleton label="Loading album…" /></section>;
  // Retry clears the error + shows the loader from the click handler (not the
  // fetch effect) and bumps `loadRetry` — the form state above is untouched.
  const retryLoad = () => {
    setError(null);
    setLoading(true);
    setLoadRetry((n) => n + 1);
  };
  if (!isNew && error) return <section aria-label="Album editor"><h1>Album</h1><ErrorState error={error} onRetry={retryLoad} context="load this album" /></section>;

  const persist = async (publish = false) => {
    if (slugCheckError) { setErrors({ slug: slugCheckError }); focusSummary(summaryRef); setTab('content'); return; }
    const next = publish ? { ...form, is_active: true } : form;
    // `name` (mapped from title) must be non-empty on every save, not just publish.
    const gate = {
      ...(String(next.title ?? '').trim() ? {} : { title: 'Title is required.' }),
      ...(publish ? { ...validateAlbum(next), ...(slugDup ? { slug: 'Slug is already in use.' } : {}) } : {}),
    };
    setErrors(gate);
    if (Object.keys(gate).length) { focusSummary(summaryRef); setTab('content'); return; }
    setSaving(true); setServerError(null);
    try {
      const payload = toApiPayload(next);
      let saved;
      if (isNew) {
        // CreateMediaCollectionSchema requires `createdBy` (must resolve to an
        // existing user row); the session is the only source for it.
        const createdBy = session?.user?.id;
        if (!createdBy) {
          setServerError('Your session has no user ID — sign out and back in, then retry.');
          return;
        }
        saved = await albumsApi.create({ ...payload, createdBy });
      } else {
        saved = await albumsApi.update(id, payload);
      }
      const row = saved?.collection ?? saved;
      const fresh = toForm(row ?? next);
      setForm(fresh); setOriginal(fresh); setToast(publish ? 'Published.' : 'Saved.');
      if (isNew && (getId(row) ?? row?.slug)) navigate(ADMIN_ENTITY_ROUTES.gallery.detail(getId(row) ?? row.slug), { replace: true });
    } catch (err) {
      setServerError(err?.body?.message ?? err?.message ?? 'Save failed.');
    } finally { setSaving(false); }
  };

  const addPhoto = async () => {
    if (!pickerId || !albumId) return;
    if (photos.some((p) => String(p.media_id ?? p.mediaId) === String(pickerId))) {
      setServerError('That photo is already in this album.');
      return;
    }
    setSaving(true); setServerError(null);
    try {
      const picked = media.find((m) => String(getId(m)) === String(pickerId));
      const altText = String(picked?.alt_text ?? picked?.altText ?? picked?.filename ?? picked?.originalName ?? '').trim() || 'Photo';
      const created = await albumItemsApi.create({
        collectionId: albumId,
        mediaId: pickerId,
        displayOrder: photos.length,
        altText,
        isFeatured: false,
      });
      const row = normalizeItem(created?.item ?? created, albumId);
      setPhotos((list) => [...list, row]);
      setPickerId('');
      setToast('Photo added from Media picker.');
    } catch (err) {
      setServerError(err?.body?.message ?? err?.message ?? 'Could not add photo.');
    } finally { setSaving(false); }
  };

  /** Optimistic single-photo PATCH; reverts + error banner on failure. Returns false when it failed. */
  const mutatePhoto = async (photo, patch) => {
    const prev = photos;
    const collectionId = photo.collection_id ?? photo.collectionId ?? albumId;
    const mediaId = photo.media_id ?? photo.mediaId;
    setPhotos((list) => list.map((p) => (p === photo ? { ...p, ...patch } : p)));
    if (String(photo.id ?? '').startsWith('tmp-') || !mediaId) return true;
    setSaving(true); setServerError(null);
    try {
      await apiFetch(itemPath(collectionId, mediaId), {
        method: 'PATCH',
        body: JSON.stringify(toItemBody(patch)),
      });
      return true;
    } catch {
      setPhotos(prev);
      setServerError('Photo update failed — rolled back.');
      return false;
    } finally { setSaving(false); }
  };

  const movePhoto = async (index, dir) => {
    const prev = photos;
    const next = [...photos];
    const j = index + dir;
    if (j < 0 || j >= next.length) return;
    [next[index], next[j]] = [next[j], next[index]];
    const ordered = next.map((p, i) => ({ ...p, order: i }));
    setPhotos(ordered);
    setSaving(true); setServerError(null);
    try {
      await Promise.all(ordered.map((p) => {
        const collectionId = p.collection_id ?? p.collectionId ?? albumId;
        const mediaId = p.media_id ?? p.mediaId;
        if (String(p.id ?? '').startsWith('tmp-') || !mediaId) return null;
        return apiFetch(itemPath(collectionId, mediaId), {
          method: 'PATCH',
          body: JSON.stringify({ displayOrder: p.order }),
        });
      }));
      setToast('Order saved.');
    } catch {
      setPhotos(prev);
      setServerError('Reorder failed — rolled back.');
    } finally { setSaving(false); }
  };

  const toggleFeaturePhoto = async (photo) => {
    if (!photo.is_featured && featuredCount >= MAX_FEATURED_PHOTOS) {
      setServerError(`Featured-photo cap reached (max ${MAX_FEATURED_PHOTOS}). Unfeature another photo first.`);
      return;
    }
    const saved = await mutatePhoto(photo, { is_featured: !photo.is_featured });
    if (!saved) setToast('Change reverted — feature not saved.');
  };

  const removePhoto = async (photo) => {
    const prev = photos;
    const collectionId = photo.collection_id ?? photo.collectionId ?? albumId;
    const mediaId = photo.media_id ?? photo.mediaId;
    setPhotos((list) => list.filter((p) => p !== photo));
    setSaving(true); setServerError(null);
    try {
      if (!String(photo.id ?? '').startsWith('tmp-') && mediaId) {
        await apiFetch(itemPath(collectionId, mediaId), { method: 'DELETE' });
      }
      setToast('Photo removed from album (media kept).');
    } catch {
      setPhotos(prev);
      setServerError('Remove failed — rolled back.');
    } finally { setSaving(false); }
  };

  const mediaName = (mid) => {
    const m = media.find((x) => String(getId(x)) === String(mid));
    return m?.filename ?? m?.originalName ?? String(mid);
  };

  return (
    <section aria-label={isNew ? 'New album' : 'Edit album'}>
      <div className="admin-page-head">
        <div><h1>{isNew ? 'New album' : form.title}</h1><p className="admin-muted">Manual create · Media picker · reorder · featured ≤ {MAX_FEATURED_PHOTOS}.</p></div>
        <Link className="gdg-btn gdg-btn-secondary" to={ADMIN_ENTITY_ROUTES.gallery.list}>Back to albums</Link>
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

      <div className="admin-tabs" role="tablist" aria-label="Album sections">
        {['content', 'photos', 'settings'].map((t) => (
          <button key={t} role="tab" aria-selected={tab === t} className={tab === t ? 'is-active' : ''} onClick={() => setTab(t)}>
            {t === 'content' ? 'Content' : t === 'photos' ? `Photos (${photos.length})` : 'Settings'}
          </button>
        ))}
      </div>

      {tab === 'content' ? (
        <form className="admin-form" onSubmit={(e) => { e.preventDefault(); persist(false); }} noValidate>
          <div className="admin-form-grid">
            <Field label="Title" htmlFor="title" error={errors.title} required>
              <input {...inputProps('title', errors.title)} value={form.title} onChange={(e) => set('title', e.target.value)} />
            </Field>
            <Field label="Slug" htmlFor="slug" error={errors.slug ?? slugCheckError ?? (slugDup ? 'Slug is already in use.' : null)} required>
              <input {...inputProps('slug', errors.slug || slugCheckError || slugDup)} value={form.slug} onChange={(e) => { setSlugTouched(true); set('slug', slugify(e.target.value)); }} />
            </Field>
          </div>
          <div className="admin-form-grid">
            <Field label="Cover media ID" htmlFor="coverMediaId" error={errors.coverMediaId} required>
              <input {...inputProps('coverMediaId', errors.coverMediaId)} value={form.coverMediaId} onChange={(e) => set('coverMediaId', e.target.value)} />
            </Field>
          </div>
          <div className="admin-form-grid">
            <Field label="Linked event ID (optional)" htmlFor="eventId" error={errors.eventId}>
              <input {...inputProps('eventId', errors.eventId)} value={form.eventId} onChange={(e) => set('eventId', e.target.value)} />
            </Field>
            <Field label="Date" htmlFor="date" error={errors.date}>
              <input {...inputProps('date', errors.date)} type="date" value={form.date} onChange={(e) => set('date', e.target.value)} />
            </Field>
          </div>
          <Field label="Description" htmlFor="description" error={errors.description}>
            <textarea {...inputProps('description', errors.description)} id="description" rows={4} value={form.description} onChange={(e) => set('description', e.target.value)} />
          </Field>
          <div className="gdg-btn-row">
            <button type="submit" className="gdg-btn gdg-btn-secondary" disabled={saving}>{saving ? 'Saving…' : 'Save draft'}</button>
            <button type="button" className="gdg-btn gdg-btn-primary" disabled={saving} onClick={() => persist(true)}>{saving ? 'Publishing…' : 'Publish'}</button>
          </div>
        </form>
      ) : null}

      {tab === 'photos' ? (
        <div className="admin-card">
          {isNew ? <p className="admin-muted">Save the album first, then add photos.</p> : (
            <>
              <div className="admin-toolbar">
                {mediaError ? (
                  <p role="alert" className="admin-muted">
                    Media library failed to load: {mediaError?.body?.message ?? mediaError?.message ?? 'request failed'}.
                  </p>
                ) : null}
                <label className="admin-visually-hidden" htmlFor="photo-picker">Add photo from Media</label>
                <select id="photo-picker" value={pickerId} onChange={(e) => setPickerId(e.target.value)}>
                  <option value="">Pick from Media…</option>
                  {media.map((m) => (
                    <option key={getId(m)} value={getId(m)}>{mediaName(getId(m))}</option>
                  ))}
                </select>
                <button type="button" className="gdg-btn gdg-btn-primary" disabled={!pickerId || saving} onClick={addPhoto}>Add photo</button>
                <span className="admin-muted" aria-live="polite">Featured {featuredCount}/{MAX_FEATURED_PHOTOS}</span>
              </div>
              {photos.length === 0 ? <p className="admin-muted">No photos yet — add from the Media picker (no new upload flow here).</p> : (
                <div className="admin-table-wrap">
                  <table className="admin-table">
                    <thead><tr><th scope="col">Media</th><th scope="col">Order</th><th scope="col">Featured</th><th scope="col">Actions</th></tr></thead>
                    <tbody>
                      {photos.map((p, i) => (
                        <tr key={p.media_id ?? i}>
                          <td>{p.caption ?? mediaName(p.media_id ?? p.mediaId)}</td>
                          <td>{p.order ?? i}</td>
                          <td>
                            <input type="checkbox" checked={!!p.is_featured} disabled={saving} onChange={() => toggleFeaturePhoto(p)} aria-label={`Feature photo ${i + 1}`} />
                          </td>
                          <td>
                            <button type="button" onClick={() => movePhoto(i, -1)} disabled={saving || i === 0} aria-label={`Move photo ${i + 1} up`}>↑</button>{' '}
                            <button type="button" onClick={() => movePhoto(i, 1)} disabled={saving || i === photos.length - 1} aria-label={`Move photo ${i + 1} down`}>↓</button>{' '}
                            <button type="button" onClick={() => removePhoto(p)} disabled={saving}>Remove</button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}
        </div>
      ) : null}

      {tab === 'settings' ? (
        <form className="admin-form" onSubmit={(e) => { e.preventDefault(); persist(false); }}>
          <Toggle id="album-featured" label="Highlight album" checked={form.is_featured} onChange={(v) => set('is_featured', v)} />
          <Toggle id="album-active" label="Active (off hides publicly)" checked={form.is_active} onChange={(v) => set('is_active', v)} />
          <div className="gdg-btn-row">
            <button type="submit" className="gdg-btn gdg-btn-secondary" disabled={saving}>Save settings</button>
            {!isNew ? <button type="button" className="gdg-btn gdg-btn-secondary" onClick={() => setConfirm(true)}>Archive / delete</button> : null}
          </div>
        </form>
      ) : null}

      <TypedConfirm open={confirm} title="Archive album?" body="Archive hides it publicly but keeps it editable (preferred)." expected={form.slug} confirmLabel="Archive" busy={saving}
        onCancel={() => setConfirm(false)}
        onConfirm={async () => {
          setSaving(true);
          try { await albumsApi.update(id, { isActive: false }); navigate(ADMIN_ENTITY_ROUTES.gallery.list); }
          catch (err) { setServerError(err?.body?.message ?? err?.message ?? 'Archive failed.'); setSaving(false); setConfirm(false); }
        }} />
    </section>
  );
}
