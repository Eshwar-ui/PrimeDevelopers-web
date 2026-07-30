import { useEffect } from 'react'
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
import AboutPage from './pages/AboutPage'
import PropertiesPage from './pages/PropertiesPage'
import PropertyDetailPage from './pages/PropertyDetailPage'
import ContactPage from './pages/ContactPage'
import NewsPage from './pages/NewsPage'
import NewsPostPage from './pages/NewsPostPage'
import LoginPage from './admin/LoginPage'
import RequireAuth from './admin/RequireAuth'
import AdminLayout from './admin/AdminLayout'
import DashboardPage from './admin/DashboardPage'
import PropertiesListPage from './admin/PropertiesListPage'
import PropertyEditPage from './admin/PropertyEditPage'
import ContentIndexPage from './admin/ContentIndexPage'
import ContentSectionPage from './admin/ContentSectionPage'
import LeadsPage from './admin/LeadsPage'
import NewsListPage from './admin/NewsListPage'
import NewsEditPage from './admin/NewsEditPage'

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
      </main>
      <Footer />
    </>
  )
}

function App() {
  return (
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
  )
}

export default App
