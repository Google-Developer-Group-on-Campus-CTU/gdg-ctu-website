import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { formatDate, mapEvent, publicApi, usePublicFeed } from '../api/public.js';
import { FeedError, FeedSkeleton, friendlyFeedError, hideImage } from '../components/FeedStates.jsx';
import '../styles/events.css';

const SCOPES = ['upcoming', 'featured', 'past'];

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

function EventDetail({ slug }) {
  const { data, loading, error, retry } = usePublicFeed(
    () => publicApi.getEventBySlug(slug).then((e) => (e ? mapEvent(e) : null)),
    `event-${slug}`,
  );
  return (
    <div className="gdg-container">
      <section className="gdg-section">
        <Link to="/events" className="gdg-btn gdg-btn-secondary">
          ← All events
        </Link>
        {loading ? <FeedSkeleton count={1} label="Loading event…" /> : null}
        {!loading && (error || !data) ? (
          <FeedError message={error ? friendlyFeedError(error) : 'This event is not published.'} onRetry={retry} />
        ) : null}
        {!loading && !error && data ? (
          <>
            <span className="gdg-badge">Event</span>
            <h2>{data.title}</h2>
            {data.coverUrl ? (
              <img className="gdg-photo" src={data.coverUrl} alt={data.coverAlt} onError={hideImage} />
            ) : null}
            {data.short ? <p className="gdg-subtitle">{data.short}</p> : null}
            {data.description ? <p>{data.description}</p> : null}
            <div className="gdg-card-meta">
              {data.startAt ? <span>Starts: {formatDate(data.startAt)}</span> : null}
              {data.endAt ? <span>Ends: {formatDate(data.endAt)}</span> : null}
              {data.location ? <span>{data.location}</span> : null}
            </div>
            {data.registrationEnabled && data.registrationUrl ? (
              <div className="gdg-btn-row">
                <a href={data.registrationUrl} target="_blank" rel="noreferrer" className="gdg-btn gdg-btn-primary">
                  Register
                </a>
              </div>
            ) : null}
          </>
        ) : null}
      </section>
    </div>
  );
}

export default function Events() {
  const { slug } = useParams();
  if (slug) return <EventDetail slug={slug} />;
  return <EventsList />;
}

