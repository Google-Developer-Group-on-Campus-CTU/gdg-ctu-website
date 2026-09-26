import { useCallback, useEffect, useMemo, useState } from 'react';
import { mapMember, mapTerm, publicApi, usePublicFeed } from '../api/public.js';
import { FeedError, friendlyFeedError } from '../components/FeedStates.jsx';
import '../styles/officers.css';

const FALLBACK_PHOTO = '/layout-assets/officers/gdg-team-2024.jpg';
const REGISTER_URL =
  'https://docs.google.com/forms/d/e/1FAIpQLSe8XGfS83u5u3bbwqaUlHYmYlTNqPuYPl1aULCb8xMrN91jaQ/viewform?pli=1';
const HERO_SRC = {
  star: '/layout-assets/home/star-no-bg.png',
  arrow: '/layout-assets/home/arrow-no-bg.png',
  heart: '/layout-assets/home/heart-no-bg.png',
  globe: '/layout-assets/home/globe-no-bg.png',
};
const CARD_LOGO = '/layout-assets/home/gdg-logo.png';

const DEPARTMENT_ORDER = [
  'Executive Board',
  'Operations',
  'Technology',
  'Creatives',
  'Community Development',
  'Finance',
];

const CARD_TINTS = ['tint-yellow', 'tint-blue', 'tint-pink', 'tint-green'];
const NAME_TONES = ['name-yellow', 'name-blue', 'name-red', 'name-green'];

function departmentRank(name) {
  const lower = String(name).toLowerCase();
  const idx = DEPARTMENT_ORDER.findIndex((k) => lower.includes(k.toLowerCase()));
  return idx === -1 ? 99 : idx;
}

function isExecutiveDept(name) {
  return String(name).toLowerCase().includes('executive');
}

function deptTabTone(name) {
  const lower = String(name).toLowerCase();
  if (lower.includes('operation')) return 'tab-amber';
  if (lower.includes('technolog')) return 'tab-red';
  if (lower.includes('creative')) return 'tab-blue';
  if (lower.includes('community')) return 'tab-green';
  if (lower.includes('financ')) return 'tab-blue';
  return 'tab-yellow';
}

function deptTabLabel(name) {
  const label = String(name).trim();
  return /department/i.test(label) ? label : `${label} Department`;
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

function OfficerCard({ member, tint, nameTone, onSelect }) {
  // `imgSrc` is derived during render — no effect-sync. The parent keys each
  // card by photo URL too, so a CMS photo swap remounts the card and resets
  // the error flag without a setState-in-effect cycle.
  const [imgFailed, setImgFailed] = useState(false);
  const imgSrc = imgFailed ? FALLBACK_PHOTO : (member.photoUrl || FALLBACK_PHOTO);

  const handleError = useCallback(() => {
    setImgFailed(true);
  }, []);

  const onKey = useCallback((e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onSelect(member);
    }
  }, [member, onSelect]);

  return (
    <article
      role="button"
      tabIndex={0}
      className={`team-card ${tint}`}
      onClick={() => onSelect(member)}
      onKeyDown={onKey}
      aria-label={`View details for ${member.name}, ${member.role}`}
    >
      <div className="card-photo-wrap">
        <img
          key={member.photoUrl}
          className="card-photo"
          src={imgSrc}
          alt={member.photoAlt || member.name}
          loading="lazy"
          onError={handleError}
        />
        <img className="card-logo" src={CARD_LOGO} alt="" aria-hidden="true" loading="lazy" />
        <span className="card-role-pill">{member.role || 'Team Member'}</span>
      </div>
      <span className={`card-name-pill ${nameTone}`}>{member.name}</span>
    </article>
  );
}

