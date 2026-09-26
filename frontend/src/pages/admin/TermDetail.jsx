import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { getId, memberTermsApi, teamApi, termsApi } from '../../api/resources.js';
import { ADMIN_ENTITY_ROUTES, useDirtyGuard } from '../../admin/editorial.js';
import {
  DirtyGuardBanner,
  EditorCard,
  EditorErrors,
  EditorField,
  EditorFooter,
  focusEditorErrors,
  memberTermEditorSchema,
  termEditorSchema,
  toEditorPayload,
  useEditorForm,
} from '../../components/admin/form-shell.jsx';
import { ErrorState, LoadingSkeleton, Toggle, TypedConfirm } from '../../components/admin/shared.jsx';
import { Form } from '../../components/ui/form';
import { MuiInput } from '../../components/admin/mui-fields.jsx';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import MediaPicker from '../../components/admin/MediaPicker.jsx';

const EMPTY = { name: '', startDate: '', endDate: '', isCurrent: false };
const ASSIGN_EMPTY = { memberId: '', role: '', profileMediaId: '', display_order: 0, is_active: true };

function toForm(item = {}) {
  return {
    name: item.name ?? '',
    startDate: (item.startDate ?? item.start_date ?? '').toString().slice(0, 10),
    endDate: (item.endDate ?? item.end_date ?? '').toString().slice(0, 10),
    isCurrent: !!(item.isCurrent ?? item.is_current),
  };
}

function memberName(m = {}) {
  return `${m.firstName ?? m.first_name ?? ''} ${m.lastName ?? m.last_name ?? ''}`.trim() || '(unnamed)';
}

