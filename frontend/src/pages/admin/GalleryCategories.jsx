import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { galleryCategoriesApi, getId } from '../../api/resources.js';
import {
  ADMIN_ENTITY_ROUTES,
  slugify,
  useAdminList,
  useDebouncedValue,
  useDirtyGuard,
} from '../../admin/editorial.js';
import {
  DirtyGuardBanner,
  EditorCard,
  EditorErrors,
  EditorField,
  focusEditorErrors,
  galleryCategoryEditorSchema,
  toEditorPayload,
  useEditorForm,
  useSlugUniqueness,
} from '../../components/admin/form-shell.jsx';
import { EmptyState, ErrorState, LoadingSkeleton, Toggle, TypedConfirm } from '../../components/admin/shared.jsx';
import { Form } from '../../components/ui/form';
import { Input } from '../../components/ui/input';

const EMPTY = { name: '', slug: '', display_order: 0, is_active: true };

function toForm(item = {}) {
  return {
    name: item.name ?? '',
    slug: item.slug ?? '',
    display_order: item.display_order ?? item.displayOrder ?? 0,
    is_active: item.is_active ?? item.isActive ?? true,
  };
}

/**
 * Form state → CreateGalleryCategorySchema / UpdateGalleryCategorySchema
 * body (backend/src/modules/gallery-categories/gallery-category.validations.ts,
 * camelCase). Removing a category never orphans albums server-side
 * (ON DELETE SET NULL) — the confirm copy says so.
 */
function toApiPayload(v = {}) {
  return {
    name: v.name,
    slug: v.slug,
    displayOrder: Number(v.display_order) || 0,
    isActive: v.is_active !== false,
  };
}

