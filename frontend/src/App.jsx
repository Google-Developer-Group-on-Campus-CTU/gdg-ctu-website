import { Link, Navigate, Outlet, RouterProvider, createBrowserRouter, useRouteError } from 'react-router-dom';
import Navbar from './components/Navbar.jsx';
import Footer from './components/Footer.jsx';
import ProtectedRoute from './components/ProtectedRoute.jsx';
import AdminShell from './components/admin/AdminShell.jsx';
import Home from './pages/Home.jsx';
import About from './pages/About.jsx';
import Officers from './pages/Officers.jsx';
import Gallery from './pages/Gallery.jsx';
import Events from './pages/Events.jsx';
import Partners from './pages/Partners.jsx';
import Contact from './pages/Contact.jsx';
import AdminLogin from './pages/admin/Login.jsx';
import AdminRegister from './pages/admin/Register.jsx';
import AdminInvites from './pages/admin/Invites.jsx';
import AdminUsers from './pages/admin/Users.jsx';
import AdminDashboard from './pages/admin/Dashboard.jsx';
import AdminEvents from './pages/admin/Events.jsx';
import EventDetail from './pages/admin/EventDetail.jsx';
import AdminTeam from './pages/admin/Team.jsx';
import TeamDetail from './pages/admin/TeamDetail.jsx';
import AdminPartners from './pages/admin/Partners.jsx';
import PartnerDetail from './pages/admin/PartnerDetail.jsx';
import AdminGallery from './pages/admin/Gallery.jsx';
import AlbumDetail from './pages/admin/AlbumDetail.jsx';
import GalleryCategories from './pages/admin/GalleryCategories.jsx';
import AdminTerms from './pages/admin/Terms.jsx';
import TermDetail from './pages/admin/TermDetail.jsx';
import AdminMedia from './pages/admin/Media.jsx';
import AdminSettings from './pages/admin/Settings.jsx';
import { ADMIN_ENTITY_ROUTES } from './admin/editorial.js';

function PublicLayout() {
  return (
    <>
      <Navbar />
      <Outlet />
      <Footer />
    </>
  );
}

/** Rendered when a route throws (loaders aside, this is mostly a safety net). */
function RouteError() {
  const err = useRouteError();
  const message = err?.statusText ?? err?.message ?? 'Something went wrong.';
  return (
    <div className="gdg-container">
      <section className="gdg-section" role="alert">
        <span className="gdg-badge">GDG-CTU</span>
        <h2>Something went wrong</h2>
        <p className="gdg-subtitle">{message}</p>
        <p className="gdg-btn-row">
          <Link className="gdg-btn gdg-btn-primary" to="/">Back home</Link>
          <Link to="/contact">Contact us</Link>
        </p>
      </section>
    </div>
  );
}

/** Catch-all for unknown URLs — deep links to retired pages land here. */
function NotFound() {
  return (
    <div className="gdg-container">
      <section className="gdg-section" role="status">
        <span className="gdg-badge">404</span>
        <h2>Page not found</h2>
        <p className="gdg-subtitle">
          That address doesn&apos;t match anything on this site. Check the URL
          or head back home.
        </p>
        <p>
          <Link className="gdg-btn gdg-btn-primary" to="/">Back home</Link>
        </p>
      </section>
    </div>
  );
}

// Page elements keyed by the canonical ADMIN_ENTITY_ROUTES entity. The route
// PATHS themselves live only in src/admin/editorial.js — this table binds
// elements to those paths (one route definition, no path copies).
const ADMIN_ENTITY_PAGES = {
  events: { list: <AdminEvents />, detail: <EventDetail /> },
  team: { list: <AdminTeam />, detail: <TeamDetail /> },
  partners: { list: <AdminPartners />, detail: <PartnerDetail /> },
  gallery: { list: <AdminGallery />, detail: <AlbumDetail /> },
  galleryCategories: { list: <GalleryCategories />, detail: null },
  terms: { list: <AdminTerms />, detail: <TermDetail /> },
  media: { list: <AdminMedia />, detail: null },
};

// Derive the admin entity routes from the canonical map: the list route always;
// the `new` route when distinct from the list; the detail route as
// `detail(':param')` (e.g. '/admin/events/:id', '/admin/terms/:id').
const adminEntityRoutes = Object.entries(ADMIN_ENTITY_ROUTES).flatMap(([key, entity]) => {
  const page = ADMIN_ENTITY_PAGES[key];
  const routes = [{ path: entity.list, element: page.list }];
  if (entity.new && entity.new !== entity.list) {
    routes.push({ path: entity.new, element: page.detail });
  }
  if (entity.detail && entity.param) {
    routes.push({ path: entity.detail(`:${entity.param}`), element: page.detail });
  }
  return routes;
});

// Data router is required for useBlocker (used by useDirtyGuard in
// src/admin/editorial.js). Same route tree as before, object form.
const router = createBrowserRouter([
  {
    element: <PublicLayout />,
    errorElement: <RouteError />,
    children: [
      { path: '/', element: <Home /> },
      { path: '/about', element: <About /> },
      { path: '/team', element: <Officers /> },
      // Deep-link parity with /events/:slug and /gallery/:slug: member slugs
      // render the roster (Officers ignores the param) instead of 404ing.
      { path: '/team/:slug', element: <Officers /> },
      { path: '/officers', element: <Navigate to="/team" replace /> },
      { path: '/partners', element: <Partners /> },
      { path: '/gallery', element: <Gallery /> },
      { path: '/gallery/:slug', element: <Gallery /> },
      { path: '/events', element: <Events /> },
      { path: '/events/:slug', element: <Events /> },
      { path: '/contact', element: <Contact /> },
      { path: '*', element: <NotFound /> },
    ],
  },
  { path: '/admin/login', element: <AdminLogin /> },
  { path: '/admin/register', element: <AdminRegister /> },
  {
    element: <ProtectedRoute />,
    errorElement: <RouteError />,
    children: [
      {
        element: <AdminShell />,
        children: [
          { path: '/admin', element: <AdminDashboard /> },
          ...adminEntityRoutes,
          { path: '/admin/invites', element: <AdminInvites /> },
          { path: '/admin/users', element: <AdminUsers /> },
          { path: '/admin/settings', element: <AdminSettings /> },
          { path: '/admin/*', element: <NotFound /> },
        ],
      },
    ],
  },
]);

export default function App() {
  return <RouterProvider router={router} />;
}
