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

function PublicLayout() {
  return (
    <>
      <Navbar />
      <Outlet />
      <Footer />
    </>
  );
}

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
  { path: '/admin/login/*', element: <AdminLogin /> },
  {
    element: <ProtectedRoute />,
    children: [
      {
        element: <AdminShell />,
        children: [
          { path: '/admin', element: <AdminDashboard /> },
          { path: '/admin/events', element: <AdminEvents /> },
          { path: '/admin/events/new', element: <EventDetail /> },
          { path: '/admin/events/:id', element: <EventDetail /> },
          { path: '/admin/team', element: <AdminTeam /> },
          { path: '/admin/team/new', element: <TeamDetail /> },
          { path: '/admin/team/:id', element: <TeamDetail /> },
          { path: '/admin/partners', element: <AdminPartners /> },
          { path: '/admin/partners/new', element: <PartnerDetail /> },
          { path: '/admin/partners/:id', element: <PartnerDetail /> },
          { path: '/admin/gallery', element: <AdminGallery /> },
          { path: '/admin/gallery/albums/new', element: <AlbumDetail /> },
          { path: '/admin/gallery/albums/:id', element: <AlbumDetail /> },
          { path: '/admin/content', element: <AdminContent /> },
          { path: '/admin/content/:sectionKey', element: <ContentEditor /> },
          { path: '/admin/media', element: <AdminMedia /> },
          { path: '/admin/settings', element: <AdminSettings /> },
        ],
      },
    ],
  },
]);

export default function App() {
  return <RouterProvider router={router} />;
}
