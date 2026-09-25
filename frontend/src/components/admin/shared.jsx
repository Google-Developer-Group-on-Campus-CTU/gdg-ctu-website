import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';

export function LoadingSkeleton({ rows = 6, label = 'Loading…' }) {
  return (
    <div role="status" aria-live="polite" aria-label={label} className="admin-skeleton" style={{ display: 'grid', gap: 8, padding: 16, background: 'var(--m3-surface-container)', borderRadius: 12 }}>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="admin-skeleton-row" aria-hidden="true" />
      ))}
      <span className="admin-visually-hidden">{label}</span>
    </div>
  );
}

export function FeedSkeleton({ count = 3, label = 'Loading…' }) {
  return (
    <div className="gdg-grid" role="status" aria-live="polite" aria-label={label}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="gdg-card" aria-hidden="true">
          <div className="gdg-skeleton gdg-skeleton-photo" />
          <div className="gdg-skeleton gdg-skeleton-line" />
          <div className="gdg-skeleton gdg-skeleton-line short" />
        </div>
      ))}
      <span className="gdg-visually-hidden">{label}</span>
    </div>
  );
}

export function hideImage(e) {
  e.currentTarget.style.display = 'none';
}

export function friendlyFeedError(error) {
  if (!error) return 'Could not load this section.';
  if (error.status === 404) return 'This content is not published yet.';
  if (error.status >= 500) return 'The content service is temporarily unavailable. Please retry.';
  return error?.body?.message ?? error?.message ?? 'Could not load this section.';
}

export function FeedError({ message = 'Could not load this section.', onRetry }) {
  return (
    <div className="admin-notice admin-notice-error" role="alert" style={{ borderRadius: 12 }}>
      <p>{message}</p>
      {onRetry ? (
        <button type="button" className="gdg-btn gdg-btn-secondary" onClick={onRetry} style={{ marginTop: 12 }}>
          Retry
        </button>
      ) : null}
    </div>
  );
}

export function StripHead({ badge, title, to, linkLabel = 'View all' }) {
  return (
    <div className="gdg-strip-head">
      <div>
        {badge ? <span className="admin-eyebrow">{badge}</span> : null}
        <h2 style={{ fontFamily: '"Google Sans", Roboto, sans-serif', fontSize: 22, fontWeight: 400 }}>{title}</h2>
      </div>
      {to ? <Link to={to} className="gdg-btn gdg-btn-secondary">{linkLabel}</Link> : null}
    </div>
  );
}

export function EmptyState({ title, hint, actionLabel, actionTo, docsHref }) {
  return (
    <div className="admin-empty">
      <div className="flex justify-center mb-3" aria-hidden="true">
        <span className="inline-flex size-12 items-center justify-center rounded-full bg-[var(--m3-secondary-container)] text-[var(--m3-on-secondary-container)]">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none"><path d="M12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM20 8h-2l-2-3H8L6 8H4a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-8a2 2 0 0 0-2-2Z" stroke="currentColor" strokeWidth="1.5"/></svg>
        </span>
      </div>
      <h3>{title}</h3>
      {hint ? <p>{hint}</p> : null}
      <div className="gdg-btn-row justify-center">
        {actionTo ? (
          <Link className="gdg-btn gdg-btn-primary" to={actionTo}>
            {actionLabel ?? 'Create new'}
          </Link>
        ) : null}
        {docsHref ? (
          <a className="gdg-btn gdg-btn-secondary" href={docsHref}>
            Docs
          </a>
        ) : null}
      </div>
    </div>
  );
}

export function ErrorState({ error, requestId, onRetry, context = 'load this content' }) {
  const message =
    error?.status === 401
      ? 'You are signed out. Sign in again to continue.'
      : error?.status === 403
        ? 'Account deactivated — contact tech/web officer.'
        : error?.status === 404
          ? 'This backend module is not deployed yet (V1 backend pass pending).'
          : (error?.body?.message ?? error?.message ?? `Could not ${context}.`);
  return (
    <div className="admin-error" role="alert">
      <h3>Something went wrong</h3>
      <p>{message}</p>
      {requestId ? <p className="admin-muted">Request ID: {requestId}</p> : null}
      {onRetry ? (
        <button type="button" className="gdg-btn gdg-btn-secondary" onClick={onRetry} style={{ marginTop: 12 }}>
          Retry
        </button>
      ) : null}
    </div>
  );
}

