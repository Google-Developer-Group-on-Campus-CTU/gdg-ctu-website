/**
 * Split-stage brand panel for /admin/login and /admin/register.
 * Logo-only left panel.
 * Class hooks (login-brand, etc.) preserved — visual only.
 */
export default function AuthBrandPanel() {
  return (
    <aside className="login-brand login-brand--logo-only" aria-label="GDG on Campus">
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

      <div className="login-brand-logo-wrap">
        <img src="/gdg-logo.png" alt="Google Developer Groups on Campus" className="login-brand-logo" />
      </div>
    </aside>
  );
}
