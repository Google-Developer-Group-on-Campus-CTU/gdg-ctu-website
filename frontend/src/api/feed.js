import { useCallback, useEffect, useRef, useState } from 'react';

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
  // `loader`/`initialData`/`withRequestId` are inline values at every call
  // site — listing them as effect deps would refetch on each render. They
  // ride in refs (synced by the dep-less effect below, which always runs
  // before the fetch effect) while `depsKey` + `retryCount` stay the
  // intentional dep list.
  const loaderRef = useRef(null);
  const optsRef = useRef(null);
  useEffect(() => {
    loaderRef.current = loader;
    optsRef.current = { initialData, withRequestId };
  });

  useEffect(() => {
    let alive = true;
    const { initialData: initial } = optsRef.current;
    setLoading(true);
    setError(null);
    setRequestId(`${Date.now().toString(36)}-${Math.floor(Math.random() * 1e4)}`);
    Promise.resolve()
      .then(() => loaderRef.current())
      .then((result) => {
        if (alive) {
          setData(result ?? initial);
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
  }, [depsKey, retryCount]);

  return { data, loading, error, requestId, retry };
}
