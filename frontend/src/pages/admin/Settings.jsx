import { useNavigate } from 'react-router-dom';
import { authClient } from '../../lib/auth-client';
import { API_BASE_URL } from '../../api/resources.js';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';

export default function AdminSettings() {
  const { data: session } = authClient.useSession();
  const navigate = useNavigate();
  const user = session?.user;

  const handleSignOut = async () => {
    try {
      await authClient.signOut();
    } finally {
      navigate('/admin/login', { replace: true });
    }
  };

  return (
    <section aria-label="Settings and profile">
      <div className="admin-page-head">
        <div>
          <h1>Settings</h1>
          <p className="admin-muted">Profile + environment. V1 has no RBAC or versioning UI.</p>
        </div>
      </div>
      <div className="admin-cards">
        <Card aria-label="Profile">
          <CardContent>
            <h2>Profile</h2>
            <p><strong>{user?.name || user?.email || 'Admin'}</strong></p>
            <p className="admin-muted">{user?.email ?? 'No email on file'}</p>
            <p className="admin-muted">User ID: {user?.id ?? '—'}</p>
            <div className="gdg-btn-row">
              <Button type="button" variant="outlined" onClick={handleSignOut}>
                Sign out
              </Button>
            </div>
          </CardContent>
        </Card>
        <Card aria-label="Environment">
          <CardContent>
            <h2>Environment</h2>
            <p className="admin-muted">API base (VITE_API_URL):</p>
            <p><code>{API_BASE_URL || '(not set)'}</code></p>
            <p className="admin-muted">
              Expected: &lt;backend&gt;/GDGoC-CTU-Main/v0.0.1. Every change is
              checked on the server (Better Auth session cookie). 401 = signed
              out, 403 = inactive account (contact the tech/web officer).
            </p>
          </CardContent>
        </Card>
      </div>
    </section>
  );
}
