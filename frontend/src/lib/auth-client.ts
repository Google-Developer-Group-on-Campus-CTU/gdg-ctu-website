import { createAuthClient } from 'better-auth/react';
import { adminClient } from 'better-auth/client/plugins';

/**
 * Better Auth client for the whole frontend.
 *
 * - `baseURL` must be `VITE_API_URL` + `/api/auth`. Better Auth only appends
 *   its default `/api/auth` basePath when the baseURL has NO path — its
 *   `withPath()` helper returns a path-bearing URL unchanged (see
 *   `utils/url.ts` `checkHasPath` short-circuit). Ours always includes
 *   `/GDGoC-CTU-Main/v0.0.1`, so the suffix has to be explicit: without it
 *   every auth call resolves to `${VITE_API_URL}/get-session` (and
 *   `/sign-in/email`, `/sign-out`, …) and404s against the API catch-all —
 *   the backend mounts the handler at `${VITE_API_URL}/api/auth/*`
 *   (`AUTH_BASE_PATH` in backend/src/config/env.ts).
 * - The session travels as an HTTP-only cookie — `apiFetch` relies on
 *   `credentials: 'include'`, no bearer tokens are attached anywhere.
 * - `adminClient()` mirrors the backend admin plugin so role helpers
 *   (`authClient.admin.*`) are available on the client.
 */
const apiBaseUrl = import.meta.env.VITE_API_URL;

export const authClient = createAuthClient({
  baseURL: apiBaseUrl ? `${apiBaseUrl.replace(/\/+$/, '')}/api/auth` : undefined,
  plugins: [adminClient()],
});
