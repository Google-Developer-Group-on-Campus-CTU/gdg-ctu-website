import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { albumItemsApi, eventsApi, getId, mediaApi, teamApi } from '../../api/resources.js';
import { MEDIA_ALLOW, MEDIA_MAX_BYTES, useAdminList, useDebouncedValue } from '../../admin/editorial.js';
import { DataTable, DataTableColumnHeader } from '../../components/admin/data-table.jsx';
import { EditorCard, EditorField, EditorFooter } from '../../components/admin/form-shell.jsx';
import { Form } from '../../components/ui/form';
import { EmptyState, TypedConfirm } from '../../components/admin/shared.jsx';

function thumbOf(m) {
  return m.secure_url ?? m.secureUrl ?? m.url ?? m.cover_url ?? '';
}

function fileLabel(m) {
  return m.filename ?? m.originalName ?? String(getId(m) ?? '');
}

const ROW_BUTTON_CLASS = 'inline-flex h-10 items-center px-6 rounded-full border border-[var(--m3-outline)] bg-transparent text-[14px] font-medium tracking-[0.1px] text-[var(--m3-primary)] hover:bg-[rgba(11,87,208,0.08)]';
const ROW_BUTTON_DANGER_CLASS = 'inline-flex h-10 items-center px-6 rounded-full border border-[var(--m3-error)] bg-transparent text-[14px] font-medium tracking-[0.1px] text-[var(--m3-error)] hover:bg-[rgba(186,26,26,0.08)]';

