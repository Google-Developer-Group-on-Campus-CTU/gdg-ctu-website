import { Link } from 'react-router-dom';
import {
  formatDate, mapContent, mapEvent, mapMember, mapPhoto, publicApi, sortPartners, usePublicFeed,
} from '../api/public.js';
import { FeedError, FeedSkeleton, StripHead, friendlyFeedError, hideImage } from '../components/FeedStates.jsx';

// Intentional hardcoded shell per spec v0.4 §1: Home is "mostly hardcoded shell + CMS feeds" — pillars stay in React, CMS controls the feeds.
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

// Intentional hardcoded shell per spec v0.4 §1 (see pillars comment above) — FAQ stays in React.
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

/* Strip states per spec: skeleton → error+retry → empty message → content.
   The section shell always renders so layout stays stable while loading. */
function TeamStrip() {
  const { data, loading, error, retry } = usePublicFeed(
    () => publicApi.getTeam({ featured: 'true' }).then((rows) => rows.map(mapMember).slice(0, 10)),
    'home-team',
  );
  const empty = !loading && !error && (!data || data.length === 0);
  return (
    <section className="gdg-section" aria-label="Our team">
      <StripHead badge="Our Team" title="Meet the Team" to="/team" linkLabel="Our Team" />
      {loading ? <FeedSkeleton label="Loading team…" /> : null}
      {!loading && error ? <FeedError message={friendlyFeedError(error)} onRetry={retry} /> : null}
      {empty ? <p className="gdg-subtitle">No team members published yet — check back soon.</p> : null}
      {!loading && !error && data?.length ? (
        <div className="gdg-carousel">
          {data.map((m) => (
            <Link key={m.id} to="/team" className="gdg-card gdg-carousel-card" aria-label={`${m.name}, ${m.role}`}>
              {m.photoUrl ? (
                <img className="gdg-photo" src={m.photoUrl} alt={m.photoAlt} loading="lazy" onError={hideImage} />
              ) : (
                <div className="gdg-photo-fallback">{m.name.charAt(0)}</div>
              )}
              <p className="gdg-role">{m.role}</p>
              <h3>{m.name}</h3>
            </Link>
          ))}
        </div>
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
    <section className="gdg-section" aria-label="Recent events">
      <StripHead badge="Events" title="Recent Events" to="/events" linkLabel="All Events" />
      {loading ? <FeedSkeleton label="Loading events…" /> : null}
      {!loading && error ? <FeedError message={friendlyFeedError(error)} onRetry={retry} /> : null}
      {empty ? <p className="gdg-subtitle">No events published yet — check back soon.</p> : null}
      {!loading && !error && data?.length ? (
        <div className="gdg-grid">
          {data.map((event) => (
            <Link
              key={event.id}
              to={event.slug ? `/events/${event.slug}` : '/events'}
              className="gdg-card gdg-card-link"
            >
              {event.coverUrl ? (
                <img className="gdg-photo" src={event.coverUrl} alt={event.coverAlt} loading="lazy" onError={hideImage} />
              ) : null}
              {event.featured || event.status ? (
                <p>
                  {event.featured ? <span className="gdg-tag">Featured</span> : null}{' '}
                  {event.status ? <span className="gdg-tag gdg-tag-green">{event.status}</span> : null}
                </p>
              ) : null}
              <h3>{event.title}</h3>
              {event.short ? <p>{event.short}</p> : null}
              <div className="gdg-card-meta">
                {event.startAt ? <span>{formatDate(event.startAt)}</span> : null}
                {event.location ? <span>{event.location}</span> : null}
              </div>
            </Link>
          ))}
        </div>
      ) : null}
    </section>
  );
}

function PartnersStrip() {
  const { data, loading, error, retry } = usePublicFeed(
    () => publicApi.getPartners().then(sortPartners),
    'home-partners',
  );
  const empty = !loading && !error && (!data || data.length === 0);
  return (
    <section className="gdg-section" aria-label="Our partners">
      <StripHead badge="Partners" title="Our Partners" to="/partners" linkLabel="All Partners" />
      {loading ? <FeedSkeleton label="Loading partners…" /> : null}
      {!loading && error ? <FeedError message={friendlyFeedError(error)} onRetry={retry} /> : null}
      {empty ? <p className="gdg-subtitle">No partners published yet — check back soon.</p> : null}
      {!loading && !error && data?.length ? (
        <div className="gdg-partner-strip">
          {data.map((p) => (
            <Link key={p.id} to="/partners" className="gdg-partner-chip" title={p.name}>
              {p.logoUrl ? (
                <img src={p.logoUrl} alt={p.logoAlt} loading="lazy" onError={hideImage} />
              ) : (
                <span>{p.name}</span>
              )}
            </Link>
          ))}
        </div>
      ) : null}
    </section>
  );
}

function MomentsStrip() {
  const { data, loading, error, retry } = usePublicFeed(
    () => publicApi.getFeaturedPhotos().then((rows) => rows.map(mapPhoto).slice(0, 8)),
    'home-moments',
  );
  const empty = !loading && !error && (!data || data.length === 0);
  return (
    <section className="gdg-section" aria-label="Captured moments">
      <StripHead badge="Gallery" title="Captured Moments" to="/gallery" linkLabel="Gallery" />
      {loading ? <FeedSkeleton label="Loading photos…" /> : null}
      {!loading && error ? <FeedError message={friendlyFeedError(error)} onRetry={retry} /> : null}
      {empty ? <p className="gdg-subtitle">No photos published yet — check back soon.</p> : null}
      {!loading && !error && data?.length ? (
        <div className="gdg-carousel">
          {data.map((photo) => (
            <Link key={photo.id} to="/gallery" className="gdg-carousel-card" aria-label={photo.alt}>
              {photo.url ? (
                <img className="gdg-photo" src={photo.url} alt={photo.alt} loading="lazy" onError={hideImage} />
              ) : (
                <div className="gdg-photo-fallback">G</div>
              )}
            </Link>
          ))}
        </div>
      ) : null}
    </section>
  );
}

export default function Home() {
  const hero = usePublicFeed(
    () => publicApi.getContentByKey('hero').then((c) => (c ? mapContent(c) : null)),
    'home-hero',
  );
  const heroContent = !hero.loading && !hero.error ? hero.data : null;
  const cta = usePublicFeed(
    () => publicApi.getContentByKey('cta').then((c) => (c ? mapContent(c) : null)),
    'home-cta',
  );
  const ctaContent = !cta.loading && !cta.error ? cta.data : null;

  return (
    <div className="gdg-container">
      <section className="gdg-section gdg-hero">
        <div>
          <span className="gdg-badge">Welcome to</span>
          <h1>{heroContent?.title || (<>Google Developer Groups <span>CTU</span></>)}</h1>
          <p>
            {heroContent?.subtitle || heroContent?.body || (
              <>
                A community of passionate developers, designers, innovators, and
                learners from{' '}
                <strong>Cebu Technological University - Main Campus</strong>{' '}
                building technology for everyone.
              </>
            )}
          </p>
          <div className="gdg-btn-row">
            {heroContent?.buttonText && heroContent?.buttonUrl ? (
              <a href={heroContent.buttonUrl} className="gdg-btn gdg-btn-primary">
                {heroContent.buttonText}
              </a>
            ) : (
              <Link to="/team" className="gdg-btn gdg-btn-primary">
                Explore Us
              </Link>
            )}
            <Link to="/about" className="gdg-btn gdg-btn-secondary">
              About Us
            </Link>
          </div>
          {!hero.loading && hero.error ? (
            <FeedError message={friendlyFeedError(hero.error)} onRetry={hero.retry} />
          ) : null}
        </div>
        <div>
          {heroContent?.mediaUrl && typeof heroContent.mediaUrl === 'string' ? (
            <img src={heroContent.mediaUrl} alt={heroContent.title || 'GDG CTU'} onError={hideImage} />
          ) : (
            <img
              src="/legacy-images/logo.png"
              alt="GDG Logo"
              onError={hideImage}
            />
          )}
        </div>
      </section>

      <section className="gdg-section">
        <span className="gdg-badge">Our Purpose</span>
        <h2>
          Building Developers. Creating <span className="gdg-gradient-text">Impact</span>.
        </h2>
        <div className="gdg-grid">
          {pillars.map((pillar) => (
            <div key={pillar.title} className="gdg-card">
              <h3>{pillar.title}</h3>
              <p>{pillar.text}</p>
            </div>
          ))}
        </div>
      </section>

      <TeamStrip />
      <RecentEventsStrip />
      <PartnersStrip />
      <MomentsStrip />

      <section className="gdg-section">
        <span className="gdg-badge">Questions?</span>
        <h2>
          Frequently Asked <span className="gdg-gradient-text">Questions</span>
        </h2>
        <div className="gdg-faq">
          {faqs.map((faq) => (
            <details key={faq.question}>
              <summary>{faq.question}</summary>
              <p>{faq.answer}</p>
            </details>
          ))}
        </div>
      </section>

      <section className="gdg-section">
        <div className="gdg-cta">
          <h2>{ctaContent?.title || 'Ready to build with us?'}</h2>
          <p>{ctaContent?.subtitle || ctaContent?.body || 'Join GDG On Campus CTU and start learning with the community.'}</p>
          {ctaContent?.buttonUrl ? (
            <a href={ctaContent.buttonUrl}>
              {ctaContent.buttonText || 'Join Us'}
            </a>
          ) : (
            <a
              href="https://docs.google.com/forms/d/e/1FAIpQLSe8XGfS83u5u3bbwqaUlHYmYlTNqPuYPl1aULCb8xMrN91jaQ/viewform?pli=1"
              target="_blank"
              rel="noreferrer"
            >
              Join Us
            </a>
          )}
          {!cta.loading && cta.error ? (
            <FeedError message={friendlyFeedError(cta.error)} onRetry={cta.retry} />
          ) : null}
        </div>
      </section>
    </div>
  );
}
