import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { ClerkProvider } from '@clerk/clerk-react'
import { AuthTokenProvider } from './api/auth.js'
import './index.css'
import App from './App.jsx'

const clerkPubKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY

if (!clerkPubKey) {
  console.warn('Clerk publishable key is missing — Clerk is disabled in local dev.')
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    {clerkPubKey ? (
      <ClerkProvider publishableKey={clerkPubKey}>
        <AuthTokenProvider>
          <App />
        </AuthTokenProvider>
      </ClerkProvider>
    ) : (
      <App />
    )}
  </StrictMode>,
)
