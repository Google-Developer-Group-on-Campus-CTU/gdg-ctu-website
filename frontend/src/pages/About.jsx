import '../styles/about.css';

const REGISTER_URL =
  'https://docs.google.com/forms/d/e/1FAIpQLSe8XGfS83u5u3bbwqaUlHYmYlTNqPuYPl1aULCb8xMrN91jaQ/viewform?pli=1';

const beliefCards = [
  { dot: 'dot-red', title: 'Learn', text: 'Explore new technologies.' },
  { dot: 'dot-yellow', title: 'Build', text: 'Put knowledge into practice.' },
  { dot: 'dot-blue', title: 'Connect', text: 'Learn with people who get it.' },
  { dot: 'dot-green', title: 'Grow', text: 'Take your next step beyond campus.' },
];

const differenceCards = [
  { title: 'Come to learn', text: 'Explore technologies outside the classroom and learn from people who are building with them.' },
  { title: 'Stay to build', text: 'Put your knowledge into practice through projects, challenges, and hands-on experiences.' },
  { title: 'Grow with the community', text: 'Meet people who can become teammates, mentors, collaborators, and lifelong friends.' },
  { title: 'Take it further', text: 'Use what you learn at CTU as a starting point for opportunities beyond campus.' },
];

const timeline = [
  { title: 'The Beginning', text: 'Founded by a small group of students with a shared goal: learn, connect, and build with technology.' },
  { title: 'The Foundation', text: 'Workshops, learning sessions, and new connections turned a small idea into a growing community.' },
  { title: 'TechConnect', subtitle: 'The Breakthrough', text: 'TechConnect brought the community to a bigger stage and showed what students can build together.' },
  { title: 'Present', subtitle: 'Still Moving Forward', text: 'Today, GDG On Campus CTU continues to grow through projects, mentorship, events, and new opportunities.' },
];

function Deco({ cls, src }) {
  return (
    <img
      className={`hero-picture ab-deco ${cls}`}
      src={src}
      alt=""
      aria-hidden="true"
    />
  );
}

