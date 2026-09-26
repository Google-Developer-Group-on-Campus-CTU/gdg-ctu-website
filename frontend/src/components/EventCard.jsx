import { Link } from 'react-router-dom';
import { formatDate } from '../api/public.js';
import { hideImage } from './FeedStates.jsx';
import '../styles/events.css';

/* Single source of truth for the event card (Events page grid, Home
   Recent Events, admin preview). Frame + overlay markup with .past-*
   classes; card pills share one category tone. */

const FRAME_SRC = '/layout-assets/events/event-card-frame.svg';

/* Card pill fill by category: Meetup yellow, Workshop green, Talk blue,
   Competition red. */
export const CATEGORY_TONES = {
  meetups: 'tone-yellow',
  workshops: 'tone-green',
  talks: 'tone-blue',
  competitions: 'tone-red',
};

// Stored category (CMS taxonomy) wins when present; older rows without a
// category fall back to keyword match over title + descriptions. Anything
// unmatched lands in Meetups.
const STORED_CATEGORIES = {
  meetup: 'meetups',
  workshop: 'workshops',
  talk: 'talks',
  competition: 'competitions',
};

export function eventCategory(e) {
  const stored = STORED_CATEGORIES[String(e.category ?? '').toLowerCase()];
  if (stored) return stored;
  const text = `${e.title ?? ''} ${e.short ?? ''} ${e.description ?? ''}`.toLowerCase();
  if (/workshop|hands-on|hands on|lab\b|study jam|bootcamp|codelab/.test(text)) return 'workshops';
  if (/competition|hackathon|contest|challenge|venture|olympiad/.test(text)) return 'competitions';
  if (/talk\b|speaker|session|summit|techconnect|conference|seminar|keynote/.test(text)) return 'talks';
  return 'meetups';
}

/* Stored category first, keyword fallback for old rows, yellow default. */
export function pillTone(event = {}) {
  return CATEGORY_TONES[eventCategory(event)] ?? 'tone-yellow';
}

function CardInner({ event }) {
  const title = (event.title ?? '').trim() ? event.title.trim() : '(Untitled event)';
  const tone = pillTone(event);
  const access = event.externalUrl ? 'Free Registration' : 'Free Access';
  const locLabel = event.location ? `${event.location} | ${access}` : access;
  const dateLabel = event.startAt ? formatDate(event.startAt) : null;
  return (
    <>
      <img
        className="past-frame"
        src={FRAME_SRC}
        alt=""
        aria-hidden="true"
        draggable="false"
      />
      {event.coverUrl ? (
        <img className="past-photo" src={event.coverUrl} alt={event.coverAlt ?? title} loading="lazy" onError={hideImage} />
      ) : (
        <div className="past-photo past-photo--fallback" aria-hidden="true">
          {title.charAt(0).toUpperCase()}
        </div>
      )}
      <div className="past-head">
        <h3>{title}</h3>
      </div>
      {dateLabel ? (
        <span className={`mini-pill ${tone}`}>{dateLabel}</span>
      ) : null}
      <p className="past-desc">{event.short || event.description || 'No description.'}</p>
      <span className={`past-loc ${tone}`}>{locLabel}</span>
    </>
  );
}

/**
 * Shared event card. Renders a link to the event by default; with
 * `preview` it renders a live-region div instead (admin preview) so
 * keyboard/clicks never navigate away from unsaved edits.
 */
export default function EventCard({ event = {}, preview = false }) {
  const title = (event.title ?? '').trim() ? event.title.trim() : '(Untitled event)';
  if (preview) {
    return (
      <div className="past-card" aria-live="polite" aria-label={`Events page preview for ${title}`}>
        <CardInner event={event} />
      </div>
    );
  }
  return (
    <Link
      to={event.slug ? `/events/${event.slug}` : '/events'}
      className="past-card"
      aria-label={title}
    >
      <CardInner event={event} />
    </Link>
  );
}
