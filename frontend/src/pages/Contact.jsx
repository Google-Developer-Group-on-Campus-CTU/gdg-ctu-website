import { Controller } from 'react-hook-form';
import TextField from '@mui/material/TextField';
import Button from '@mui/material/Button';
import Alert from '@mui/material/Alert';
import AlertTitle from '@mui/material/AlertTitle';
import CircularProgress from '@mui/material/CircularProgress';
import { Link } from 'react-router-dom';
import { useContactForm } from '../components/contact-form.js';
import '../styles/contact.css';

const JOIN_FORM_URL =
  'https://docs.google.com/forms/d/e/1FAIpQLSe8XGfS83u5u3bbwqaUlHYmYlTNqPuYPl1aULCb8xMrN91jaQ/viewform?pli=1';

const FACEBOOK_URL = 'https://www.facebook.com/gdsc.cebutech';
const EMAIL = 'gdsc.ctu@gmail.com';

function ContactForm() {
  const { form, sending, sent, submitError, statusRef, onSubmit, showForm } = useContactForm();
  const { control } = form;

  if (sent) {
    return (
      <div className="form-sent">
        <Alert ref={statusRef} tabIndex={-1} severity="success">
          <AlertTitle>Message sent</AlertTitle>
          Thanks for reaching out — the GDG On Campus CTU team will get back to
          you soon.
        </Alert>
        <p className="form-actions">
          <Button type="button" variant="outlined" onClick={showForm}>
            Send another message
          </Button>
        </p>
      </div>
    );
  }

  return (
    <form className="contact-form" onSubmit={onSubmit} noValidate aria-label="Contact form">
      <h3>Send Us a Message</h3>
      {submitError ? (
        <Alert ref={statusRef} tabIndex={-1} severity="error">
          {submitError}
        </Alert>
      ) : null}
      <div className="field-row">
        <div className="field">
          <Controller
            name="name"
            control={control}
            render={({ field, fieldState }) => (
              <TextField
                {...field}
                id="contact-name"
                label="Name"
                placeholder="Your name"
                autoComplete="name"
                required
                fullWidth
                disabled={sending}
                error={!!fieldState.error}
                helperText={fieldState.error?.message}
                slotProps={fieldState.error ? { formHelperText: { role: 'alert' } } : undefined}
              />
            )}
          />
        </div>
        <div className="field">
          <Controller
            name="email"
            control={control}
            render={({ field, fieldState }) => (
              <TextField
                {...field}
                id="contact-email"
                label="Email"
                placeholder="you@example.com"
                type="email"
                autoComplete="email"
                required
                fullWidth
                disabled={sending}
                error={!!fieldState.error}
                helperText={fieldState.error?.message}
                slotProps={fieldState.error ? { formHelperText: { role: 'alert' } } : undefined}
              />
            )}
          />
        </div>
      </div>
      <div className="field">
        <Controller
          name="subject"
          control={control}
          render={({ field, fieldState }) => (
            <TextField
              {...field}
              id="contact-subject"
              label="Subject"
              placeholder="What is this about?"
              fullWidth
              disabled={sending}
              error={!!fieldState.error}
              helperText={fieldState.error?.message ?? 'Optional'}
              slotProps={fieldState.error ? { formHelperText: { role: 'alert' } } : undefined}
              inputProps={{ maxLength: 255 }}
            />
          )}
        />
      </div>
      <div className="field">
        <Controller
          name="message"
          control={control}
          render={({ field, fieldState }) => (
            <TextField
              {...field}
              id="contact-message"
              label="Message"
              placeholder="How can we help?"
              multiline
              minRows={5}
              fullWidth
              required
              disabled={sending}
              error={!!fieldState.error}
              helperText={fieldState.error?.message}
              slotProps={fieldState.error ? { formHelperText: { role: 'alert' } } : undefined}
              inputProps={{ maxLength: 2000 }}
            />
          )}
        />
      </div>
      <p className="form-actions">
        <Button
          type="submit"
          variant="contained"
          disabled={sending}
          aria-busy={sending}
          startIcon={sending ? <CircularProgress size={20} color="inherit" /> : undefined}
        >
          {sending ? 'Sending…' : 'Send message'}
        </Button>
      </p>
    </form>
  );
}

