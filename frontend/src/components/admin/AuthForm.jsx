import { useCallback, useState } from 'react';
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

export function AuthField({ id, label, error, hintId, hint, children }) {
  return (
    <div className={`login-field${error ? ' has-error' : ''}`}>
      <label htmlFor={id}>{label}</label>
      {children}
      {hint && !error ? (
        <p className="login-hint" id={hintId}>
          {hint}
        </p>
      ) : null}
      {error ? (
        <p className="login-field-error" id={`${id}-error`} role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}

export function AuthInput({ id, error, hintId, ...props }) {
  return (
    <input
      id={id}
      aria-invalid={error ? 'true' : undefined}
      aria-describedby={error ? `${id}-error` : hintId}
      {...props}
    />
  );
}

export function PasswordField({ id, label, value, onChange, error, hint, hintId, autoComplete, show, setShow }) {
  return (
    <AuthField id={id} label={label} error={error} hint={hint} hintId={hintId}>
      <div className="login-password-wrap">
        <AuthInput
          id={id}
          type={show ? 'text' : 'password'}
          autoComplete={autoComplete}
          value={value}
          onChange={onChange}
          error={error}
          hintId={hintId}
        />
        <button type="button" className="login-peek" aria-pressed={show} onClick={() => setShow((v) => !v)}>
          {show ? 'Hide' : 'Show'}
        </button>
      </div>
    </AuthField>
  );
}

export function AuthAlert({ message }) {
  if (!message) return null;
  return (
    <div className="login-alert" role="alert">
      {message}
    </div>
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