export default function TermDetail() {
  const { id } = useParams();
  // The static `/admin/terms/new` route carries no `:id` param
  // (useParams().id is undefined there); the detail route always supplies
  // one. A missing param therefore means "new" — without this, the new
  // form fires termsApi.get(undefined) and renders the error state.
  const isNew = id === 'new' || id === undefined;
  const navigate = useNavigate();
  const summaryRef = useRef(null);
  const rosterSummaryRef = useRef(null);
  const methods = useEditorForm({ schema: termEditorSchema, defaultValues: EMPTY });
  const {
    control, reset, watch, handleSubmit,
    formState: { errors: rhfErrors },
  } = methods;
  const assignMethods = useEditorForm({ schema: memberTermEditorSchema, defaultValues: ASSIGN_EMPTY });
  const {
    control: assignControl, reset: assignReset,
    handleSubmit: handleAssignSubmit, formState: { errors: assignRhfErrors },
  } = assignMethods;
  const [original, setOriginal] = useState(EMPTY);
  const [loading, setLoading] = useState(!isNew);
  const [error, setError] = useState(null);
  // Load retry that preserves form state — bumps the fetch effect below
  // instead of window.location.reload(), which would wipe unsaved edits.
  const [loadRetry, setLoadRetry] = useState(0);
  const [serverError, setServerError] = useState(null);
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [toast, setToast] = useState('');
  // Roster state: the list endpoint takes pagination only, so the term's
  // assignments are filtered client-side by termId.
  const [assignments, setAssignments] = useState([]);
  const [members, setMembers] = useState([]);
  const [rosterLoading, setRosterLoading] = useState(!isNew);
  const [rosterError, setRosterError] = useState(null);
  const [rosterRetry, setRosterRetry] = useState(0);
  const [assignError, setAssignError] = useState(null);
  const [assignSaving, setAssignSaving] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState(null);

  const values = watch();
  const dirty = useMemo(() => JSON.stringify(values) !== JSON.stringify(original), [values, original]);
  const blocker = useDirtyGuard(dirty && !saving);

  useEffect(() => {
    if (isNew) return;
    let alive = true;
    termsApi.get(id)
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

  useEffect(() => {
    if (isNew) {
      setRosterLoading(false);
      return undefined;
    }
    let alive = true;
    setRosterLoading(true);
    setRosterError(null);
    Promise.all([
      memberTermsApi.list({ limit: 100 }).catch((e) => {
        if (e?.status === 404) return [];
        throw e;
      }),
      teamApi.list(),
    ])
      .then(([terms, team]) => {
        if (!alive) return;
        const mine = (Array.isArray(terms) ? terms : [])
          .filter((t) => String(t.termId ?? t.term_id ?? '') === String(id))
          .sort((a, b) => (a.displayOrder ?? a.display_order ?? 0) - (b.displayOrder ?? b.display_order ?? 0));
        setAssignments(mine);
        setMembers(Array.isArray(team) ? team : []);
        setRosterLoading(false);
      })
      .catch((err) => {
        if (!alive) return;
        setRosterError(err);
        setRosterLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [id, isNew, rosterRetry]);

  if (!isNew && loading) return <section aria-label="Term editor"><h1>Term</h1><LoadingSkeleton label="Loading term…" /></section>;
  // Retry clears the error + shows the loader from the click handler (not the
  // fetch effect) and bumps `loadRetry` — the form state above is untouched.
  const retryLoad = () => {
    setError(null);
    setLoading(true);
    setLoadRetry((n) => n + 1);
  };
  if (!isNew && error) return <section aria-label="Term editor"><h1>Term</h1><ErrorState error={error} onRetry={retryLoad} context="load this term" /></section>;

  const persist = (publish) => async (next) => {
    // Client validation runs through the zod schema on every submit; the
    // end < start cross-rule is backend truth and surfaces as the server
    // 400 banner. `publish` only flips callers' intent copy — terms have no
    // draft/published split, so both paths save verbatim.
    void publish;
    setSaving(true);
    setServerError(null);
    try {
      const payload = {
        name: next.name,
        startDate: next.startDate,
        endDate: next.endDate,
        isCurrent: !!next.isCurrent,
      };
      let saved;
      if (isNew) saved = await termsApi.create(payload);
      else saved = await termsApi.update(id, payload);
      const fresh = toForm(saved ?? next);
      reset(fresh);
      setOriginal(fresh);
      setToast('Saved.');
      if (isNew && getId(saved)) navigate(ADMIN_ENTITY_ROUTES.terms.detail(getId(saved)), { replace: true });
    } catch (err) {
      setServerError(err?.body?.message ?? err?.message ?? 'Save failed.');
    } finally {
      setSaving(false);
    }
  };

  const hardDelete = async () => {
    setSaving(true);
    try {
      await termsApi.remove(id);
      navigate(ADMIN_ENTITY_ROUTES.terms.list);
    } catch (err) {
      setServerError(err?.body?.message ?? err?.message ?? 'Delete failed.');
      setSaving(false);
      setConfirmDelete(false);
    }
  };

  const memberById = (memberId) => members.find((m) => String(getId(m)) === String(memberId));
  const assignedIds = new Set(assignments.map((a) => String(a.memberId ?? a.member_id ?? '')));
  const assignable = members.filter((m) => !assignedIds.has(String(getId(m))));

  const assign = async (form) => {
    const normalized = toEditorPayload(form);
    setAssignSaving(true);
    setAssignError(null);
    try {
      const created = await memberTermsApi.create({
        memberId: normalized.memberId,
        termId: id,
        role: normalized.role.trim(),
        profileMediaId: normalized.profileMediaId || null,
        displayOrder: Number(normalized.display_order) || 0,
        isActive: normalized.is_active !== false,
      });
      const row = created?.memberTerm ?? created;
      setAssignments((list) => [...list, row].sort(
        (a, b) => (a.displayOrder ?? a.display_order ?? 0) - (b.displayOrder ?? b.display_order ?? 0),
      ));
      assignReset(ASSIGN_EMPTY);
      setToast('Member assigned.');
    } catch (err) {
      setAssignError(err?.body?.message ?? err?.message ?? 'Could not assign member.');
    } finally {
      setAssignSaving(false);
    }
  };

  const removeAssignment = async () => {
    const rid = getId(confirmRemove);
    if (!rid) {
      setConfirmRemove(null);
      return;
    }
    const prev = assignments;
    setAssignments((list) => list.filter((a) => getId(a) !== rid));
    setAssignSaving(true);
    setAssignError(null);
    try {
      await memberTermsApi.remove(rid);
      setToast('Assignment removed.');
      setConfirmRemove(null);
    } catch (err) {
      setAssignments(prev);
      setAssignError(err?.body?.message ?? err?.message ?? 'Remove failed — change reverted.');
      setConfirmRemove(null);
    } finally {
      setAssignSaving(false);
    }
  };

  /* isActive is optimistic — persist immediately, roll back + announce on failure. */
  const toggleAssignmentActive = async (row, value) => {
    const rid = getId(row);
    if (!rid || assignSaving) return;
    const prev = assignments;
    setAssignments((list) => list.map((a) => (a === row ? { ...a, isActive: value, is_active: value } : a)));
    try {
      await memberTermsApi.update(rid, { isActive: value });
      setToast(value ? 'Member is active in this term.' : 'Member hidden in this term.');
    } catch (err) {
      setAssignments(prev);
      setAssignError(err?.body?.message ?? err?.message ?? 'Could not save visibility — toggle reverted.');
    }
  };

  return (
    <section aria-label={isNew ? 'New term' : 'Edit term'}>
      <div className="admin-page-head">
        <div>
          <h1>{isNew ? 'New term' : values.name || 'Term'}</h1>
          <p className="admin-muted">
            {values.isCurrent ? 'Current term · ' : ''}Promoting a term unsets every other term server-side.
          </p>
        </div>
        {!isNew ? <Link className="gdg-btn gdg-btn-secondary" to={ADMIN_ENTITY_ROUTES.terms.list}>Back to list</Link> : null}
      </div>

      <DirtyGuardBanner blocker={blocker} />

      <Form {...methods}>
        {/* persist(false) is created in the submit handler (not during render)
            so the summaryRef focus path never runs at render time. */}
        <form onSubmit={(e) => handleSubmit(persist(false), () => focusEditorErrors(summaryRef))(e)} noValidate>
          <EditorCard
            title={isNew ? 'New term' : 'Edit term'}
            eyebrow="Terms"
          >
            <EditorErrors errors={rhfErrors} serverError={serverError} summaryRef={summaryRef} />
            {toast ? <p role="status" aria-live="polite" className="admin-muted">{toast}</p> : null}
            <EditorField control={control} name="name" label="Name (≤ 20 chars)" required>
              {(field) => <MuiInput field={field} maxLength={20} />}
            </EditorField>
            <div className="editor-grid">
              <EditorField control={control} name="startDate" label="Start date" required>
                {(field) => <MuiInput field={field} type="date" />}
              </EditorField>
              <EditorField control={control} name="endDate" label="End date" required>
                {(field) => <MuiInput field={field} type="date" />}
              </EditorField>
            </div>
            <EditorField control={control} name="isCurrent" label="Current term" plain
              hint="Promoting unsets every other term (single-current invariant).">
              {(field) => (
                <Toggle id="isCurrent" label="Current term" checked={!!field.value} onChange={field.onChange} />
              )}
            </EditorField>
            <EditorFooter
              saving={saving}
              isNew={isNew}
              onPublish={() => handleSubmit(persist(true), () => focusEditorErrors(summaryRef))()}
              saveLabel="Save"
              publishLabel="Save"
              onArchive={() => setConfirmDelete(true)}
              archiveLabel="Delete"
            />
          </EditorCard>
        </form>
      </Form>

      {isNew ? (
        <div className="admin-card">
          <p className="admin-muted">Save the term first, then assign its roster.</p>
        </div>
      ) : (
        <Form {...assignMethods}>
          <EditorCard
            title="Roster"
            eyebrow="Term"
          >
            <p className="admin-muted">
              Assign team members with a per-term role, photo snapshot, order and
              visibility. One member per term — re-assigning the same member 409s.
            </p>
            <EditorErrors
              errors={assignRhfErrors}
              serverError={assignError}
              summaryRef={rosterSummaryRef}
              title="Fix the assignment fields below"
            />
            {rosterLoading ? <LoadingSkeleton label="Loading roster…" /> : null}
            {!rosterLoading && rosterError ? (
              <ErrorState error={rosterError} onRetry={() => setRosterRetry((t) => t + 1)} context="load roster" />
            ) : null}
            {!rosterLoading && !rosterError && assignments.length === 0 ? (
              <p className="admin-muted">No members assigned yet — assign the first one below.</p>
            ) : null}
            {!rosterLoading && !rosterError && assignments.length > 0 ? (
              <div className="admin-table-wrap">
                <Table className="admin-table">
                  <TableHead>
                    <TableRow>
                      <TableCell scope="col">Member</TableCell>
                      <TableCell scope="col">Role</TableCell>
                      <TableCell scope="col">Order</TableCell>
                      <TableCell scope="col">Active</TableCell>
                      <TableCell scope="col">Actions</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {assignments.map((a, i) => {
                      const rid = getId(a);
                      const memberId = a.memberId ?? a.member_id;
                      const member = memberById(memberId);
                      const active = (a.isActive ?? a.is_active) !== false;
                      return (
                        <TableRow key={rid ?? `${memberId}-${i}`}>
                          <TableCell>{member ? memberName(member) : <span className="admin-muted">{String(memberId ?? '').slice(0, 8)}…</span>}</TableCell>
                          <TableCell>{a.role || '—'}</TableCell>
                          <TableCell>{a.displayOrder ?? a.display_order ?? 0}</TableCell>
                          <TableCell>
                            <Toggle
                              id={`roster-active-${rid ?? i}`}
                              label="Active in term"
                              checked={active}
                              onChange={(v) => toggleAssignmentActive(a, v)}
                            />
                          </TableCell>
                          <TableCell>
                            <button
                              type="button"
                              className="gdg-btn gdg-btn-secondary admin-danger"
                              disabled={assignSaving}
                              onClick={() => setConfirmRemove(a)}
                            >
                              Remove
                            </button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            ) : null}
            <form onSubmit={(e) => handleAssignSubmit(assign, () => focusEditorErrors(rosterSummaryRef))(e)} noValidate>
              <h3>Assign member</h3>
              <div className="editor-grid">
                <EditorField control={assignControl} name="memberId" label="Member" required plain>
                  {(field) => (
                    <select id="memberId" value={field.value ?? ''} onChange={(e) => field.onChange(e.target.value)}>
                      <option value="">Select a team member…</option>
                      {assignable.map((m) => {
                        const mid = getId(m);
                        return <option key={mid} value={mid}>{memberName(m)}</option>;
                      })}
                    </select>
                  )}
                </EditorField>
                <EditorField control={assignControl} name="role" label="Role" required>
                  {(field) => <MuiInput field={field} value={field.value ?? ''} placeholder="e.g. Lead, Core member" />}
                </EditorField>
              </div>
              <div className="editor-grid">
                <EditorField
                  control={assignControl}
                  name="profileMediaId"
                  label="Photo"
                  plain
                  showMessage={false}
                  hint="Term snapshot — empty reuses the member's current avatar."
                >
                  {(field) => (
                    <MediaPicker
                      id="rosterProfileMediaId"
                      label="Profile media ID"
                      hint="Term snapshot — empty reuses the member's current avatar."
                      error={assignRhfErrors.profileMediaId?.message}
                      value={field.value ?? ''}
                      onChange={field.onChange}
                    />
                  )}
                </EditorField>
                <EditorField control={assignControl} name="display_order" label="Display order (≥ 0)">
                  {(field) => <input type="number" min="0" step="1" {...field} />}
                </EditorField>
              </div>
              <EditorField control={assignControl} name="is_active" label="Active in term" plain>
                {(field) => (
                  <Toggle id="roster-is-active" label="Active in term" checked={!!field.value} onChange={field.onChange} />
                )}
              </EditorField>
              <div className="editor-btn-row">
                <button type="submit" className="editor-btn editor-btn-primary" disabled={assignSaving}>
                  {assignSaving ? (
                    <>
                      <span className="editor-spinner" aria-hidden="true" />
                      Assigning…
                    </>
                  ) : (
                    'Assign member'
                  )}
                </button>
              </div>
            </form>
          </EditorCard>
        </Form>
      )}

      <TypedConfirm open={confirmDelete} title="Delete term?" body="Deletes the term and its roster assignments. This cannot be undone." expected={values.name} confirmLabel="Delete forever" busy={saving} onCancel={() => setConfirmDelete(false)} onConfirm={hardDelete} />
      <TypedConfirm open={!!confirmRemove} title="Remove assignment?" body="Removes this member from the term roster. The team-member profile is kept." expected={confirmRemove?.role ?? ''} confirmLabel="Remove" busy={assignSaving} onCancel={() => setConfirmRemove(null)} onConfirm={removeAssignment} />
    </section>
  );
}
