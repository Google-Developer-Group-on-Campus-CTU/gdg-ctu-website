import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  formatDate,
  mapAlbum,
  mapEvent,
  mapGalleryCategory,
  mapMember,
  publicApi,
  sortPartners,
  usePublicFeed,
} from '../api/public.js';
import { FeedSkeleton, friendlyFeedError, hideImage } from '../components/FeedStates.jsx';
import '../styles/home.css';

const REGISTER_URL =
  'https://docs.google.com/forms/d/e/1FAIpQLSe8XGfS83u5u3bbwqaUlHYmYlTNqPuYPl1aULCb8xMrN91jaQ/viewform?pli=1';

const EVENT_TAG_COLORS = ['green', 'yellow', 'blue'];

function TeamStrip() {
  const { data, loading, error, retry } = usePublicFeed(
    () => publicApi.getTeam({ featured: 'true' }).then((rows) => rows.map(mapMember).slice(0, 10)),
    'home-team',
  );
  const empty = !loading && !error && (!data || data.length === 0);
  const [current, setCurrent] = useState(0);
  const startXRef = useRef(0);

  const show = useCallback(
    (idx) => {
      if (!data || data.length === 0) return;
      let next = idx;
      if (next < 0) next = data.length - 1;
      if (next >= data.length) next = 0;
      setCurrent(next);
    },
    [data],
  );

  useEffect(() => {
    function onKey(e) {
      if (e.key === 'ArrowLeft') show(current - 1);
      if (e.key === 'ArrowRight') show(current + 1);
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [current, show]);

  const handleTouchStart = (e) => {
    startXRef.current = e.changedTouches[0].screenX;
  };
  const handleTouchEnd = (e) => {
    const endX = e.changedTouches[0].screenX;
    const diff = startXRef.current - endX;
    if (Math.abs(diff) < 50) return;
    if (diff > 0) show(current + 1);
    else show(current - 1);
  };

  return (
    <section id="team" className="jh-team section-frame" aria-label="Our team">
      <div className="section-rule" />
      <img
        className="hero-picture hero-deco-heart-team"
        src="/layout-assets/home/heart-no-bg.png"
        alt=""
        aria-hidden="true"
      />
      <img
        className="hero-picture hero-deco-star-team"
        src="/layout-assets/home/star-no-bg.png"
        alt=""
        aria-hidden="true"
      />
      <img
        className="hero-picture hero-deco-arrow-team"
        src="/layout-assets/home/arrow-no-bg.png"
        alt=""
        aria-hidden="true"
      />
      <img
        className="hero-picture hero-deco-globe-team"
        src="/layout-assets/home/globe-no-bg.png"
        alt=""
        aria-hidden="true"
      />

      <div className="section-heading">
        <h2>Our Team</h2>
        <p>
          Meet the creative minds and leaders bringing
          <br />
          our vision to life.
        </p>
      </div>

      {loading ? (
        <div className="feed-skeleton">
          <FeedSkeleton label="Loading team…" />
        </div>
      ) : null}
      {!loading && error ? (
        <div className="gdg-feed-error" role="alert">
          <p>{friendlyFeedError(error)}</p>
          <button type="button" className="small-blue-btn" onClick={retry}>
            Retry
          </button>
        </div>
      ) : null}
      {empty ? (
        <div className="feed-empty">
          <p>No team members published yet — check back soon.</p>
        </div>
      ) : null}

      {!loading && !error && data?.length ? (
        <>
          <div className="team-carousel-wrap">
            <button type="button" className="carousel-arrow carousel-prev" aria-label="Previous photo" onClick={() => show(current - 1)}>
              ‹
            </button>

            <div
              className="wide-photo team-carousel"
              onTouchStart={handleTouchStart}
              onTouchEnd={handleTouchEnd}
              role="region"
              aria-roledescription="carousel"
              aria-label="Team photos"
            >
              <div className="carousel-track">
                {data.map((m, idx) => (
                  <img
                    key={m.id}
                    src={m.photoUrl || '/layout-assets/home/image-team.png'}
                    alt={m.photoAlt}
                    loading="lazy"
                    onError={hideImage}
                    className={`carousel-slide${idx === current ? ' active' : ''}`}
                  />
                ))}
              </div>
              <div className="carousel-dots" role="tablist" aria-label="Team carousel pagination">
                {data.map((_, idx) => (
                  <button
                    key={idx}
                    type="button"
                    className={`carousel-dot${idx === current ? ' active' : ''}`}
                    aria-label={`Go to slide ${idx + 1}`}
                    aria-selected={idx === current}
                    role="tab"
                    onClick={() => show(idx)}
                  />
                ))}
              </div>
            </div>

            <button type="button" className="carousel-arrow carousel-next" aria-label="Next photo" onClick={() => show(current + 1)}>
              ›
            </button>
          </div>
          <Link to="/team" className="small-green-btn">
            Explore the team <span className="arrow-icon">↗</span>
          </Link>
        </>
      ) : null}
    </section>
  );
}

function RecentEventsStrip() {
  const { data, loading, error, retry } = usePublicFeed(
    () => publicApi.getEvents('recent').then((rows) => rows.map(mapEvent).slice(0, 3)),
    'home-recent',
  );
  const empty = !loading && !error && (!data || data.length === 0);
  return (
    <section id="events" className="cards-section section-frame jh-events" aria-label="Recent events">
      <div className="section-rule" />
      <img
        className="hero-picture hero-deco-star-events"
        src="/layout-assets/home/star-no-bg.png"
        alt=""
        aria-hidden="true"
      />
      <img
        className="hero-picture hero-deco-heart-events"
        src="/layout-assets/home/heart-no-bg.png"
        alt=""
        aria-hidden="true"
      />
      <img
        className="hero-picture hero-deco-arrow-events"
        src="/layout-assets/home/arrow-no-bg.png"
        alt=""
        aria-hidden="true"
      />

      <div className="section-heading heading-row">
        <img
          className="heading-icon"
          src="/layout-assets/home/globe-no-bg.png"
          alt=""
          aria-hidden="true"
        />
        <h2>Recent Events</h2>
      </div>

      {loading ? (
        <div className="feed-skeleton">
          <FeedSkeleton label="Loading events…" />
        </div>
      ) : null}
      {!loading && error ? (
        <div className="gdg-feed-error" role="alert">
          <p>{friendlyFeedError(error)}</p>
          <button type="button" className="small-blue-btn" onClick={retry}>
            Retry
          </button>
        </div>
      ) : null}
      {empty ? (
        <div className="feed-empty">
          <p>No events published yet — check back soon.</p>
        </div>
      ) : null}
      {!loading && !error && data?.length ? (
        <div className="three-cards">
          {data.map((event, idx) => (
            <Link
              key={event.id}
              to={event.slug ? `/events/${event.slug}` : '/events'}
              className="image-card"
              aria-label={event.title}
            >
              {event.coverUrl ? (
                <img className="card-photo" src={event.coverUrl} alt={event.coverAlt} loading="lazy" onError={hideImage} />
              ) : (
                <img className="card-photo" src="/layout-assets/home/devfiest.jpg" alt={event.title} loading="lazy" onError={hideImage} />
              )}
              <div className="card-body">
                <h3>{event.title}</h3>
                {event.short ? <p>{event.short}</p> : null}
                <span className={`g-tag ${EVENT_TAG_COLORS[idx % EVENT_TAG_COLORS.length]}`}>
                  {event.status ?? (event.startAt ? formatDate(event.startAt) : 'Event')}
                </span>
              </div>
            </Link>
          ))}
        </div>
      ) : null}
      <Link to="/events" className="small-green-btn">
        Discover more events! <span className="arrow-icon">↗</span>
      </Link>
    </section>
  );
}

function PartnersStrip() {
  const { data, loading, error, retry } = usePublicFeed(() => publicApi.getPartners().then(sortPartners), 'home-partners');
  const empty = !loading && !error && (!data || data.length === 0);
  return (
    <section id="partners" className="cards-section section-frame jh-partners" aria-label="Our partners">
      <div className="section-rule" />
      <img
        className="hero-picture hero-deco-arrow-partners"
        src="/layout-assets/home/arrow-no-bg.png"
        alt=""
        aria-hidden="true"
      />
      <img
        className="hero-picture hero-deco-globe-partners"
        src="/layout-assets/home/globe-no-bg.png"
        alt=""
        aria-hidden="true"
      />
      <img
        className="hero-picture hero-deco-heart-partners"
        src="/layout-assets/home/heart-no-bg.png"
        alt=""
        aria-hidden="true"
      />
      <img
        className="hero-picture hero-deco-star-partners"
        src="/layout-assets/home/star-no-bg.png"
        alt=""
        aria-hidden="true"
      />

      <div className="section-heading">
        <h2>Our Partners</h2>
      </div>

      {loading ? (
        <div className="feed-skeleton">
          <FeedSkeleton label="Loading partners…" />
        </div>
      ) : null}
      {!loading && error ? (
        <div className="gdg-feed-error" role="alert">
          <p>{friendlyFeedError(error)}</p>
          <button type="button" className="small-blue-btn" onClick={retry}>
            Retry
          </button>
        </div>
      ) : null}
      {empty ? (
        <div className="feed-empty">
          <p>No partners published yet — check back soon.</p>
        </div>
      ) : null}
      {!loading && !error && data?.length ? (
        <div className="three-cards partner-cards">
          {data.slice(0, 3).map((p) => (
            <Link key={p.id} to="/partners" className="logo-card" aria-label={p.name}>
              {p.logoUrl ? (
                <img src={p.logoUrl} alt={p.logoAlt} loading="lazy" onError={hideImage} />
              ) : (
                <span className="partner-name">{p.name}</span>
              )}
              {!p.logoUrl ? null : <span className="partner-name">{p.name}</span>}
            </Link>
          ))}
        </div>
      ) : null}
    </section>
  );
}

const MOMENT_CHIP_COLORS = ['red', 'blue', 'green', 'yellow'];

function MomentsStrip() {
  const { data: categoryData } = usePublicFeed(
    () => publicApi.getGalleryCategories().then((rows) => rows.map(mapGalleryCategory)),
    'home-categories',
  );
  const categories = (categoryData ?? []).slice().sort((a, b) => a.order - b.order);
  const [filter, setFilter] = useState('all');
  const activeCategory = filter === 'all' ? undefined : filter;
  const catLabel = (cat) => (cat.name === 'Worksops' ? 'Workshops' : cat.name);
  const activeLabel = filter === 'all'
    ? null
    : (categories.find((c) => c.slug === filter)?.name ?? filter);

  const { data, loading, error, retry } = usePublicFeed(
    () => publicApi
      .getAlbums(activeCategory ? { category: activeCategory } : undefined)
      .then((rows) => rows.map(mapAlbum).slice(0, 3)),
    `home-moments-${filter}`,
  );
  const empty = !loading && !error && (!data || data.length === 0);

  return (
    <section id="gallery" className="gallery-section section-frame jh-gallery" aria-label="Captured moments">
      <div className="section-rule" />
      <img
        className="hero-picture hero-deco-heart-gallery"
        src="/layout-assets/home/heart-no-bg.png"
        alt=""
        aria-hidden="true"
      />
      <img
        className="hero-picture hero-deco-arrow-gallery"
        src="/layout-assets/home/arrow-no-bg.png"
        alt=""
        aria-hidden="true"
      />
      <img
        className="hero-picture hero-deco-star-gallery"
        src="/layout-assets/home/star-no-bg.png"
        alt=""
        aria-hidden="true"
      />
      <img
        className="hero-picture hero-deco-globe-gallery"
        src="/layout-assets/home/globe-no-bg.png"
        alt=""
        aria-hidden="true"
      />

      <div className="gallery-frame">
        <div className="section-heading compact">
          <h2>Captured Moments</h2>
        </div>
        <div className="tags" role="tablist" aria-label="Gallery filter">
          <button
            type="button"
            className={`tag${filter === 'all' ? ' active' : ''}`}
            data-filter="all"
            role="tab"
            aria-selected={filter === 'all'}
            onClick={() => setFilter('all')}
          >
            All
          </button>
          {categories.map((cat, idx) => (
            <button
              key={cat.slug ?? cat.id}
              type="button"
              className={`tag ${MOMENT_CHIP_COLORS[idx % MOMENT_CHIP_COLORS.length]}${filter === cat.slug ? ' active' : ''}`}
              data-filter={cat.slug}
              role="tab"
              aria-selected={filter === cat.slug}
              onClick={() => setFilter(cat.slug)}
            >
              {catLabel(cat)}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="feed-skeleton">
            <FeedSkeleton label="Loading photos…" />
          </div>
        ) : null}
        {!loading && error ? (
          <div className="gdg-feed-error" role="alert">
            <p>{friendlyFeedError(error)}</p>
            <button type="button" className="small-blue-btn" onClick={retry}>
              Retry
            </button>
          </div>
        ) : null}
        {empty ? (
          <div className="feed-empty">
            <p>
              {activeLabel
                ? `No ${activeLabel.toLowerCase()} albums yet — try another filter or check All.`
                : 'No photos published yet — check back soon.'}
            </p>
          </div>
        ) : null}
        {!loading && !error && data?.length ? (
          <div className="gallery-grid">
            {data.map((album) => (
              <Link
                key={album.id}
                to={album.slug ? `/gallery/${album.slug}` : '/gallery'}
                className="moment"
                data-category={album.categorySlug ?? ''}
                aria-label={album.title}
              >
                {album.coverUrl ? (
                  <img src={album.coverUrl} alt={album.coverAlt} loading="lazy" onError={hideImage} />
                ) : (
                  <img src="/layout-assets/home/image.png" alt={album.coverAlt} loading="lazy" onError={hideImage} />
                )}
              </Link>
            ))}
          </div>
        ) : null}
      </div>
    </section>
  );
}

export default function Home() {
  return (
    <div className="page-home">
      <section className="jh-hero">
        <img
          className="hero-picture hero-deco-star-hero"
          src="/layout-assets/home/star-no-bg.png"
          alt=""
          aria-hidden="true"
        />
        <img
          className="hero-picture hero-deco-arrow-hero"
          src="/layout-assets/home/arrow-no-bg.png"
          alt=""
          aria-hidden="true"
        />
        <img
          className="hero-picture hero-deco-globe-hero"
          src="/layout-assets/home/globe-no-bg.png"
          alt=""
          aria-hidden="true"
        />
        <img
          className="hero-picture hero-deco-heart-hero"
          src="/layout-assets/home/heart-no-bg.png"
          alt=""
          aria-hidden="true"
        />

        <div className="hero-content">
          <h1>
            Google Developer Groups
            <br />
            <span>On Campus</span>
          </h1>
          <div className="university-box">
            <span className="c-blue">CE</span>
            <span className="c-red">B</span>
            <span className="c-yellow">U</span>
            <span>&nbsp;</span>
            <span className="c-green">T</span>
            <span className="c-blue">E</span>
            <span className="c-red">C</span>
            <span className="c-yellow">H</span>
            <span className="c-green">N</span>
            <span className="c-blue">O</span>
            <span className="c-red">L</span>
            <span className="c-yellow">O</span>
            <span className="c-green">G</span>
            <span className="c-blue">I</span>
            <span className="c-red">C</span>
            <span className="c-yellow">A</span>
            <span className="c-green">L</span>
            <span>&nbsp;</span>
            <span className="c-blue">U</span>
            <span className="c-red">N</span>
            <span className="c-yellow">I</span>
            <span className="c-green">V</span>
            <span className="c-blue">E</span>
            <span className="c-red">R</span>
            <span className="c-yellow">S</span>
            <span className="c-green">I</span>
            <span className="c-blue">T</span>
            <span className="c-red">Y</span>
          </div>

          <p className="hero-copy">
            <img
              className="hero-copy-icon"
              src="/layout-assets/home/globe-no-bg.png"
              alt=""
              aria-hidden="true"
            />
            <span>
              Immerse yourself into a community driven by shared passion, where networking meets real hands-on learning with the
              brightest minds on campus.
            </span>
          </p>

          <div className="stats">
            <div className="stat red">
              <b>30+</b>
              <span>Group Officers</span>
            </div>
            <div className="stat blue">
              <b>1424</b>
              <span>Group Members</span>
            </div>
            <div className="stat green">
              <b>20+</b>
              <span>Tech Events</span>
            </div>
            <div className="stat yellow">
              <b>100%</b>
              <span>Free &amp; Open</span>
            </div>
          </div>
        </div>
      </section>

      <section id="story" className="jh-story section-frame">
        <div className="section-rule" />
        <div className="eyebrow">
          <span />
          OUR STORY
        </div>
        <h2>
          From a student initiative to
          <br /> a premier tech community.
        </h2>
        <p>
          We started as a small group of passionate students determined to bring Google technologies to Cebu Technological University — growing into a community that builds, learns, and creates impact together.
        </p>

        <Link to="/about" className="small-green-btn">
          Our journey <span className="arrow-icon">↗</span>
        </Link>
      </section>

      <TeamStrip />
      <RecentEventsStrip />
      <PartnersStrip />
      <MomentsStrip />

      <section id="join" className="jh-cta section-frame jh-join">
        <div className="section-rule" />
        <div className="cta-card">
          <div className="window-dots" aria-hidden="true">
            <i className="red" />
            <i className="blue" />
            <i className="green" />
            <i className="yellow" />
          </div>
          <h2>Ready to transform ideas?</h2>
          <p>
            Join our member registry today. Receive direct RSVP access to workshops, events, and Google tech credentials.
          </p>
          <a
            href={REGISTER_URL}
            target="_blank"
            rel="noreferrer"
            className="small-green-btn"
          >
            Register now <span className="arrow-icon">↗</span>
          </a>
        </div>
      </section>
    </div>
  );
}
