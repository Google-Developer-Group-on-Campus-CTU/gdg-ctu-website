import { useNavigate } from 'react-router-dom';
import { DEV_BYPASS_STORAGE_KEY } from '../../api/client.js';

/**
 * Dev-only shortcut that skips the Better Auth sign-in form by setting the
 * `gdg-dev-admin-bypass` flag and routing into the admin shell.
 * Requires the backend to run with `DEV_ADMIN_BYPASS=true`.
 * Renders nothing in production builds (`import.meta.env.DEV` is false).
 */
export default function DevInstantAdmin() {
  const navigate = useNavigate();

  if (!import.meta.env.DEV) return null;

  const activate = () => {
    try {
      localStorage.setItem(DEV_BYPASS_STORAGE_KEY, '1');
    } catch {
      /* storage unavailable — navigation still happens, bypass just won't persist */
    }
    navigate('/admin');
  };

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '0.5rem',
        marginTop: '1.25rem',
      }}
    >
      <button type="button" className="gdg-btn gdg-btn-secondary" onClick={activate}>
        Enter the admin without signing in (dev)
      </button>
      <small style={{ opacity: 0.75 }}>
        Dev only — sets a local bypass flag; production builds ignore it.
      </small>
    </div>
  );
}
