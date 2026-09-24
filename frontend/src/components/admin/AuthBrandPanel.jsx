/**
 * Split-stage brand panel shared by the admin auth pages
 * (/admin/login and /admin/register) — styled by src/styles/login.css.
 * Visual language mirrors public DS: Poppins, GDG palette (blue/red/yellow/green),
 * dot texture + 4-color bar echo shell/footer.
 */
export default function AuthBrandPanel() {
  return (
    <aside className="login-brand" aria-label="About the GDG-CTU admin">
      <div className="login-brand-top">
        <span className="login-mark" aria-hidden="true">
          G
        </span>
        <span className="login-brand-name">GDG-CTU</span>
      </div>

      <div className="login-brand-copy">
        <p className="login-brand-kicker">Google Developer Group on Campus</p>
        <h1 className="login-brand-headline">
          The campus site, <span>managed in one place.</span>
        </h1>
        <p className="login-brand-sub">
          Events, officers, gallery, and pages — write them here once and the
          public site picks them up right away.
        </p>
      </div>

      <ul className="login-brand-points">
        <li>Events, team, and partners</li>
        <li>Gallery albums and photos</li>
        <li>Site content sections</li>
      </ul>

      <p className="login-brand-foot">
        Cebu Technological University · Google Developer Group on Campus
      </p>
    </aside>
  );
}
