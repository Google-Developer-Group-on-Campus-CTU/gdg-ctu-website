import { Navigate, Outlet, RouterProvider, createBrowserRouter } from 'react-router-dom';
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
import AdminContent from './pages/admin/Content.jsx';
import ContentEditor from './pages/admin/ContentEditor.jsx';
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

// Page elements keyed by the canonical ADMIN_ENTITY_ROUTES entity. The route
// PATHS themselves live only in src/admin/editorial.js — this table binds
// elements to those paths (one route definition, no path copies).
const ADMIN_ENTITY_PAGES = {
  events: { list: <AdminEvents />, detail: <EventDetail /> },
  team: { list: <AdminTeam />, detail: <TeamDetail /> },
  partners: { list: <AdminPartners />, detail: <PartnerDetail /> },
  gallery: { list: <AdminGallery />, detail: <AlbumDetail /> },
  content: { list: <AdminContent />, detail: <ContentEditor /> },
  media: { list: <AdminMedia />, detail: null },
};

// Derive the admin entity routes from the canonical map: the list route always;
// the `new` route when distinct from the list; the detail route as
// `detail(':param')` (e.g. '/admin/events/:id', '/admin/content/:sectionKey').
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
    children: [
      { path: '/', element: <Home /> },
      { path: '/about', element: <About /> },
      { path: '/team', element: <Officers /> },
      { path: '/officers', element: <Navigate to="/team" replace /> },
      { path: '/partners', element: <Partners /> },
      { path: '/gallery', element: <Gallery /> },
      { path: '/gallery/:slug', element: <Gallery /> },
      { path: '/events', element: <Events /> },
      { path: '/events/:slug', element: <Events /> },
      { path: '/contact', element: <Contact /> },
    ],
  },
  { path: '/admin/login', element: <AdminLogin /> },
  { path: '/admin/register', element: <AdminRegister /> },
  {
    element: <ProtectedRoute />,
    children: [
      {
        element: <AdminShell />,
        children: [
          { path: '/admin', element: <AdminDashboard /> },
          ...adminEntityRoutes,
          { path: '/admin/invites', element: <AdminInvites /> },
          { path: '/admin/users', element: <AdminUsers /> },
          { path: '/admin/settings', element: <AdminSettings /> },
        ],
      },
    ],
  },
]);

export default function App() {
  return <RouterProvider router={router} />;
}
