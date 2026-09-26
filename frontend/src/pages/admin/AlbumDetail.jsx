import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { apiFetch } from '../../api/client.js';
import { albumItemsApi, albumsApi, galleryCategoriesApi, getId, mediaApi, publicPreview } from '../../api/resources.js';
import { ADMIN_ENTITY_ROUTES, MAX_FEATURED_PHOTOS, slugify, useDirtyGuard } from '../../admin/editorial.js';
import {
  albumEditorSchema,
  DirtyGuardBanner,
  EditorCard,
  EditorErrors,
  EditorField,
  EditorFooter,
  MuiConfirmDialog,
  MuiInput,
  MuiSwitchField,
  focusEditorErrors,
  toEditorPayload,
  useEditorForm,
  useSlugUniqueness,
} from '../../components/admin/form-shell.jsx';
import { ErrorState, LoadingSkeleton } from '../../components/admin/shared.jsx';
import { Form } from '../../components/ui/form';
import Button from '@mui/material/Button';
import Checkbox from '@mui/material/Checkbox';
import IconButton from '@mui/material/IconButton';
import MenuItem from '@mui/material/MenuItem';
import Tabs from '@mui/material/Tabs';
import Tab from '@mui/material/Tab';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import { authClient } from '../../lib/auth-client';

