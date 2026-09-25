import { useState } from 'react';
import { publicApi } from '../api/public.js';
import { Input } from '../components/ui/input';

const JOIN_FORM_URL =
  'https://docs.google.com/forms/d/e/1FAIpQLSe8XGfS83u5u3bbwqaUlHYmYlTNqPuYPl1aULCb8xMrN91jaQ/viewform?pli=1';

const FACEBOOK_URL = 'https://www.facebook.com/gdsc.cebutech';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const EMPTY_FORM = { name: '', email: '', subject: '', message: '' };

function validateContact(values) {
  const errors = {};
  if (!values.name.trim()) errors.name = 'Name is required.';
  if (!values.email.trim()) errors.email = 'Email is required.';
  else if (!EMAIL_RE.test(values.email.trim())) errors.email = 'Enter a valid email address.';
  if (!values.message.trim()) errors.message = 'Message is required.';
  return errors;
}

function contactErrorMessage(err) {
  if (err?.status === 503) return 'The contact service is not configured right now. Please try again later.';
  if (err?.status === 429) return 'You are sending messages too quickly. Please wait a moment and try again.';
  if (err?.status >= 500) return 'The contact service is temporarily unavailable. Please try again.';
  const body = err?.body;
  const msg =
    typeof body === 'object' && body !== null ? (body.message ?? body.error) : null;
  if (typeof msg === 'string' && msg) return msg;
  if (Array.isArray(body?.issues) && body.issues.length > 0) {
    const first = body.issues[0];
    if (typeof first?.message === 'string' && first.message) return first.message;
  }
  return err?.message ?? 'Could not send your message. Please try again.';
}

function ContactForm() {
  const [values, setValues] = useState(EMPTY_FORM);
  const [errors, setErrors] = useState({});
  const [status, setStatus] = useState('idle');
  const [errorMessage, setErrorMessage] = useState(null);

  const set = (key) => (e) => {
    setValues((prev) => ({ ...prev, [key]: e.target.value }));
    // Clear the field error as the user types; a fresh submit re-validates.
    setErrors((prev) => (prev[key] ? { ...prev, [key]: undefined } : prev));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const fieldErrors = validateContact(values);
    setErrors(fieldErrors);
    if (Object.values(fieldErrors).some(Boolean)) return;
    setStatus('sending');
    setErrorMessage(null);
    try {
      await publicApi.submitContact({
        name: values.name.trim(),
        email: values.email.trim(),
        ...(values.subject.trim() ? { subject: values.subject.trim() } : {}),
        message: values.message.trim(),
      });
      setStatus('sent');
      setValues(EMPTY_FORM);
      setErrors({});
    } catch (err) {
      setStatus('error');
      setErrorMessage(contactErrorMessage(err));
    }
  };

  if (status === 'sent') {
    return (
      <div role="status" aria-live="polite">
        <h3>Message sent</h3>
        <p>
          Thanks for reaching out — the GDG On Campus CTU team will get back to
          you soon.
        </p>
        <div className="gdg-btn-row">
          <button
            type="button"
            className="gdg-btn gdg-btn-secondary"
            onClick={() => setStatus('idle')}
          >
            Send another message
          </button>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} noValidate aria-label="Contact form">
      {status === 'error' && errorMessage ? (
        <p className="admin-field-error" role="alert" style={{ marginBottom: 12 }}>
          {errorMessage}
        </p>
      ) : null}
      <div className="editor-grid">
        <div className="admin-field">
          <label htmlFor="contact-name">
            Name <span aria-hidden="true" style={{ color: 'var(--m3-error)' }}>*</span>
          </label>
          <Input
            id="contact-name"
            name="name"
            type="text"
            autoComplete="name"
            value={values.name}
            onChange={set('name')}
            required
            aria-required="true"
            aria-invalid={errors.name ? 'true' : undefined}
            aria-describedby={errors.name ? 'contact-name-error' : undefined}
            placeholder="Your name"
          />
          {errors.name ? (
            <p className="admin-field-error" id="contact-name-error" role="alert">
              {errors.name}
            </p>
          ) : null}
        </div>
        <div className="admin-field">
          <label htmlFor="contact-email">
            Email <span aria-hidden="true" style={{ color: 'var(--m3-error)' }}>*</span>
          </label>
          <Input
            id="contact-email"
            name="email"
            type="email"
            autoComplete="email"
            value={values.email}
            onChange={set('email')}
            required
            aria-required="true"
            aria-invalid={errors.email ? 'true' : undefined}
            aria-describedby={errors.email ? 'contact-email-error' : undefined}
            placeholder="you@example.com"
          />
          {errors.email ? (
            <p className="admin-field-error" id="contact-email-error" role="alert">
              {errors.email}
            </p>
          ) : null}
        </div>
      </div>
      <div className="admin-field">
        <label htmlFor="contact-subject">Subject</label>
        <Input
          id="contact-subject"
          name="subject"
          type="text"
          value={values.subject}
          onChange={set('subject')}
          placeholder="What is this about? (optional)"
        />
      </div>
      <div className="admin-field">
        <label htmlFor="contact-message">
          Message <span aria-hidden="true" style={{ color: 'var(--m3-error)' }}>*</span>
        </label>
        <textarea
          id="contact-message"
          name="message"
          rows={5}
          value={values.message}
          onChange={set('message')}
          required
          aria-required="true"
          aria-invalid={errors.message ? 'true' : undefined}
          aria-describedby={errors.message ? 'contact-message-error' : undefined}
          placeholder="How can we help?"
          style={{ width: '100%' }}
        />
        {errors.message ? (
          <p className="admin-field-error" id="contact-message-error" role="alert">
            {errors.message}
          </p>
        ) : null}
      </div>
      <div className="gdg-btn-row">
        <button
          type="submit"
          className="gdg-btn gdg-btn-primary"
          disabled={status === 'sending'}
          aria-busy={status === 'sending'}
        >
          {status === 'sending' ? 'Sending…' : 'Send message'}
        </button>
      </div>
    </form>
  );
}

