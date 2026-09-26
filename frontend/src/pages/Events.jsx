import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { formatDate, mapEvent, publicApi, usePublicFeed } from '../api/public.js';
import { FeedError, FeedSkeleton, friendlyFeedError, hideImage } from '../components/FeedStates.jsx';
import EventCard, { eventCategory } from '../components/EventCard.jsx';
import '../styles/events.css';

const REGISTER_URL =
  'https://docs.google.com/forms/d/e/1FAIpQLSe8XGfS83u5u3bbwqaUlHYmYlTNqPuYPl1aULCb8xMrN91jaQ/viewform?pli=1';

const TRACKS = [
  {
    id: 'ai-agents',
    title: 'AI & Agents',
    desc: 'Build agentic workflows, Google ADK, and Gemini models.',
    image: '/layout-assets/events/image 107.png',
    logo: '/layout-assets/events/track 1 title.png',
    bg: '/layout-assets/events/track 1.png',
    bgBack: '/layout-assets/events/track 1 green.png',
    backTitle: 'Build with Gemini + ADK',
    backSubtitle: 'Learn to create AI-powered workflows.',
    learn: ['Google ADK Workflows', 'Gemini Multimodal API', 'Prompt Design & RAG'],
    stack: ['Python', 'Gemini', 'ADK'],
    btnClass: 'track-btn-one',
    contentClass: 'track-one-content',
    logoClass: 'track-one-logo',
    imageClass: 'image-track-one',
  },
  {
    id: 'web-cloud',
    title: 'Web & Cloud',
    desc: 'Modern frontend with React, Firebase backends & Cloud.',
    image: '/layout-assets/events/image 108.png',
    logo: '/layout-assets/events/track 2 title.png',
    bg: '/layout-assets/events/track 1.png',
    bgBack: '/layout-assets/events/track 2 blue.png',
    backTitle: 'Build Modern Web & Cloud Apps',
    backSubtitle: 'Learn to build scalable full-stack web solutions.',
    learn: ['Component-driven UI with React', 'Firebase Studio & Backend Integrations', 'Cloud Deployment & Scalable APIs'],
    stack: ['React', 'Firebase', 'Cloud'],
    btnClass: 'track-btn-two',
    contentClass: 'track-two-content',
    logoClass: 'track-two-logo',
    imageClass: 'image-track-two',
  },
  {
    id: 'ui-ux',
    title: 'UI/UX Design',
    desc: 'Master Figma, wireframing, and accessible product design.',
    image: '/layout-assets/events/image 109.png',
    logo: '/layout-assets/events/track 3 title.png',
    bg: '/layout-assets/events/track 1.png',
    bgBack: '/layout-assets/events/track 3 red.png',
    backTitle: 'Design Interfaces in Figma',
    backSubtitle: 'Learn to create user-centered digital products.',
    learn: ['Wireframing & Auto-Layout in Figma', 'Design Systems & Reusable Components', 'Responsive Layouts & Prototyping'],
    stack: ['Figma', 'FigJam', 'Material 3'],
    btnClass: 'track-btn-three',
    contentClass: 'track-three-content',
    logoClass: 'track-three-logo',
    imageClass: 'image-track-three',
  },
  {
    id: 'mobile-dev',
    title: 'Mobile Dev',
    desc: 'Cross-platform native builds using Flutter and Dart.',
    image: '/layout-assets/events/image 110.png',
    logo: '/layout-assets/events/track 4 title.png',
    bg: '/layout-assets/events/track 1.png',
    bgBack: '/layout-assets/events/track 4 yellow.png',
    backTitle: 'Build Cross-Platform with Flutter',
    backSubtitle: 'Learn to develop native iOS and Android apps.',
    learn: ['Multi-Platform UI with Flutter & Dart', 'State Management & App Navigation', 'Native Device APIs & Backend Sync'],
    stack: ['Flutter', 'Dart', 'Android'],
    btnClass: 'track-btn-four',
    contentClass: 'track-four-content',
    logoClass: 'track-four-logo',
    imageClass: 'image-track-four',
  },
];