function OfficerModal({ member, onClose }) {
  // Fresh mount per selection (parent keys by member id) — no reset effect
  // needed when the selection changes.
  const [photoFailed, setPhotoFailed] = useState(false);
  const src = member?.photoUrl || FALLBACK_PHOTO;
  const showPhoto = src && !photoFailed;

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
                {!member.github && !member.linkedin && !member.website ? <span className="gdg-muted">—</span> : null}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function Officers() {
  const { data: termsData } = usePublicFeed(
    () => publicApi.getTerms().then((rows) => rows.map(mapTerm)),
    'team-terms',
  );
  const terms = useMemo(() => termsData ?? [], [termsData]);

  // Explicit selection wins; otherwise default to the current term (fall
  // back to the newest row — the feed is newest-first).
  const [selectedTerm, setSelectedTerm] = useState(null);
  const currentTermName = terms.find((t) => t.isCurrent)?.name ?? terms[0]?.name ?? null;
  const activeTermName = selectedTerm ?? currentTermName;

  const { data, loading, error, retry } = usePublicFeed(
    () => publicApi.getTeam(activeTermName ? { termName: activeTermName } : undefined)
      .then((rows) => rows.map(mapMember).sort((a, b) => a.order - b.order)),
    `team-${activeTermName ?? 'default'}`,
  );

  const [selected, setSelected] = useState(null);

  const grouped = useMemo(() => {
    if (!data || data.length === 0) return [];
    return groupByDepartment(data);
  }, [data]);

  const execMembers = useMemo(
    () => grouped.filter(([dept]) => isExecutiveDept(dept)).flatMap(([, members]) => members),
    [grouped],
  );
  const coreGroups = useMemo(
    () => grouped.filter(([dept]) => !isExecutiveDept(dept)),
    [grouped],
  );

  // Department tab selection is derived during render — falls back to the
  // first core department whenever the selection is missing.
  const [selectedDept, setSelectedDept] = useState(null);
  const activeDeptName = coreGroups.some(([dept]) => dept === selectedDept)
    ? selectedDept
    : (coreGroups[0]?.[0] ?? null);
  const activeDeptMembers = coreGroups.find(([dept]) => dept === activeDeptName)?.[1] ?? [];

  const isEmpty = !loading && !error && (!data || data.length === 0);
  const cardStyle = (idx) => ({
    tint: CARD_TINTS[idx % CARD_TINTS.length],
    nameTone: NAME_TONES[idx % NAME_TONES.length],
  });

  return (
    <div className="page-officers">
      <section className="team-hero" aria-label="Team hero">
        <img className="hero-picture hero-picture--star" src={HERO_SRC.star} alt="" aria-hidden="true" />
        <img className="hero-picture hero-picture--arrow" src={HERO_SRC.arrow} alt="" aria-hidden="true" />
        <img className="hero-picture hero-picture--globe" src={HERO_SRC.globe} alt="" aria-hidden="true" />
        <img className="hero-picture hero-picture--heart" src={HERO_SRC.heart} alt="" aria-hidden="true" />

        <div className="team-intro">
          <div className="team-label"><span aria-hidden="true" />MEET THE TEAM</div>
          <h1>
            The{' '}
            <span className="people-card" aria-label="People">
              <span className="c-blue">P</span>
              <span className="c-red">E</span>
              <span className="c-yellow">O</span>
              <span className="c-blue">P</span>
              <span className="c-green">L</span>
              <span className="c-red">E</span>
            </span>{' '}
            behind<br />the community
          </h1>
          <p>A team of students who plan, create, organize, and build the experiences behind GDGoC - CTU.</p>
          <a className="hero-cta" href="#team-roster">
            Explore the team <span aria-hidden="true">↓</span>
          </a>
          {terms.length > 0 ? (
            <div className="officers-term-filter">
              <label htmlFor="officers-term">S.Y.</label>
              <select
                id="officers-term"
                value={activeTermName ?? ''}
                onChange={(e) => setSelectedTerm(e.target.value || null)}
                aria-label="Filter officers by school year"
              >
                {terms.map((t) => (
                  <option key={t.id ?? t.name} value={t.name}>
                    {t.label}{t.isCurrent ? ' (Current)' : ''}
                  </option>
                ))}
              </select>
            </div>
          ) : null}
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

      {!loading && !error && (execMembers.length > 0 || coreGroups.length > 0) ? (
        <div id="team-roster" className="roster section-frame">
          {execMembers.length > 0 ? (
            <section className="exec-section" aria-label="Executive officers">
              <div className="section-rule" />
              <h2>Executive Officers</h2>
              <div className="team-grid">
                {execMembers.map((m, idx) => {
                  const style = cardStyle(idx);
                  return (
                    <OfficerCard key={`${m.id || m.name}-${m.photoUrl}`} member={m} tint={style.tint} nameTone={style.nameTone} onSelect={setSelected} />
                  );
                })}
              </div>
            </section>
          ) : null}

          {coreGroups.length > 0 ? (
            <section className="core-section" aria-label="Core team officers">
              <div className="section-rule" />
              <h2>Core Team Officers</h2>
              <div className="dept-tabs" role="tablist" aria-label="Filter by department">
                {coreGroups.map(([dept]) => (
                  <button
                    key={dept}
                    type="button"
                    role="tab"
                    aria-selected={dept === activeDeptName}
                    className={`dept-tab ${deptTabTone(dept)}${dept === activeDeptName ? ' active' : ''}`}
                    onClick={() => setSelectedDept(dept)}
                  >
                    {deptTabLabel(dept)}
                  </button>
                ))}
              </div>
              <div className="core-panel">
                <div className="team-grid">
                  {activeDeptMembers.map((m, idx) => {
                    const style = cardStyle(idx);
                    return (
                      <OfficerCard key={`${m.id || m.name}-${m.photoUrl}`} member={m} tint={style.tint} nameTone={style.nameTone} onSelect={setSelected} />
                    );
                  })}
                </div>
              </div>
            </section>
          ) : null}
        </div>
      ) : null}

      {selected ? <OfficerModal key={selected.id || selected.name} member={selected} onClose={() => setSelected(null)} /> : null}

      <section className="more-role section-frame" aria-label="More than a role">
        <div className="section-rule" />
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
            <a
              className="community-btn"
              href={REGISTER_URL}
              target="_blank"
              rel="noreferrer"
            >
              Register now <span aria-hidden="true">↗</span>
            </a>
          </div>
        </div>
      </section>
    </div>
  );
}