export default function About() {
  return (
    <main className="page-about">
      {/* 1 — HERO */}
      <section className="ab-hero" aria-labelledby="about-title">
        <Deco cls="ab-deco-star" src="/layout-assets/home/star-no-bg.png" />
        <Deco cls="ab-deco-arrow" src="/layout-assets/home/arrow-no-bg.png" />
        <Deco cls="ab-deco-globe" src="/layout-assets/home/globe-no-bg.png" />
        <Deco cls="ab-deco-heart" src="/layout-assets/home/heart-no-bg.png" />

        <div className="ab-hero-content">
          <div className="eyebrow"><span /> ABOUT GDG ON CAMPUS CTU</div>
          <h1 id="about-title">
            A community for students<br />
            who{' '}
            <span className="ab-build-card" aria-label="Build">
              <span className="c-blue">B</span>
              <span className="c-red">U</span>
              <span className="c-yellow">I</span>
              <span className="c-green">L</span>
              <span className="c-blue">D</span>
            </span>
          </h1>
          <p className="sub">
            GDG on Campus - Cebu Technological University is a student-led
            developer community where CTU students come together to learn,
            build, and grow through technology.
          </p>
          <a className="ab-hero-cta" href="#about-belief">
            Get to know GDGoC - CTU <span aria-hidden="true">↓</span>
          </a>
        </div>
      </section>

      {/* 2 — WHY WE EXIST */}
      <section id="about-belief" className="ab-belief section-frame" aria-labelledby="belief-title">
        <div className="section-rule" />
        <div className="eyebrow"><span /> WHY WE EXIST</div>
        <h2 id="belief-title">Turn curiosity into<br />capability</h2>
        <p className="sub">Whether you&apos;re writing your first line of code or already working on your next big project, there&apos;s a place for you here.</p>
      </section>

      {/* 3 — WHAT WE BELIEVE */}
      <section className="ab-believe section-frame" aria-labelledby="believe-title">
        <Deco cls="ab-deco-star" src="/layout-assets/home/star-no-bg.png" />
        <Deco cls="ab-deco-arrow" src="/layout-assets/home/arrow-no-bg.png" />
        <div className="section-rule" />
        <div className="eyebrow"><span /> WHAT WE BELIEVE</div>
        <h2 id="believe-title">We believe in starting<br />before you feel ready</h2>
        <div className="belief-grid">
          {beliefCards.map((card) => (
            <article className="belief-card" key={card.title}>
              <span className={`card-dot ${card.dot}`} />
              <h3>{card.title}</h3>
              <p>{card.text}</p>
            </article>
          ))}
        </div>
      </section>

      {/* 4 — STATEMENT */}
      <section className="ab-statement section-frame" aria-label="Community statement">
        <Deco cls="ab-deco-heart" src="/layout-assets/home/heart-no-bg.png" />
        <div className="statement-card">
          <span className="u u-red">Learn it.</span> <span className="u u-blue">Build it.</span><br />
          <strong className="u u-green">Make it real.</strong>
        </div>
        <p className="sub">GDG on Campus CTU creates spaces where students can learn through doing, build alongside others, and grow through real experiences.</p>
      </section>

      {/* 5 — OUR JOURNEY */}
      <section className="ab-story section-frame" aria-labelledby="journey-title">
        <Deco cls="ab-deco-arrow" src="/layout-assets/home/arrow-no-bg.png" />
        <Deco cls="ab-deco-star" src="/layout-assets/home/star-no-bg.png" />
        <Deco cls="ab-deco-globe" src="/layout-assets/home/globe-no-bg.png" />
        <div className="section-rule" />
        <div className="eyebrow"><span /> OUR JOURNEY</div>
        <h2 id="journey-title">It started with<br />a community</h2>
        <p className="sub">What began as an initiative to bring students closer to the developer community gradually became a space where learning turned into action.</p>
        <ul className="timeline">
          {timeline.map((item) => (
            <li key={item.title}>
              <h3>
                {item.title}
                {item.subtitle ? (
                  <>
                    <br />
                    {item.subtitle}
                  </>
                ) : null}
              </h3>
              <p>{item.text}</p>
            </li>
          ))}
        </ul>
      </section>

      {/* 6 — WHAT MAKES US DIFFERENT */}
      <section className="ab-different section-frame" aria-labelledby="different-title">
        <Deco cls="ab-deco-arrow" src="/layout-assets/home/arrow-no-bg.png" />
        <Deco cls="ab-deco-heart" src="/layout-assets/home/heart-no-bg.png" />
        <Deco cls="ab-deco-globe" src="/layout-assets/home/globe-no-bg.png" />
        <Deco cls="ab-deco-star" src="/layout-assets/home/star-no-bg.png" />
        <div className="section-rule" />
        <h2 id="different-title">What makes GDGoC - CTU<br />different?</h2>
        <p className="sub">You don&apos;t have to build alone.</p>
        <div className="difference-grid">
          {differenceCards.map((card) => (
            <article className="difference-card" key={card.title}>
              <h3>{card.title}</h3>
              <p>{card.text}</p>
            </article>
          ))}
        </div>
      </section>

      {/* 7 — DRIVEN BY PURPOSE */}
      <section className="ab-purpose section-frame" aria-labelledby="purpose-title">
        <Deco cls="ab-deco-star" src="/layout-assets/home/star-no-bg.png" />
        <Deco cls="ab-deco-arrow" src="/layout-assets/home/arrow-no-bg.png" />
        <Deco cls="ab-deco-heart" src="/layout-assets/home/heart-no-bg.png" />
        <div className="section-rule" />
        <div className="purpose-head">
          <img
            className="purpose-icon"
            src="/layout-assets/home/globe-no-bg.png"
            alt=""
            aria-hidden="true"
          />
          <div>
            <h2 id="purpose-title">Driven by Purpose</h2>
            <p className="sub">The principles that guide our community, shape our vision, and define our goals.</p>
          </div>
        </div>
        <div className="purpose-grid">
          <div className="purpose-side">
            <article className="purpose-card">
              <span className="card-dot dot-yellow" />
              <h3>Vision</h3>
            </article>
            <article className="purpose-card">
              <span className="card-dot dot-green" />
              <h3>Mission</h3>
            </article>
          </div>
          <article className="purpose-card purpose-goals">
            <div className="skel-stack" aria-hidden="true">
              <span className="skel w90" />
              <span className="skel w100" />
              <span className="skel w85" />
              <span className="skel w95" />
              <span className="skel w80" />
              <span className="skel w90" />
            </div>
            <span className="card-dot dot-blue" />
            <h3>Goals</h3>
          </article>
        </div>
      </section>

      {/* 8 — FINAL CTA */}
      <section className="ab-final section-frame" aria-labelledby="final-title">
        <div className="section-rule" />
        <div className="final-card">
          <div className="final-dots" aria-hidden="true">
            <span className="dot-red" />
            <span className="dot-blue" />
            <span className="dot-yellow" />
            <span className="dot-green" />
          </div>
          <h2 id="final-title">Your next build starts here.</h2>
          <p className="sub">Join the GDG On Campus CTU community and turn your ideas into something real.</p>
          <a
            className="final-btn"
            href={REGISTER_URL}
            target="_blank"
            rel="noreferrer"
          >
            Register now <span aria-hidden="true">↗</span>
          </a>
        </div>
      </section>
    </main>
  );
}