const PAST_CATS = [
  { id: 'all', label: 'All Events', tone: 'cat-white' },
  { id: 'meetups', label: 'Meetups', tone: 'cat-yellow' },
  { id: 'workshops', label: 'Workshops', tone: 'cat-green' },
  { id: 'talks', label: 'Talks', tone: 'cat-blue' },
  { id: 'competitions', label: 'Competitions', tone: 'cat-red' },
];

/* Card rendering + tones live in the shared EventCard component. */

function EventDetail({ slug }) {
  const { data, loading, error, retry } = usePublicFeed(
    () => publicApi.getEventBySlug(slug).then((e) => (e ? mapEvent(e) : null)),
    `event-${slug}`,
  );
  return (
    <div className="page-events">
      <div className="event-detail section-frame">
        <Link to="/events" className="back-pill">
          ← All events
        </Link>
        {loading ? <FeedSkeleton count={1} label="Loading event…" /> : null}
        {!loading && (error || !data) ? (
          <FeedError message={error ? friendlyFeedError(error) : 'This event is not published.'} onRetry={retry} />
        ) : null}
        {!loading && !error && data ? (
          <article className="detail-card">
            <span className="eyebrow"><span /> Event</span>
            <h2>{data.title}</h2>
            {data.coverUrl ? (
              <img className="detail-photo" src={data.coverUrl} alt={data.coverAlt} onError={hideImage} />
            ) : null}
            {data.short ? <p className="sub">{data.short}</p> : null}
            {data.description ? <p className="detail-desc">{data.description}</p> : null}
            <div className="detail-meta">
              {data.startAt ? <span>Starts: {formatDate(data.startAt)}</span> : null}
              {data.endAt ? <span>Ends: {formatDate(data.endAt)}</span> : null}
              {data.location ? <span>{data.location}</span> : null}
              {data.timezone ? <span>{data.timezone}</span> : null}
            </div>
            {data.externalUrl ? (
              <div className="detail-actions">
                <a href={data.externalUrl} target="_blank" rel="noreferrer" className="green-pill">
                  Join
                </a>
              </div>
            ) : null}
          </article>
        ) : null}
      </div>
    </div>
  );
}

export default function Events() {
  const { slug } = useParams();
  if (slug) return <EventDetail slug={slug} />;
  return <EventsList />;
}

