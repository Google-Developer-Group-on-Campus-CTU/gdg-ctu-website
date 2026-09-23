import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

// Auth needs no provider: Better Auth talks to the backend directly and the
// session lives in an HTTP-only cookie (see src/lib/auth-client.ts).
createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
