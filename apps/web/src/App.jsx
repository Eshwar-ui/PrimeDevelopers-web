import { useEffect } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { Routes, Route, Navigate, useLocation, useParams } from 'react-router-dom'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { useSmoothScroll, lenis } from './hooks/useSmoothScroll'
import Navbar from './components/Navbar'
import Hero from './components/Hero'
import Marquee from './components/Marquee'
import About from './components/About'
import Properties from './components/Properties'
import Services from './components/Services'
import Gallery from './components/Gallery'
import Testimonials from './components/Testimonials'
import NewsTeaser from './components/NewsTeaser'
import CallToAction from './components/CallToAction'
import Footer from './components/Footer'
import CinematicLayer from './components/CinematicLayer'
import AboutPage from './pages/AboutPage'
import EnterprisePage from './pages/EnterprisePage'
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
      <Services />
      <Gallery />
      <Testimonials />
      <NewsTeaser />
      <CallToAction />
    </>
  )
}

// The route transition. Asymmetric on purpose: the outgoing page leaves quickly
// on an accelerating curve, as if it were being taken away, and the incoming one
// arrives slower on the decelerating curve the rest of the site eases with.
// Matching the two makes a swap feel like a cross-fade; splitting them gives it
// a direction.
const PAGE = {
  initial: { opacity: 0, y: 14 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.16, 1, 0.3, 1] } },
  exit: { opacity: 0, y: -10, transition: { duration: 0.3, ease: [0.4, 0, 1, 1] } },
}

// Sends the document back to the top as the new page mounts. Mounted inside the
// keyed subtree rather than driven by a callback on the transition: under
// `mode="wait"` the new page only mounts once the old one has gone, so this
// already runs during the empty frame — no callback needed to find that moment,
// and nothing to go wrong if one never fires.
function ScrollTop() {
  useEffect(() => {
    lenis.current?.scrollTo(0, { immediate: true })
  }, [])
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
  const location = useLocation()
  const reduced = useReducedMotion()

  // `mode="wait"` is what makes this work rather than just decorate. It holds
  // the incoming page until the outgoing one is fully gone, which buys a moment
  // with nothing on screen — the only moment when the jump back to the top of
  // the document can happen unseen. Resetting the scroll on the pathname change
  // instead, as this used to, snaps the outgoing page upward while the visitor
  // is still looking at it.
  //
  // The cost is that mounting the new route waits on an animation. That is only
  // safe because the wait is bounded by a duration rather than by anything that
  // can fail to arrive — and because a tab that isn't rendering isn't being
  // looked at, so the pause resolves the moment it is.

  // Refreshed once the new page has both mounted and settled: ScrollTrigger
  // measures the document, and measuring it mid-transition records positions
  // that are about to change.
  const onArrived = () => ScrollTrigger.refresh()

  return (
    <>
      <CinematicLayer />
      <Navbar />
      {/* Holds the page open through the frame where neither route is mounted.
          Without it the footer flies up to meet the header and drops back. */}
      <main className="min-h-dvh">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={location.pathname}
            initial={reduced ? false : PAGE.initial}
            animate={PAGE.animate}
            exit={reduced ? { opacity: 0 } : PAGE.exit}
            onAnimationComplete={onArrived}
          >
            <ScrollTop />
            {/* The location is passed explicitly so the outgoing subtree keeps
                rendering the route it was mounted with. Left to read the router
                itself, it would swap its own content to the new page and then
                animate that out. */}
            <Routes location={location}>
              <Route path="/" element={<Home />} />
              <Route path="/about" element={<AboutPage />} />
              <Route path="/enterprise" element={<EnterprisePage />} />
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
          </motion.div>
        </AnimatePresence>
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