function EventsList() {
  const { data: upcomingData, loading: upcomingLoading, error: upcomingError, retry: upcomingRetry } = usePublicFeed(
    () => publicApi.getEvents('upcoming').then((rows) => rows.map(mapEvent)),
    'events-upcoming',
  );
  const { data: pastData, loading: pastLoading, error: pastError, retry: pastRetry } = usePublicFeed(
    () => publicApi.getEvents('past').then((rows) => rows.map(mapEvent)),
    'events-past',
  );

  const [cat, setCat] = useState('all');
  const [visible, setVisible] = useState(4);
  const [flipState, setFlipState] = useState({ zoomedId: null, flippedId: null });

  useEffect(() => {
    function onKey(e) {
      if (e.key === 'Escape') setFlipState({ zoomedId: null, flippedId: null });
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  const clearFlip = useCallback(() => setFlipState({ zoomedId: null, flippedId: null }), []);

  const upcomingEmpty = !upcomingLoading && !upcomingError && (!upcomingData || upcomingData.length === 0);

  const filteredPast = useMemo(() => {
    const rows = pastData ?? [];
    if (cat === 'all') return rows;
    return rows.filter((e) => eventCategory(e) === cat);
  }, [pastData, cat]);

  const shownPast = filteredPast.slice(0, visible);

  return (
    <div className="page-events">
      {/* ---------- HERO ---------- */}
      <section className="ev-hero" aria-labelledby="events-title">
        <img className="ev-deco ev-deco-star" src="/layout-assets/home/star-no-bg.png" alt="" aria-hidden="true" />
        <img className="ev-deco ev-deco-arrow" src="/layout-assets/home/arrow-no-bg.png" alt="" aria-hidden="true" />
        <img className="ev-deco ev-deco-globe" src="/layout-assets/home/globe-no-bg.png" alt="" aria-hidden="true" />
        <img className="ev-deco ev-deco-heart" src="/layout-assets/home/heart-no-bg.png" alt="" aria-hidden="true" />

        <div className="ev-hero-content">
          <div className="eyebrow"><span /> EVENTS</div>
          <h1 id="events-title">
            <span className="learn-card" aria-label="Learn">
              <span className="c-blue">L</span>
              <span className="c-red">E</span>
              <span className="c-yellow">A</span>
              <span className="c-blue">R</span>
              <span className="c-green">N</span>
            </span>{' '}
            and<br />build something
          </h1>
          <p className="sub">
            From hands-on workshops to community meetups, discover the
            events where CTU students learn, connect, and build together.
          </p>
          <a className="green-pill" href="#upcoming-events">
            View Upcoming Events <span aria-hidden="true">↓</span>
          </a>
        </div>
      </section>

      {/* ---------- UPCOMING ---------- */}
      <section id="upcoming-events" className="ev-upcoming section-frame" aria-labelledby="upcoming-title">
        <div className="section-rule" />
        <div className="eyebrow"><span className="dot-yellow" /> UPCOMING EVENT</div>
        <h2 id="upcoming-title">What&apos;s happening next</h2>

        {upcomingLoading ? <FeedSkeleton label="Loading upcoming events…" /> : null}
        {!upcomingLoading && upcomingError ? (
          <div className="gdg-feed-error" role="alert">
            <FeedError message={friendlyFeedError(upcomingError)} onRetry={upcomingRetry} />
          </div>
        ) : null}

        {!upcomingLoading && !upcomingError && upcomingData?.length ? (
          <div className="past-grid">
            {upcomingData.slice(0, 4).map((event) => (
              <EventCard key={event.id} event={event} />
            ))}
          </div>
        ) : null}

        {upcomingEmpty ? (
          <div className="empty-state">
            <p className="sub">
              No upcoming events right now. We&apos;re cooking up something
              exciting for the next sprint! Follow our socials or check back soon!
            </p>
            <Link to="/contact" className="green-pill">
              Follow our community <span aria-hidden="true">↗</span>
            </Link>
          </div>
        ) : null}
      </section>

      {/* ---------- CORE TRACKS ---------- */}
      <section className="ev-tracks section-frame" aria-labelledby="tracks-title">
        <div className="section-rule" />
        <img className="ev-deco ev-deco-globe-tracks" src="/layout-assets/home/globe-no-bg.png" alt="" aria-hidden="true" />
        <img className="ev-deco ev-deco-star-tracks" src="/layout-assets/home/star-no-bg.png" alt="" aria-hidden="true" />
        <div className="eyebrow"><span /> CORE TRACKS</div>
        <h2 id="tracks-title">More to learn.<br />More to build.</h2>

        <div className="track-containers">
          {TRACKS.map((track) => {
            const isZoomed = flipState.zoomedId === track.id;
            const isFlipped = flipState.flippedId === track.id;
            return (
              <div
                key={track.id}
                className={`track-one ${isZoomed ? 'zoomed' : ''} ${isFlipped ? 'flipped' : ''}`.trim()}
                onClick={() => {
                  if (!isZoomed) return;
                  setFlipState((prev) => ({ ...prev, flippedId: prev.flippedId === track.id ? null : track.id }));
                }}
              >
                <button
                  type="button"
                  className="track-close"
                  aria-label="Close"
                  onClick={(e) => {
                    e.stopPropagation();
                    clearFlip();
                  }}
                >
                  ✕
                </button>

                <div className="track-flip-inner">
                  <div className="track-front">
                    <img src={track.bg} className="track-one-bg" alt="" aria-hidden="true" />
                    <img src={track.logo} className={track.logoClass} alt={`${track.title} logo`} />
                    <div className={track.contentClass}>
                      <img src={track.image} className={track.imageClass} alt={track.title} onError={hideImage} />
                      <h3 className="track-title">{track.title}</h3>
                      <p className="track-desc">{track.desc}</p>
                      <button
                        type="button"
                        className={track.btnClass}
                        onClick={(e) => {
                          e.stopPropagation();
                          if (isZoomed) {
                            setFlipState((prev) => ({ ...prev, flippedId: track.id }));
                          } else {
                            setFlipState({ zoomedId: track.id, flippedId: null });
                          }
                        }}
                      >
                        Explore Track <span aria-hidden="true">⟳</span>
                      </button>
                    </div>
                  </div>

                  <div className="track-back">
                    <img src={track.bgBack} className="track-one-bg" alt="" aria-hidden="true" />
                    <img src={track.logo} className={track.logoClass} alt={`${track.title} logo`} />
                    <div className="track-one-content gdg-track-content-offset">
                      <h3 className="track-title">{track.backTitle}</h3>
                      <h3 className="track-sub-title">{track.backSubtitle}</h3>
                      <button
                        type="button"
                        className={`${track.btnClass} gdg-track-learn-btn gdg-track-${track.id}`}
                        disabled
                      >
                        What You&apos;ll Learn
                      </button>
                      <ul className="track-back-list">
                        {track.learn.map((item) => (
                          <li key={item}>• {item}</li>
                        ))}
                      </ul>
                      <hr />
                      <h3 className="tech-stack">Tech Stack</h3>
                      <div className="tech-tools">
                        {track.stack.map((tech) => (
                          <button key={tech} type="button" className="tech-one" disabled>
                            {tech}
                          </button>
                        ))}
                      </div>
                      <button
                        type="button"
                        className={`${track.btnClass} gdg-track-back-btn gdg-track-${track.id}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          setFlipState((prev) => ({ ...prev, flippedId: null }));
                        }}
                      >
                        Back to Track <span aria-hidden="true">⟳</span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div
          className={`track-overlay ${flipState.zoomedId ? 'active' : ''}`.trim()}
          onClick={clearFlip}
          aria-hidden={flipState.zoomedId ? 'false' : 'true'}
        />
      </section>

      {/* ---------- PAST EVENTS ---------- */}
      <section className="ev-past section-frame" aria-labelledby="past-title">
        <div className="section-rule" />
        <img className="ev-deco ev-deco-heart-past" src="/layout-assets/home/heart-no-bg.png" alt="" aria-hidden="true" />
        <img className="ev-deco ev-deco-arrow-past" src="/layout-assets/home/arrow-no-bg.png" alt="" aria-hidden="true" />
        <div className="eyebrow"><span className="dot-blue" /> PAST EVENTS</div>
        <h2 id="past-title">What we&apos;ve<br />built together</h2>

        <div className="cat-pills" role="tablist" aria-label="Filter past events">
          {PAST_CATS.map((c) => (
            <button
              key={c.id}
              type="button"
              role="tab"
              aria-selected={cat === c.id}
              className={`cat-pill ${c.tone}${cat === c.id ? ' active' : ''}`}
              onClick={() => { setCat(c.id); setVisible(4); }}
            >
              {c.label}
            </button>
          ))}
        </div>

        {pastLoading ? <FeedSkeleton label="Loading past events…" /> : null}
        {!pastLoading && pastError ? (
          <div className="gdg-feed-error" role="alert">
            <FeedError message={friendlyFeedError(pastError)} onRetry={pastRetry} />
          </div>
        ) : null}
        {!pastLoading && !pastError && filteredPast.length === 0 ? (
          <p className="sub">No past events right now — check back soon.</p>
        ) : null}

        {!pastLoading && !pastError && shownPast.length > 0 ? (
          <div className="past-grid">
            {shownPast.map((event) => (
              <EventCard key={event.id} event={event} />
            ))}
          </div>
        ) : null}

        {!pastLoading && !pastError && visible < filteredPast.length ? (
          <button type="button" className="green-pill load-more" onClick={() => setVisible((v) => v + 4)}>
            Load More <span aria-hidden="true">↓</span>
          </button>
        ) : null}
      </section>

      {/* ---------- FINAL CTA ---------- */}
      <section className="ev-final section-frame" aria-labelledby="final-title">
        <div className="section-rule" />
        <div className="final-card">
          <div className="final-dots" aria-hidden="true">
            <span className="dot-red" />
            <span className="dot-blue" />
            <span className="dot-green" />
            <span className="dot-yellow" />
          </div>
          <h2 id="final-title">Don&apos;t just watch from<br />the sidelines.</h2>
          <p className="sub">Come learn, meet people, and build something with us.</p>
          <a className="green-pill" href={REGISTER_URL} target="_blank" rel="noreferrer">
            Register now <span aria-hidden="true">↗</span>
          </a>
        </div>
      </section>
    </div>
  );
}