export default function GalleryCategories() {
  const [params, setParams] = useSearchParams();
  const q = params.get('q') ?? '';
  const debounced = useDebouncedValue(q);
  const { data, loading, error, requestId, retry } = useAdminList(
    () => galleryCategoriesApi.list().catch((e) => {
      if (e?.status === 404) return [];
      throw e;
    }),
    'gallery-categories',
  );
  const summaryRef = useRef(null);
  const methods = useEditorForm({ schema: galleryCategoryEditorSchema, defaultValues: EMPTY });
  const {
    control, reset, watch, setValue, setError: setFieldError, handleSubmit,
    formState: { errors: rhfErrors },
  } = methods;
  const [editingId, setEditingId] = useState(null);
  const [original, setOriginal] = useState(EMPTY);
  const [serverError, setServerError] = useState(null);
  const [saving, setSaving] = useState(false);
  const [slugTouched, setSlugTouched] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [toast, setToast] = useState('');

  const values = watch();
  const dirty = useMemo(() => JSON.stringify(values) !== JSON.stringify(original), [values, original]);
  const blocker = useDirtyGuard(dirty && !saving);

  // Slug auto-fills from the name until touched (same contract as the entity editors).
  const name = watch('name');
  useEffect(() => {
    if (!slugTouched) setValue('slug', slugify(name ?? ''));
  }, [name, slugTouched, setValue]);

  const { slugDup, slugCheckError } = useSlugUniqueness(galleryCategoriesApi, watch('slug'), editingId);

  const rows = useMemo(() => {
    const term = debounced.trim().toLowerCase();
    const sorted = [...(data ?? [])].sort(
      (a, b) => (a.display_order ?? a.displayOrder ?? 0) - (b.display_order ?? b.displayOrder ?? 0),
    );
    if (!term) return sorted;
    return sorted.filter((c) =>
      [c.name, c.slug].filter(Boolean).join(' ').toLowerCase().includes(term),
    );
  }, [data, debounced]);

  const setQuery = (value) => {
    const next = new URLSearchParams(params);
    if (value) next.set('q', value);
    else next.delete('q');
    setParams(next, { replace: true });
  };

  const startCreate = () => {
    setEditingId(null);
    setSlugTouched(false);
    setServerError(null);
    reset(EMPTY);
    setOriginal(EMPTY);
  };

  const startEdit = (category) => {
    const next = toForm(category);
    setEditingId(getId(category));
    setSlugTouched(true);
    setServerError(null);
    reset(next);
    setOriginal(next);
    focusEditorErrors(summaryRef);
  };

  const persist = async (next) => {
    if (slugCheckError) {
      setFieldError('slug', { message: slugCheckError });
      focusEditorErrors(summaryRef);
      return;
    }
    // Slug-dup gates every save here (single-page CRUD has no draft/publish split).
    if (slugDup) {
      setFieldError('slug', { message: 'Slug is already in use.' });
      focusEditorErrors(summaryRef);
      return;
    }
    setSaving(true);
    setServerError(null);
    try {
      const payload = toApiPayload(toEditorPayload(next));
      if (editingId) await galleryCategoriesApi.update(editingId, payload);
      else await galleryCategoriesApi.create(payload);
      setToast(editingId ? 'Category updated.' : 'Category created.');
      startCreate();
      retry();
    } catch (err) {
      setServerError(err?.body?.message ?? err?.message ?? 'Save failed.');
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!confirmDelete) return;
    const cid = getId(confirmDelete);
    setSaving(true);
    try {
      await galleryCategoriesApi.remove(cid);
      setToast('Category deleted. Albums keep working (uncategorized).');
      if (editingId && String(editingId) === String(cid)) startCreate();
      setConfirmDelete(null);
      retry();
    } catch (err) {
      setServerError(err?.body?.message ?? err?.message ?? 'Delete failed.');
      setSaving(false);
      setConfirmDelete(null);
    }
  };

  return (
    <section aria-label="Gallery categories">
      <div className="admin-page-head">
        <div>
          <h1>Categories</h1>
          <p className="admin-muted">Taxonomy for the public ?category= album filter. Deleting a category never orphans albums.</p>
        </div>
      </div>

      <DirtyGuardBanner blocker={blocker} />

      {loading ? <LoadingSkeleton label="Loading categories…" /> : null}
      {!loading && error ? (
        <ErrorState error={error} requestId={requestId} onRetry={retry} context="load gallery categories" />
      ) : null}

      {!loading && !error ? (
        <>
          <div className="admin-toolbar">
            <label className="admin-visually-hidden" htmlFor="category-search">Search categories</label>
            <input
              id="category-search"
              type="search"
              placeholder="Search categories…"
              value={q}
              onChange={(e) => setQuery(e.target.value)}
            />
            <span className="admin-muted" aria-live="polite">{rows.length} {rows.length === 1 ? 'category' : 'categories'}</span>
          </div>
          {rows.length === 0 ? (
            <EmptyState
              title={q ? `No categories match “${q}”.` : 'No categories yet'}
              hint="Create the first category below — albums link to it from the album editor."
            />
          ) : (
            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th scope="col">Name</th>
                    <th scope="col">Slug</th>
                    <th scope="col">Order</th>
                    <th scope="col">Active</th>
                    <th scope="col">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((c, i) => {
                    const cid = getId(c);
                    const active = (c.is_active ?? c.isActive) !== false;
                    return (
                      <tr key={cid ?? c.slug ?? i}>
                        <td>{c.name ?? '(unnamed)'}</td>
                        <td><span className="admin-muted">{c.slug ?? '—'}</span></td>
                        <td>{c.display_order ?? c.displayOrder ?? 0}</td>
                        <td>{active ? 'Yes' : 'No'}</td>
                        <td>
                          <button type="button" className="gdg-btn gdg-btn-secondary" onClick={() => startEdit(c)}>
                            Edit
                          </button>{' '}
                          <button
                            type="button"
                            className="gdg-btn gdg-btn-secondary admin-danger"
                            disabled={saving}
                            onClick={() => setConfirmDelete(c)}
                          >
                            Delete
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          <Form {...methods}>
            <form onSubmit={(e) => handleSubmit(persist, () => focusEditorErrors(summaryRef))(e)} noValidate>
              <EditorCard
                title={editingId ? 'Edit category' : 'New category'}
                eyebrow="Gallery"
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
                  <EditorField control={control} name="display_order" label="Display order (≥ 0)">
                    {(field) => <input type="number" min="0" step="1" {...field} />}
                  </EditorField>
                  <EditorField control={control} name="is_active" label="Active" plain>
                    {(field) => (
                      <Toggle id="category-active" label="Active" checked={!!field.value} onChange={field.onChange} />
                    )}
                  </EditorField>
                </div>
                <div className="editor-btn-row">
                  <button type="submit" className="editor-btn editor-btn-primary" disabled={saving}>
                    {saving ? (
                      <>
                        <span className="editor-spinner" aria-hidden="true" />
                        Saving…
                      </>
                    ) : (
                      editingId ? 'Save changes' : 'Create category'
                    )}
                  </button>
                  {editingId ? (
                    <button type="button" className="editor-btn editor-btn-secondary" disabled={saving} onClick={startCreate}>
                      Cancel
                    </button>
                  ) : null}
                </div>
                <p className="admin-muted">
                  <a href={ADMIN_ENTITY_ROUTES.gallery.list}>← Back to albums</a>
                </p>
              </EditorCard>
            </form>
          </Form>
        </>
      ) : null}

      <TypedConfirm
        open={!!confirmDelete}
        title="Delete category?"
        body="Albums in this category become uncategorized — nothing is orphaned. This cannot be undone."
        expected={confirmDelete?.slug ?? ''}
        confirmLabel="Delete forever"
        busy={saving}
        onCancel={() => setConfirmDelete(null)}
        onConfirm={remove}
      />
    </section>
  );
}
