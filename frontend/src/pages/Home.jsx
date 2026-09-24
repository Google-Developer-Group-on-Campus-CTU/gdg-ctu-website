import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  formatDate,
  mapContent,
  mapEvent,
  mapMember,
  mapPhoto,
  publicApi,
  sortPartners,
  usePublicFeed,
} from '../api/public.js';
import { FeedSkeleton, friendlyFeedError, hideImage } from '../components/FeedStates.jsx';
import '../styles/home.css';

const pillars = [
  {
    title: 'Our Mission',
    text: 'To empower students and the community with cutting-edge technology knowledge through collaborative learning, skill development, and meaningful connections.',
  },
  {
    title: 'Our Vision',
    text: 'A future where every CTU student has access to world-class technology education and a supportive network of tech professionals.',
  },
  {
    title: 'Our Values',
    text: 'Innovation, collaboration, and excellence in an inclusive environment where every member grows into a confident tech professional.',
  },
];

const faqs = [
  {
    question: 'What is GDG On Campus CTU?',
    answer:
      'GDG On Campus CTU is a student-led technology community at Cebu Technological University that empowers aspiring developers through workshops, hackathons, collaborative projects, and networking events powered by Google technologies.',
  },
  {
    question: 'How can I become a member?',
    answer:
      "You can become a member by signing up through our registration form. All students of Cebu Technological University are welcome to join! Just click the 'Join Us' button.",
  },
  {
    question: 'What activities does GDG CTU organize?',
    answer:
      'We organize workshops, hackathons, tech talks, bootcamps, study jams, and community meetups. All activities are designed to help students learn new technologies and build their skills.',
  },
  {
    question: 'What are the benefits of joining?',
    answer:
      'Members get access to exclusive workshops, networking opportunities with industry professionals, project collaboration, Google resources, certificates, and a supportive community of tech enthusiasts.',
  },
  {
    question: 'Do I need to know how to code?',
    answer:
      'Not at all! We welcome everyone regardless of skill level. Our activities are designed for beginners to advanced learners. We believe in learning together and helping each other grow.',
  },
];

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
        src="/layout-assets/home/star-huge.png"
        alt=""
        aria-hidden="true"
      />
      <img
        className="hero-picture hero-deco-arrow-team"
        src="/layout-assets/home/arrow-hugee.png"
        alt=""
        aria-hidden="true"
      />
      <img
        className="hero-picture hero-deco-globe-team"
        src="/layout-assets/home/globe-huge.png"
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
          <Link to="/team" className="small-yellow-btn">
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
        className="hero-picture hero-deco-globe-events"
        src="/layout-assets/home/globe-no-bg.png"
        alt=""
        aria-hidden="true"
      />
      <img
        className="hero-picture hero-deco-heart-events"
        src="/layout-assets/home/heart-huge.png"
        alt=""
        aria-hidden="true"
      />
      <img
        className="hero-picture hero-deco-star-events"
        src="/layout-assets/home/star-huge.png"
        alt=""
        aria-hidden="true"
      />
      <img
        className="hero-picture hero-deco-arrow-events"
        src="/layout-assets/home/arrow-hugee.png"
        alt=""
        aria-hidden="true"
      />

      <div className="section-heading compact">
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
          {data.map((event) => (
            <Link
              key={event.id}
              to={event.slug ? `/events/${event.slug}` : '/events'}
              className="image-card"
              aria-label={event.title}
            >
              {event.coverUrl ? (
                <img src={event.coverUrl} alt={event.coverAlt} loading="lazy" onError={hideImage} />
              ) : (
                <img src="/layout-assets/home/devfiest.jpg" alt={event.title} loading="lazy" onError={hideImage} />
              )}
              <div className="card-overlay">
                <h3>{event.title}</h3>
                {event.short ? <p>{event.short}</p> : null}
                <div className="card-meta">
                  {event.featured ? <span className="g-tag">Featured</span> : null}
                  {event.status ? <span className="g-tag green">{event.status}</span> : null}
                </div>
                <div className="card-meta">
                  {event.startAt ? <span>{formatDate(event.startAt)}</span> : null}
                  {event.location ? <span>{event.location}</span> : null}
                </div>
              </div>
            </Link>
          ))}
        </div>
      ) : null}
      <Link to="/events" className="small-blue-btn">
        Discover more events ↗
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
        src="/layout-assets/home/globe-huge.png"
        alt=""
        aria-hidden="true"
      />
      <img
        className="hero-picture hero-deco-heart-partners"
        src="/layout-assets/home/heart-huge.png"
        alt=""
        aria-hidden="true"
      />
      <img
        className="hero-picture hero-deco-star-partners"
        src="/layout-assets/home/star-huge.png"
        alt=""
        aria-hidden="true"
      />

      <div className="section-heading compact">
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
        <div className="three-cards">
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
      <Link to="/partners" className="small-green-btn">
        View all partners ↗
      </Link>
    </section>
  );
}

