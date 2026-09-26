import { useEffect, useMemo, useState } from 'react';
import { mapMember, mapTerm, publicApi, usePublicFeed } from '../api/public.js';
import { apiFetch } from '../api/client.js';
import { FeedError, friendlyFeedError } from '../components/FeedStates.jsx';
import TeamCard from '../components/TeamCard.jsx';
import {
  CORE_DEPARTMENTS,
  DEPT_COLORS,
  deptTabLabel,
  getInitials,
  isExecutiveMember,
  normalizeDepartment,
} from '../theme/teamTheme.js';
import '../styles/officers.css';

const REGISTER_URL =
  'https://docs.google.com/forms/d/e/1FAIpQLSe8XGfS83u5u3bbwqaUlHYmYlTNqPuYPl1aULCb8xMrN91jaQ/viewform?pli=1';
const HERO_SRC = {
  star: '/layout-assets/home/star-no-bg.png',
  arrow: '/layout-assets/home/arrow-no-bg.png',
  heart: '/layout-assets/home/heart-no-bg.png',
  globe: '/layout-assets/home/globe-no-bg.png',
};

const FALLBACK_COPY = {
  heroEyebrow: 'MEET THE TEAM',
  heroLead: 'The',
  heroHighlight: 'PEOPLE',
  heroTail: 'behind\nthe community',
  heroSub: 'A team of students who plan, create, organize, and build the experiences behind GDGoC - CTU.',
  heroCta: 'Explore the team',
  valuesEyebrow: 'MORE THAN A ROLE',
  valuesItems: ['Plan', 'Connect', 'Create', 'Deliver'],
  valuesNote: 'Different roles.\nOne community.',
  joinTitle: 'Join Us',
  joinSub: "There's always room for another builder",
  joinCta: 'Register now',
};

function isVisibleFlag(map, prefix) {
  const keys = [`${prefix}.visible`, `${prefix}.is_visible`, `${prefix}.show`, `${prefix}.enabled`];
  for (const key of keys) {
    if (!(key in map)) continue;
    const raw = map[key];
    if (raw === false || raw === 0) return false;
    const text = String(raw ?? '').trim().toLowerCase();
    if (['false', '0', 'no', 'off', 'hidden', 'hide'].includes(text)) return false;
  }
  return true;
}

function pickCopy(map, key, fallback) {
  const raw = map[key];
  if (raw === undefined || raw === null) return fallback;
  const text = String(raw).trim();
  return text || fallback;
}

/**
 * Team page copy from site-content (keys like `team.hero.*`,
 * `team.values.*`, `team.join.*` with a visible flag). The public
 * site-content endpoint may not exist yet — any failure resolves to
 * an empty map so the page falls back to the hardcoded copy below
 * with no error UI. No backend changes.
 */