export default function AdminMedia() {
  const [params, setParams] = useSearchParams();
  const q = params.get('q') ?? '';
  const debounced = useDebouncedValue(q);
  const [file, setFile] = useState(null);
  const [alt, setAlt] = useState('');
  const [uploading, setUploading] = useState(false);
  const [toast, setToast] = useState('');
  const [serverError, setServerError] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [usedIn, setUsedIn] = useState({});
  // Shell-bound upload form: validation stays manual (identical gates below)
  // so behavior is unchanged; RHF only carries the alt error into FormMessage.
  const uploadForm = useForm();
  const {
    control: uploadControl,
    setError: setUploadError,
    clearErrors: clearUploadErrors,
    formState: { errors: uploadErrors },
  } = uploadForm;

  const media = useAdminList(() => mediaApi.list({ limit: 100 }).catch((e) => { throw e; }), 'media');

  const rows = useMemo(() => {
    const term = debounced.trim().toLowerCase();
    if (!term) return media.data ?? [];
    return (media.data ?? []).filter((m) =>
      [m.filename, m.originalName, m.alt_text ?? m.altText, String(getId(m) ?? '')]
        .filter(Boolean).join(' ').toLowerCase().includes(term),
    );
  }, [media.data, debounced]);

  const computeUsedIn = async () => {
    try {
      // No `.catch(() => [])` here: a failed list must surface as an error —
      // only a 200 with an empty array may render as "used in 0".
      const [events, team, items] = await Promise.all([
        eventsApi.list(), teamApi.list(),
        albumItemsApi.list(),
      ]);
      const counts = {};
      const bump = (id) => {
        if (!id) return;
        counts[String(id)] = (counts[String(id)] ?? 0) + 1;
      };
      for (const e of (Array.isArray(events) ? events : [])) bump(e.coverMediaId ?? e.cover_media_id);
      for (const m of (Array.isArray(team) ? team : [])) bump(m.profileMediaId ?? m.profile_media_id);
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
    } catch (err) {
      setServerError(err?.body?.message ?? err?.message ?? 'Could not load media usage counts.');
    }
  };

  useEffect(() => {
    if (!media.data.length) return;
    computeUsedIn().then(() => {}).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [media.data.length]);

  const setQuery = (value) => {
    const next = new URLSearchParams(params);
    if (value) next.set('q', value);
    else next.delete('q');
    setParams(next, { replace: true });
  };

  const copyId = useCallback(async (id) => {
    try {
      if (!navigator.clipboard?.writeText) throw new Error('clipboard unavailable');
      await navigator.clipboard.writeText(String(id));
      setToast('Copied.');
    } catch {
      setToast('Automatic copy is blocked here — copy the ID from the table manually.');
    }
  }, []);

  const upload = async (e) => {
    e?.preventDefault?.();
    setServerError(null);
    if (!alt.trim()) {
      setUploadError('alt', { type: 'manual', message: 'Alt text is required before publish.' });
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

  /* Column defs close over `usedIn` (async usage counts) — memoized so the
     table instance survives the counts arriving after the media list. */
  const columns = useMemo(() => [
    {
      id: 'thumb',
      header: 'Preview',
      enableSorting: false,
      cell: ({ row }) => {
        const m = row.original;
        const src = thumbOf(m);
        return src ? (
          <img src={src} alt={m.alt_text ?? m.altText ?? ''} className="admin-thumb" loading="lazy" />
        ) : (
          <span className="admin-thumb" aria-hidden="true" />
        );
      },
    },
    {
      id: 'file',
      accessorFn: (m) => fileLabel(m),
      header: ({ column }) => <DataTableColumnHeader column={column} title="File" />,
      cell: ({ row }) => {
        const m = row.original;
        return (
          <span>
            <strong title={m.filename ?? ''}>{fileLabel(m)}</strong>
            <br />
            <span className="admin-muted">
              {m.width && m.height ? `${m.width}×${m.height} · ` : ''}{m.bytes ? `${Math.round(m.bytes / 1024)}KB` : '—'}
            </span>
          </span>
        );
      },
    },
    {
      id: 'alt',
      accessorFn: (m) => m.alt_text ?? m.altText ?? '',
      header: 'Alt text',
      enableSorting: false,
      cell: ({ row }) => row.original.alt_text ?? row.original.altText ?? '—',
    },
    {
      id: 'usedIn',
      // Always rendered (default 0, tabular numerals) so the async usage
      // counts fill in without shifting the layout.
      accessorFn: (m) => usedIn[String(getId(m))] ?? 0,
      header: ({ column }) => <DataTableColumnHeader column={column} title="Used in" />,
      cell: ({ row }) => (
        <span className="tabular-nums">used in {usedIn[String(getId(row.original))] ?? 0}</span>
      ),
    },
    {
      id: 'mediaId',
      accessorFn: (m) => String(getId(m) ?? ''),
      header: 'ID',
      enableSorting: false,
      cell: ({ row }) => (
        <code className="font-mono text-xs" title={String(getId(row.original) ?? '')}>
          {String(getId(row.original) ?? '—')}
        </code>
      ),
    },
    {
      id: 'actions',
      header: 'Actions',
      enableSorting: false,
      cell: ({ row }) => {
        const m = row.original;
        const id = getId(m);
        const label = fileLabel(m);
        return (
          <span className="admin-row-actions">
            <button type="button" className={ROW_BUTTON_CLASS} onClick={() => copyId(id)} aria-label={`Copy ID of ${label}`}>
              Copy ID
            </button>
            <button type="button" className={ROW_BUTTON_DANGER_CLASS} onClick={() => setConfirmDelete(m)} aria-label={`Delete ${label}`}>
              Delete
            </button>
          </span>
        );
      },
    },
  ], [usedIn, copyId]);

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

      <EditorCard title="Upload media" eyebrow="Media">
        {/* FormProvider wrapper: EditorField renders shadcn FormField/FormLabel,
            whose useFormField() reads useFormContext() — without this provider
            the Media page crashes on render (null context destructure). */}
        <Form {...uploadForm}>
          <form onSubmit={upload} aria-label="Upload media">
          <div className="editor-grid">
            <EditorField
              control={uploadControl}
              name="file"
              label="File"
              hint="Allow-list: jpeg, png, webp, gif. Max 4MB."
              required
              plain
            >
              <input id="media-file" type="file" accept={MEDIA_ALLOW.join(',')} onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
            </EditorField>
            <EditorField control={uploadControl} name="alt" label="Alt text" required plain>
              <input
                id="media-alt"
                value={alt}
                aria-invalid={uploadErrors.alt ? 'true' : undefined}
                onChange={(e) => { setAlt(e.target.value); clearUploadErrors('alt'); }}
              />
            </EditorField>
          </div>
          <EditorFooter saving={uploading} isNew saveLabel="Upload" publishLabel="Upload" onPublish={() => upload()} />
          </form>
        </Form>
      </EditorCard>

      <div className="gdg-spacer-sm" />

      <DataTable
        columns={columns}
        data={rows}
        loading={media.loading}
        loadingLabel="Loading media…"
        error={media.error}
        requestId={media.requestId}
        onRetry={media.retry}
        searchColumnId="file"
        searchPlaceholder="Search filename, alt text, or ID…"
        searchValue={q}
        onSearchChange={setQuery}
        pageSizeOptions={[20, 10]}
        renderEmptyState={
          <EmptyState
            title="No media yet"
            hint="Upload the first image above — alt text is required."
          />
        }
      />

      <TypedConfirm open={!!confirmDelete} title="Delete media?" body={`Only never-used drafts may be hard-deleted (used in ${confirmDelete ? (usedIn[String(getId(confirmDelete))] ?? 0) : 0}). Otherwise archive the referencing content instead.`}
        expected={confirmDelete?.filename ?? confirmDelete?.originalName ?? String(getId(confirmDelete) ?? '')}
        confirmLabel="Delete forever" busy={false}
        onCancel={() => setConfirmDelete(null)} onConfirm={() => remove(confirmDelete)} />
    </section>
  );
}