function MomentsStrip() {
  const { data, loading, error, retry } = usePublicFeed(
    () => publicApi.getFeaturedPhotos().then((rows) => rows.map(mapPhoto).slice(0, 8)),
    'home-moments',
  );
  const empty = !loading && !error && (!data || data.length === 0);
  const [filter, setFilter] = useState('all');
  const categories = [
    { key: 'all', label: 'All', cls: 'red active' },
    { key: 'events', label: 'Events', cls: 'blue' },
    { key: 'workshops', label: 'Workshops', cls: 'green' },
    { key: 'community', label: 'Community', cls: 'yellow' },
  ];
  const decorated = (data ?? []).map((photo, idx) => {
    const cats = ['events', 'workshops', 'community'];
    return { ...photo, _cat: cats[idx % 3] };
  });
  const visible = filter === 'all' ? decorated : decorated.filter((p) => p._cat === filter);

  return (
    <section id="gallery" className="gallery-section section-frame jh-gallery" aria-label="Captured moments">
      <div className="section-rule" />
      <img
        className="hero-picture hero-deco-heart-gallery"
        src="/layout-assets/home/heart-huge.png"
        alt=""
        aria-hidden="true"
      />
      <img
        className="hero-picture hero-deco-arrow-gallery"
        src="/layout-assets/home/arrow-hugee.png"
        alt=""
        aria-hidden="true"
      />
      <img
        className="hero-picture hero-deco-star-gallery"
        src="/layout-assets/home/star-huge.png"
        alt=""
        aria-hidden="true"
      />
      <img
        className="hero-picture hero-deco-globe-gallery"
        src="/layout-assets/home/globe-huge.png"
        alt=""
        aria-hidden="true"
      />

      <div className="gallery-frame">
        <div className="section-heading compact">
          <h2>Captured Moments</h2>
        </div>
        <div className="tags" role="tablist" aria-label="Gallery filter">
          {categories.map((cat) => (
            <button
              key={cat.key}
              type="button"
              className={`tag ${cat.cls.split(' ')[0]}${filter === cat.key ? ' active' : ''}`}
              data-filter={cat.key}
              role="tab"
              aria-selected={filter === cat.key}
              onClick={() => setFilter(cat.key)}
            >
              {cat.label}
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
            <p>No photos published yet — check back soon.</p>
          </div>
        ) : null}
        {!loading && !error && decorated.length ? (
          <div className="gallery-grid">
            {visible.map((photo) => (
              <Link key={photo.id} to="/gallery" className="moment" data-category={photo._cat} aria-label={photo.alt}>
                {photo.url ? (
                  <img src={photo.url} alt={photo.alt} loading="lazy" onError={hideImage} />
                ) : (
                  <img src="/layout-assets/home/image.png" alt={photo.alt} loading="lazy" onError={hideImage} />
                )}
              </Link>
            ))}
          </div>
        ) : null}
        <div className="gdg-center-mt">
          <Link to="/gallery" className="small-yellow-btn">
            View gallery ↗
          </Link>
        </div>
      </div>
    </section>
  );
}

export default function Home() {
  const hero = usePublicFeed(() => publicApi.getContentByKey('hero').then((c) => (c ? mapContent(c) : null)), 'home-hero');
  const cta = usePublicFeed(() => publicApi.getContentByKey('cta').then((c) => (c ? mapContent(c) : null)), 'home-cta');
  const heroContent = !hero.loading && !hero.error ? hero.data : null;
  const ctaContent = !cta.loading && !cta.error ? cta.data : null;

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
            {heroContent?.subtitle || heroContent?.body ? (
              heroContent.subtitle || heroContent.body
            ) : (
              <>
                Immerse yourself into a community driven by shared passion, where networking meets real hands-on learning with the
                brightest minds on campus.
              </>
            )}
          </p>

          <div className="stats">
            <div className="stat red">
              <b>30+</b>
              <span>Group Officers</span>
            </div>
            <div className="stat blue">
              <b>28</b>
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

          <div className="hero-actions">
            {heroContent?.buttonText && heroContent?.buttonUrl ? (
              <a href={heroContent.buttonUrl} className="small-yellow-btn">
                {heroContent.buttonText} <span className="arrow-icon">↗</span>
              </a>
            ) : (
              <Link to="/team" className="small-yellow-btn">
                Explore Us <span className="arrow-icon">↗</span>
              </Link>
            )}
            <Link to="/about" className="small-green-btn">
              About Us <span className="arrow-icon">↗</span>
            </Link>
          </div>
          {!hero.loading && hero.error ? (
            <div className="gdg-feed-error gdg-feed-offset" role="alert">
              <p>{friendlyFeedError(hero.error)}</p>
              <button type="button" className="small-blue-btn" onClick={hero.retry}>
                Retry
              </button>
            </div>
          ) : null}
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
          {heroContent?.body
            ? heroContent.body
            : 'We started as a small group of passionate students determined to bring Google technologies to Cebu Technological University — growing into a community that builds, learns, and creates impact together.'}
        </p>

        <div className="story-pills">
          {pillars.map((pillar) => (
            <div key={pillar.title} className="story-pill">
              <h3>{pillar.title}</h3>
              <p>{pillar.text}</p>
            </div>
          ))}
        </div>
        <Link to="/about" className="small-green-btn">
          Our Journey <span className="arrow-icon">↗</span>
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
          <h2>{ctaContent?.title || 'Ready to transform ideas?'}</h2>
          <p>
            {ctaContent?.subtitle || ctaContent?.body || 'Join our community today to develop your skills through workshops, events, and Google tech credentials.'}
          </p>
          {ctaContent?.buttonUrl ? (
            <a href={ctaContent.buttonUrl} className="small-green-btn">
              {ctaContent.buttonText || 'Register now'} <span className="arrow-icon">↗</span>
            </a>
          ) : (
            <a
              href="https://docs.google.com/forms/d/e/1FAIpQLSe8XGfS83u5u3bbwqaUlHYmYlTNqPuYPl1aULCb8xMrN91jaQ/viewform?pli=1"
              target="_blank"
              rel="noreferrer"
              className="small-green-btn"
            >
              Register now <span className="arrow-icon">↗</span>
            </a>
          )}
          {!cta.loading && cta.error ? (
            <div className="gdg-feed-error gdg-feed-offset-sm" role="alert">
              <p>{friendlyFeedError(cta.error)}</p>
              <button type="button" className="small-blue-btn" onClick={cta.retry}>
                Retry
              </button>
            </div>
          ) : null}
        </div>
      </section>

      <section className="jh-faq section-frame" aria-label="Frequently asked questions">
        <div className="section-rule" />
        <h2>Frequently Asked Questions</h2>
        <div className="faq-list">
          {faqs.map((faq) => (
            <details key={faq.question}>
              <summary>{faq.question}</summary>
              <p>{faq.answer}</p>
            </details>
          ))}
        </div>
      </section>
    </div>
  );
}
