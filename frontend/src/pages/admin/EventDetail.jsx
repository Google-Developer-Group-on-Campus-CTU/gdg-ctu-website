import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { eventsApi, getId, publicPreview } from '../../api/resources.js';
import {
  ADMIN_ENTITY_ROUTES,
  isReservedSlug, slugify,
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
  toEditorPayload,
  useEditorForm,
} from '../../components/admin/form-shell.jsx';
import { ErrorState, LoadingSkeleton, Toggle, TypedConfirm } from '../../components/admin/shared.jsx';
import { Form } from '../../components/ui/form';
import { Input } from '../../components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../components/ui/select';
import { Button } from '../../components/ui/button';
import { Popover } from '@base-ui/react/popover';
import { Calendar, ChevronLeft, ChevronRight } from 'lucide-react';
import MediaPicker from '../../components/admin/MediaPicker.jsx';

const DEFAULT_TIMEZONE = 'Asia/Manila';
/** First time offered when a date is picked before a time. */
const DEFAULT_EVENT_TIME = '09:00';

const EMPTY = {
  title: '', short_description: '', description: '', coverMediaId: '',
  location: '', externalUrl: '', timezone: DEFAULT_TIMEZONE,
  startAt: '', endAt: '', status: 'draft', is_active: true,
};

function toForm(item = {}) {
  return {
    title: item.title ?? '',
    short_description: item.short_description ?? item.shortDescription ?? '',
    description: item.description ?? '',
    coverMediaId: item.coverMediaId ?? item.cover_media_id ?? item.cover_url ?? '',
    location: item.location ?? '',
    externalUrl: item.externalUrl ?? item.external_url ?? '',
    timezone: item.timezone ?? DEFAULT_TIMEZONE,
    startAt: (item.startAt ?? item.start_at ?? '').toString().slice(0, 16),
    endAt: (item.endAt ?? item.end_at ?? '').toString().slice(0, 16),
    status: String(item.status ?? 'draft').toLowerCase(),
    is_active: item.is_active ?? item.isActive ?? true,
    updated_by: item.updated_by ?? item.updatedBy ?? null, updated_at: item.updated_at ?? item.updatedAt ?? null,
  };
}

/** Slug is never typed — it is derived from the title at save time. */
function deriveEventSlug(title) {
  return slugify(title ?? '');
}

/**
 * Keyless map links derived from the location text (there is no Google Maps
 * API key in the frontend env — see .env.example). The embed URL is what the
 * backend persists as locationEmbedUrl; the search URL powers the
 * "Open in Google Maps" link.
 */
function mapsEmbedUrl(location) {
  const query = String(location ?? '').trim();
  if (!query) return null;
  return `https://maps.google.com/maps?q=${encodeURIComponent(query)}&output=embed`;
}

function mapsSearchUrl(location) {
  const query = String(location ?? '').trim();
  if (!query) return null;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}

/**
 * Form state → CreateEventSchema / UpdateEventSchema body
 * (backend/src/modules/events/event.validations.ts, camelCase). The slug is
 * only ever sent on create (the backend requires it there); edits never send
 * it. locationEmbedUrl is auto-derived from the location text.
 */
function toApiPayload(v = {}, { slug } = {}) {
  const body = {
    title: v.title,
    shortDescription: v.short_description || null,
    description: v.description || null,
    coverMediaId: v.coverMediaId || null,
    location: v.location || null,
    locationEmbedUrl: mapsEmbedUrl(v.location),
    externalUrl: v.externalUrl,
    timezone: v.timezone || DEFAULT_TIMEZONE,
    startAt: v.startAt,
    endAt: v.endAt,
    status: v.status,
    isActive: v.is_active !== false,
  };
  if (slug) body.slug = slug;
  return body;
}

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];
const WEEKDAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

function pad2(n) {
  return String(n).padStart(2, '0');
}

/** Split an ISO-like `YYYY-MM-DDTHH:mm` value into date/time parts. */
function splitDateTime(value) {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(String(value ?? ''));
  if (!m) return { year: '', month: '', day: '', time: '' };
  return { year: m[1], month: m[2], day: m[3], time: `${m[4]}:${m[5]}` };
}

