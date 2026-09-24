import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';

export function LoadingSkeleton({ rows = 6, label = 'Loading…' }) {
  return (
    <div role="status" aria-live="polite" aria-label={label} className="admin-skeleton">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="admin-skeleton-row" aria-hidden="true" />
      ))}
      <span className="admin-visually-hidden">{label}</span>
    </div>
  );
}

export function EmptyState({ title, hint, actionLabel, actionTo, docsHref }) {
  return (
    <div className="admin-empty">
      <h3>{title}</h3>
      {hint ? <p>{hint}</p> : null}
      <div className="gdg-btn-row">
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
        <button type="button" className="gdg-btn gdg-btn-secondary" onClick={onRetry}>
          Retry
        </button>
      ) : null}
    </div>
  );
}

export function StatusPill({ status, active }) {
  const normalized = String(status ?? (active === false ? 'archived' : 'draft')).toLowerCase();
  return (
    <span className={`admin-pill admin-pill-${normalized}`} aria-label={`Status: ${normalized}`}>
      {normalized}
    </span>
  );
}

export function Field({ label, hint, error, htmlFor, children, required }) {
  return (
    <div className="admin-field">
      <label htmlFor={htmlFor}>
        {label} {required ? <span aria-hidden="true">*</span> : null}
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

/** Archive-preferred typed confirm: caller decides archive vs hard delete; hard delete needs typed slug. */
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
        <label htmlFor="typed-confirm" style={{ fontWeight: 600, fontSize: '0.9rem' }}>
          Type <code>{expected}</code> to confirm
        </label>
        <input
          id="typed-confirm"
          ref={inputRef}
          value={typed}
          onChange={(e) => setTyped(e.target.value)}
          autoComplete="off"
        />
        <div className="gdg-btn-row" style={{ justifyContent: 'flex-end', marginTop: '1.25rem' }}>
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
      <label htmlFor={id} style={{ fontWeight: 500 }}>{label}</label>
      {hint ? <p className="admin-hint">{hint}</p> : null}
    </div>
  );
}

/**
 * Shared admin list shell: loading → error → empty → table/content.
 * Uses public DS utilities (gdg-btn, admin-table inside admin-table-wrap card).
 */
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
