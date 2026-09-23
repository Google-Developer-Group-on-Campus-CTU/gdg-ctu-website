import { Link } from 'react-router-dom';
import { mapContent, publicApi, sortPartners, usePublicFeed } from '../api/public.js';
import { FeedError, FeedSkeleton, friendlyFeedError, hideImage } from '../components/FeedStates.jsx';

const purposeCards = [
  {
    title: 'Our Mission',
    text: 'To empower students and the community with cutting-edge technology knowledge through collaborative learning, skill development, and meaningful connections that drive innovation and career growth.',
    points: [
      'Computer Science Advocacy',
      'Practical Skills Development',
      'Community Upskilling',
      'Networking Opportunities',
    ],
  },
  {
    title: 'Our Vision',
    text: 'We envision a future where every student at Cebu Technological University has access to world-class technology education, practical skills, and a supportive network that transforms them into confident, competent, and connected tech professionals.',
    points: [
      'Accessibility for All',
      'Excellence in Learning',
      'Transformation & Growth',
      'Connection & Network',
    ],
  },
  {
    title: 'Our Values',
    text: 'We believe in creating an inclusive environment where innovation thrives, collaboration flourishes, and every member grows into a confident tech professional.',
    points: [
      'Innovation & Learning',
      'Collaboration & Community',
      'Excellence & Competency',
      'Advocacy & Impact',
    ],
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
  const about = usePublicFeed(
    () => publicApi.getContentByKey('about').then((c) => (c ? mapContent(c) : null)),
    'about-key',
  );
  const community = usePublicFeed(
    () => publicApi.getContentByKey('community').then((c) => (c ? mapContent(c) : null)),
    'community-key',
  );
  const partners = usePublicFeed(
    () => publicApi.getPartners().then(sortPartners),
    'about-partners',
  );

  const aboutContent = !about.loading && !about.error ? about.data : null;
  const communityContent = !community.loading && !community.error ? community.data : null;
  const cmsPartners = !partners.loading && !partners.error ? partners.data : null;

  return (
    <div className="gdg-container">
      <section className="gdg-section">
        <span className="gdg-badge">About Us</span>
        <h2>
          {aboutContent?.title || (<>Building Developers. Creating Impact. <span className="gdg-gradient-text">Together.</span></>)}
        </h2>
        <p className="gdg-subtitle">
          {aboutContent?.subtitle || aboutContent?.body || (
            <>
              Google Developer Groups - Cebu Technological University - Main
              Campus is a student-led technology community that empowers aspiring
              developers through workshops, hackathons, collaborative projects,
              networking events, and hands-on learning experiences powered by
              Google technologies.
            </>
          )}
        </p>
        {aboutContent?.buttonText && aboutContent?.buttonUrl ? (
          <div className="gdg-btn-row">
            <a href={aboutContent.buttonUrl} className="gdg-btn gdg-btn-primary">{aboutContent.buttonText}</a>
          </div>
        ) : null}
        {/* Loading/empty fall back to the hardcoded shell above; real failures get retry. */}
        {!about.loading && about.error ? (
          <FeedError message={friendlyFeedError(about.error)} onRetry={about.retry} />
        ) : null}
      </section>

      <section className="gdg-section" aria-label="Community">
        <span className="gdg-badge">Community</span>
        <h2>{communityContent?.title || 'Our Community'}</h2>
        {community.loading ? <FeedSkeleton count={1} label="Loading community…" /> : null}
        {!community.loading && community.error ? (
          <FeedError message={friendlyFeedError(community.error)} onRetry={community.retry} />
        ) : null}
        {!community.loading && !community.error && !communityContent ? (
          <p className="gdg-subtitle">No community updates published yet — check back soon.</p>
        ) : null}
        {communityContent?.subtitle ? <p className="gdg-subtitle">{communityContent.subtitle}</p> : null}
        {communityContent?.body ? <p>{communityContent.body}</p> : null}
      </section>

      <section className="gdg-section">
        <span className="gdg-badge">Our Purpose</span>
        <h2>Our Mission, Vision, and Values</h2>
        <div className="gdg-grid">
          {purposeCards.map((card) => (
            <div key={card.title} className="gdg-card">
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

      <section className="gdg-section">
        <span className="gdg-badge">Strategic Goals</span>
        <h2>
          How We Make <span className="gdg-gradient-text">Impact</span>
        </h2>
        <div className="gdg-grid">
          {strategicGoals.map((goal) => (
            <div key={goal.title} className="gdg-card">
              <h3>{goal.title}</h3>
              <p>{goal.text}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="gdg-section">
        <span className="gdg-badge">Our Story</span>
        <h2>
          Team Story: <span className="gdg-gradient-text">GDG On Campus CTU</span>
        </h2>
        <p className="gdg-subtitle">
          From a small group of passionate students to one of the most active
          tech communities in the region.
        </p>
        <ul className="gdg-timeline">
          {timeline.map((item) => (
            <li key={item.title}>
              <span className="gdg-timeline-year">{item.year}</span>
              <h3>{item.title}</h3>
              <p>{item.text}</p>
            </li>
          ))}
        </ul>
      </section>

      <section className="gdg-section">
        <span className="gdg-badge">Our Partners</span>
        <h2>
          Trusted <span className="gdg-gradient-text">Partners</span>
        </h2>
        <p className="gdg-subtitle">
          We proudly collaborate with leading technology companies, academic
          institutions, and developer communities.
        </p>
        {partners.loading ? <FeedSkeleton count={4} label="Loading partners…" /> : null}
        {!partners.loading && partners.error ? (
          <FeedError message={`${friendlyFeedError(partners.error)} Showing legacy partners.`} onRetry={partners.retry} />
        ) : null}
        {!partners.loading && !partners.error && !cmsPartners?.length ? (
          <p className="gdg-subtitle">No partners published yet — check back soon.</p>
        ) : null}
        {!partners.loading && (partners.error || cmsPartners?.length) ? (
          <div className="gdg-grid">
            {partners.error
              ? legacyPartners.map((partner) => (
                <div key={partner.name} className="gdg-card">
                  {partner.image ? (
                    <img
                      className="gdg-photo"
                      src={partner.image}
                      alt={partner.name}
                      onError={hideImage}
                    />
                  ) : (
                    <div className="gdg-photo-fallback">{partner.name.charAt(0)}</div>
                  )}
                  <h3>{partner.name}</h3>
                  <p>{partner.role}</p>
                </div>
              ))
              : (cmsPartners ?? []).map((partner) => (
                <div key={partner.id} className="gdg-card">
                  {partner.logoUrl ? (
                    <img className="gdg-photo" src={partner.logoUrl} alt={partner.logoAlt} loading="lazy" onError={hideImage} />
                  ) : (
                    <div className="gdg-photo-fallback">{partner.name.charAt(0)}</div>
                  )}
                  <h3>{partner.name}</h3>
                  <p><span className="gdg-tag">{partner.tier}</span></p>
                  {partner.description ? <p>{partner.description}</p> : null}
                </div>
              ))}
          </div>
        ) : null}
        {cmsPartners?.length ? (
          <div className="gdg-btn-row">
            <Link to="/partners" className="gdg-btn gdg-btn-secondary">All Partners</Link>
          </div>
        ) : null}
      </section>
    </div>
  );
}
