import { useEffect } from 'react';
import { useAuth } from '@clerk/clerk-react';
import { setAuthTokenProvider } from './client.js';

const clerkPubKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;

/**
 * Registers Clerk `getToken()` as the global auth-token provider for
 * `apiFetch` (and multipart uploads) so every backend call carries
 * `Authorization: Bearer <session JWT>`. Renders only its children.
 *
 * When Clerk is disabled (no publishable key) it registers nothing.
 */
export function AuthTokenProvider({ children }) {
  const { getToken } = useAuth();

  useEffect(() => {
    if (!clerkPubKey || typeof getToken !== 'function') {
      return undefined;
    }
    setAuthTokenProvider(() => getToken());
    return () => {
      setAuthTokenProvider(null);
    };
  }, [getToken]);

  return children ?? null;
}

export default AuthTokenProvider;
