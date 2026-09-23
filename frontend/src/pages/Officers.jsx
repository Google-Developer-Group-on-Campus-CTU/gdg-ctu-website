import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { mapMember, publicApi, usePublicFeed } from '../api/public.js';
import { FeedError, friendlyFeedError } from '../components/FeedStates.jsx';
import '../styles/officers.css';

const FALLBACK_PHOTO = '/layout-assets/officers/gdg-team-2024.jpg';
const HERO_SRC = {
  star: '/layout-assets/star-no-bg.png',
  arrow: '/layout-assets/arrow-no-bg.png',
  heart: '/layout-assets/heart-no-bg.png',
  globe: '/layout-assets/globe-no-bg.png',
};

const DEPARTMENT_ORDER = [
  'Executive Board',
  'Operations',
  'Technology',
  'Creatives',
  'Community Development',
  'Finance',
];

function departmentRank(name) {
  const lower = String(name).toLowerCase();
  const idx = DEPARTMENT_ORDER.findIndex((k) => lower.includes(k.toLowerCase()));
  return idx === -1 ? 99 : idx;
}

function groupByDepartment(members) {
  const groups = new Map();
  for (const m of members) {
    const key = (m.department && String(m.department).trim()) || 'Team';
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(m);
  }
  return [...groups.entries()].sort((a, b) => {
    const ra = departmentRank(a[0]);
    const rb = departmentRank(b[0]);
    if (ra !== rb) return ra - rb;
    return a[0].localeCompare(b[0]);
  });
}

function OfficersSkeleton({ count = 8 }) {
  return (
    <div className="officers-skeleton-grid" aria-hidden="true">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="officer-skeleton-card">
          <div className="skeleton-photo" />
          <div className="skeleton-body">
            <div className="skeleton-line" />
            <div className="skeleton-line short" />
            <div className="skeleton-line tiny" />
          </div>
        </div>
      ))}
    </div>
  );
}

function OfficerCard({ member, onSelect }) {
  const [imgSrc, setImgSrc] = useState(member.photoUrl || FALLBACK_PHOTO);
  const [imgError, setImgError] = useState(false);

  // eslint-disable-next-line react/set-state-in-effect -- sync fallback when CMS photo changes
  useEffect(() => {
    setImgSrc(member.photoUrl || FALLBACK_PHOTO);
    setImgError(false);
  }, [member.photoUrl]);

  const handleError = useCallback(() => {
    if (!imgError) {
      setImgError(true);
      setImgSrc(FALLBACK_PHOTO);
    }
  }, [imgError]);

  const meta = [member.program, member.yearSection].filter(Boolean).join(' · ');
  const desc = member.bio || '';

  const onKey = useCallback((e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onSelect(member);
    }
  }, [member, onSelect]);

  return (
    <div
      role="button"
      tabIndex={0}
      className="team-card"
      onClick={() => onSelect(member)}
      onKeyDown={onKey}
      aria-label={`View details for ${member.name}, ${member.role}`}
    >
      {imgSrc ? (
        <img
          className="card-photo"
          src={imgSrc}
          alt={member.photoAlt || member.name}
          loading="lazy"
          onError={handleError}
        />
      ) : (
        <div className="card-photo card-photo--fallback" aria-hidden="true">
          {member.name.charAt(0)}
        </div>
      )}
      <div className="card-info">
        <h4 className="card-name">{member.name}</h4>
        <p className="card-role">{member.role || 'Team Member'}</p>
        {meta ? <p className="card-role" style={{ opacity: 0.85, marginTop: 2, fontSize: 11 }}>{meta}</p> : null}
        {desc ? <p className="card-role" style={{ opacity: 0, height: 0, overflow: 'hidden', margin: 0 }}>{desc}</p> : null}
        {(member.linkedin || member.github || member.website) && (
          <div className="card-links">
            {member.github ? <a href={member.github} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()}>GitHub</a> : null}
            {member.linkedin ? <a href={member.linkedin} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()}>LinkedIn</a> : null}
            {member.website && !member.github && !member.linkedin ? <a href={member.website} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()}>Website</a> : null}
          </div>
        )}
      </div>
    </div>
  );
}