export default function Contact() {
  return (
    <div className="gdg-container">
      <section className="gdg-section">
        <span className="gdg-badge">Contact</span>
        <h2>
          Get in <span className="gdg-gradient-text">Touch</span>
        </h2>
        <p className="gdg-subtitle">
          Have questions or want to collaborate? Reach out to GDG On Campus
          CTU — we would love to hear from you.
        </p>
        <div className="gdg-card" style={{ marginBottom: 24 }}>
          <h3>Send Us a Message</h3>
          <ContactForm />
        </div>
        <div className="gdg-grid">
          <div className="gdg-card">
            <h3>Join Our Community</h3>
            <p>
              All students of Cebu Technological University are welcome to
              join. Sign up through our registration form.
            </p>
            <div className="gdg-btn-row">
              <a
                href={JOIN_FORM_URL}
                target="_blank"
                rel="noreferrer"
                className="gdg-btn gdg-btn-primary"
              >
                Join Us
              </a>
            </div>
          </div>
          <div className="gdg-card">
            <h3>Follow Us</h3>
            <p>
              Stay updated on events, workshops, and announcements through our
              Facebook page.
            </p>
            <div className="gdg-btn-row">
              <a
                href={FACEBOOK_URL}
                target="_blank"
                rel="noreferrer"
                className="gdg-btn gdg-btn-secondary"
              >
                Facebook Page
              </a>
            </div>
          </div>
          <div className="gdg-card">
            <h3>Find Us</h3>
            <p>
              Cebu Technological University - Main Campus, M.J. Cuenco Avenue,
              Cebu City, Philippines.
            </p>
            <div className="gdg-btn-row">
              <a
                href="https://maps.google.com/"
                target="_blank"
                rel="noreferrer"
                className="gdg-btn gdg-btn-secondary"
              >
                View Map
              </a>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
