import { createAuthClient } from 'better-auth/react';
import { adminClient } from 'better-auth/client/plugins';

/**
 * Better Auth client for the whole frontend.
 *
 * - `baseURL` is `VITE_API_URL` (already includes `/GDGoC-CTU-Main/v0.0.1`),
 *   so requests go to `${VITE_API_URL}/api/auth/*`. The session travels as an
 *   HTTP-only cookie — `apiFetch` relies on `credentials: 'include'`, no
 *   bearer tokens are attached anywhere.
 * - `adminClient()` mirrors the backend admin plugin so role helpers
 *   (`authClient.admin.*`) are available on the client.
 */
export const authClient = createAuthClient({
  baseURL: import.meta.env.VITE_API_URL,
  plugins: [adminClient()],
});
