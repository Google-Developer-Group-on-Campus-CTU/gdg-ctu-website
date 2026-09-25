import { useEffect, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { publicApi } from '../api/public.js';

/**
 * Shared public contact-form contract. The schema mirrors the backend
 * SubmitContactMessageSchema presence rules (name/email/message required,
 * subject ≤ 255 chars, message ≤ 2000 chars) so client errors match what
 * the API enforces. Both public forms — the Contact page and the landing
 * HomeContactStrip — validate through this schema with react-hook-form +
 * zodResolver (mode: onTouched), submit via publicApi.submitContact, and
 * share the same status/error mapping. Presentation stays in the pages.
 */

export const EMPTY_CONTACT_FORM = { name: '', email: '', subject: '', message: '' };

export const contactSchema = z.object({
  name: z.string().trim().min(1, { message: 'Name is required.' }),
  email: z
    .string()
    .trim()
    .min(1, { message: 'Valid email is required.' })
    .pipe(z.email({ message: 'Valid email is required.' })),
  subject: z
    .string()
    .trim()
    .max(255, { message: 'Subject must be at most 255 characters.' })
    .optional(),
  message: z
    .string()
    .trim()
    .min(1, { message: 'Message is required.' })
    .max(2000, { message: 'Message must be at most 2000 characters.' }),
});

export function contactErrorMessage(err) {
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

const FIELD_ORDER = ['name', 'email', 'subject', 'message'];

/**
 * Transactional contact submit state machine: idle → sending → sent|error.
 * Entered data is preserved on error so the user can retry without
 * retyping; the form resets only on success. Callers move focus to the
 * status alert via the returned statusRef.
 */
export function useContactForm() {
  const form = useForm({
    resolver: zodResolver(contactSchema),
    defaultValues: EMPTY_CONTACT_FORM,
    mode: 'onTouched',
  });
  const [status, setStatus] = useState('idle');
  const [submitError, setSubmitError] = useState(null);
  const statusRef = useRef(null);

  // Move focus to the status alert whenever a submit resolves, so success
  // and failure are both announced and keyboard users land on the outcome.
  useEffect(() => {
    if (status !== 'sent' && status !== 'error') return undefined;
    const target = statusRef.current;
    if (!target) return undefined;
    const frame = requestAnimationFrame(() => target.focus?.());
    return () => cancelAnimationFrame(frame);
  }, [status]);

  const onSubmit = form.handleSubmit(
    async (values) => {
      setStatus('sending');
      setSubmitError(null);
      try {
        await publicApi.submitContact({
          name: values.name.trim(),
          email: values.email.trim(),
          ...(values.subject?.trim() ? { subject: values.subject.trim() } : {}),
          message: values.message.trim(),
        });
        form.reset(EMPTY_CONTACT_FORM);
        setStatus('sent');
      } catch (err) {
        setStatus('error');
        setSubmitError(contactErrorMessage(err));
      }
    },
    (errors) => {
      const first = FIELD_ORDER.find((name) => errors[name]);
      if (first) form.setFocus(first);
    },
  );

  const showForm = () => {
    setStatus('idle');
    setSubmitError(null);
    requestAnimationFrame(() => form.setFocus('name'));
  };

  return {
    form,
    status,
    sending: status === 'sending',
    sent: status === 'sent',
    submitError,
    statusRef,
    onSubmit,
    showForm,
  };
}
