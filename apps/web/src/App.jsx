import { Suspense, lazy, useEffect } from 'react'
import { Routes, Route, Navigate, useLocation, useParams } from 'react-router-dom'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { useSmoothScroll, lenis } from './hooks/useSmoothScroll'
import Navbar from './components/Navbar'
import Hero from './components/Hero'
import Marquee from './components/Marquee'
import About from './components/About'
import Properties from './components/Properties'
import Gallery from './components/Gallery'
import Testimonials from './components/Testimonials'
import Footer from './components/Footer'
import CinematicLayer from './components/CinematicLayer'

// The home page's sections stay eagerly imported above: they are what the
// overwhelming majority of visits render, and deferring them would only add a
// round trip to the one route that matters most.
//
// Everything below is split out. The admin panel is the reason — ~2,500 lines
// of CMS that shipped in the main bundle to every visitor who would never sign
// in. The secondary public pages follow the same logic: a chunk fetched on
// navigation costs a fraction of what carrying it on every first paint does.
const AboutPage = lazy(() => import('./pages/AboutPage'))
const PropertiesPage = lazy(() => import('./pages/PropertiesPage'))
const PropertyDetailPage = lazy(() => import('./pages/PropertyDetailPage'))
const ContactPage = lazy(() => import('./pages/ContactPage'))
const NewsPage = lazy(() => import('./pages/NewsPage'))
const NewsPostPage = lazy(() => import('./pages/NewsPostPage'))

const LoginPage = lazy(() => import('./admin/LoginPage'))
const AdminLayout = lazy(() => import('./admin/AdminLayout'))
const DashboardPage = lazy(() => import('./admin/DashboardPage'))
const PropertiesListPage = lazy(() => import('./admin/PropertiesListPage'))
const PropertyEditPage = lazy(() => import('./admin/PropertyEditPage'))
const ContentIndexPage = lazy(() => import('./admin/ContentIndexPage'))
const ContentSectionPage = lazy(() => import('./admin/ContentSectionPage'))
const LeadsPage = lazy(() => import('./admin/LeadsPage'))
const NewsListPage = lazy(() => import('./admin/NewsListPage'))
const NewsEditPage = lazy(() => import('./admin/NewsEditPage'))

// RequireAuth is the gate in front of every admin route, so it is not lazy —
// splitting it would mean fetching a chunk to discover the visitor should be
// redirected to the login page.
import RequireAuth from './admin/RequireAuth'

// Deliberately not a spinner. A chunk on a warm connection lands in tens of
// milliseconds, and a spinner that appears and vanishes that fast reads as a
// flicker; a matching ground reads as the page still arriving.
function RouteFallback() {
  return <div className="min-h-[100dvh] bg-void" />
}

function Home() {
  return (
    <>
      <Hero />
      <Marquee />
      <About />
      <Properties />
      <Gallery />
      <Testimonials />
    </>
  )
}

// On every route change: jump to top and let ScrollTrigger recompute positions
// once the new page has laid out.
function ScrollManager() {
  const { pathname } = useLocation()
  useEffect(() => {
    lenis.current?.scrollTo(0, { immediate: true })
    const id = requestAnimationFrame(() => ScrollTrigger.refresh())
    return () => cancelAnimationFrame(id)
  }, [pathname])
  return null
}

// Preserves any bookmark or external link to the old /projects and /blog
// paths from before the Properties/News rename, rather than letting them 404.
function RedirectSlug({ to }) {
  const { slug } = useParams()
  return <Navigate to={`${to}/${slug}`} replace />
}

function RedirectId({ to }) {
  const { id } = useParams()
  return <Navigate to={`${to}/${id}`} replace />
}

function PublicSite() {
  useSmoothScroll() // Lenis + GSAP ScrollTrigger, mounted once at the root

  return (
    <>
      <ScrollManager />
      <CinematicLayer />
      <Navbar />
      <main>
        {/* Inside <main>, so the navbar and footer stay painted while a route
            chunk is in flight rather than the whole page blanking. */}
        <Suspense fallback={<RouteFallback />}>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/about" element={<AboutPage />} />
            <Route path="/properties" element={<PropertiesPage />} />
            <Route path="/properties/:slug" element={<PropertyDetailPage />} />
            <Route path="/news" element={<NewsPage />} />
            <Route path="/news/:slug" element={<NewsPostPage />} />
            <Route path="/contact" element={<ContactPage />} />

            {/* Legacy routes — pre-rename links keep working */}
            <Route path="/projects" element={<Navigate to="/properties" replace />} />
            <Route path="/projects/:slug" element={<RedirectSlug to="/properties" />} />
            <Route path="/blog" element={<Navigate to="/news" replace />} />
            <Route path="/blog/:slug" element={<RedirectSlug to="/news" />} />
          </Routes>
        </Suspense>
      </main>
      <Footer />
    </>
  )
}

function App() {
  return (
    // The admin routes are all lazy, so they need a boundary above them. The
    // public site carries its own inside <main>, and reaching PublicSite means
    // this one never renders for a visitor.
    <Suspense fallback={<RouteFallback />}>
      <Routes>
        <Route path="/admin/login" element={<LoginPage />} />
        <Route
          path="/admin"
          element={
            <RequireAuth>
              <AdminLayout />
            </RequireAuth>
          }
        >
          <Route index element={<DashboardPage />} />
          <Route path="properties" element={<PropertiesListPage />} />
          <Route path="properties/:id" element={<PropertyEditPage />} />
          <Route path="content" element={<ContentIndexPage />} />
          <Route path="content/:section" element={<ContentSectionPage />} />
          <Route path="news" element={<NewsListPage />} />
          <Route path="news/:id" element={<NewsEditPage />} />
          <Route path="leads" element={<LeadsPage />} />

          {/* Legacy admin routes — old bookmarks to the admin panel still land */}
          <Route path="projects" element={<Navigate to="/admin/properties" replace />} />
          <Route path="projects/:id" element={<RedirectId to="/admin/properties" />} />
          <Route path="blog" element={<Navigate to="/admin/news" replace />} />
          <Route path="blog/:id" element={<RedirectId to="/admin/news" />} />
        </Route>
        <Route path="/*" element={<PublicSite />} />
      </Routes>
    </Suspense>
  )
}

export default App
