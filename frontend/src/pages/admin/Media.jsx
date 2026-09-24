import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { albumItemsApi, contentApi, eventsApi, getId, mediaApi, teamApi } from '../../api/resources.js';
import { MEDIA_ALLOW, MEDIA_MAX_BYTES, useAdminList, useDebouncedValue } from '../../admin/editorial.js';
import { EmptyState, ErrorState, Field, LoadingSkeleton, TypedConfirm, inputProps } from '../../components/admin/shared.jsx';

function thumbOf(m) {
  return m.secure_url ?? m.secureUrl ?? m.url ?? m.cover_url ?? '';
}

export default function AdminMedia() {
  const [params] = useSearchParams();
  const q = params.get('q') ?? '';
  const debounced = useDebouncedValue(q);
  const [file, setFile] = useState(null);
  const [alt, setAlt] = useState('');
  const [altError, setAltError] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [toast, setToast] = useState('');
  const [serverError, setServerError] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [usedIn, setUsedIn] = useState({});

  const media = useAdminList(() => mediaApi.list({ limit: 100 }).catch((e) => { throw e; }), 'media');

  const rows = useMemo(() => {
    const term = debounced.trim().toLowerCase();
    if (!term) return media.data ?? [];
    return (media.data ?? []).filter((m) =>
      [m.filename, m.originalName, m.alt_text ?? m.altText].filter(Boolean).join(' ').toLowerCase().includes(term),
    );
  }, [media.data, debounced]);

  const computeUsedIn = async () => {
    try {
      const [events, team, content, items] = await Promise.all([
        eventsApi.list().catch(() => []), teamApi.list().catch(() => []),
        contentApi.list().catch(() => []), albumItemsApi.list().catch(() => []),
      ]);
      const counts = {};
      const bump = (id) => {
        if (!id) return;
        counts[String(id)] = (counts[String(id)] ?? 0) + 1;
      };
      for (const e of (Array.isArray(events) ? events : [])) bump(e.coverMediaId ?? e.cover_media_id);
      for (const m of (Array.isArray(team) ? team : [])) bump(m.profileMediaId ?? m.profile_media_id);
      for (const c of (Array.isArray(content) ? content : [])) bump(c.mediaId ?? c.media_id);
      for (const a of (Array.isArray(items) ? items : [])) {
        const album = a.collection_id ?? a.collectionId;
        bump(a.media_id ?? a.mediaId);
        if (album) counts[`album:${album}`] = (counts[`album:${album}`] ?? 0) + 1;
      }
      for (const m of (Array.isArray(media.data) ? media.data : [])) {
        const c = m.used_in ?? m.usedIn ?? m.usage_count;
        if (typeof c === 'number') counts[String(getId(m))] = c;
      }
      setUsedIn(counts);
    } catch { /* best-effort */ }
  };

  useEffect(() => {
    if (!media.data.length) return;
    computeUsedIn().then(() => {}).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [media.data.length]);

  const upload = async (e) => {
    e?.preventDefault?.();
    setServerError(null);
    if (!alt.trim()) {
      setAltError('Alt text is required before publish.');
      document.getElementById('media-alt')?.focus();
      return;
    }
    if (!file) {
      setServerError('Choose a file first.');
      return;
    }
    if (!MEDIA_ALLOW.includes(file.type)) {
      setServerError(`Blocked type ${file.type || 'unknown'} — allowed: jpeg/png/webp/gif.`);
      return;
    }
    if (file.size > MEDIA_MAX_BYTES) {
      setServerError('File exceeds 4MB (413). Choose a smaller file.');
      return;
    }
    setUploading(true);
    try {
      await mediaApi.upload(file, alt.trim());
      setToast('Uploaded.');
      setFile(null);
      setAlt('');
      media.retry();
    } catch (err) {
      setServerError(err?.status === 413 ? 'File exceeds 4MB.' : (err?.body?.message ?? err?.message ?? 'Upload failed.'));
    } finally {
      setUploading(false);
    }
  };

  const remove = async (item) => {
    const id = getId(item);
    try {
      await mediaApi.remove(id);
      setToast('Deleted.');
      setConfirmDelete(null);
      media.retry();
    } catch (err) {
      setServerError(err?.body?.message ?? err?.message ?? 'Delete failed. Archive instead if in use.');
    }
  };

  return (
    <section aria-label="Media library">
      <div className="admin-page-head">
        <div>
          <h1>Media</h1>
          <p className="admin-muted">jpeg/png/webp/gif · ≤ 4MB · alt required · delete only never-used drafts.</p>
        </div>
      </div>
      {serverError ? <div className="admin-summary" role="alert"><p>{serverError}</p></div> : null}
      {toast ? <p role="status" aria-live="polite" className="admin-muted">{toast}</p> : null}

      <form className="admin-form" onSubmit={upload} aria-label="Upload media">
        <div className="admin-form-grid">
          <Field label="File" htmlFor="media-file" hint="Allow-list: jpeg, png, webp, gif. Max 4MB." required>
            <input id="media-file" type="file" accept={MEDIA_ALLOW.join(',')} onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
          </Field>
          <Field label="Alt text" htmlFor="media-alt" error={altError} required>
            <input {...inputProps('media-alt', altError)} value={alt} onChange={(e) => { setAlt(e.target.value); setAltError(null); }} />
          </Field>
        </div>
        <div className="gdg-btn-row">
          <button type="submit" className="gdg-btn gdg-btn-primary" disabled={uploading}>{uploading ? 'Uploading…' : 'Upload'}</button>
        </div>
      </form>

      <div style={{ height: '1rem' }} />
      {media.loading ? <LoadingSkeleton label="Loading media…" /> : null}
      {!media.loading && media.error ? <ErrorState error={media.error} requestId={media.requestId} onRetry={media.retry} context="load media" /> : null}
      {!media.loading && !media.error && rows.length === 0 ? (
        <EmptyState title="No media yet" hint="Upload the first image above — alt text is required." />
      ) : null}
      {!media.loading && !media.error && rows.length > 0 ? (
        <div className="admin-media-grid">
          {rows.map((m) => {
            const id = getId(m);
            return (
              <article key={id} className="admin-media-card">
                {thumbOf(m) ? <img src={thumbOf(m)} alt={m.alt_text ?? m.altText ?? ''} loading="lazy" /> : <div style={{ height: 140, background: '#f1f3f4' }} />}
                <div className="admin-media-card-body">
                  <strong title={m.filename ?? ''}>{m.filename ?? m.originalName ?? id}</strong>
                  <p className="admin-muted">
                    {m.width && m.height ? `${m.width}×${m.height} · ` : ''}{m.bytes ? `${Math.round(m.bytes / 1024)}KB · ` : ''}used in {usedIn[String(id)] ?? 0}
                  </p>
                  <p className="admin-muted">alt: {m.alt_text ?? m.altText ?? '—'}</p>
                  <button type="button" onClick={() => setConfirmDelete(m)}>Delete</button>
                </div>
              </article>
            );
          })}
        </div>
      ) : null}

      <TypedConfirm open={!!confirmDelete} title="Delete media?" body={`Only never-used drafts may be hard-deleted (used in ${confirmDelete ? (usedIn[String(getId(confirmDelete))] ?? 0) : 0}). Otherwise archive the referencing content instead.`}
        expected={confirmDelete?.filename ?? confirmDelete?.originalName ?? String(getId(confirmDelete) ?? '')}
        confirmLabel="Delete forever" busy={false}
        onCancel={() => setConfirmDelete(null)} onConfirm={() => remove(confirmDelete)} />
    </section>
  );
}
