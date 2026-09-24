import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { getId, mediaApi } from '../../api/resources.js';
import { pickImage, safeSrc } from '../../api/public.js';
import { ADMIN_ENTITY_ROUTES } from '../../admin/editorial.js';
import { hideImage } from './shared.jsx';
import { ErrorState, Field, LoadingSkeleton, inputProps } from './shared.jsx';

function shortId(id) {
  const text = String(id ?? '');
  return text.length > 20 ? `${text.slice(0, 8)}…${text.slice(-4)}` : text;
}

/**
 * Shared media picker for admin forms. Searches the Media library (mediaApi),
 * previews thumbnails through pickImage + safeSrc, shows selected state with
 * gdg-tag + blue outline, offers copy-ID, and links to /admin/media.
 * Visual language: Poppins, --card/--border, gdg-btn/gdg-tag/admin-media-card.
 */
export default function MediaPicker({ id, label, hint, error, required, value = '', onChange }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [retryTick, setRetryTick] = useState(0);
  const [query, setQuery] = useState('');
  const [copiedId, setCopiedId] = useState('');

  useEffect(() => {
    let alive = true;
    mediaApi
      .list({ limit: 100 })
      .then((rows) => {
        if (!alive) return;
        setItems(Array.isArray(rows) ? rows : []);
        setLoadError(null);
        setLoading(false);
      })
      .catch((err) => {
        if (!alive) return;
        setLoadError(err);
        setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [retryTick]);

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return items;
    return items.filter((m) =>
      [m.filename, m.originalName, m.alt_text ?? m.altText, String(getId(m) ?? '')]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(term),
    );
  }, [items, query]);

  const retry = () => {
    setLoading(true);
    setLoadError(null);
    setRetryTick((t) => t + 1);
  };

  const select = (mediaId) => {
    const next = String(mediaId ?? '');
    onChange?.(String(value ?? '') === next ? '' : next);
  };

  const copyId = async (mediaId) => {
    const text = String(mediaId ?? '');
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(text);
    } catch {
      window.prompt('Copy this media ID:', text);
    }
  };

  const selectedText = String(value ?? '');

  return (
    <Field label={label} hint={hint} error={error} htmlFor={id} required={required}>
      <div className="admin-toolbar">
        <input
          {...inputProps(id, error)}
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search filename, alt, or ID"
        />
        <Link to={ADMIN_ENTITY_ROUTES.media.list} className="gdg-btn gdg-btn-secondary">
          Upload new media
        </Link>
      </div>
      <p className="admin-muted gdg-status-muted" role="status" aria-live="polite">
        {selectedText ? (
          <>
            Selected: <code title={selectedText} className="gdg-code-muted">{shortId(selectedText)}</code>{' '}
            <button type="button" className="admin-link-btn" onClick={() => copyId(selectedText)}>
              {copiedId === selectedText ? 'Copied ✓' : 'Copy ID'}
            </button>{' '}
            <button type="button" className="admin-link-btn" onClick={() => onChange?.('')}>Clear</button>
          </>
        ) : (
          'No media selected — choose one below.'
        )}
      </p>
      {loading ? <LoadingSkeleton label="Loading media…" /> : null}
      {!loading && loadError ? (
        <ErrorState error={loadError} onRetry={retry} context="load media" />
      ) : null}
      {!loading && !loadError && items.length === 0 ? (
        <p className="admin-muted">No media yet — upload it from the Media library.</p>
      ) : null}
      {!loading && !loadError && items.length > 0 && filtered.length === 0 ? (
        <p className="admin-muted">Nothing matches “{query.trim()}”.</p>
      ) : null}
      {!loading && !loadError && filtered.length > 0 ? (
        <div className="admin-media-grid">
          {filtered.map((m) => {
            const mediaId = String(getId(m) ?? '');
            const selected = !!mediaId && selectedText === mediaId;
            const src = safeSrc(pickImage(m));
            const name = m.filename ?? m.originalName ?? mediaId;
            const alt = m.alt_text ?? m.altText ?? '';
            return (
              <article
                key={mediaId}
                className={`admin-media-card${selected ? ' is-selected' : ''}`}
              >
                {src ? (
                  <img src={src} alt={alt} loading="lazy" onError={hideImage} />
                ) : (
                  <div className="gdg-media-placeholder" aria-hidden="true" />
                )}
                <div className="admin-media-card-body">
                  <strong title={name} className="gdg-ellipsis">{name}</strong>
                  <p className="admin-muted gdg-muted-sm">{alt ? `alt: ${alt}` : 'No alt text'}</p>
                  {selected ? <p className="gdg-selected-wrap"><span className="gdg-tag gdg-tag-green">Selected</span></p> : null}
                  <div className="gdg-btn-row gdg-btn-row-sm">
                    <button type="button" className={selected ? 'gdg-btn gdg-btn-secondary gdg-btn-sm' : 'gdg-btn gdg-btn-primary gdg-btn-sm'} aria-pressed={selected} disabled={!mediaId} onClick={() => select(mediaId)}>
                      {selected ? 'Clear' : 'Select'}
                    </button>
                    <button type="button" className="gdg-btn gdg-btn-secondary gdg-btn-sm" disabled={!mediaId} onClick={() => copyId(mediaId)}>
                      {copiedId === mediaId ? 'Copied ✓' : 'Copy ID'}
                    </button>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      ) : null}
    </Field>
  );
}
