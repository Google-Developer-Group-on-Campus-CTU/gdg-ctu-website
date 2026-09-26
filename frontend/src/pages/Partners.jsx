import { Link } from 'react-router-dom';
import { publicApi, sortPartners, usePublicFeed } from '../api/public.js';
import { FeedError, FeedSkeleton, friendlyFeedError, hideImage } from '../components/FeedStates.jsx';
import '../styles/partners.css';

const CARD_BGS = ['bg-white', 'bg-magenta', 'bg-dark'];

export default function Partners() {
  const { data, loading, error, retry } = usePublicFeed(
    () => publicApi.getPartners().then(sortPartners),
    'partners-all',
  );

  const partners = data ?? [];
  const empty = !loading && !error && partners.length === 0;

  return (
    <main className="page-partners">
      {/* ---------- HERO ---------- */}
      <section className="pt-hero" aria-labelledby="partners-title">
        <img className="pt-deco pt-deco-star" src="/layout-assets/home/star-no-bg.png" alt="" aria-hidden="true" />
        <img className="pt-deco pt-deco-arrow" src="/layout-assets/home/arrow-no-bg.png" alt="" aria-hidden="true" />
        <img className="pt-deco pt-deco-globe" src="/layout-assets/home/globe-no-bg.png" alt="" aria-hidden="true" />
        <img className="pt-deco pt-deco-heart" src="/layout-assets/home/heart-no-bg.png" alt="" aria-hidden="true" />

        <div className="pt-hero-content">
          <div className="eyebrow"><span /> OUR PARTNERS</div>
          <h1 id="partners-title">
            Better{' '}
            <span className="together-card" aria-label="Together">
              <span className="c-blue">T</span>
              <span className="c-red">O</span>
              <span className="c-yellow">G</span>
              <span className="c-blue">E</span>
              <span className="c-green">T</span>
              <span className="c-red">H</span>
              <span className="c-blue">E</span>
              <span className="c-green">R</span>
            </span>
          </h1>
          <p className="sub">
            We work with organizations, communities, and industry partners
            who help create better opportunities for CTU students.
          </p>
          <a className="green-pill" href="#partners-roster">
            Meet our partners <span aria-hidden="true">↓</span>
          </a>
        </div>
      </section>

      {/* ---------- ROSTER ---------- */}
      <section id="partners-roster" className="pt-roster section-frame" aria-label="Our partners">
        <div className="section-rule" />
        <img className="pt-deco pt-deco-heart-roster" src="/layout-assets/home/heart-no-bg.png" alt="" aria-hidden="true" />
        <img className="pt-deco pt-deco-star-roster" src="/layout-assets/home/star-no-bg.png" alt="" aria-hidden="true" />
        <div className="eyebrow"><span className="dot-green" /> WHY WE EXIST</div>
        <h2>Connected to the<br />community</h2>
        <p className="sub">
          Our partners help us bring ideas beyond the classroom through knowledge-
          sharing, mentorship, events, resources, and opportunities.
        </p>

        {loading ? <FeedSkeleton count={3} label="Loading partners…" /> : null}
        {!loading && error ? (
          <div className="gdg-feed-error" role="alert">
            <FeedError message={friendlyFeedError(error)} onRetry={retry} />
          </div>
        ) : null}
        {empty ? (
          <p className="sub">No partners published yet — check back soon.</p>
        ) : null}

        {!loading && !error && partners.length > 0 ? (
          <div className="partner-grid">
            {partners.map((partner, idx) => {
              const body = partner.logoUrl ? (
                <img src={partner.logoUrl} alt={partner.logoAlt} loading="lazy" onError={hideImage} />
              ) : (
                <span className="partner-fallback" aria-hidden="true">{partner.name.charAt(0)}</span>
              );
              const cardClass = `partner-card ${CARD_BGS[idx % CARD_BGS.length]}`;
              return partner.website ? (
                <a
                  key={partner.id}
                  className={cardClass}
                  href={partner.website}
                  target="_blank"
                  rel="noreferrer"
                  aria-label={`${partner.name} (opens in a new tab)`}
                  title={partner.name}
                >
                  {body}
                </a>
              ) : (
                <div key={partner.id} className={cardClass} aria-label={partner.name} title={partner.name}>
                  {body}
                </div>
              );
            })}
          </div>
        ) : null}
      </section>

      {/* ---------- FINAL CTA ---------- */}
      <section className="pt-final section-frame" aria-labelledby="final-title">
        <div className="section-rule" />
        <div className="final-card">
          <div className="final-dots" aria-hidden="true">
            <span className="dot-red" />
            <span className="dot-blue" />
            <span className="dot-green" />
            <span className="dot-yellow" />
          </div>
          <h2 id="final-title">Let&apos;s build something useful</h2>
          <p className="sub">
            Interested in creating opportunities for the next generation of
            builders?
          </p>
          <Link to="/contact" className="green-pill">
            Partner with us <span aria-hidden="true">↗</span>
          </Link>
        </div>
      </section>
    </main>
  );
}