function OfficerModal({ member, onClose }) {
  const [photoFailed, setPhotoFailed] = useState(false);
  const src = member?.photoUrl || FALLBACK_PHOTO;
  const showPhoto = src && !photoFailed;

  // eslint-disable-next-line react/set-state-in-effect -- reset modal photo when selection changes
  useEffect(() => {
    setPhotoFailed(false);
  }, [member]);

  useEffect(() => {
    function onKey(e) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [onClose]);

  if (!member) return null;

  const meta = [member.program, member.yearSection].filter(Boolean).join(' · ');
  return (
    <div className="officer-modal" role="dialog" aria-modal="true" aria-label={`${member.name} details`}>
      <div className="officer-modal-backdrop" onClick={onClose} />
      <div className="officer-modal-card">
        <button type="button" className="officer-modal-close" aria-label="Close details" onClick={onClose}>×</button>
        <div className={`officer-modal-photo ${!showPhoto ? 'is-placeholder' : ''}`}>
          {showPhoto ? (
            <img src={src} alt={member.photoAlt || member.name} onError={() => setPhotoFailed(true)} />
          ) : (
            <span className="photo-placeholder">{member.name.charAt(0)}</span>
          )}
        </div>
        <div className="officer-modal-body">
          <h3>{member.name}</h3>
          <p className="officer-modal-role">{member.role || 'Team Member'}</p>
          <p className="officer-modal-desc">{member.bio || 'No description provided.'}</p>
          <div className="officer-modal-info">
            {member.department ? (
              <div className="info-row">
                <span className="info-label">Department</span>
                <span>{member.department}</span>
              </div>
            ) : null}
            {meta ? (
              <div className="info-row">
                <span className="info-label">Program</span>
                <span>{meta}</span>
              </div>
            ) : null}
            <div className="info-row">
              <span className="info-label">Profile</span>
              <span className="info-links">
                {member.github ? <a href={member.github} target="_blank" rel="noreferrer">GitHub</a> : null}
                {member.linkedin ? <a href={member.linkedin} target="_blank" rel="noreferrer">LinkedIn</a> : null}
                {member.website ? <a href={member.website} target="_blank" rel="noreferrer">Website</a> : null}
                {!member.github && !member.linkedin && !member.website ? <span style={{ color: '#777' }}>—</span> : null}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function Officers() {
  const { data, loading, error, retry } = usePublicFeed(
    () => publicApi.getTeam().then((rows) => rows.map(mapMember).sort((a, b) => a.order - b.order)),
    'team-all',
  );

  const [selected, setSelected] = useState(null);

  const grouped = useMemo(() => {
    if (!data || data.length === 0) return [];
    return groupByDepartment(data);
  }, [data]);

  const isEmpty = !loading && !error && (!data || data.length === 0);

  return (
    <div className="page-officers">
      <section className="team-hero" aria-label="Team hero">
        <img className="hero-picture hero-picture--star" src={HERO_SRC.star} alt="" aria-hidden="true" />
        <img className="hero-picture hero-picture--arrow" src={HERO_SRC.arrow} alt="" aria-hidden="true" />
        <img className="hero-picture hero-picture--globe" src={HERO_SRC.globe} alt="" aria-hidden="true" />
        <img className="hero-picture hero-picture--heart" src={HERO_SRC.heart} alt="" aria-hidden="true" />

        <div className="team-intro">
          <div className="team-label"><span aria-hidden="true" />MEET THE TEAM</div>
          <h1>The people behind<br />the community</h1>
          <p>A team of students who plan, create, organize, and build the experiences behind GDGoC - CTU.</p>
        </div>
      </section>

      {loading ? (
        <div className="officers-state" aria-label="Loading team">
          <OfficersSkeleton count={8} />
          <span className="gdg-visually-hidden">Loading team…</span>
        </div>
      ) : null}

      {!loading && error ? (
        <div className="officers-error" role="alert">
          <FeedError message={friendlyFeedError(error)} onRetry={retry} />
        </div>
      ) : null}

      {isEmpty ? (
        <div className="officers-empty" role="status">
          <strong>No active team members published yet — check back soon.</strong>
          <span>Our officers roster is being updated. Follow our socials for the latest cohort announcements.</span>
        </div>
      ) : null}

      {!loading && !error && grouped.length > 0 ? (
        <div className="departments">
          {grouped.map(([dept, members]) => (
            <section key={dept} className="department" aria-label={dept}>
              <div className="department-head">
                <h2>{dept}</h2>
                <span className="department-count">{members.length} {members.length === 1 ? 'member' : 'members'}</span>
              </div>
              <div className="team-grid">
                {members.map((m) => (
                  <OfficerCard key={m.id || m.name} member={m} onSelect={setSelected} />
                ))}
              </div>
            </section>
          ))}
        </div>
      ) : null}

      {selected ? <OfficerModal member={selected} onClose={() => setSelected(null)} /> : null}

      <section className="more-role" aria-label="More than a role">
        <div className="role-line" aria-hidden="true" />
        <div className="role-content">
          <div className="role-badge"><span aria-hidden="true" />MORE THAN A ROLE</div>
          <div className="roles">
            <div className="role-item"><span className="role-dot yellow" aria-hidden="true" /><span>Plan</span></div>
            <div className="role-item"><span className="role-dot red" aria-hidden="true" /><span>Connect</span></div>
            <div className="role-item"><span className="role-dot blue" aria-hidden="true" /><span>Create</span></div>
            <div className="role-item"><span className="role-dot green" aria-hidden="true" /><span>Deliver</span></div>
          </div>
          <p className="role-description">Different roles.<br />One community.</p>
        </div>
        <div className="join-card">
          <div className="join-dots" aria-hidden="true">
            <span className="dot red" /><span className="dot blue" /><span className="dot green" /><span className="dot yellow" />
          </div>
          <div className="join-content">
            <h2>Join Us</h2>
            <p>There&apos;s always room for another builder</p>
            <Link to="/contact" className="community-btn">Join the community <span aria-hidden="true">↗</span></Link>
          </div>
        </div>
      </section>
    </div>
  );
}
