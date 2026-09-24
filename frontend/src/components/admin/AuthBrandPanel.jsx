/**
 * Split-stage brand panel for /admin/login and /admin/register.
 * Aligned to Home landing system: Google Sans Flex, 1.5px #222 borders,
 * eyebrow pill + window-dots vibe, doodle ornaments, pill cardlets.
 * Class hooks (login-brand, etc.) preserved — visual only.
 */
export default function AuthBrandPanel() {
  return (
    <aside className="login-brand" aria-label="About the GDG-CTU admin">
      <img
        className="brand-deco brand-deco-star"
        src="/layout-assets/home/star-huge.png"
        alt=""
        aria-hidden="true"
      />
      <img
        className="brand-deco brand-deco-globe"
        src="/layout-assets/home/globe-huge.png"
        alt=""
        aria-hidden="true"
      />
      <img
        className="brand-deco brand-deco-heart"
        src="/layout-assets/home/heart-huge.png"
        alt=""
        aria-hidden="true"
      />

      <div className="login-brand-top">
        <span className="login-mark" aria-hidden="true">
          G
        </span>
        <span className="login-brand-name">GDG-CTU</span>
      </div>

      <div className="login-brand-copy">
        <div className="login-brand-kicker">
          <span className="login-brand-eyebrow">
            <i aria-hidden="true" /> Google Developer Group on Campus
          </span>
        </div>
        <h1 className="login-brand-headline">
          Manage the site — <span className="accent">all in one place.</span>
        </h1>
        <p className="login-brand-sub">
          Update events, officers, gallery and page content here. What you publish appears on the public site right
          away — no extra steps.
        </p>
      </div>

      <ul className="login-brand-points">
        <li>Events, team and partners</li>
        <li>Gallery albums and photos</li>
        <li>Site content sections</li>
      </ul>

      <p className="login-brand-foot">Cebu Technological University · Google Developer Group on Campus</p>
    </aside>
  );
}
