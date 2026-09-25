import { Link } from 'react-router-dom';
import { publicApi, sortPartners, usePublicFeed } from '../api/public.js';
import { FeedSkeleton, friendlyFeedError, hideImage } from '../components/FeedStates.jsx';
import '../styles/about.css';

const purposeCards = [
  {
    title: 'Our Mission',
    text: 'To empower students and the community with cutting-edge technology knowledge through collaborative learning, skill development, and meaningful connections that drive innovation and career growth.',
    points: ['Computer Science Advocacy', 'Practical Skills Development', 'Community Upskilling', 'Networking Opportunities'],
  },
  {
    title: 'Our Vision',
    text: 'We envision a future where every student at Cebu Technological University has access to world-class technology education, practical skills, and a supportive network that transforms them into confident, competent, and connected tech professionals.',
    points: ['Accessibility for All', 'Excellence in Learning', 'Transformation & Growth', 'Connection & Network'],
  },
  {
    title: 'Our Values',
    text: 'We believe in creating an inclusive environment where innovation thrives, collaboration flourishes, and every member grows into a confident tech professional.',
    points: ['Innovation & Learning', 'Collaboration & Community', 'Excellence & Competency', 'Advocacy & Impact'],
  },
];

const strategicGoals = [
  {
    title: 'Computer Science Advocacy',
    text: 'Making CS accessible to all students through interdisciplinary workshops and beginner-friendly content.',
  },
  {
    title: 'Skill Development',
    text: 'Providing high-quality, practical learning experiences with industry-relevant projects.',
  },
  {
    title: 'Upskilling & Competency',
    text: 'Ensuring members develop marketable, up-to-date technical competencies.',
  },
  {
    title: 'Networking & Growth',
    text: 'Building a robust network connecting students with industry professionals and mentors.',
  },
];

const timeline = [
  {
    year: '2023',
    title: 'Our Beginning',
    text: "Founded in 2023, GDG On Campus CTU started as a small group of passionate students determined to bring Google's developer community to Cebu Technological University.",
  },
  {
    year: '2023',
    title: 'The Foundation',
    text: 'Chapter founded with an initial core team of organizers, beginner-friendly programming sessions, and relationships with local tech professionals.',
  },
  {
    year: '2024',
    title: 'Major Breakthrough',
    text: 'TechConnect flagship event, 200+ active members milestone, industry partnerships, and recognition from Google and the university community.',
  },
  {
    year: '2024',
    title: 'TechConnect 2024',
    text: 'Our biggest achievement to date — 200+ participants, industry speakers, hands-on workshops, and student project showcases.',
  },
  {
    year: 'Today',
    title: 'Where We Are Now',
    text: 'Regular workshops and learning sessions, industry connections, CS promotion across disciplines, and a supportive community of tech enthusiasts.',
  },
];

const legacyPartners = [
  { name: 'UX Mini Cebu', role: 'Organization Partner', image: '/legacy-images/partnership/p1.jpg' },
  { name: 'Google', role: 'Technology Partner', image: null },
  { name: 'Microsoft', role: 'Technology Partner', image: null },
  { name: 'AWS', role: 'Cloud Partner', image: null },
  { name: 'GitHub', role: 'Developer Partner', image: null },
];

