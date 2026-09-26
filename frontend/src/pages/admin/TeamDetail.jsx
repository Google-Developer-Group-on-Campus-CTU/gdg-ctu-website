import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { getId, mediaApi, memberTermsApi, teamApi, termsApi } from '../../api/resources.js';
import { mapTerm, pickImage, publicApi, safeSrc } from '../../api/public.js';
import { ADMIN_ENTITY_ROUTES, MAX_FEATURED_TEAM, isAnyUrl, isReservedSlug, slugify, useDirtyGuard } from '../../admin/editorial.js';
import {
  DirtyGuardBanner,
  EditorCard,
  EditorErrors,
  EditorField,
  EditorFooter,
  MuiConfirmDialog,
  MuiInput,
  MuiSwitchField,
  TEAM_DEPARTMENTS,
  focusEditorErrors,
  normalizeTeamDepartment,
  teamEditorSchema,
  toEditorPayload,
  useEditorForm,
  useSlugUniqueness,
} from '../../components/admin/form-shell.jsx';
import { ErrorState, LoadingSkeleton } from '../../components/admin/shared.jsx';
import TeamCard from '../../components/TeamCard.jsx';
import { Form } from '../../components/ui/form';
import Button from '@mui/material/Button';
import MenuItem from '@mui/material/MenuItem';
import MediaPicker from '../../components/admin/MediaPicker.jsx';

const EMPTY = {
  firstName: '', lastName: '', slug: '', role: '', bio: '',
  department: '', program: '', yearSection: '', profileMediaId: '',
  linkedinUrl: '', githubUrl: '', websiteUrl: '',
  isFeatured: false, displayOrder: 0, isActive: true, status: 'draft',
  termId: '', termDisplayOrder: 0, termIsActive: true,
};

function toForm(item = {}, termRow = null) {
  // Legacy CMS rows store free-text departments ("Executive Board",
  // "Operations Department", …) — fold through the theme normalizer so the
  // <select> shows the canonical value instead of rendering blank.
  const rawDept = item.department ?? '';
  return {
    firstName: item.firstName ?? item.first_name ?? '',
    lastName: item.lastName ?? item.last_name ?? '',
    slug: item.slug ?? '',
    role: termRow?.role ?? item.role ?? item.roleTitle ?? item.role_title ?? '',
    bio: item.bio ?? '',
    department: rawDept ? normalizeTeamDepartment(rawDept) : '',
    program: item.program ?? '',
    yearSection: item.yearSection ?? item.year_section ?? '',
    profileMediaId: termRow?.profileMediaId ?? item.profileMediaId ?? item.profile_media_id ?? '',
    linkedinUrl: item.linkedinUrl ?? item.linkedin_url ?? '',
    githubUrl: item.githubUrl ?? item.github_url ?? '',
    websiteUrl: item.websiteUrl ?? item.website_url ?? '',
    isFeatured: !!(item.isFeatured ?? item.is_featured),
    displayOrder: item.displayOrder ?? item.display_order ?? 0,
    isActive: item.isActive ?? item.is_active ?? true,
    status: String(item.status ?? 'draft').toLowerCase(),
    termId: termRow?.termId ?? termRow?.term_id ?? '',
    termDisplayOrder: termRow?.displayOrder ?? termRow?.display_order ?? item.displayOrder ?? item.display_order ?? 0,
    termIsActive: termRow?.isActive ?? termRow?.is_active ?? true,
  };
}

function emptyToNull(v) {
  if (v === '' || v === undefined) return null;
  if (typeof v === 'string' && v.trim() === '') return null;
  return v;
}

