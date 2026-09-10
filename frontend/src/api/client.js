const API_BASE_URL = import.meta.env.VITE_API_URL ?? '';

let authTokenProvider = null;

/**
 * Register a global async token getter (wired to Clerk `useAuth().getToken()`
 * via `<AuthTokenProvider>`). Keeps all call sites unchanged.
 */
export function setAuthTokenProvider(fn) {
  authTokenProvider = typeof fn === 'function' ? fn : null;
}

export function getAuthTokenProvider() {
  return authTokenProvider;
}

export async function getAuthToken() {
  try {
    if (typeof authTokenProvider !== 'function') return null;
    return await authTokenProvider();
  } catch {
    return null;
  }
}
/**
 * Minimal fetch wrapper for the GDGoC-CTU backend.
 *
 * Sends cookies (`credentials: 'include'`), JSON headers, and the Clerk
 * session JWT (`Authorization: Bearer <token>`) when a token provider is
 * registered. Throws an Error on non-OK responses (with `error.status` and
 * `error.body` attached when available).
 */
export async function apiFetch(path, options = {}) {
  const { headers, ...rest } = options;

  const mergedHeaders = {
    'Content-Type': 'application/json',
    ...headers,
  };

  if (!mergedHeaders.Authorization) {
    const token = await getAuthToken();
    if (token) {
      mergedHeaders.Authorization = `Bearer ${token}`;
    }
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    credentials: 'include',
    headers: mergedHeaders,
    ...rest,
  });

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
