import { SignIn } from '@clerk/clerk-react';
import { AdminDisabled } from '../../components/ProtectedRoute.jsx';
import DevInstantAdmin from '../../components/admin/DevInstantAdmin.jsx';

const clerkPubKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;

export default function AdminLogin() {
  if (!clerkPubKey) {
    return (
      <>
        <AdminDisabled />
        <DevInstantAdmin />
      </>
    );
  }

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        paddingTop: '4rem',
      }}
    >
      <SignIn
        routing="path"
        path="/admin/login"
        signUpUrl="/admin/login"
        afterSignInUrl="/admin"
      />
      <DevInstantAdmin />
    </div>
  );
}