const EMPTY = { title: '', slug: '', coverMediaId: '', eventId: '', categoryId: '', date: '', description: '', is_featured: false, is_active: true };

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
    categoryId: src.categoryId ?? src.category_id ?? '',
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
    categoryId: v.categoryId || null,
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
  // The static `/admin/gallery/albums/new` route carries no `:id` param
  // (useParams().id is undefined there); the detail route always supplies
  // one. A missing param therefore means "new" — without this, the new
  // form fires albumsApi.get(undefined) and renders the error state.
  const isNew = id === 'new' || id === undefined;
  const navigate = useNavigate();
  const summaryRef = useRef(null);
  const { data: session } = authClient.useSession();
  const methods = useEditorForm({ schema: albumEditorSchema, defaultValues: EMPTY });
  const {
    control, reset, watch, setValue, setError: setFieldError, handleSubmit,
    formState: { errors: rhfErrors },
  } = methods;
  const [tab, setTab] = useState('content');
  const [original, setOriginal] = useState(EMPTY);
  const [photos, setPhotos] = useState([]);
  const [media, setMedia] = useState([]);
  const [categories, setCategories] = useState([]);
  const [categoriesError, setCategoriesError] = useState(null);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [newCategoryBusy, setNewCategoryBusy] = useState(false);
  const [newCategoryMsg, setNewCategoryMsg] = useState(null);
  const [pickerId, setPickerId] = useState('');
  const [loading, setLoading] = useState(!isNew);
  const [error, setError] = useState(null);
  // Load retry that preserves form state — bumps the fetch effect below
  // instead of window.location.reload(), which would wipe unsaved edits.
  const [loadRetry, setLoadRetry] = useState(0);
  const [serverError, setServerError] = useState(null);
  const [saving, setSaving] = useState(false);
  const [slugTouched, setSlugTouched] = useState(false);
  const [mediaError, setMediaError] = useState(null);
  const [confirm, setConfirm] = useState(false);
  const [toast, setToast] = useState('');

  const values = watch();
  const dirty = useMemo(() => JSON.stringify(values) !== JSON.stringify(original), [values, original]);
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
    // Category taxonomy for the ?category= album filter — a 404 means the
    // module has not shipped yet, so the select renders "Uncategorized" only.
    galleryCategoriesApi.list().then((rows) => {
      if (alive) { setCategories(Array.isArray(rows) ? rows : []); setCategoriesError(null); }
    }).catch((err) => {
      if (alive) {
        if (err?.status === 404) setCategories([]);
        else setCategoriesError(err);
      }
    });
    if (isNew) return () => { alive = false; };
    Promise.all([
      albumsApi.get(id),
      albumItemsApi.list().catch(() => []),
    ]).then(([albumRes, allItems]) => {
      if (!alive) return;
      const album = albumRes?.collection ?? albumRes;
      const next = toForm(album);
      reset(next); setOriginal(next);
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
  }, [id, isNew, loadRetry, reset]);

  // Slug auto-fills from the title until touched (same contract as before).
  const title = watch('title');
  useEffect(() => {
    if (!slugTouched) setValue('slug', slugify(title ?? ''));
  }, [title, slugTouched, setValue]);

  const currentId = isNew ? null : getId(original) ?? id;
  const { slugDup, slugCheckError } = useSlugUniqueness(albumsApi, watch('slug'), currentId);

  if (!isNew && loading) return <section aria-label="Album editor"><h1>Album</h1><LoadingSkeleton label="Loading album…" /></section>;
  // Retry clears the error + shows the loader from the click handler (not the
  // fetch effect) and bumps `loadRetry` — the form state above is untouched.
  const retryLoad = () => {
    setError(null);
    setLoading(true);
    setLoadRetry((n) => n + 1);
  };
  if (!isNew && error) return <section aria-label="Album editor"><h1>Album</h1><ErrorState error={error} onRetry={retryLoad} context="load this album" /></section>;

  // Inline category creation (the /admin/gallery-categories page is retired):
  // auto-slug client-side, display_order appends after the max, then select
  // the new id. Payload shape unchanged (categoryId id or null).
  const createCategoryInline = async () => {
    const name = String(newCategoryName ?? '').trim();
    if (!name) { setNewCategoryMsg('Type a category name first.'); return; }
    const slug = slugify(name);
    if (!slug) { setNewCategoryMsg('That name produces an empty URL slug — use letters or numbers.'); return; }
    setNewCategoryBusy(true); setNewCategoryMsg(null);
    try {
      const nextOrder = categories.reduce(
        (m, c) => Math.max(m, Number(c.displayOrder ?? c.display_order ?? c.order ?? 0) || 0),
        -1,
      ) + 1;
      const created = await galleryCategoriesApi.create({ name, slug, displayOrder: nextOrder, isActive: true });
      const row = created ?? {};
      setCategories((prev) => [...prev, row].sort(
        (a, b) => (Number(a.displayOrder ?? a.display_order ?? 0) || 0) - (Number(b.displayOrder ?? b.display_order ?? 0) || 0),
      ));
      const newId = row.id ?? row._id ?? row.uuid;
      if (newId) setValue('categoryId', newId);
      setNewCategoryName('');
      setNewCategoryMsg(`Category "${name}" created and selected.`);
    } catch (err) {
      if (err?.status === 409) setNewCategoryMsg(`"${slug}" already exists — pick it from the list above.`);
      else setNewCategoryMsg(err?.body?.message ?? err?.message ?? 'Could not create category.');
    } finally { setNewCategoryBusy(false); }
  };

  const onInvalid = () => { focusEditorErrors(summaryRef); setTab('content'); };

  const persist = (publish) => async (next) => {
    if (slugCheckError) { setFieldError('slug', { message: slugCheckError }); onInvalid(); return; }
    // `title` (mapped to backend `name`) is required on every save via the
    // zod schema; slug-dup only gates publish — exactly like today.
    if (publish && slugDup) { setFieldError('slug', { message: 'Slug is already in use.' }); onInvalid(); return; }
    const effective = publish ? { ...next, is_active: true } : next;
    setSaving(true); setServerError(null);
    try {
      const payload = toApiPayload(toEditorPayload(effective));
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
      const fresh = toForm(row ?? effective);
      reset(fresh); setOriginal(fresh); setToast(publish ? 'Published.' : 'Saved.');
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
        <div><h1>{isNew ? 'New album' : values.title}</h1></div>
        <Button component={Link} variant="outlined" to={ADMIN_ENTITY_ROUTES.gallery.list}>Back to albums</Button>
      </div>
      <DirtyGuardBanner blocker={blocker} />

      <Tabs value={tab} onChange={(_e, next) => setTab(next)} aria-label="Album sections" sx={{ mb: 2 }}>
        <Tab value="content" label="Content" />
        <Tab value="photos" label={`Photos (${photos.length})`} />
        <Tab value="settings" label="Settings" />
      </Tabs>

      <Form {...methods}>
        {tab === 'content' ? (
          <form onSubmit={(e) => handleSubmit(persist(false), onInvalid)(e)} noValidate>
            <EditorCard
              title={isNew ? 'New album' : 'Edit album'}
              eyebrow="Gallery"
              actions={(
                <Button
                  component="a"
                  variant="outlined"
                  href={values.slug ? publicPreview.albumSlug(values.slug) : ADMIN_ENTITY_ROUTES.gallery.list}
                  target={values.slug ? '_blank' : undefined}
                  rel="noreferrer"
                >
                  Public preview
                </Button>
              )}
            >
              <EditorErrors errors={rhfErrors} serverError={serverError} summaryRef={summaryRef} />
              {toast ? <p role="status" aria-live="polite" className="admin-muted">{toast}</p> : null}
              <div className="editor-grid">
                <EditorField control={control} name="title" label="Title" required>
                  {(field) => <MuiInput field={field} />}
                </EditorField>
                <EditorField
                  control={control}
                  name="slug"
                  label="Slug"
                  required
                  hint={slugCheckError ?? (slugDup ? 'Slug is already in use.' : 'Auto-fills from title until edited.')}
                >
                  {(field) => <MuiInput field={field} onChange={(e) => { setSlugTouched(true); field.onChange(slugify(e.target.value)); }} />}
                </EditorField>
              </div>
              <div className="editor-grid">
                <EditorField control={control} name="coverMediaId" label="Cover media ID" required>
                  {(field) => <MuiInput field={field} value={field.value ?? ''} />}
                </EditorField>
              </div>
              <div className="editor-grid">
                <EditorField control={control} name="eventId" label="Linked event ID (optional)">
                  {(field) => <MuiInput field={field} value={field.value ?? ''} />}
                </EditorField>
                <EditorField
                  control={control}
                  name="categoryId"
                  label="Category"
                  plain
                  hint={categoriesError ? `Categories failed to load: ${categoriesError?.body?.message ?? categoriesError?.message ?? 'request failed'}.` : 'Drives the public ?category= album filter.'}
                >
                  {(field) => (
                    <MuiInput field={field} select value={field.value ?? ''}>
                      <MenuItem value="">Uncategorized</MenuItem>
                      {categories.map((c) => {
                        const cid = c?.id ?? c?._id ?? c?.uuid;
                        return <MenuItem key={cid ?? c.slug} value={cid ?? ''}>{c.name ?? c.slug ?? '(unnamed)'}</MenuItem>;
                      })}
                    </MuiInput>
                  )}
                </EditorField>
                <div className="admin-toolbar" aria-label="Create a new category">
                  <MuiInput
                    field={{ value: newCategoryName, onChange: (e) => { setNewCategoryName(e?.target?.value ?? e); setNewCategoryMsg(null); }, onBlur: () => {}, name: 'newCategoryName' }}
                    placeholder="+ New category (e.g. Meetups)"
                    inputProps={{ 'aria-label': 'New category name' }}
                  />
                  <Button type="button" variant="outlined" disabled={newCategoryBusy} onClick={createCategoryInline}>
                    {newCategoryBusy ? 'Adding…' : 'Add'}
                  </Button>
                </div>
                {newCategoryMsg ? <p role="status" aria-live="polite" className="admin-muted">{newCategoryMsg}</p> : null}
                <EditorField control={control} name="date" label="Date">
                  {(field) => <MuiInput field={field} type="date" />}
                </EditorField>
              </div>
              <EditorField control={control} name="description" label="Description">
                {(field) => <MuiInput field={field} value={field.value ?? ''} multiline rows={4} />}
              </EditorField>
              <EditorFooter
                saving={saving}
                isNew={isNew}
                onPublish={() => handleSubmit(persist(true), onInvalid)()}
                saveLabel="Save draft"
                publishLabel="Publish"
              />
            </EditorCard>
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
                  <MuiInput
                    field={{ value: pickerId, onChange: (e) => setPickerId(e?.target?.value ?? e), onBlur: () => {}, name: 'photo-picker' }}
                    select
                    inputProps={{ id: 'photo-picker', 'aria-label': 'Add photo from Media' }}
                  >
                    <MenuItem value="">Pick from Media…</MenuItem>
                    {media.map((m) => (
                      <MenuItem key={getId(m)} value={getId(m)}>{mediaName(getId(m))}</MenuItem>
                    ))}
                  </MuiInput>
                  <Button type="button" variant="contained" disabled={!pickerId || saving} onClick={addPhoto}>Add photo</Button>
                  <span className="admin-muted" aria-live="polite">Featured {featuredCount}/{MAX_FEATURED_PHOTOS}</span>
                </div>
                {photos.length === 0 ? null : (
                  <div className="admin-table-wrap">
                    <Table className="admin-table">
                      <TableHead><TableRow><TableCell scope="col">Media</TableCell><TableCell scope="col">Order</TableCell><TableCell scope="col">Featured</TableCell><TableCell scope="col">Actions</TableCell></TableRow></TableHead>
                      <TableBody>
                        {photos.map((p, i) => (
                          <TableRow key={p.media_id ?? i}>
                            <TableCell>{p.caption ?? mediaName(p.media_id ?? p.mediaId)}</TableCell>
                            <TableCell>{p.order ?? i}</TableCell>
                            <TableCell>
                              <Checkbox checked={!!p.is_featured} disabled={saving} onChange={() => toggleFeaturePhoto(p)} inputProps={{ 'aria-label': `Feature photo ${i + 1}` }} />
                            </TableCell>
                            <TableCell>
                              <IconButton type="button" size="small" onClick={() => movePhoto(i, -1)} disabled={saving || i === 0} aria-label={`Move photo ${i + 1} up`}>↑</IconButton>{' '}
                              <IconButton type="button" size="small" onClick={() => movePhoto(i, 1)} disabled={saving || i === photos.length - 1} aria-label={`Move photo ${i + 1} down`}>↓</IconButton>{' '}
                              <Button type="button" size="small" variant="outlined" onClick={() => removePhoto(p)} disabled={saving}>Remove</Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </>
            )}
          </div>
        ) : null}

        {tab === 'settings' ? (
          <form onSubmit={(e) => handleSubmit(persist(false), onInvalid)(e)}>
            <EditorField control={control} name="is_featured" label="Highlight album" plain>
              {(field) => (
                <MuiSwitchField field={field} id="album-featured" label="Highlight album" />
              )}
            </EditorField>
            <EditorField control={control} name="is_active" label="Active (off hides publicly)" plain>
              {(field) => (
                <MuiSwitchField field={field} id="album-active" label="Active (off hides publicly)" />
              )}
            </EditorField>
            <div className="editor-btn-row">
              <Button type="submit" variant="outlined" disabled={saving}>
                {saving ? 'Saving…' : 'Save settings'}
              </Button>
              {!isNew ? (
                <Button type="button" variant="outlined" color="error" disabled={saving} onClick={() => setConfirm(true)}>
                  Archive / delete
                </Button>
              ) : null}
            </div>
          </form>
        ) : null}
      </Form>

      <MuiConfirmDialog open={confirm} title="Archive album?" body="Archive hides it publicly but keeps it editable (preferred)." expected={values.slug} confirmLabel="Archive" busy={saving}
        onCancel={() => setConfirm(false)}
        onConfirm={async () => {
          setSaving(true);
          try { await albumsApi.update(id, { isActive: false }); navigate(ADMIN_ENTITY_ROUTES.gallery.list); }
          catch (err) { setServerError(err?.body?.message ?? err?.message ?? 'Archive failed.'); setSaving(false); setConfirm(false); }
        }} />
    </section>
  );
}