const infoCards = [
  {
    title: 'Join Our Community',
    text: 'All students of Cebu Technological University are welcome to join. Sign up through our registration form.',
    link: { href: JOIN_FORM_URL, external: true, label: 'Join Us' },
  },
  {
    title: 'Follow Us',
    text: 'Stay updated on events, workshops, and announcements through our Facebook page.',
    link: { href: FACEBOOK_URL, external: true, label: 'Facebook Page' },
  },
  {
    title: 'Find Us',
    text: 'Cebu Technological University - Main Campus, M.J. Cuenco Avenue, Cebu City, Philippines.',
    link: { href: 'https://maps.google.com/', external: true, label: 'View Map' },
  },
];

export default function Contact() {
  return (
    <main className="page-contact">
      {/* ---------- HERO ---------- */}
      <section className="ct-hero" aria-labelledby="contact-title">
        <img className="ct-deco ct-deco-star" src="/layout-assets/home/star-no-bg.png" alt="" aria-hidden="true" />
        <img className="ct-deco ct-deco-arrow" src="/layout-assets/home/arrow-no-bg.png" alt="" aria-hidden="true" />
        <img className="ct-deco ct-deco-globe" src="/layout-assets/home/globe-no-bg.png" alt="" aria-hidden="true" />
        <img className="ct-deco ct-deco-heart" src="/layout-assets/home/heart-no-bg.png" alt="" aria-hidden="true" />

        <div className="ct-hero-content">
          <div className="eyebrow"><span /> CONTACT</div>
          <h1 id="contact-title">
            Let&apos;s{' '}
            <span className="talk-card" aria-label="Talk">
              <span className="c-blue">T</span>
              <span className="c-red">A</span>
              <span className="c-yellow">L</span>
              <span className="c-green">K</span>
            </span>
          </h1>
          <p className="sub">
            Have questions or want to collaborate? Reach out to GDG On Campus
            CTU — we would love to hear from you.
          </p>
          <a className="green-pill" href="#contact-form">
            Send us a message <span aria-hidden="true">↓</span>
          </a>
        </div>
      </section>

      {/* ---------- FORM ---------- */}
      <section id="contact-form" className="ct-form section-frame" aria-label="Contact form">
        <div className="section-rule" />
        <img className="ct-deco ct-deco-star-form" src="/layout-assets/home/star-no-bg.png" alt="" aria-hidden="true" />
        <img className="ct-deco ct-deco-heart-form" src="/layout-assets/home/heart-no-bg.png" alt="" aria-hidden="true" />
        <div className="eyebrow"><span className="dot-blue" /> GET IN TOUCH</div>
        <h2>We&apos;d love to hear from you</h2>
        <p className="sub">Tell us what&apos;s on your mind — a question, an idea, or a collaboration.</p>

        <div className="form-card">
          <ContactForm />
        </div>

        <div className="info-grid">
          {infoCards.map((card) => (
            <article className="info-card" key={card.title}>
              <h3>{card.title}</h3>
              <p>{card.text}</p>
              <a
                className={card.title === 'Join Our Community' ? 'green-pill sm' : 'white-pill sm'}
                href={card.link.href}
                target="_blank"
                rel="noreferrer"
              >
                {card.link.label} <span aria-hidden="true">↗</span>
              </a>
            </article>
          ))}
        </div>
      </section>

      {/* ---------- CONNECT ---------- */}
      <section className="ct-connect section-frame" aria-labelledby="connect-title">
        <div className="section-rule" />
        <img className="ct-deco ct-deco-globe-connect" src="/layout-assets/home/globe-no-bg.png" alt="" aria-hidden="true" />
        <img className="ct-deco ct-deco-arrow-connect" src="/layout-assets/home/arrow-no-bg.png" alt="" aria-hidden="true" />
        <div className="eyebrow"><span className="dot-green" /> STAY IN THE LOOP</div>
        <h2 id="connect-title">More ways to reach us</h2>
        <p className="sub">Prefer email or socials? Or curious about building with us as a partner?</p>
        <div className="connect-row">
          <a className="white-pill" href={`mailto:${EMAIL}`}>
            {EMAIL}
          </a>
          <a className="white-pill" href={FACEBOOK_URL} target="_blank" rel="noreferrer">
            Facebook <span aria-hidden="true">↗</span>
          </a>
          <Link className="white-pill" to="/partners">
            Our partners <span aria-hidden="true">↗</span>
          </Link>
          <a className="green-pill" href={JOIN_FORM_URL} target="_blank" rel="noreferrer">
            Join us <span aria-hidden="true">↗</span>
          </a>
        </div>
      </section>
    </main>
  );
}
