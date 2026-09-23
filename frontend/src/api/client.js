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
  const { headers, ...rest } = options;

  const mergedHeaders = {
    'Content-Type': 'application/json',
    ...headers,
  };

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  let response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      credentials: 'include',
      headers: mergedHeaders,
      ...rest,
      signal: controller.signal,
    });
  } catch (err) {
    if (err?.name === 'AbortError') {
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
