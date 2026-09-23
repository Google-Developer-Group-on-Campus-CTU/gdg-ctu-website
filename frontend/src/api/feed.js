import { useCallback, useEffect, useState } from 'react';

/**
 * Shared feed primitives (single source of truth).
 * - `qs` was duplicated in api/resources.js + api/public.js.
 * - `useAdminList` (admin/editorial.js) and `usePublicFeed` (api/public.js)
 *   were structurally identical; both delegate to `useFeed` below,
 *   parameterized on initial data (+ opt-in requestId for admin lists).
 */

export function qs(params = {}) {
  const entries = Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== '');
  if (!entries.length) return '';
  return `?${new URLSearchParams(entries).toString()}`;
}

export function useFeed(loader, { depsKey = '', initialData = null, withRequestId = false } = {}) {
  const [data, setData] = useState(initialData);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [requestId, setRequestId] = useState(null);
  const [retryCount, setRetryCount] = useState(0);
  const retry = useCallback(() => setRetryCount((n) => n + 1), []);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError(null);
    if (withRequestId) setRequestId(`${Date.now().toString(36)}-${Math.floor(Math.random() * 1e4)}`);
    Promise.resolve()
      .then(loader)
      .then((result) => {
        if (alive) {
          setData(result ?? initialData);
          setLoading(false);
        }
      })
      .catch((err) => {
        // Rejections (incl. apiFetch 504 timeout/abort errors) land in `error`
        // so consumers can render a retry UI instead of a stuck loader.
        if (alive) {
          setError(err);
          setLoading(false);
        }
      });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [depsKey, retryCount]);

  return { data, loading, error, requestId, retry };
}