function useTeamCopy() {
  const [copy, setCopy] = useState({});
  useEffect(() => {
    let alive = true;
    (async () => {
      const attempts = [
        '/public/site-content?section=team',
        '/public/site-content?sectionKey=team',
        '/public/content?section=team',
      ];
      for (const path of attempts) {
        try {
          const payload = await apiFetch(path);
          const rows = Array.isArray(payload)
            ? payload
            : payload?.items ?? payload?.data ?? payload?.entries ?? payload?.content ?? [];
          const list = Array.isArray(rows) ? rows : [];
          if (list.length === 0 && payload && typeof payload === 'object' && !Array.isArray(payload)) {
            // Object map shape: { "team.hero.subtitle": { value, visible } }
            const map = {};
            for (const [key, entry] of Object.entries(payload)) {
              if (!key.startsWith('team.')) continue;
              if (entry && typeof entry === 'object') {
                const visible = entry.visible ?? entry.is_visible ?? entry.isVisible ?? entry.is_active ?? true;
                if (visible === false || String(visible).toLowerCase() === 'false') continue;
                map[key] = entry.value ?? entry.content ?? entry.text ?? entry.title ?? '';
              } else if (typeof entry === 'string') {
                map[key] = entry;
              }
            }
            if (Object.keys(map).length > 0 && alive) setCopy(map);
            return;
          }
          const map = {};
          for (const entry of list) {
            if (!entry || typeof entry !== 'object') continue;
            const key = entry.key ?? entry.section_key ?? entry.name ?? entry.slug ?? '';
            if (!String(key).startsWith('team.')) continue;
            const visible = entry.visible ?? entry.is_visible ?? entry.isVisible ?? entry.is_active ?? entry.isActive ?? true;
            const status = String(entry.status ?? 'published').toLowerCase();
            if (visible === false || String(visible).toLowerCase() === 'false') continue;
            if (['archived', 'draft', 'hidden'].includes(status) && entry.visible === undefined) continue;
            const value = entry.value ?? entry.content ?? entry.text ?? entry.title ?? entry.body ?? '';
            map[String(key)] = value;
          }
          if (alive) setCopy(map);
          return;
        } catch {
          // Try the next path; a missing route just means CMS copy
          // is not published yet — the hardcoded fallback stands in.
        }
      }
      if (alive) setCopy({});
    })();
    return () => {
      alive = false;
    };
  }, []);
  return copy;
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

function OfficerModal({ member, onClose }) {
  // Fresh mount per selection (parent keys by member id) — no reset effect
  // needed when the selection changes.
  const [photoFailed, setPhotoFailed] = useState(false);
  const photoUrl = typeof member?.photoUrl === 'string' ? member.photoUrl.trim() : '';
  const showPhoto = Boolean(photoUrl) && !photoFailed;

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
            <img src={photoUrl} alt={member.photoAlt || member.name} onError={() => setPhotoFailed(true)} />
          ) : (
            <span className="photo-initials" aria-hidden="true">{getInitials(member.name)}</span>
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
  const copyMap = useTeamCopy();

  const heroEyebrow = pickCopy(copyMap, 'team.hero.eyebrow', FALLBACK_COPY.heroEyebrow);
  const heroHighlight = pickCopy(copyMap, 'team.hero.highlight', FALLBACK_COPY.heroHighlight);
  const heroLead = pickCopy(copyMap, 'team.hero.title_prefix', FALLBACK_COPY.heroLead);
  const heroTail = pickCopy(copyMap, 'team.hero.title_suffix', FALLBACK_COPY.heroTail);
  const heroSub = pickCopy(copyMap, 'team.hero.subtitle', FALLBACK_COPY.heroSub);
  const heroCta = pickCopy(copyMap, 'team.hero.cta_label', FALLBACK_COPY.heroCta);
  const showHero = isVisibleFlag(copyMap, 'team.hero');

  const valuesEyebrow = pickCopy(copyMap, 'team.values.eyebrow', FALLBACK_COPY.valuesEyebrow);
  const valuesNote = pickCopy(copyMap, 'team.values.note', FALLBACK_COPY.valuesNote);
  const valuesItemsRaw = pickCopy(copyMap, 'team.values.items', FALLBACK_COPY.valuesItems.join(', '));
  const valuesItems = String(valuesItemsRaw).split(',').map((s) => s.trim()).filter(Boolean).slice(0, 6);
  const showValues = isVisibleFlag(copyMap, 'team.values');

  const joinTitle = pickCopy(copyMap, 'team.join.title', FALLBACK_COPY.joinTitle);
  const joinSub = pickCopy(copyMap, 'team.join.subtitle', FALLBACK_COPY.joinSub);
  const joinCta = pickCopy(copyMap, 'team.join.cta_label', FALLBACK_COPY.joinCta);
  const joinUrl = pickCopy(copyMap, 'team.join.url', REGISTER_URL);
  const showJoin = isVisibleFlag(copyMap, 'team.join');

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

  // Executive rule: department is Executive OR the member is featured.
  const execMembers = useMemo(() => (data ?? []).filter(isExecutiveMember), [data]);

  const coreBuckets = useMemo(() => {
    const buckets = new Map(CORE_DEPARTMENTS.map((dept) => [dept, []]));
    const overflow = new Map();
    for (const m of (data ?? [])) {
      if (isExecutiveMember(m)) continue;
      const canonical = normalizeDepartment(m.department);
      if (buckets.has(canonical)) buckets.get(canonical).push(m);
      else {
        const key = (m.department && String(m.department).trim()) || 'Team';
        if (!overflow.has(key)) overflow.set(key, []);
        overflow.get(key).push(m);
      }
    }
    return { buckets, overflow: [...overflow.entries()] };
  }, [data]);

  const coreTabs = useMemo(() => {
    const base = CORE_DEPARTMENTS.map((dept) => [dept, coreBuckets.buckets.get(dept) ?? []]);
    // Unknown departments only surface as extra tabs so no one goes missing;
    // the standard case stays exactly the 5 core tabs.
    return [...base, ...coreBuckets.overflow];
  }, [coreBuckets]);

  const hasCoreMembers = coreTabs.some(([, members]) => members.length > 0);

  // Department tab selection is derived during render — falls back to the
  // first core department with members (else the first tab) whenever the
  // selection is missing.
  const [selectedDept, setSelectedDept] = useState(null);
  const defaultDept = coreTabs.find(([, members]) => members.length > 0)?.[0] ?? coreTabs[0]?.[0] ?? null;
  const activeDeptName = coreTabs.some(([dept]) => dept === selectedDept) ? selectedDept : defaultDept;
  const activeDeptMembers = coreTabs.find(([dept]) => dept === activeDeptName)?.[1] ?? [];

  const isEmpty = !loading && !error && (!data || data.length === 0);

  return (
    <div className="page-officers">
      {showHero ? (
        <section className="team-hero" aria-label="Team hero">
          <img className="hero-picture hero-picture--star" src={HERO_SRC.star} alt="" aria-hidden="true" />
          <img className="hero-picture hero-picture--arrow" src={HERO_SRC.arrow} alt="" aria-hidden="true" />
          <img className="hero-picture hero-picture--globe" src={HERO_SRC.globe} alt="" aria-hidden="true" />
          <img className="hero-picture hero-picture--heart" src={HERO_SRC.heart} alt="" aria-hidden="true" />

          <div className="team-intro">
            <div className="team-label"><span aria-hidden="true" />{heroEyebrow}</div>
            <h1>
              {heroLead}{' '}
              <span className="people-card" aria-label={heroHighlight}>
                {heroHighlight.split('').map((ch, i) => (
                  <span key={i} className={['c-blue', 'c-red', 'c-yellow', 'c-blue', 'c-green', 'c-red'][i % 6]}>{ch}</span>
                ))}
              </span>{' '}
              {heroTail.includes('\n') ? (
                <>
                  {heroTail.split('\n')[0]}
                  <br />
                  {heroTail.split('\n').slice(1).join(' ')}
                </>
              ) : (
                heroTail
              )}
            </h1>
            <p>{heroSub}</p>
            <a className="hero-cta" href="#team-roster">
              {heroCta} <span aria-hidden="true">↓</span>
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
      ) : null}

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

      {!loading && !error && (execMembers.length > 0 || hasCoreMembers) ? (
        <div id="team-roster" className="roster section-frame">
          {execMembers.length > 0 ? (
            <section className="exec-section" aria-label="Executive officers">
              <div className="section-rule" />
              <h2>Executive Officers</h2>
              <div className="team-grid">
                {execMembers.map((m) => (
                  <TeamCard key={m.id || m.name} member={m} onSelect={setSelected} />
                ))}
              </div>
            </section>
          ) : null}

          {coreTabs.length > 0 && hasCoreMembers ? (
            <section className="core-section" aria-label="Core team officers">
              <div className="section-rule" />
              <h2>Core Team Officers</h2>
              <div className="dept-tabs" role="tablist" aria-label="Filter by department">
                {coreTabs.map(([dept, members]) => {
                  const color = DEPT_COLORS[normalizeDepartment(dept)] ?? '#FBBC05';
                  const active = dept === activeDeptName;
                  return (
                    <button
                      key={dept}
                      type="button"
                      role="tab"
                      aria-selected={active}
                      className={`dept-tab${active ? ' active' : ''}`}
                      style={{
                        background: active ? color : '#fff',
                        borderColor: '#0b0b0b',
                        color: '#0b0b0b',
                      }}
                      onClick={() => setSelectedDept(dept)}
                    >
                      {deptTabLabel(dept)}{members.length > 0 ? ` (${members.length})` : ''}
                    </button>
                  );
                })}
              </div>
              <div className="core-panel">
                <div className="team-grid">
                  {activeDeptMembers.map((m) => (
                    <TeamCard key={m.id || m.name} member={m} onSelect={setSelected} />
                  ))}
                </div>
              </div>
            </section>
          ) : null}
        </div>
      ) : null}

      {selected ? <OfficerModal key={selected.id || selected.name} member={selected} onClose={() => setSelected(null)} /> : null}

      {showValues || showJoin ? (
        <section className="more-role section-frame" aria-label="More than a role">
          <div className="section-rule" />
          {showValues ? (
            <div className="role-content">
              <div className="role-badge"><span aria-hidden="true" />{valuesEyebrow}</div>
              <div className="roles">
                {(valuesItems.length > 0 ? valuesItems : FALLBACK_COPY.valuesItems).map((label, i) => (
                  <div key={`${label}-${i}`} className="role-item">
                    <span
                      className="role-dot"
                      aria-hidden="true"
                      style={{ background: ['#FBBC05', '#EA4335', '#4285F4', '#34A853'][i % 4] }}
                    />
                    <span>{label}</span>
                  </div>
                ))}
              </div>
              <p className="role-description">{valuesNote.split('\n').map((line, i) => (
                <span key={i}>{line}{i < valuesNote.split('\n').length - 1 ? <br /> : null}</span>
              ))}
              </p>
            </div>
          ) : null}
          {showJoin ? (
            <div className="join-card">
              <div className="join-dots" aria-hidden="true">
                <span className="dot red" /><span className="dot blue" /><span className="dot green" /><span className="dot yellow" />
              </div>
              <div className="join-content">
                <h2>{joinTitle}</h2>
                <p>{joinSub}</p>
                <a
                  className="community-btn"
                  href={joinUrl}
                  target="_blank"
                  rel="noreferrer"
                >
                  {joinCta} <span aria-hidden="true">↗</span>
                </a>
              </div>
            </div>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}
