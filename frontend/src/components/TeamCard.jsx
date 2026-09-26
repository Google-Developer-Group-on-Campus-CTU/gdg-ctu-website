import { useCallback, useState } from 'react';
import { getDeptColor, getInitials } from '../theme/teamTheme.js';
import '../styles/officers.css';

/* Shared team member card (Team page grids + admin preview).
   Single source of truth for dept colors lives in theme/teamTheme.js.
   No fallback-photo masking: missing or broken photos render an
   initials placeholder so empty states stay honest. */

export const FALLBACK_PHOTO = '/layout-assets/officers/gdg-team-2024.jpg';
const CARD_LOGO = '/layout-assets/home/gdg-logo.png';

/**
 * Shared team member card. Interactive by default (opens details via
 * `onSelect`); with `preview` it renders the same visuals without any
 * handlers so admin previews never navigate or steal focus.
 */
export default function TeamCard({
  member,
  tint,
  nameTone,
  onSelect,
  preview = false,
}) {
  // `imgFailed` is render-derived state only — the parent keys each card
  // by photo URL too, so a CMS photo swap remounts and resets the flag
  // without a setState-in-effect cycle.
  const [imgFailed, setImgFailed] = useState(false);
  const photoUrl = typeof member?.photoUrl === 'string' ? member.photoUrl.trim() : '';
  const showPhoto = Boolean(photoUrl) && !imgFailed;

  const handleError = useCallback(() => {
    setImgFailed(true);
  }, []);

  const onKey = useCallback((e) => {
    if ((e.key === 'Enter' || e.key === ' ') && typeof onSelect === 'function') {
      e.preventDefault();
      onSelect(member);
    }
  }, [member, onSelect]);

  const name = member?.name || 'Unnamed member';
  const role = member?.role || 'Team Member';
  const deptColor = getDeptColor(member?.department);
  const initials = getInitials(name);

  const cardStyle = { borderColor: deptColor };
  const namePillStyle = { background: deptColor };

  const photoBlock = showPhoto ? (
    <img
      key={member?.photoUrl}
      className="card-photo"
      src={photoUrl}
      alt={member?.photoAlt || name}
      loading="lazy"
      onError={handleError}
    />
  ) : (
    <span className="card-initials" aria-hidden="true">{initials}</span>
  );

  if (preview) {
    return (
      <article
        className={`team-card ${tint ?? ''} ${nameTone ?? ''}`.trim()}
        style={cardStyle}
        aria-live="polite"
        aria-label={`Team page preview for ${name}`}
      >
        <div className="card-photo-wrap">
          {photoBlock}
          <img className="card-logo" src={CARD_LOGO} alt="" aria-hidden="true" loading="lazy" />
          <span className="card-role-pill">{role}</span>
        </div>
        <span className="card-name-pill" style={namePillStyle}>{name}</span>
      </article>
    );
  }

  return (
    <article
      role="button"
      tabIndex={0}
      className="team-card"
      style={cardStyle}
      onClick={() => onSelect?.(member)}
      onKeyDown={onKey}
      aria-label={`View details for ${name}, ${role}`}
    >
      <div className="card-photo-wrap">
        {photoBlock}
        <img className="card-logo" src={CARD_LOGO} alt="" aria-hidden="true" loading="lazy" />
        <span className="card-role-pill">{role}</span>
      </div>
      <span className="card-name-pill" style={namePillStyle}>{name}</span>
    </article>
  );
}