export function StatusPill({ status, active }) {
  let raw = status;
  if (typeof raw !== 'string' || !raw.trim()) {
    if (active === false) raw = 'archived';
    else if (active === true) raw = 'published';
    else raw = 'draft';
  }
  const normalized = String(raw).trim().toLowerCase();
  const variant =
    normalized === 'published' || normalized === 'active' || normalized === 'verified'
      ? 'lozenge-success'
      : normalized === 'draft' || normalized === 'unverified'
        ? 'lozenge-warning'
        : normalized === 'archived' || normalized === 'cancelled' || normalized === 'banned'
          ? 'lozenge-removed'
          : normalized === 'new'
            ? 'lozenge-new'
            : 'lozenge-default';
  // Non-color cue: icon dot
  const dot = variant === 'lozenge-success' ? '●' : variant === 'lozenge-warning' ? '◐' : variant === 'lozenge-removed' ? '■' : '○';
  return (
    <span className={`lozenge ${variant}`} aria-label={`Status: ${normalized}`}>
      <span aria-hidden="true" style={{ marginRight: 6 }}>{dot}</span>{normalized}
    </span>
  );
}

export function Field({ label, hint, error, htmlFor, children, required }) {
  return (
    <div className="admin-field">
      <label htmlFor={htmlFor}>
        {label} {required ? <span aria-hidden="true" style={{ color: 'var(--m3-error)' }}>*</span> : null}
      </label>
      {hint ? <p className="admin-hint" id={`${htmlFor}-hint`}>{hint}</p> : null}
      {children}
      {error ? (
        <p className="admin-field-error" id={`${htmlFor}-error`} role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}

export function inputProps(id, error) {
  return {
    id,
    'aria-invalid': error ? 'true' : undefined,
    'aria-describedby': error ? `${id}-error` : `${id}-hint`,
  };
}

export function FormSummary({ errors, summaryRef }) {
  const list = Object.entries(errors ?? {}).filter(([, v]) => v);
  if (!list.length) return null;
  return (
    <div className="admin-summary" role="alert" ref={summaryRef} tabIndex={-1}>
      <h3>Please fix {list.length} {list.length === 1 ? 'field' : 'fields'} before publishing</h3>
      <ul>
        {list.map(([key, message]) => (
          <li key={key}>
            <a href={`#${key}`}>{message}</a>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function focusSummary(ref) {
  requestAnimationFrame(() => ref?.current?.focus?.());
}

export function TypedConfirm({ open, title, body, expected, confirmLabel = 'Confirm', onConfirm, onCancel, busy }) {
  const [typed, setTyped] = useState('');
  const inputRef = useRef(null);
  if (!open) return null;
  const matches = typed.trim() === String(expected ?? '').trim();
  return (
    <div className="admin-dialog-backdrop" role="presentation" onClick={onCancel}>
      <div
        className="admin-dialog"
        role="alertdialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
        ref={(node) => {
          if (node && !inputRef.current) {
            const input = node.querySelector('input');
            if (input) input.focus();
          }
        }}
      >
        <h3>{title}</h3>
        <p className="admin-muted">{body}</p>
        <label htmlFor="typed-confirm" className="gdg-confirm-label">
          Type <code className="gdg-code-muted">{expected}</code> to confirm
        </label>
        <input
          id="typed-confirm"
          ref={inputRef}
          value={typed}
          onChange={(e) => setTyped(e.target.value)}
          autoComplete="off"
        />
        <div className="gdg-btn-row gdg-dialog-actions">
          <button type="button" className="gdg-btn gdg-btn-secondary" onClick={onCancel} disabled={busy}>
            Cancel
          </button>
          <button
            type="button"
            className="gdg-btn gdg-btn-primary admin-danger"
            disabled={!matches || busy}
            onClick={onConfirm}
          >
            {busy ? 'Working…' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

export function Toggle({ id, label, checked, onChange, hint }) {
  return (
    <div className="admin-toggle">
      <input id={id} type="checkbox" checked={!!checked} onChange={(e) => onChange(e.target.checked)} />
      <label htmlFor={id} className="gdg-toggle-label">{label}</label>
      {hint ? <p className="admin-hint">{hint}</p> : null}
    </div>
  );
}

export function AdminListPage({
  loading,
  loadingLabel = 'Loading…',
  error,
  requestId,
  onRetry,
  errorContext,
  isEmpty,
  empty,
  children,
}) {
  return (
    <>
      {loading ? <LoadingSkeleton label={loadingLabel} /> : null}
      {!loading && error ? (
        <ErrorState error={error} requestId={requestId} onRetry={onRetry} context={errorContext} />
      ) : null}
      {!loading && !error && isEmpty ? empty : null}
      {!loading && !error && !isEmpty ? children : null}
    </>
  );
}