function EventsList() {
  const [params, setParams] = useSearchParams();
  const scope = SCOPES.includes(params.get('scope')) ? params.get('scope') : 'upcoming';
  const { data, loading, error, retry } = usePublicFeed(
    () => publicApi.getEvents(scope).then((rows) => rows.map(mapEvent)),
    `events-${scope}`,
  );

  const carouselRef = useRef(null);
  const [showLeft, setShowLeft] = useState(false);
  const [showRight, setShowRight] = useState(false);
  const [flipState, setFlipState] = useState({ zoomedId: null, flippedId: null });

  const updateFades = useCallback(() => {
    const el = carouselRef.current;
    if (!el) return;
    if (el.scrollWidth <= el.clientWidth) {
      setShowLeft(false);
      setShowRight(false);
      return;
    }
    const maxScroll = el.scrollWidth - el.clientWidth;
    const pos = el.scrollLeft;
    setShowLeft(pos > 5);
    setShowRight(pos < maxScroll - 5);
  }, []);

  useEffect(() => {
    const el = carouselRef.current;
    if (!el) return;
    updateFades();
    el.addEventListener('scroll', updateFades, { passive: true });
    window.addEventListener('resize', updateFades);
    return () => {
      el.removeEventListener('scroll', updateFades);
      window.removeEventListener('resize', updateFades);
    };
  }, [updateFades, data, loading]);

  useEffect(() => {
    updateFades();
  }, [data, updateFades]);

  useEffect(() => {
    function onKey(e) {
      if (e.key === 'Escape') setFlipState({ zoomedId: null, flippedId: null });
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  const scrollLeft = useCallback(() => {
    carouselRef.current?.scrollBy({ left: -220, behavior: 'smooth' });
  }, []);

  const scrollRight = useCallback(() => {
    carouselRef.current?.scrollBy({ left: 220, behavior: 'smooth' });
  }, []);

  const clearFlip = useCallback(() => setFlipState({ zoomedId: null, flippedId: null }), []);

  const isEmpty = !loading && !error && (!data || data.length === 0);

  return (
    <div className="page-events">
      <div className="hero">
        <img className="doodle doodle-1" src="/layout-assets/events/Group 168.png" alt="" aria-hidden="true" />
        <img className="doodle doodle-2" src="/layout-assets/events/Group 170.png" alt="" aria-hidden="true" />
        <img className="doodle doodle-3" src="/layout-assets/events/Group 169.png" alt="" aria-hidden="true" />
        <img className="doodle doodle-4" src="/layout-assets/events/Group 171.png" alt="" aria-hidden="true" />

        <button className="events-btn" type="button" disabled>
          <span className="dot" aria-hidden="true" />
          EVENTS
        </button>

        <h1>
          <img src="/layout-assets/events/learn logo.png" className="learn-img" alt="Learn" /> and
        </h1>
        <h1>build something</h1>

        <p>From hands-on workshops to community meetups, discover the</p>
        <p>events where CTU students learn, connect, and build together.</p>

        <a href="#upcoming-events" className="cta-btn">
          View Upcoming Events
          <span className="arrow-down" aria-hidden="true">
            ↓
          </span>
        </a>

        <hr id="upcoming-events" />

        <button className="upcoming-events-btn" type="button" disabled>
          <span className="up-dot" aria-hidden="true" />
          UPCOMING EVENTS
        </button>

        <h1>What&apos;s happening next</h1>
      </div>

      <div className="page-events__tabs-wrap">
        <div className="gdg-tabs" role="tablist" aria-label="Event scopes">
          {SCOPES.map((s) => (
            <button
              key={s}
              type="button"
              role="tab"
              aria-selected={scope === s}
              className={scope === s ? 'is-active' : ''}
              onClick={() => setParams({ scope: s })}
            >
              {s.charAt(0).toUpperCase() + s.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="page-events__section">
          <FeedSkeleton label={`Loading ${scope} events…`} />
        </div>
      ) : null}
      {!loading && error ? (
        <div className="gdg-feed-error" style={{ maxWidth: 720, margin: '16px auto' }}>
          <FeedError message={friendlyFeedError(error)} onRetry={retry} />
        </div>
      ) : null}

      <div className={`carousel-wrapper ${showLeft ? 'show-left' : ''} ${showRight ? 'show-right' : ''}`.trim()}>
        <button type="button" className="carousel-arrow-left" aria-label="Scroll left" onClick={scrollLeft}>
          ‹
        </button>
        <button type="button" className="carousel-arrow-right" aria-label="Scroll right" onClick={scrollRight}>
          ›
        </button>

        <div ref={carouselRef} className="carousel" id="carousel">
          {isEmpty ? (
            <div className="carousel-empty-state">
              <p>No upcoming events right now. We&apos;re cooking up something</p>
              <p>exciting for the next sprint! Follow our socials or check back soon!</p>
              <Link to="/contact" className="register" style={{ marginTop: 30, width: 300 }}>
                Follow our community <span className="arrow-diagonal" aria-hidden="true">↗</span>
              </Link>
            </div>
          ) : null}

          {!loading && !error && data?.length
            ? data.map((event) => (
                <Link
                  key={event.id}
                  to={event.slug ? `/events/${event.slug}` : '/events'}
                  className="card card--cms"
                >
                  {event.coverUrl ? (
                    <img src={event.coverUrl} alt={event.coverAlt} loading="lazy" onError={hideImage} />
                  ) : (
                    <div
                      style={{
                        height: 176,
                        background: '#ececec',
                        display: 'grid',
                        placeItems: 'center',
                        color: '#777',
                        fontWeight: 600,
                      }}
                      aria-hidden="true"
                    >
                      {event.title.charAt(0).toUpperCase()}
                    </div>
                  )}
                  <div className="card__body">
                    <h3>{event.title}</h3>
                    <p>{event.short || event.description || 'No description.'}</p>
                    <div className="card__meta">
                      {event.startAt ? <span>{formatDate(event.startAt)}</span> : null}
                      {event.location ? <span>{event.location}</span> : null}
                      {event.featured ? <span className="card__tag card__tag--featured">Featured</span> : null}
                      {event.status ? <span className="card__tag">{event.status}</span> : null}
                    </div>
                  </div>
                </Link>
              ))
            : null}
        </div>
      </div>

      <hr />

      <div className="page-events__featured">
        <button className="featured-events-btn" type="button" disabled>
          <span className="feat-dot" aria-hidden="true" />
          FEATURED EVENTS
        </button>

        <h1>More to learn.</h1>
        <h1>More to build.</h1>

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
                        Explore Track ⟳
                      </button>
                    </div>
                  </div>

                  <div className="track-back">
                    <img src={track.bgBack} className="track-one-bg" alt="" aria-hidden="true" />
                    <img src={track.logo} className={track.logoClass} alt={`${track.title} logo`} />
                    <div className="track-one-content" style={{ marginTop: 38 }}>
                      <h3 className="track-title">{track.backTitle}</h3>
                      <h3 className="track-sub-title">{track.backSubtitle}</h3>
                      <button
                        type="button"
                        className={track.btnClass}
                        style={{
                          marginTop: 15,
                          width: 200,
                          backgroundColor: track.id === 'web-cloud' ? '#4285F4' : track.id === 'ui-ux' ? '#EA4335' : track.id === 'mobile-dev' ? '#F9AB00' : undefined,
                          color: track.id === 'web-cloud' || track.id === 'ui-ux' ? '#fff' : undefined,
                        }}
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
                        className={track.btnClass}
                        style={{
                          marginTop: 16,
                          backgroundColor: track.id === 'web-cloud' ? '#4285F4' : track.id === 'ui-ux' ? '#EA4335' : track.id === 'mobile-dev' ? '#F9AB00' : undefined,
                          color: track.id === 'web-cloud' || track.id === 'ui-ux' ? '#fff' : undefined,
                        }}
                        onClick={(e) => {
                          e.stopPropagation();
                          setFlipState((prev) => ({ ...prev, flippedId: null }));
                        }}
                      >
                        Back to Track ⟳
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
      </div>

      <hr />

      <div className="page-events__past">
        <button className="past-events-btn" type="button" disabled>
          <span className="past-dot" aria-hidden="true" />
          PAST EVENTS
        </button>

        <h1>What we&apos;ve</h1>
        <h1>built together</h1>

        {isEmpty && scope === 'past' ? (
          <p className="gdg-subtitle" style={{ marginTop: 16 }}>
            No past events right now — check back soon.
          </p>
        ) : null}

        <div className="card-rows">
          {!loading && !error && data?.length
            ? data.map((event) => (
                <Link
                  key={event.id}
                  to={event.slug ? `/events/${event.slug}` : '/events'}
                  className="card-past card-past--cms"
                >
                  {event.coverUrl ? (
                    <img src={event.coverUrl} alt={event.coverAlt} loading="lazy" onError={hideImage} />
                  ) : (
                    <div
                      style={{
                        height: 160,
                        background: '#ececec',
                        display: 'grid',
                        placeItems: 'center',
                        color: '#777',
                        fontWeight: 600,
                      }}
                      aria-hidden="true"
                    >
                      {event.title.charAt(0).toUpperCase()}
                    </div>
                  )}
                  <div className="card__body">
                    <h3>{event.title}</h3>
                    <p>{event.short || event.description || 'No description.'}</p>
                    <div className="card__meta">
                      {event.startAt ? <span>{formatDate(event.startAt)}</span> : null}
                      {event.location ? <span>{event.location}</span> : null}
                      {event.status ? <span className="card__tag">{event.status}</span> : null}
                    </div>
                  </div>
                </Link>
              ))
            : null}

          {!loading && !error && isEmpty && scope !== 'past'
            ? Array.from({ length: 4 }).map((_, i) => <div key={i} className="card-past" aria-hidden="true" />)
            : null}
        </div>
      </div>

      <hr />

      <div className="box-event">
        <div className="dots" aria-hidden="true">
          <span className="dot dot-red" />
          <span className="dot dot-blue" />
          <span className="dot dot-green" />
          <span className="dot dot-yellow" />
        </div>

        <h2>Don&apos;t just watch from</h2>
        <h2>the sidelines.</h2>
        <p>Come learn, meet people, and build something with us.</p>

        <Link to="/contact" className="register">
          Register now <span className="arrow-diagonal" aria-hidden="true">↗</span>
        </Link>
      </div>
    </div>
  );
}