export default function About() {
  // Site-content API is retired — hero/community copy is hardcoded below and
  // only the partners strip still reads live CMS data.
  const partners = usePublicFeed(() => publicApi.getPartners().then(sortPartners), 'about-partners');

  const cmsPartners = !partners.loading && !partners.error ? partners.data : null;

  return (
    <div className="page-about">
      <section className="ab-hero">
        <img
          className="hero-picture ab-deco ab-deco-star"
          src="/layout-assets/home/star-no-bg.png"
          alt=""
          aria-hidden="true"
        />
        <img
          className="hero-picture ab-deco ab-deco-arrow"
          src="/layout-assets/home/arrow-no-bg.png"
          alt=""
          aria-hidden="true"
        />
        <img
          className="hero-picture ab-deco ab-deco-globe"
          src="/layout-assets/home/globe-no-bg.png"
          alt=""
          aria-hidden="true"
        />
        <img
          className="hero-picture ab-deco ab-deco-heart"
          src="/layout-assets/home/heart-no-bg.png"
          alt=""
          aria-hidden="true"
        />

        <div className="ab-hero-content">
          <div className="eyebrow">
            <span /> ABOUT US
          </div>
          <h1>
            Building Developers. Creating Impact. <span className="grad">Together.</span>
          </h1>
          <p className="lead">
            Google Developer Groups - Cebu Technological University - Main Campus is a student-led technology community that
            empowers aspiring developers through workshops, hackathons, collaborative projects, networking events, and hands-on
            learning experiences powered by Google technologies.
          </p>
        </div>
      </section>

      <section className="ab-community section-frame" aria-label="Community">
        <div className="section-rule" />
        <div className="eyebrow">
          <span /> COMMUNITY
        </div>
        <h2>Our Community</h2>
        <p className="sub">
          A diverse, inclusive community where students from all courses learn together, build together, and grow together —
          supported by mentors, alumni, and industry friends.
        </p>
      </section>

      <section className="ab-purpose section-frame">
        <div className="section-rule" />
        <div className="eyebrow">
          <span /> OUR PURPOSE
        </div>
        <h2>Our Mission, Vision, and Values</h2>
        <p className="sub">What drives us every day as a campus technology community.</p>
        <div className="purpose-grid">
          {purposeCards.map((card) => (
            <div key={card.title} className="purpose-card">
              <h3>{card.title}</h3>
              <p>{card.text}</p>
              <ul>
                {card.points.map((point) => (
                  <li key={point}>{point}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      <section className="ab-strategic section-frame">
        <div className="section-rule" />
        <div className="eyebrow">
          <span /> STRATEGIC GOALS
        </div>
        <h2>
          How We Make <span className="grad">Impact</span>
        </h2>
        <p className="sub">Four pillars that shape our programs and guide every event we run.</p>
        <div className="strategic-grid">
          {strategicGoals.map((goal) => (
            <div key={goal.title} className="strategic-card">
              <h3>{goal.title}</h3>
              <p>{goal.text}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="ab-story section-frame">
        <div className="section-rule" />
        <div className="eyebrow">
          <span /> OUR STORY
        </div>
        <h2>
          Team Story: <span className="grad">GDG On Campus CTU</span>
        </h2>
        <p className="sub">From a small group of passionate students to one of the most active tech communities in the region.</p>
        <ul className="timeline">
          {timeline.map((item) => (
            <li key={item.title}>
              <span className="tl-year">{item.year}</span>
              <h3>{item.title}</h3>
              <p>{item.text}</p>
            </li>
          ))}
        </ul>
      </section>

      <section className="ab-partners section-frame">
        <div className="section-rule" />
        <div className="eyebrow">
          <span /> OUR PARTNERS
        </div>
        <h2>
          Trusted <span className="grad">Partners</span>
        </h2>
        <p className="sub">We proudly collaborate with leading technology companies, academic institutions, and developer communities.</p>

        {partners.loading ? (
          <div className="feed-skeleton">
            <FeedSkeleton count={3} label="Loading partners…" />
          </div>
        ) : null}
        {!partners.loading && partners.error ? (
          <div className="gdg-feed-error" role="alert">
            <p>{friendlyFeedError(partners.error)} Showing legacy partners.</p>
            <button type="button" className="btn-secondary" onClick={partners.retry}>
              Retry
            </button>
          </div>
        ) : null}
        {!partners.loading && !partners.error && !cmsPartners?.length ? (
          <div className="feed-empty">
            <p>No partners published yet — check back soon.</p>
          </div>
        ) : null}

        {!partners.loading && (partners.error || cmsPartners?.length) ? (
          <div className="partners-grid">
            {partners.error
              ? legacyPartners.map((partner) => (
                  <div key={partner.name} className="partner-card">
                    {partner.image ? (
                      <img src={partner.image} alt={partner.name} loading="lazy" onError={hideImage} />
                    ) : (
                      <div className="fallback">{partner.name.charAt(0)}</div>
                    )}
                    <h3>{partner.name}</h3>
                    <p>{partner.role}</p>
                  </div>
                ))
              : (cmsPartners ?? []).map((partner) => (
                  <div key={partner.id} className="partner-card">
                    {partner.logoUrl ? (
                      <img src={partner.logoUrl} alt={partner.logoAlt} loading="lazy" onError={hideImage} />
                    ) : (
                      <div className="fallback">{partner.name.charAt(0)}</div>
                    )}
                    <h3>{partner.name}</h3>
                    <p>
                      <span className="g-tag">{partner.tier}</span>
                    </p>
                    {partner.description ? <p>{partner.description}</p> : null}
                  </div>
                ))}
          </div>
        ) : null}
        {cmsPartners?.length ? (
          <div className="btn-row">
            <Link to="/partners" className="btn-secondary">
              All Partners
            </Link>
          </div>
        ) : null}
      </section>

      <section className="ab-join section-frame">
        <div className="section-rule" />
        <div className="cta-card">
          <h2>Ready to build with us?</h2>
          <p>Join GDG On Campus CTU and start learning, building, and growing with the community.</p>
          <div className="btn-row">
            <a
              href="https://docs.google.com/forms/d/e/1FAIpQLSe8XGfS83u5u3bbwqaUlHYmYlTNqPuYPl1aULCb8xMrN91jaQ/viewform?pli=1"
              target="_blank"
              rel="noreferrer"
              className="small-green-btn"
            >
              Join Us <span aria-hidden="true">↗</span>
            </a>
            <Link to="/team" className="btn-secondary">
              Meet the Team
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