function formatDateTime(parts) {
  if (!parts.year || !parts.month || !parts.day) return '';
  const date = new Date(Number(parts.year), Number(parts.month) - 1, Number(parts.day), 0, 0);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

/**
 * Single combined date-and-time picker: a calendar month-grid inside a
 * popover with hour + minute selection in the same popover, one
 * `YYYY-MM-DDTHH:mm` form value out. Built from the shared shadcn Button +
 * Select primitives and the Base UI popover (same stack as components/ui) —
 * no new dependency, no separate date/time rows.
 */
function DateTimeField({ id, value, onChange }) {
  const parts = splitDateTime(value);
  const [open, setOpen] = useState(false);
  const today = new Date();
  const [view, setView] = useState({ year: today.getFullYear(), month: today.getMonth() + 1 });

  // Every open starts on the current value (or today) — form resets after
  // save never leave the calendar parked on a stale month.
  const handleOpenChange = (next) => {
    if (next) {
      const current = splitDateTime(value);
      setView({
        year: Number(current.year) || today.getFullYear(),
        month: Number(current.month) || today.getMonth() + 1,
      });
    }
    setOpen(next);
  };

  const emit = (date, time) => {
    if (!date) {
      onChange('');
      return;
    }
    onChange(`${date}T${time || DEFAULT_EVENT_TIME}`);
  };

  const currentDate = parts.year && parts.month && parts.day
    ? `${parts.year}-${parts.month}-${parts.day}`
    : '';
  const currentTime = parts.time;

  const pickDay = (day) => {
    emit(`${view.year}-${pad2(view.month)}-${pad2(day)}`, currentTime);
  };

  const setTime = (key, val) => {
    const [hh, mm] = (currentTime || DEFAULT_EVENT_TIME).split(':');
    const nextTime = key === 'hour' ? `${val}:${mm}` : `${hh}:${val}`;
    if (!currentDate) {
      emit(`${today.getFullYear()}-${pad2(today.getMonth() + 1)}-${pad2(today.getDate())}`, nextTime);
      return;
    }
    emit(currentDate, nextTime);
  };

  const shiftMonth = (delta) => {
    setView((v) => {
      const date = new Date(v.year, v.month - 1 + delta, 1);
      return { year: date.getFullYear(), month: date.getMonth() + 1 };
    });
  };

  const firstDow = new Date(view.year, view.month - 1, 1).getDay();
  const daysInView = new Date(view.year, view.month, 0).getDate();
  const cells = [...Array(firstDow).fill(null)];
  for (let d = 1; d <= daysInView; d += 1) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);

  const hours = [];
  for (let h = 0; h < 24; h += 1) hours.push(pad2(h));
  const minutes = [];
  for (let m = 0; m < 60; m += 1) minutes.push(pad2(m));
  const [selHour, selMinute] = (currentTime || '').split(':');

  const triggerLabel = currentDate
    ? `${formatDateTime(parts)}${currentTime ? `, ${currentTime}` : ''}`
    : 'Pick date & time';

  return (
    <Popover.Root open={open} onOpenChange={handleOpenChange}>
      <Popover.Trigger
        id={id}
        render={<Button variant="outline" type="button" className="justify-start font-normal" />}
      >
        <Calendar className="size-4 text-muted-foreground" aria-hidden="true" />
        <span className={currentDate ? undefined : 'text-muted-foreground'}>{triggerLabel}</span>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Positioner side="bottom" align="start" sideOffset={4} className="isolate z-50">
          <Popover.Popup className="w-max rounded-lg bg-popover p-3 text-popover-foreground shadow-md ring-1 ring-foreground/10 outline-none">
            <div className="flex items-center justify-between">
              <Button type="button" variant="ghost" size="icon-sm" onClick={() => shiftMonth(-1)} aria-label="Previous month">
                <ChevronLeft aria-hidden="true" />
              </Button>
              <p className="text-sm font-medium" aria-live="polite">{MONTHS[view.month - 1]} {view.year}</p>
              <Button type="button" variant="ghost" size="icon-sm" onClick={() => shiftMonth(1)} aria-label="Next month">
                <ChevronRight aria-hidden="true" />
              </Button>
            </div>
            <div className="grid grid-cols-7 gap-1" role="grid" aria-label="Choose a date">
              {WEEKDAYS.map((d) => (
                <span key={d} className="flex size-8 items-center justify-center text-xs text-muted-foreground" aria-hidden="true">{d}</span>
              ))}
              {cells.map((day, i) => {
                if (day === null) return <span key={`blank-${i}`} aria-hidden="true" />;
                const isSelected = currentDate === `${view.year}-${pad2(view.month)}-${pad2(day)}`;
                const dayDate = new Date(view.year, view.month - 1, day);
                const isToday = dayDate.toDateString() === today.toDateString();
                return (
                  <Button
                    // eslint-disable-next-line react/no-array-index-key
                    key={`${view.year}-${view.month}-${day}`}
                    type="button"
                    size="icon"
                    variant={isSelected ? 'default' : isToday ? 'outline' : 'ghost'}
                    aria-pressed={isSelected}
                    aria-label={dayDate.toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' })}
                    onClick={() => pickDay(day)}
                  >
                    {day}
                  </Button>
                );
              })}
            </div>
            <div className="mt-3 flex items-end gap-2">
              <label className="editor-field" htmlFor={`${id}-hour`}>
                <span className="editor-label">Hour</span>
                <Select value={selHour || undefined} onValueChange={(v) => setTime('hour', v)}>
                  <SelectTrigger id={`${id}-hour`}>
                    <SelectValue placeholder="HH" />
                  </SelectTrigger>
                  <SelectContent>
                    {hours.map((h) => (
                      <SelectItem key={h} value={h}>{h}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </label>
              <span className="pb-2 text-sm text-muted-foreground" aria-hidden="true">:</span>
              <label className="editor-field" htmlFor={`${id}-minute`}>
                <span className="editor-label">Minute</span>
                <Select value={selMinute || undefined} onValueChange={(v) => setTime('minute', v)}>
                  <SelectTrigger id={`${id}-minute`}>
                    <SelectValue placeholder="MM" />
                  </SelectTrigger>
                  <SelectContent>
                    {minutes.map((m) => (
                      <SelectItem key={m} value={m}>{m}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </label>
              <span className="flex-1" aria-hidden="true" />
              <Button type="button" variant="ghost" size="sm" onClick={() => { onChange(''); setOpen(false); }}>
                Clear
              </Button>
              <Button type="button" size="sm" onClick={() => setOpen(false)}>
                Done
              </Button>
            </div>
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  );
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
  const methods = useEditorForm({ schema: eventEditorSchema, defaultValues: EMPTY });
  const {
    control, reset, watch, setValue, setError: setFieldError, handleSubmit,
    formState: { errors: rhfErrors },
  } = methods;
  const [original, setOriginal] = useState(EMPTY);
  // The persisted slug is display-only (public link + preview text) — it is
  // never edited and never sent back on update.
  const [savedSlug, setSavedSlug] = useState('');
  const [loading, setLoading] = useState(!isNew);
  const [error, setError] = useState(null);
  // Load retry that preserves form state — bumps the fetch effect below
  // instead of window.location.reload(), which would wipe unsaved edits.
  const [loadRetry, setLoadRetry] = useState(0);
  const [serverError, setServerError] = useState(null);
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [toast, setToast] = useState('');
  const activePending = useRef(false);

  const values = watch();
  const dirty = useMemo(() => JSON.stringify(values) !== JSON.stringify(original), [values, original]);
  const blocker = useDirtyGuard(dirty && !saving);

  useEffect(() => {
    if (isNew) return;
    let alive = true;
    eventsApi.get(id)
      .then((item) => {
        if (!alive) return;
        const next = toForm(item);
        reset(next);
        setOriginal(next);
        setSavedSlug(item?.slug ?? '');
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

  if (!isNew && loading) return <section aria-label="Event editor"><h1>Event</h1><LoadingSkeleton label="Loading event…" /></section>;
  // Retry clears the error + shows the loader from the click handler (not the
  // fetch effect) and bumps `loadRetry` — the form state above is untouched.
  const retryLoad = () => {
    setError(null);
    setLoading(true);
    setLoadRetry((n) => n + 1);
  };
  if (!isNew && error) return <section aria-label="Event editor"><h1>Event</h1><ErrorState error={error} onRetry={retryLoad} context="load this event" /></section>;

  const titleText = values.title ?? '';
  const previewSlug = isNew ? deriveEventSlug(titleText) : (savedSlug || deriveEventSlug(titleText));
  const locationText = values.location ?? '';
  const embedUrl = mapsEmbedUrl(locationText);
  const searchUrl = mapsSearchUrl(locationText);

  // Live publish-gate indicator (display only — submit validation runs zod).
  const publishGate = validateEvent(values);

  /** Create with a server-generated unique slug: base first, then -2, -3… on 409. */
  const createWithUniqueSlug = async (payload, slugBase) => {
    let lastError = null;
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const slug = attempt === 0 ? slugBase : `${slugBase}-${attempt + 1}`;
      try {
        // eslint-disable-next-line no-await-in-loop
        const saved = await eventsApi.create({ ...payload, slug });
        return { saved, slug };
      } catch (err) {
        if (err?.status === 409 && attempt < 4) {
          lastError = err;
          continue;
        }
        throw err;
      }
    }
    throw lastError;
  };

  const persist = (publish) => async (next) => {
    // Client validation runs through the zod schema (same UX-level policy as
    // validateEvent) on every submit.
    const slugBase = deriveEventSlug(next.title);
    if (!slugBase) {
      setFieldError('title', { message: 'Title needs letters or numbers for the link.' });
      focusEditorErrors(summaryRef);
      return;
    }
    if (isReservedSlug(slugBase)) {
      setFieldError('title', { message: 'That title is reserved — try another.' });
      focusEditorErrors(summaryRef);
      return;
    }
    const normalized = toEditorPayload(next);
    // Status comes from the buttons, never a picker: draft on save, published on publish.
    const effective = { ...normalized, status: publish ? 'published' : 'draft', is_active: publish ? true : normalized.is_active };
    setSaving(true);
    setServerError(null);
    try {
      let saved;
      let finalSlug = savedSlug;
      if (isNew) {
        const created = await createWithUniqueSlug(toApiPayload(effective), slugBase);
        saved = created.saved;
        finalSlug = created.slug;
        setSavedSlug(created.slug);
      } else {
        // Edits never send the slug — the public link stays stable.
        saved = await eventsApi.update(id, toApiPayload(effective));
        finalSlug = saved?.slug ?? savedSlug;
        setSavedSlug(finalSlug);
      }
      const fresh = toForm(saved ?? effective);
      reset(fresh);
      setOriginal(fresh);
      const deduped = isNew && finalSlug && finalSlug !== slugBase;
      setToast(`${publish ? 'Published.' : 'Saved as draft.'}${deduped ? ` Public link: /events/${finalSlug}.` : ''}`);
      if (isNew && (getId(saved) ?? saved?.slug)) navigate(ADMIN_ENTITY_ROUTES.events.detail(getId(saved) ?? saved.slug), { replace: true });
    } catch (err) {
      setServerError(err?.body?.message ?? err?.message ?? 'Save failed.');
    } finally {
      setSaving(false);
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
      await eventsApi.update(id, { isActive: value });
      setOriginal((o) => ({ ...o, is_active: value }));
      setToast(value ? 'Event is active.' : 'Event hidden publicly.');
    } catch (err) {
      setValue('is_active', prev);
      setToast(err?.body?.message ?? err?.message ?? 'Could not save visibility — toggle reverted.');
    } finally {
      activePending.current = false;
    }
  };

  const isDraft = original.status === 'draft';

  return (
    <section aria-label={isNew ? 'New event' : 'Edit event'}>
      <div className="admin-page-head">
        <div>
          <h1>{isNew ? 'New event' : values.title || 'Event'}</h1>
          {values.updated_at ? (
            <p className="admin-muted">
              Last edited {values.updated_at}{values.updated_by ? ` by ${values.updated_by}` : ''}
            </p>
          ) : null}
        </div>
        {!isNew ? <Link className="gdg-btn gdg-btn-secondary" to={ADMIN_ENTITY_ROUTES.events.list}>Back to list</Link> : null}
      </div>

      <DirtyGuardBanner blocker={blocker} />

      <div className="m3-detail-grid">
        <div className="m3-detail-main">
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
                href={previewSlug ? publicPreview.eventSlug(previewSlug) : publicPreview.events()}
                target="_blank"
                rel="noreferrer"
              >
                Public preview
              </a>
            )}
          >
            <EditorErrors errors={rhfErrors} serverError={serverError} summaryRef={summaryRef} />
            {toast ? <p role="status" aria-live="polite" className="admin-muted">{toast}</p> : null}
            <EditorField control={control} name="title" label="Title" required>
              {(field) => <Input {...field} placeholder="e.g. Build with AI Workshop" />}
            </EditorField>
            {previewSlug ? (
              <p className="admin-muted" aria-live="polite">/events/{previewSlug}</p>
            ) : null}
            <EditorField control={control} name="short_description" label="Short description">
              {(field) => <Input {...field} value={field.value ?? ''} placeholder="e.g. Intro AI workshop for students" />}
            </EditorField>
            <EditorField control={control} name="description" label="Description (markdown)" required>
              {(field) => <textarea {...field} value={field.value ?? ''} rows={6} />}
            </EditorField>
            <EditorField
              control={control}
              name="coverMediaId"
              label="Cover photo"
              plain
              showMessage={false}
            >
              {(field) => (
                <MediaPicker
                  id="coverMediaId"
                  label="Cover photo"
                  hint="Choose from the gallery or upload a new photo — no IDs needed."
                  error={rhfErrors.coverMediaId?.message}
                  required
                  showIds={false}
                  value={field.value ?? ''}
                  onChange={field.onChange}
                />
              )}
            </EditorField>
            <EditorField
              control={control}
              name="location"
              label="Location"
            >
              {(field) => <Input {...field} value={field.value ?? ''} placeholder="e.g. CTU Main Campus, Cebu City" />}
            </EditorField>
            {embedUrl ? (
              <div>
                <iframe
                  title={`Map preview for ${locationText.trim()}`}
                  src={embedUrl}
                  loading="lazy"
                  style={{ width: '100%', height: 280, border: 0, borderRadius: 8 }}
                />
                <p className="admin-muted">
                  <a href={searchUrl} target="_blank" rel="noreferrer">Open in Google Maps ↗</a>
                </p>
              </div>
            ) : null}
            <div className="editor-grid">
              <EditorField control={control} name="externalUrl" label="External link" required>
                {(field) => <Input {...field} value={field.value ?? ''} placeholder="https://…" />}
              </EditorField>
              <EditorField control={control} name="timezone" label="Timezone" required>
                {(field) => <Input {...field} value={field.value ?? ''} placeholder="Asia/Manila" />}
              </EditorField>
            </div>
            <div className="editor-grid">
              <EditorField control={control} name="startAt" label="Starts at" required plain>
                {(field) => (
                  <DateTimeField id="startAt" value={field.value ?? ''} onChange={field.onChange} />
                )}
              </EditorField>
              <EditorField control={control} name="endAt" label="Ends at" required plain>
                {(field) => (
                  <DateTimeField id="endAt" value={field.value ?? ''} onChange={field.onChange} />
                )}
              </EditorField>
            </div>
            <EditorField control={control} name="is_active" label="Active" plain>
              {(field) => (
                <Toggle id="is_active" label="Active" checked={!!field.value} onChange={toggleActive} />
              )}
            </EditorField>
            <EditorFooter
              saving={saving}
              isNew={isNew}
              onPublish={() => handleSubmit(persist(true), () => focusEditorErrors(summaryRef))()}
              onArchive={isDraft && !isNew ? () => setConfirmDelete(true) : undefined}
              archiveLabel="Delete draft"
            />
            {Object.keys(publishGate).length > 0 ? (
              <p className="admin-muted">Fix {Object.keys(publishGate).length} more to publish.</p>
            ) : (
              <p className="admin-muted">Ready to publish.</p>
            )}
          </EditorCard>
        </form>
      </Form>
        </div>
        <aside className="m3-detail-pane" aria-label="Supporting details">
          <h3>Preview &amp; status</h3>
          <p className="admin-muted" style={{ wordBreak: 'break-all' }} aria-live="polite">
            {previewSlug ? `/events/${previewSlug}` : 'Slug generated from title'}
          </p>
          <p>
            <a className="gdg-btn gdg-btn-secondary" href={previewSlug ? publicPreview.eventSlug(previewSlug) : publicPreview.events()} target="_blank" rel="noreferrer">
              Open public preview ↗
            </a>
          </p>
          <hr style={{ border: 'none', borderTop: '1px solid var(--m3-outline-variant)', margin: '8px 0' }} />
          <p style={{ fontSize: 'var(--m3-typescale-label-medium-size)', fontWeight: 500, color: 'var(--m3-on-surface)' }}>
            {Object.keys(publishGate).length > 0 ? `Fix ${Object.keys(publishGate).length} fields to publish` : 'Ready to publish'}
          </p>
          <p className="admin-muted" style={{ fontSize: 'var(--m3-typescale-body-small-size)' }}>
            Status: {values.status} · {values.is_active ? 'Visible publicly' : 'Hidden publicly'}
          </p>
          {embedUrl ? (
            <div style={{ display: 'grid', gap: 8 }}>
              <p style={{ fontSize: 'var(--m3-typescale-label-medium-size)', fontWeight: 500 }}>Location preview</p>
              <iframe title={`Map preview for ${locationText.trim()}`} src={embedUrl} loading="lazy" style={{ width: '100%', height: 220, border: 0, borderRadius: 'var(--m3-shape-corner-md)' }} />
              <a className="admin-muted" href={searchUrl} target="_blank" rel="noreferrer" style={{ fontSize: 'var(--m3-typescale-body-small-size)' }}>Open in Google Maps ↗</a>
            </div>
          ) : (
            <p className="admin-muted" style={{ fontSize: 'var(--m3-typescale-body-small-size)' }}>Add a location to see map preview here.</p>
          )}
        </aside>
      </div>

      <TypedConfirm open={confirmDelete} title="Delete draft?" body="Hard delete is only for never-published drafts. This cannot be undone." expected={values.title} confirmLabel="Delete forever" busy={saving} onCancel={() => setConfirmDelete(false)} onConfirm={hardDelete} />
    </section>
  );
}
