import { useCallback, useState } from 'react';
import TextField from '@mui/material/TextField';
import InputAdornment from '@mui/material/InputAdornment';
import IconButton from '@mui/material/IconButton';
import Alert from '@mui/material/Alert';
import { Eye, EyeOff } from 'lucide-react';
import AuthBrandPanel from './AuthBrandPanel.jsx';

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const MIN_PASSWORD_LENGTH = 8;

export { AuthBrandPanel };

export function useFieldErrors(initial = {}) {
  const [fieldErrors, setFieldErrors] = useState(initial);
  const clearFieldError = useCallback((field) => {
    setFieldErrors((prev) => (prev[field] ? { ...prev, [field]: undefined } : prev));
  }, []);
  return [fieldErrors, setFieldErrors, clearFieldError];
}

export function AuthField({ id, label, hintId, hint, children }) {
  return (
    <div className="login-field">
      <label htmlFor={id}>{label}</label>
      {children}
      {hint ? (
        <p className="login-hint" id={hintId}>
          {hint}
        </p>
      ) : null}
    </div>
  );
}

export function AuthInput({ id, error, hintId, ...props }) {
  return (
    <TextField
      id={id}
      fullWidth
      variant="outlined"
      error={!!error}
      helperText={error ?? null}
      slotProps={{
        input: {
          'aria-invalid': error ? 'true' : undefined,
          'aria-describedby': error ? `${id}-error` : hintId,
        },
      }}
      {...props}
    />
  );
}

export function PasswordField({ id, label, value, onChange, error, hint, hintId, autoComplete, show, setShow }) {
  return (
    <AuthField id={id} label={label} hint={hint} hintId={hintId}>
      <TextField
        id={id}
        type={show ? 'text' : 'password'}
        autoComplete={autoComplete}
        value={value}
        onChange={onChange}
        fullWidth
        variant="outlined"
        error={!!error}
        helperText={error ?? null}
        slotProps={{
          input: {
            'aria-invalid': error ? 'true' : undefined,
            'aria-describedby': error ? `${id}-error` : hintId,
            endAdornment: (
              <InputAdornment position="end">
                <IconButton
                  type="button"
                  size="small"
                  aria-pressed={show}
                  aria-label={show ? 'Hide password' : 'Show password'}
                  onClick={() => setShow((v) => !v)}
                  edge="end"
                >
                  {show ? <EyeOff size={18} aria-hidden="true" /> : <Eye size={18} aria-hidden="true" />}
                </IconButton>
              </InputAdornment>
            ),
          },
        }}
      />
    </AuthField>
  );
}

export function AuthAlert({ message }) {
  if (!message) return null;
  return (
    <Alert severity="error" role="alert" sx={{ mb: 2 }}>
      {message}
    </Alert>
  );
}

export function AuthCardDots() {
  return (
    <div className="login-card-dots" aria-hidden="true">
      <i />
      <i />
      <i />
      <i />
    </div>
  );
}

export function AuthShell({ children, showDecor = true }) {
  return (
    <div className="login-page">
      <div className="login-stage">
        <AuthBrandPanel />
        <main className="login-panel">
          {showDecor ? (
            <>
              <img className="panel-deco panel-deco-star" src="/layout-assets/home/star-no-bg.png" alt="" aria-hidden="true" />
              <img className="panel-deco panel-deco-globe" src="/layout-assets/home/globe-no-bg.png" alt="" aria-hidden="true" />
            </>
          ) : null}
          <div className="login-card">
            <AuthCardDots />
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
