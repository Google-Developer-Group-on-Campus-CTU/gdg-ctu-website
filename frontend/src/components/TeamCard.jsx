import { useState } from 'react';
import { getInitials } from '../theme/teamTheme.js';
import '../styles/officers.css';

export const FALLBACK_PHOTO = '/layout-assets/officers/gdg-team-2024.jpg';

// Reference officer card: 363x385, 50px radius. The photo stays unclipped and
// intact; white cutout wrappers size to the pill text and punch rounded
// notches out of the photo corners.
export default function TeamCard({
  member,
  onSelect,
  preview = false,
}) {
  const [imgFailed, setImgFailed] = useState(false);
  const photoUrl = typeof member?.photoUrl === 'string' ? member.photoUrl.trim() : '';
  const showPhoto = Boolean(photoUrl) && !imgFailed;

  const name = member?.name || 'Unnamed member';
  const role = member?.role || 'Team Member';

  const handleError = () => {
    setImgFailed(true);
  };

  const onKey = (e) => {
    if ((e.key === 'Enter' || e.key === ' ') && typeof onSelect === 'function') {
      e.preventDefault();
      onSelect(member);
    }
  };

  const cardContent = (
    <div className="card-photo-wrap">
      <div className="card-clip">
        {showPhoto ? (
          <img
            key={member?.photoUrl}
            className="card-photo"
            src={photoUrl}
            alt={member?.photoAlt || name}
            loading="lazy"
            onError={handleError}
          />
        ) : (
          <span className="card-initials" aria-hidden="true">
            {getInitials(name)}
          </span>
        )}
      </div>
      <div className="gdg-logo-mark" aria-hidden="true">
        <i className="gdg-pill red" />
        <i className="gdg-pill blue" />
        <i className="gdg-pill yellow" />
        <i className="gdg-pill green" />
      </div>
      <div className="role-cutout">
        <span className="card-role-pill">{role}</span>
      </div>
      <div className="name-cutout">
        <h2 className="card-name-pill">{name}</h2>
      </div>
    </div>
  );

  if (preview) {
    return (
      <article
        className="team-card"
        aria-live="polite"
        aria-label={`Team page preview for ${name}`}
      >
        {cardContent}
      </article>
    );
  }

  return (
    <article
      role="button"
      tabIndex={0}
      className="team-card"
      onClick={() => onSelect?.(member)}
      onKeyDown={onKey}
      aria-label={`View details for ${name}, ${role}`}
    >
      {cardContent}
    </article>
  );
}
