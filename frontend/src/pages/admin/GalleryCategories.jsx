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
  EditorErrors,
  EditorField,
  focusEditorErrors,
  galleryCategoryEditorSchema,
  toEditorPayload,
  useEditorForm,
  useSlugUniqueness,
} from '../../components/admin/form-shell.jsx';
import { EmptyState, ErrorState, LoadingSkeleton, Toggle, TypedConfirm } from '../../components/admin/shared.jsx';
import { MuiInput, MuiSearchField } from '../../components/admin/mui-fields.jsx';
import { Form } from '../../components/ui/form';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';

const EMPTY = { name: '', slug: '', display_order: 0, is_active: true };

function toForm(item = {}) {
  return {
    name: item.name ?? '',
    slug: item.slug ?? '',
    display_order: item.display_order ?? item.displayOrder ?? 0,
    is_active: item.is_active ?? item.isActive ?? true,
  };
}

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
  const dialogRef = useRef(null);
  const triggerRef = useRef(null);
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
  const [dialogOpen, setDialogOpen] = useState(false);

  const values = watch();
  const dirty = useMemo(() => JSON.stringify(values) !== JSON.stringify(original), [values, original]);
  const blocker = useDirtyGuard(dirty && !saving && !dialogOpen);

  const name = watch('name');
  useEffect(() => {
    if (!slugTouched) setValue('slug', slugify(name ?? ''));
  }, [name, slugTouched, setValue]);

  const { slugDup, slugCheckError } = useSlugUniqueness(galleryCategoriesApi, watch('slug'), editingId);

  // Dialog focus trap, Esc, and focus restore — M3 modal dialog 28dp surfaceContainerHigh scrim 40%
  useEffect(() => {
    if (!dialogOpen) return undefined;
    const previouslyFocused = triggerRef.current;
    const node = dialogRef.current;
    // focus first input after mount
    requestAnimationFrame(() => {
      const first = node?.querySelector('input, select, textarea, button');
      first?.focus();
    });
    const onKeyDown = (e) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        // prevent stacking with TypedConfirm: close dialog cleanly
        if (!confirmDelete) {
          setDialogOpen(false);
          setServerError(null);
        }
        return;
      }
      if (e.key !== 'Tab') return;
      if (!node) return;
      const items = node.querySelectorAll('a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled])');
      if (items.length === 0) return;
      const first = items[0]; const last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', onKeyDown);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prevOverflow;
      document.removeEventListener('keydown', onKeyDown);
      // focus restore to trigger
      previouslyFocused?.focus();
    };
  }, [dialogOpen, confirmDelete]);

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

  const openCreate = (e) => {
    triggerRef.current = e?.currentTarget ?? document.activeElement;
    setEditingId(null);
    setSlugTouched(false);
    setServerError(null);
    reset(EMPTY);
    setOriginal(EMPTY);
    setDialogOpen(true);
  };

  const openEdit = (category, e) => {
    triggerRef.current = e?.currentTarget ?? document.activeElement;
    const next = toForm(category);
    setEditingId(getId(category));
    setSlugTouched(true);
    setServerError(null);
    reset(next);
    setOriginal(next);
    setDialogOpen(true);
    // focus will move to dialog first input via effect
  };

  const closeDialog = () => {
    if (saving) return;
    setDialogOpen(false);
    setServerError(null);
    // reset dirty check to original
    reset(original);
  };

  const persist = async (next) => {
    if (slugCheckError) {
      setFieldError('slug', { message: slugCheckError });
      focusEditorErrors(summaryRef);
      return;
    }
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
      setDialogOpen(false);
      setEditingId(null);
      setSlugTouched(false);
      reset(EMPTY);
      setOriginal(EMPTY);
      retry();
    } catch (err) {
      setServerError(err?.body?.message ?? err?.message ?? 'Save failed.');
      focusEditorErrors(summaryRef);
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
      if (editingId && String(editingId) === String(cid)) {
        setEditingId(null);
        setSlugTouched(false);
        reset(EMPTY);
        setOriginal(EMPTY);
      }
      setConfirmDelete(null);
      // ensure dialog closed to avoid stacking
      setDialogOpen(false);
      retry();
    } catch (err) {
      setServerError(err?.body?.message ?? err?.message ?? 'Delete failed.');
      setSaving(false);
      setConfirmDelete(null);
    }
  };

  // Never stack modals: if delete confirm opens, ensure category dialog is not over it
  const handleDeleteTrigger = (c, e) => {
    triggerRef.current = e?.currentTarget ?? document.activeElement;
    setConfirmDelete(c);
    setDialogOpen(false);
  };

  return (
    <section aria-label="Gallery categories">
      <div className="admin-page-head">
        <div>
          <h1>Categories</h1>
          <p className="admin-muted">Taxonomy for the public ?category= album filter. Deleting a category never orphans albums.</p>
        </div>
        {/* Per-page primary create as extended FAB/text — no global +New in shell */}
        <button type="button" className="admin-new-btn" onClick={openCreate} aria-haspopup="dialog" aria-expanded={dialogOpen}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
          New category
        </button>
      </div>

      <DirtyGuardBanner blocker={blocker} />
      {toast ? <p role="status" aria-live="polite" className="admin-muted" style={{ marginBottom: 12 }}>{toast}</p> : null}

      {loading ? <LoadingSkeleton label="Loading categories…" /> : null}
      {!loading && error ? (
        <ErrorState error={error} requestId={requestId} onRetry={retry} context="load gallery categories" />
      ) : null}

      {!loading && !error ? (
        <>
          <div className="admin-toolbar">
            <MuiSearchField
              id="category-search"
              label="Search categories"
              value={q}
              onChange={setQuery}
              placeholder="Search categories…"
            />
            <span className="admin-muted" aria-live="polite">{rows.length} {rows.length === 1 ? 'category' : 'categories'}</span>
          </div>
          {rows.length === 0 ? (
            <EmptyState
              title={q ? `No categories match “${q}”.` : 'No categories yet'}
              hint="Create the first category — albums link to it from the album editor."
              actionLabel="New category"
              actionTo={undefined}
            />
          ) : (
            <div className="admin-table-wrap">
              <Table className="admin-table">
                <TableHead>
                  <TableRow>
                    <TableCell scope="col">Name</TableCell>
                    <TableCell scope="col">Slug</TableCell>
                    <TableCell scope="col">Order</TableCell>
                    <TableCell scope="col">Active</TableCell>
                    <TableCell scope="col">Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {rows.map((c, i) => {
                    const cid = getId(c);
                    const active = (c.is_active ?? c.isActive) !== false;
                    return (
                      <TableRow key={cid ?? c.slug ?? i}>
                        <TableCell>{c.name ?? '(unnamed)'}</TableCell>
                        <TableCell><span className="admin-muted">{c.slug ?? '—'}</span></TableCell>
                        <TableCell>{c.display_order ?? c.displayOrder ?? 0}</TableCell>
                        <TableCell>{active ? 'Yes' : 'No'}</TableCell>
                        <TableCell>
                          <button type="button" className="gdg-btn gdg-btn-secondary" onClick={(e) => openEdit(c, e)}>
                            Edit
                          </button>{' '}
                          <button
                            type="button"
                            className="gdg-btn gdg-btn-secondary admin-danger"
                            disabled={saving}
                            onClick={(e) => handleDeleteTrigger(c, e)}
                            aria-label={`Delete category ${c.name ?? c.slug}`}
                          >
                            Delete
                          </button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
          <p className="admin-muted" style={{ marginTop: 12 }}>
            <a href={ADMIN_ENTITY_ROUTES.gallery.list}>← Back to albums</a>
          </p>
        </>
      ) : null}

      {/* M3 modal dialog 28dp surfaceContainerHigh scrim 40% — replaces hard-placed inline div */}
      {dialogOpen ? (
        <div className="admin-dialog-backdrop" role="presentation" onClick={closeDialog}>
          <div
            ref={dialogRef}
            className="admin-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="category-dialog-title"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 id="category-dialog-title">{editingId ? 'Edit category' : 'New category'}</h3>
            <p className="admin-muted" style={{ marginBottom: 16 }}>Taxonomy for ?category= filter. Deleting never orphans albums.</p>
            <Form {...methods}>
              <form onSubmit={(e) => handleSubmit(persist, () => focusEditorErrors(summaryRef))(e)} noValidate>
                <EditorErrors errors={rhfErrors} serverError={serverError} summaryRef={summaryRef} />
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
                  <EditorField control={control} name="display_order" label="Display order (≥ 0)">
                    {(field) => <input type="number" min="0" step="1" {...field} />}
                  </EditorField>
                  <EditorField control={control} name="is_active" label="Active" plain>
                    {(field) => (
                      <Toggle id="category-active" label="Active" checked={!!field.value} onChange={field.onChange} />
                    )}
                  </EditorField>
                </div>
                <div className="admin-dialog-actions" style={{ marginTop: 24 }}>
                  <button type="button" className="gdg-btn gdg-btn-secondary" onClick={closeDialog} disabled={saving}>
                    Cancel
                  </button>
                  <button type="submit" className="gdg-btn gdg-btn-primary" disabled={saving} aria-busy={saving}>
                    {saving ? (
                      <>
                        <span className="editor-spinner" aria-hidden="true" />
                        Saving…
                      </>
                    ) : (
                      editingId ? 'Save changes' : 'Create category'
                    )}
                  </button>
                </div>
              </form>
            </Form>
          </div>
        </div>
      ) : null}

      <TypedConfirm
        open={!!confirmDelete}
        title="Delete category?"
        body="Albums in this category become uncategorized — nothing is orphaned. This cannot be undone."
        expected={confirmDelete?.slug ?? ''}
        confirmLabel="Delete forever"
        busy={saving}
        onCancel={() => { setConfirmDelete(null); triggerRef.current?.focus(); }}
        onConfirm={remove}
      />
    </section>
  );
}