export default function TeamDetail() {
  const { id } = useParams();
  // The static `/admin/team/new` route carries no `:id` param
  // (useParams().id is undefined there); the detail route always supplies
  // one. A missing param therefore means "new".
  const isNew = id === 'new' || id === undefined;
  const navigate = useNavigate();
  const summaryRef = useRef(null);
  const methods = useEditorForm({ schema: teamEditorSchema, defaultValues: EMPTY });
  const {
    control, reset, watch, setValue, getValues, setError: setFieldError,
    formState: { errors: rhfErrors },
  } = methods;
  const [original, setOriginal] = useState(EMPTY);
  const [loading, setLoading] = useState(!isNew);
  const [error, setError] = useState(null);
  const [loadRetry, setLoadRetry] = useState(0);
  const [serverError, setServerError] = useState(null);
  const [publishErrors, setPublishErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [slugTouched, setSlugTouched] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [toast, setToast] = useState('');
  const [terms, setTerms] = useState([]);
  const [termsError, setTermsError] = useState(null);
  const [termRows, setTermRows] = useState([]);
  const [photoUrl, setPhotoUrl] = useState(null);
  const [copying, setCopying] = useState(false);
  const [newTermName, setNewTermName] = useState('');
  const [newTermBusy, setNewTermBusy] = useState(false);
  const [newTermMsg, setNewTermMsg] = useState(null);

  const values = watch();
  const dirty = useMemo(() => JSON.stringify(values) !== JSON.stringify(original), [values, original]);
  const blocker = useDirtyGuard(dirty && !saving);

  // Term picklist: public feed first (no auth), admin list as fallback.
  useEffect(() => {
    let alive = true;
    publicApi.getTerms()
      .then((rows) => {
        if (!alive) return;
        const mapped = (Array.isArray(rows) ? rows : []).map(mapTerm);
        setTerms(mapped);
        setTermsError(null);
      })
      .catch(() => {
        termsApi.list().then((rows) => {
          if (!alive) return;
          setTerms((Array.isArray(rows) ? rows : []).map(mapTerm));
          setTermsError(null);
        }).catch((err) => {
          if (!alive) return;
          setTerms([]);
          setTermsError(err);
        });
      });
    return () => { alive = false; };
  }, [loadRetry]);

  const currentTerm = useMemo(
    () => terms.find((t) => t.isCurrent) ?? terms[0] ?? null,
    [terms],
  );

  // Default the term dropdown to the current S.Y. on new records.
  useEffect(() => {
    if (!isNew || !currentTerm) return;
    if (!getValues('termId')) setValue('termId', currentTerm.id ?? '', { shouldDirty: true });
  }, [isNew, currentTerm, getValues, setValue]);

  useEffect(() => {
    if (isNew) return;
    let alive = true;
    Promise.all([
      teamApi.get(id),
      memberTermsApi.list({ limit: 100 }).catch(() => memberTermsApi.list().catch(() => [])),
    ]).then(([item, rows]) => {
      if (!alive) return;
      const all = Array.isArray(rows) ? rows : [];
      const memberId = getId(item) ?? id;
      const mine = all.filter((r) => String(r.memberId ?? r.member_id ?? '') === String(memberId));
      setTermRows(mine);
      const preferred = mine.find((r) => r.isActive ?? r.is_active) ?? mine[0] ?? null;
      const next = toForm(item, preferred);
      // When the member has no term row yet, default to the current term so
      // the first save targets a real S.Y. row.
      if (!next.termId && currentTerm?.id) next.termId = currentTerm.id;
      reset(next); setOriginal(next); setLoading(false);
    }).catch((err) => {
      if (!alive) return;
      setError(err); setLoading(false);
    });
    return () => { alive = false; };
  }, [id, isNew, loadRetry, reset, currentTerm]);

  // When the term dropdown changes on an existing member, swap the term-row
  // fields (role/order/photo/isActive) to that S.Y. row. New members keep
  // whatever was typed (their first row is unsaved).
  const activeTermId = watch('termId');
  useEffect(() => {
    if (isNew || !activeTermId) return;
    const row = termRows.find((r) => String(r.termId ?? r.term_id ?? '') === String(activeTermId));
    if (!row) {
      setValue('role', '', { shouldDirty: true });
      setValue('termDisplayOrder', getValues('displayOrder') ?? 0, { shouldDirty: true });
      setValue('termIsActive', true, { shouldDirty: true });
      return;
    }
    setValue('role', row.role ?? '', { shouldDirty: true });
    setValue('termDisplayOrder', row.displayOrder ?? row.display_order ?? 0, { shouldDirty: true });
    setValue('termIsActive', row.isActive ?? row.is_active ?? true, { shouldDirty: true });
    if (row.profileMediaId) setValue('profileMediaId', row.profileMediaId, { shouldDirty: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTermId]);

  // Slug auto-fills from the name until touched.
  const firstName = watch('firstName');
  const lastName = watch('lastName');
  useEffect(() => {
    if (!slugTouched) setValue('slug', slugify(`${firstName ?? ''} ${lastName ?? ''}`));
  }, [firstName, lastName, slugTouched, setValue]);

  // Resolve the MediaPicker UUID to a real URL for the exact-card preview.
  // safeSrc rejects bare UUIDs by design, so look the media row up.
  const profileMediaId = watch('profileMediaId');
  useEffect(() => {
    let alive = true;
    const direct = safeSrc(profileMediaId);
    if (direct) {
      setPhotoUrl(direct);
      return undefined;
    }
    const uuidLike = /^[0-9a-f-]{8,}/i.test(String(profileMediaId ?? ''));
    if (!uuidLike || !profileMediaId) {
      setPhotoUrl(null);
      return undefined;
    }
    mediaApi.get(profileMediaId).then((m) => {
      if (!alive) return;
      setPhotoUrl(pickImage(m));
    }).catch(() => {
      if (!alive) return;
      setPhotoUrl(null);
    });
    return () => { alive = false; };
  }, [profileMediaId]);

  const currentId = isNew ? null : getId(original) ?? id;
  const { slugDup, slugCheckError } = useSlugUniqueness(teamApi, watch('slug'), currentId);

  if (!isNew && loading) return <section aria-label="Team editor"><h1>Member</h1><LoadingSkeleton label="Loading member…" /></section>;
  const retryLoad = () => {
    setError(null);
    setLoading(true);
    setLoadRetry((n) => n + 1);
  };
  if (!isNew && error) return <section aria-label="Team editor"><h1>Member</h1><ErrorState error={error} onRetry={retryLoad} context="load this member" /></section>;

  /* Live card preview through the shared TeamCard (preview mode never
     navigates) — the exact public card: role pill, name pill, photo. */
  const previewName = `${values.firstName ?? ''} ${values.lastName ?? ''}`.trim() || 'Unnamed member';
  const previewMember = {
    name: previewName,
    role: values.role ?? '',
    bio: values.bio ?? '',
    photoUrl,
    photoAlt: previewName,
  };
  const activeTermName = terms.find((t) => String(t.id) === String(values.termId))?.name ?? null;

  const validateForPublish = (next) => {
    const errs = {};
    if (!String(next.firstName ?? '').trim()) errs.firstName = 'First name is required.';
    if (!String(next.lastName ?? '').trim()) errs.lastName = 'Last name is required.';
    if (!String(next.slug ?? '').trim()) errs.slug = 'Slug is required.';
    else if (isReservedSlug(next.slug)) errs.slug = 'This slug is reserved.';
    if (!next.profileMediaId) errs.profileMediaId = 'Photo is required on publish (3:4 portrait).';
    if (!String(next.role ?? '').trim()) errs.role = 'Role is required on publish.';
    else if (String(next.role).length > 80) errs.role = 'Role must be ≤ 80 characters.';
    // Legacy free-text ("Executive Board", "X Department") normalizes to
    // the canonical team before the enum check so old rows still publish.
    if (next.department) {
      const canonical = normalizeTeamDepartment(next.department);
      if (!TEAM_DEPARTMENTS.includes(canonical)) errs.department = 'Department must be one of the six teams.';
    }
    const order = Number(next.displayOrder);
    if (!Number.isInteger(order) || order < 0) errs.displayOrder = 'Display order must be an integer ≥ 0.';
    if (!next.termId) errs.termId = 'Term is required — pick the S.Y. this edit targets.';
    for (const key of ['linkedinUrl', 'githubUrl', 'websiteUrl']) {
      if (next[key] && !isAnyUrl(next[key])) errs[key] = 'Must be a valid URL.';
    }
    return errs;
  };

  const upsertTermRow = async (memberId, next) => {
    // The identity PATCH already upserts role/photo for termId; this call
    // writes the remaining term-row fields (order/active) through the
    // member-terms API so both stores stay in sync.
    const rows = await memberTermsApi.list({ limit: 100 }).catch(() => memberTermsApi.list());
    const all = Array.isArray(rows) ? rows : [];
    const existing = all.find(
      (r) => String(r.memberId ?? r.member_id ?? '') === String(memberId)
        && String(r.termId ?? r.term_id ?? '') === String(next.termId),
    );
    const body = {
      displayOrder: Number(next.termDisplayOrder ?? next.displayOrder) || 0,
      isActive: !!next.termIsActive,
      ...(next.profileMediaId ? { profileMediaId: next.profileMediaId } : {}),
    };
    if (existing) {
      const termRowId = existing.id ?? existing._id ?? existing.uuid;
      if (termRowId) await memberTermsApi.update(termRowId, body);
    } else {
      await memberTermsApi.create({
        memberId,
        termId: next.termId,
        role: next.role,
        profileMediaId: next.profileMediaId || null,
        displayOrder: body.displayOrder,
        isActive: body.isActive,
      });
    }
  };

  const persist = (publish) => async (e) => {
    if (e?.preventDefault) e.preventDefault();
    const next = getValues();
    setPublishErrors({});
    if (slugCheckError) { setFieldError('slug', { message: slugCheckError }); focusEditorErrors(summaryRef); return; }
    if (publish) {
      const gate = validateForPublish(next);
      if (slugDup) gate.slug = 'Slug is already in use.';
      if (Object.keys(gate).length > 0) {
        setPublishErrors(gate);
        for (const [k, message] of Object.entries(gate)) setFieldError(k, { message });
        focusEditorErrors(summaryRef);
        return;
      }
      if (next.isFeatured) {
        try {
          const all = await teamApi.list();
          const others = (Array.isArray(all) ? all : []).filter(
            (m) => (m.isFeatured ?? m.is_featured) && String(getId(m) ?? m.slug) !== String(currentId ?? next.slug),
          );
          if (others.length >= MAX_FEATURED_TEAM) {
            setServerError(`Featured cap reached (max ${MAX_FEATURED_TEAM}). Unfeature someone first.`);
            return;
          }
        } catch { /* non-blocking on lookup failure */ }
      }
    }
    setSaving(true); setServerError(null);
    try {
      // Drafts save unvalidated (no publish gate above); publish validated.
      const cleaned = toEditorPayload(next, { nullable: ['department', 'program', 'yearSection'] });
      const identity = {
        firstName: cleaned.firstName,
        lastName: cleaned.lastName,
        slug: cleaned.slug,
        bio: emptyToNull(cleaned.bio),
        department: emptyToNull(cleaned.department),
        program: emptyToNull(cleaned.program),
        yearSection: emptyToNull(cleaned.yearSection),
        profileMediaId: emptyToNull(cleaned.profileMediaId),
        linkedinUrl: emptyToNull(cleaned.linkedinUrl),
        githubUrl: emptyToNull(cleaned.githubUrl),
        websiteUrl: emptyToNull(cleaned.websiteUrl),
        isFeatured: !!cleaned.isFeatured,
        displayOrder: Number(cleaned.displayOrder) || 0,
        isActive: publish ? true : !!cleaned.isActive,
      };
      let saved; let memberId = currentId;
      if (isNew) {
        if (!next.termId || !String(next.role ?? '').trim()) {
          setServerError('Pick a term and role — a new member is an identity plus its first S.Y. row.');
          setSaving(false);
          return;
        }
        saved = await teamApi.create({ ...identity, termId: next.termId, role: String(next.role).trim() });
        memberId = getId(saved) ?? saved?.slug;
        await upsertTermRow(memberId, next).catch(() => {});
      } else {
        saved = await teamApi.update(id, {
          ...identity,
          ...(next.termId && String(next.role ?? '').trim()
            ? { termId: next.termId, role: String(next.role).trim() }
            : {}),
        });
        await upsertTermRow(memberId ?? id, next).catch(() => {});
      }
      const freshRows = await memberTermsApi.list({ limit: 100 }).catch(() => memberTermsApi.list().catch(() => []));
      const allRows = Array.isArray(freshRows) ? freshRows : [];
      const mine = allRows.filter((r) => String(r.memberId ?? r.member_id ?? '') === String(memberId ?? id));
      setTermRows(mine);
      const activeRow = mine.find((r) => String(r.termId ?? r.term_id ?? '') === String(next.termId)) ?? null;
      const fresh = toForm(saved ?? next, activeRow);
      reset(fresh); setOriginal(fresh); setToast(publish ? 'Published.' : 'Saved as draft.');
      if (isNew && memberId) navigate(ADMIN_ENTITY_ROUTES.team.detail(memberId), { replace: true });
    } catch (err) {
      setServerError(err?.body?.message ?? err?.message ?? 'Save failed.');
    } finally { setSaving(false); }
  };

  const copyFromPreviousTerm = async () => {
    if (!values.termId || termRows.length === 0) return;
    setCopying(true);
    try {
      const ordered = [...terms].sort((a, b) => String(a.name ?? '').localeCompare(String(b.name ?? '')));
      const idx = ordered.findIndex((t) => String(t.id) === String(values.termId));
      const prev = ordered.slice(0, idx).reverse()
        .map((t) => termRows.find((r) => String(r.termId ?? r.term_id ?? '') === String(t.id)))
        .find(Boolean);
      if (!prev) {
        setServerError('No previous S.Y. row to copy from yet.');
        return;
      }
      setValue('role', prev.role ?? '', { shouldDirty: true });
      setValue('termDisplayOrder', prev.displayOrder ?? prev.display_order ?? 0, { shouldDirty: true });
      setValue('termIsActive', prev.isActive ?? prev.is_active ?? true, { shouldDirty: true });
      if (prev.profileMediaId) setValue('profileMediaId', prev.profileMediaId, { shouldDirty: true });
      setToast('Copied from previous S.Y.');
    } finally { setCopying(false); }
  };

  // Inline S.Y. creation (the /admin/terms page is retired): validates the
  // YYYY-YYYY shape, derives Aug→Jul dates, creates via the kept terms API,
  // then selects the new term.
  const createTermInline = async () => {
    const raw = String(newTermName ?? '').trim();
    const m = /^(\d{4})-(\d{4})$/.exec(raw);
    if (!m || Number(m[2]) !== Number(m[1]) + 1) {
      setNewTermMsg('Use S.Y. format YYYY-YYYY with consecutive years (e.g. 2030-2031).');
      return;
    }
    setNewTermBusy(true); setNewTermMsg(null);
    try {
      const startYear = Number(m[1]);
      const created = await termsApi.create({
        name: raw,
        startDate: `${startYear}-08-01`,
        endDate: `${startYear + 1}-07-31`,
      });
      const mapped = mapTerm(created ?? {});
      setTerms((prev) => {
        const rest = prev.filter((t) => String(t.id ?? t.name) !== String(mapped.id ?? mapped.name));
        return [...rest, mapped].sort((a, b) => String(b.name ?? '').localeCompare(String(a.name ?? '')));
      });
      if (mapped.id) setValue('termId', mapped.id, { shouldDirty: true });
      setNewTermName('');
      setNewTermMsg(`S.Y. ${raw} created and selected.`);
    } catch (err) {
      if (err?.status === 409) setNewTermMsg(`S.Y. ${raw} already exists — pick it from the list above.`);
      else setNewTermMsg(err?.body?.message ?? err?.message ?? 'Could not create term.');
    } finally { setNewTermBusy(false); }
  };

  const combinedErrors = { ...rhfErrors, ...publishErrors };
  const previewHref = activeTermName ? `/team?term=${encodeURIComponent(activeTermName)}` : '/team';

  return (
    <section aria-label={isNew ? 'New member' : 'Edit member'}>
      <div className="admin-page-head">
        <div>
          <h1>{isNew ? 'New member' : `${values.firstName} ${values.lastName}`}</h1>
          <p className="admin-muted">Identity + S.Y. row · role ≤ 80 · Home carousel cap {MAX_FEATURED_TEAM}.</p>
        </div>
        {!isNew ? <Button component={Link} variant="outlined" to={ADMIN_ENTITY_ROUTES.team.list}>Back to list</Button> : null}
      </div>
      <DirtyGuardBanner blocker={blocker} />
      <div className="m3-detail-grid">
        <div className="m3-detail-main">
      <Form {...methods}>
        <form onSubmit={persist(false)} noValidate>
          <EditorCard
            title={isNew ? 'New member' : 'Edit member'}
            eyebrow="Team"
            actions={(
              <Button component="a" variant="outlined" href={previewHref} target="_blank" rel="noreferrer">
                Public preview
              </Button>
            )}
          >
            <EditorErrors errors={combinedErrors} serverError={serverError} summaryRef={summaryRef} />
            {toast ? <p role="status" aria-live="polite" className="admin-muted">{toast}</p> : null}
            <EditorField control={control} name="termId" label="School year (S.Y.)" required hint={termsError ? 'Could not load terms — type a new S.Y. below and press Add.' : 'Edits target this term\'s roster row.'}>
              {(field) => (
                <MuiInput field={field} select value={field.value ?? ''}>
                  <MenuItem value="">Select a term…</MenuItem>
                  {terms.map((t) => (
                    <MenuItem key={t.id ?? t.name} value={t.id ?? ''}>{t.label}{t.isCurrent ? ' (Current)' : ''}</MenuItem>
                  ))}
                </MuiInput>
              )}
            </EditorField>
            <div className="admin-toolbar" aria-label="Create a new school year">
              <MuiInput
                field={{ value: newTermName, onChange: (e) => { setNewTermName(e?.target?.value ?? e); setNewTermMsg(null); }, onBlur: () => {}, name: 'newTermName' }}
                placeholder="＋ New S.Y. (e.g. 2030-2031)"
                inputProps={{ 'aria-label': 'New school year name (YYYY-YYYY)' }}
              />
              <Button type="button" variant="outlined" disabled={newTermBusy} onClick={createTermInline}>
                {newTermBusy ? 'Adding…' : 'Add'}
              </Button>
            </div>
            {newTermMsg ? <p role="status" aria-live="polite" className="admin-muted">{newTermMsg}</p> : null}
            <div className="editor-grid">
              <EditorField control={control} name="role" label="Role for this term (≤ 80)" required>
                {(field) => <MuiInput field={field} maxLength={80} />}
              </EditorField>
              <EditorField control={control} name="termDisplayOrder" label="Term order (this S.Y.)">
                {(field) => <MuiInput field={field} type="number" min={0} step={1} />}
              </EditorField>
            </div>
            <EditorField control={control} name="termIsActive" label="Active in this term" plain>
              {(field) => (
                <MuiSwitchField field={field} id="tm-term-active" label="Active in this term" />
              )}
            </EditorField>
            {!isNew && termRows.length > 0 ? (
              <p>
                <Button type="button" variant="outlined" disabled={copying || !values.termId} onClick={copyFromPreviousTerm}>
                  {copying ? 'Copying…' : 'Copy from previous S.Y.'}
                </Button>
              </p>
            ) : null}
            <div className="editor-grid">
              <EditorField control={control} name="firstName" label="First name" required>
                {(field) => <MuiInput field={field} />}
              </EditorField>
              <EditorField control={control} name="lastName" label="Last name" required>
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
              <EditorField control={control} name="department" label="Department" required hint="One of the six public teams.">
                {(field) => (
                  <MuiInput field={field} select value={field.value ?? ''}>
                    <MenuItem value="">Select a department…</MenuItem>
                    {TEAM_DEPARTMENTS.map((d) => (
                      <MenuItem key={d} value={d}>{d}</MenuItem>
                    ))}
                  </MuiInput>
                )}
              </EditorField>
            </div>
            <EditorField control={control} name="bio" label="Bio">
              {(field) => <MuiInput field={field} value={field.value ?? ''} multiline rows={4} />}
            </EditorField>
            <div className="editor-grid">
              <EditorField control={control} name="program" label="Program (nullable)">
                {(field) => <MuiInput field={field} value={field.value ?? ''} />}
              </EditorField>
              <EditorField control={control} name="yearSection" label="Year / section (nullable)">
                {(field) => <MuiInput field={field} value={field.value ?? ''} />}
              </EditorField>
            </div>
            <EditorField
              control={control}
              name="profileMediaId"
              label="Photo (3:4 portrait, required on publish)"
              plain
              showMessage={false}
              hint="Pick from the Media library below; the ID is stored on save. Use a 3:4 portrait (≥ 600×800)."
            >
              {(field) => (
                <MediaPicker
                  id="profileMediaId"
                  label="Profile media ID"
                  hint="Pick from the Media library below; the ID is stored on save. Use a 3:4 portrait (≥ 600×800)."
                  error={combinedErrors.profileMediaId?.message ?? combinedErrors.profileMediaId}
                  value={field.value ?? ''}
                  onChange={field.onChange}
                />
              )}
            </EditorField>
            <div className="editor-grid">
              {['linkedinUrl', 'githubUrl', 'websiteUrl'].map((key) => (
                <EditorField key={key} control={control} name={key} label={key === 'linkedinUrl' ? 'LinkedIn URL' : key === 'githubUrl' ? 'GitHub URL' : 'Website URL'}>
                  {(field) => <MuiInput field={field} value={field.value ?? ''} placeholder="https://…" />}
                </EditorField>
              ))}
            </div>
            <EditorField control={control} name="isFeatured" label={`Featured on Home carousel (max ${MAX_FEATURED_TEAM})`} plain>
              {(field) => (
                <MuiSwitchField field={field} id="tm-featured" label={`Featured on Home carousel (max ${MAX_FEATURED_TEAM})`} />
              )}
            </EditorField>
            <div className="editor-grid">
              <EditorField control={control} name="displayOrder" label="Display order (member)">
                {(field) => <MuiInput field={field} type="number" min={0} step={1} />}
              </EditorField>
              <EditorField control={control} name="status" label="Status" plain>
                {(field) => (
                  <MuiInput field={field} select value={field.value ?? 'draft'}>
                    {['draft', 'published', 'archived'].map((s) => (
                      <MenuItem key={s} value={s}>{s}</MenuItem>
                    ))}
                  </MuiInput>
                )}
              </EditorField>
            </div>
            <EditorField control={control} name="isActive" label="Active (member)" plain>
              {(field) => (
                <MuiSwitchField field={field} id="tm-active" label="Active (member)" />
              )}
            </EditorField>
            <EditorFooter
              saving={saving}
              isNew={isNew}
              onPublish={persist(true)}
              onArchive={() => setConfirmDelete(true)}
            />
          </EditorCard>
        </form>
      </Form>
        </div>
        <aside className="m3-detail-pane" aria-label="Supporting details">
          <h3>Preview &amp; status</h3>
          <div style={{ display: 'grid', gap: 8 }}>
            <p style={{ fontSize: 'var(--m3-typescale-label-medium-size)', fontWeight: 500 }}>Team page preview</p>
            <p className="admin-muted" style={{ fontSize: 'var(--m3-typescale-body-small-size)' }}>
              The exact public card{activeTermName ? ` for S.Y. ${activeTermName}` : ''} — role pill, name pill, photo.
            </p>
            <TeamCard member={previewMember} preview />
          </div>
          <hr style={{ border: 'none', borderTop: '1px solid var(--m3-outline-variant)', margin: '8px 0' }} />
          <p className="admin-muted" style={{ wordBreak: 'break-all' }} aria-live="polite">
            {values.slug ? `/team/${values.slug}` : 'Slug generated from name'}
          </p>
          <p>
            <Button component="a" variant="outlined" href={previewHref} target="_blank" rel="noreferrer">
              Open public preview ↗
            </Button>
          </p>
          <hr style={{ border: 'none', borderTop: '1px solid var(--m3-outline-variant)', margin: '8px 0' }} />
          <p className="admin-muted" style={{ fontSize: 'var(--m3-typescale-body-small-size)' }}>
            Status: {values.status} · {values.isActive ? 'Visible publicly' : 'Hidden publicly'}
          </p>
        </aside>
      </div>
      <MuiConfirmDialog
        open={confirmDelete}
        title="Archive or delete member?"
        body="Prefer archive (isActive=false). Hard delete only for never-published drafts."
        expected={values.slug}
        confirmLabel="Archive member"
        busy={saving}
        onCancel={() => setConfirmDelete(false)}
        onConfirm={async () => {
          setSaving(true);
          try {
            await teamApi.update(id, { isActive: false, status: 'archived' });
            navigate(ADMIN_ENTITY_ROUTES.team.list);
          } catch (err) { setServerError(err?.body?.message ?? err?.message ?? 'Archive failed.'); setSaving(false); setConfirmDelete(false); }
        }}
      />
    </section>
  );
}
