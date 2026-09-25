import { Controller } from 'react-hook-form';
import Stack from '@mui/material/Stack';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import TextField from '@mui/material/TextField';
import Button from '@mui/material/Button';
import Alert from '@mui/material/Alert';
import AlertTitle from '@mui/material/AlertTitle';
import CircularProgress from '@mui/material/CircularProgress';
import { useContactForm } from '../components/contact-form.js';

const JOIN_FORM_URL =
  'https://docs.google.com/forms/d/e/1FAIpQLSe8XGfS83u5u3bbwqaUlHYmYlTNqPuYPl1aULCb8xMrN91jaQ/viewform?pli=1';

const FACEBOOK_URL = 'https://www.facebook.com/gdsc.cebutech';

function ContactForm() {
  const { form, sending, sent, submitError, statusRef, onSubmit, showForm } = useContactForm();
  const { control } = form;

  if (sent) {
    return (
      <Stack spacing={2}>
        <Alert ref={statusRef} tabIndex={-1} severity="success">
          <AlertTitle>Message sent</AlertTitle>
          Thanks for reaching out — the GDG On Campus CTU team will get back to
          you soon.
        </Alert>
        <Box>
          <Button type="button" variant="outlined" onClick={showForm}>
            Send another message
          </Button>
        </Box>
      </Stack>
    );
  }

  return (
    <Stack spacing={2} component="form" onSubmit={onSubmit} noValidate aria-label="Contact form">
      <Typography variant="h6" component="h3">
        Send Us a Message
      </Typography>
      {submitError ? (
        <Alert ref={statusRef} tabIndex={-1} severity="error">
          {submitError}
        </Alert>
      ) : null}
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
      <Box>
        <Button
          type="submit"
          variant="contained"
          disabled={sending}
          aria-busy={sending}
          startIcon={sending ? <CircularProgress size={20} color="inherit" /> : undefined}
        >
          {sending ? 'Sending…' : 'Send message'}
        </Button>
      </Box>
    </Stack>
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
        <ContactForm />
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
