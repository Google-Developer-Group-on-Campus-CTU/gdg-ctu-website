import { useState } from 'react';
import { getInitials } from '../theme/teamTheme.js';
import '../styles/orgLeads.css';

/* Organization Leads card — the Figma "frame": full-bleed photo, GDG mark,
   and a white details panel with the name, role badge and social pills.
   Deliberately a separate component from the shared TeamCard so the
   core-department grid keeps its own look. Inline SVG icons avoid pulling in
   react-icons for four glyphs (this project uses npm, not pnpm). */

function GithubIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12 .5C5.73.5.5 5.73.5 12c0 5.08 3.29 9.39 7.86 10.91.58.11.79-.25.79-.56 0-.28-.01-1.02-.02-2-3.2.7-3.88-1.54-3.88-1.54-.52-1.33-1.28-1.68-1.28-1.68-1.05-.72.08-.7.08-.7 1.16.08 1.77 1.19 1.77 1.19 1.03 1.77 2.7 1.26 3.36.96.1-.75.4-1.26.73-1.55-2.55-.29-5.23-1.28-5.23-5.69 0-1.26.45-2.29 1.19-3.09-.12-.29-.52-1.46.11-3.05 0 0 .97-.31 3.18 1.18a11.1 11.1 0 0 1 2.9-.39c.98 0 1.97.13 2.9.39 2.2-1.49 3.17-1.18 3.17-1.18.63 1.59.23 2.76.11 3.05.74.8 1.19 1.83 1.19 3.09 0 4.42-2.69 5.39-5.25 5.68.41.36.78 1.06.78 2.14 0 1.55-.01 2.8-.01 3.18 0 .31.21.68.8.56A10.52 10.52 0 0 0 23.5 12C23.5 5.73 18.27.5 12 .5z" />
    </svg>
  );
}

function LinkedinIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M20.45 20.45h-3.56v-5.57c0-1.33-.03-3.04-1.85-3.04-1.85 0-2.13 1.45-2.13 2.94v5.67H9.35V9h3.42v1.56h.05c.48-.9 1.64-1.85 3.37-1.85 3.6 0 4.27 2.37 4.27 5.46v6.28zM5.34 7.43a2.07 2.07 0 1 1 0-4.14 2.07 2.07 0 0 1 0 4.14zM7.12 20.45H3.55V9h3.57v11.45zM22.22 0H1.77C.79 0 0 .77 0 1.72v20.56C0 23.23.79 24 1.77 24h20.45c.98 0 1.78-.77 1.78-1.72V1.72C24 .77 23.2 0 22.22 0z" />
    </svg>
  );
}

function LinkIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
      <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
    </svg>
  );
}

function MailIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect width="20" height="16" x="2" y="4" rx="2" />
      <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
    </svg>
  );
}

/* `key` doubles as the member field name (github / linkedin / website / email). */
const SOCIALS = [
  { key: 'github', label: 'GitHub', Icon: GithubIcon },
  { key: 'linkedin', label: 'LinkedIn', Icon: LinkedinIcon },
  { key: 'website', label: 'Portfolio', Icon: LinkIcon },
  { key: 'email', label: 'Email', Icon: MailIcon },
];

export default function OrgLeadCard({ member, onSelect }) {
  const [photoFailed, setPhotoFailed] = useState(false);
  if (!member) return null;

  const name = member.name || 'Unnamed member';
  const role = member.role || 'Team Member';
  const photoUrl = typeof member.photoUrl === 'string' ? member.photoUrl.trim() : '';
  const showPhoto = Boolean(photoUrl) && !photoFailed;

  // Only links that were actually provided, so a missing handle never
  // renders a pill that goes nowhere.
  const links = SOCIALS.map((s) => ({ ...s, href: member[s.key] })).filter((s) => s.href);

  return (
    <article className="org-lead-card">
      <button
        type="button"
        className="org-lead-card__photo-btn"
        onClick={() => onSelect?.(member)}
        aria-label={`View details for ${name}`}
      >
        {showPhoto ? (
          <img
            className="org-lead-card__photo"
            src={photoUrl}
            alt={member.photoAlt || name}
            loading="lazy"
            onError={() => setPhotoFailed(true)}
          />
        ) : (
          <span className="org-lead-card__initials" aria-hidden="true">{getInitials(name)}</span>
        )}
      </button>

      <img
        className="org-lead-card__logo"
        src="/layout-assets/home/gdg-logo.png"
        alt=""
        aria-hidden="true"
        loading="lazy"
      />

      <div className="org-lead-card__details">
        <div className="org-lead-card__identity">
          <h3 className="org-lead-card__name" title={name}>{name}</h3>
          <span className="org-lead-card__role" title={role}>{role}</span>
        </div>

        {links.length > 0 ? (
          <nav className="org-lead-card__socials" aria-label={`${name}'s contact links`}>
            {links.map(({ key, label, href, Icon }) => (
              <a
                key={key}
                className={`org-lead-card__link org-lead-card__link--${key}`}
                href={href}
                target="_blank"
                rel="noreferrer"
                aria-label={`${label}: ${name}`}
              >
                <Icon />
                <span>{label}</span>
              </a>
            ))}
          </nav>
        ) : null}
      </div>
    </article>
  );
}
