const API_BASE_URL = import.meta.env.VITE_API_URL ?? '';
const API_BASE_SUFFIX = '/GDGoC-CTU-Main/v0.0.1';

if (!API_BASE_URL) {
  console.error(
    '[api] VITE_API_URL is missing — API calls will hit the frontend origin and fail. Set it in frontend/.env (e.g. http://localhost:3000/GDGoC-CTU-Main/v0.0.1).',
  );
} else if (!API_BASE_URL.replace(/\/+$/, '').endsWith(API_BASE_SUFFIX)) {
  console.error(
    `[api] VITE_API_URL does not end with "${API_BASE_SUFFIX}" — backend routes will not resolve. Current value: ${API_BASE_URL}`,
  );
}

/** Abort any apiFetch that has not completed within this window. */
const REQUEST_TIMEOUT_MS = 15000;

/**
 * Minimal fetch wrapper for the GDGoC-CTU backend.
 *
 * Sends cookies (`credentials: 'include'`) so the Better Auth session cookie
 * travels with every call — no Authorization header is attached. Throws an
 * Error on non-OK responses (with `error.status` and `error.body` attached
 * when available) and aborts with `error.status = 504` if the request exceeds
 * the 15s timeout.
 */
export async function apiFetch(path, options = {}) {
  // Never relative-fetch: without VITE_API_URL the request would hit the
  // frontend origin and fail confusingly. Throw so admin UI can disable
  // itself via API_BASE_URL instead of firing doomed requests.
  if (!API_BASE_URL) {
    const error = new Error(
      'API is not configured — set VITE_API_URL in frontend/.env (e.g. http://localhost:3000/GDGoC-CTU-Main/v0.0.1) and restart the dev server.',
    );
    error.status = 503;
    throw error;
  }
  const { headers, body, signal: externalSignal, ...rest } = options;

  // Content-Type only when a body is present (GET/DELETE send none), and never
  // for FormData — the browser must append the multipart boundary itself.
  const mergedHeaders = { ...headers };
  if (
    body != null &&
    !(body instanceof FormData) &&
    mergedHeaders['Content-Type'] == null
  ) {
    mergedHeaders['Content-Type'] = 'application/json';
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  // Share an optional caller signal with the timeout controller so aborting
  // from the caller cancels the request too (and is not misreported as a 504).
  let externallyAborted = false;
  const onExternalAbort = () => {
    externallyAborted = true;
    controller.abort();
  };
  if (externalSignal?.aborted) onExternalAbort();
  else externalSignal?.addEventListener('abort', onExternalAbort, { once: true });

  let response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      credentials: 'include',
      headers: mergedHeaders,
      ...rest,
      body,
      signal: controller.signal,
    });
  } catch (err) {
    if (err?.name === 'AbortError') {
      if (externallyAborted) {
        const error = new Error(`API request aborted: ${path}`);
        error.name = 'AbortError';
        error.aborted = true;
        throw error;
      }
      const error = new Error(
        `API request timed out after ${REQUEST_TIMEOUT_MS}ms: ${path}`,
      );
      error.status = 504;
      error.timeout = true;
      throw error;
    }
    throw err;
  } finally {
    clearTimeout(timeoutId);
    externalSignal?.removeEventListener('abort', onExternalAbort);
  }

  if (!response.ok) {
    const error = new Error(
      `API request failed: ${response.status} ${response.statusText}`,
    );
    error.status = response.status;
    try {
      error.body = await response.json();
    } catch {
      error.body = await response.text().catch(() => null);
    }
    throw error;
  }

  if (response.status === 204) return null;

  const contentType = response.headers.get('content-type') ?? '';
  if (contentType.includes('application/json')) {
    return response.json();
  }
  return response.text();
}

export { API_BASE_URL };
