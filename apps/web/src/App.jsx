import { Suspense, lazy, useEffect, useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { Routes, Route, Navigate, useLocation, useParams } from 'react-router-dom'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { useSmoothScroll, lenis } from './hooks/useSmoothScroll'
import Navbar from './components/Navbar'
import Hero from './components/Hero'
import Partners from './components/Partners'

import FeaturedProperty from './components/FeaturedProperty'
import Properties from './components/Properties'
import Services from './components/Services'
import AcademyTeaser from './components/AcademyTeaser'
import Gallery from './components/Gallery'
import Testimonials from './components/Testimonials'
import LatestUpdates from './components/LatestUpdates'
// CallToAction is no longer rendered: the closing panel moved into <Footer/>, so
// it runs on every route instead of the homepage alone. The component and its
// `cta_home` copy are both kept — the footer panel reads the same section, and
// deleting the file would take the photographic treatment with it.
import Footer from './components/Footer'
import SectionRevealController from './components/SectionRevealController'
import LandingParallaxChapter from './components/LandingParallaxChapter'

// The home page's sections stay eagerly imported above: they are what the
// overwhelming majority of visits render, and deferring them would only add a
// round trip to the one route that matters most.
//
// Everything below is split out. The admin panel is the reason — ~2,500 lines
// of CMS that shipped in the main bundle to every visitor who would never sign
// in. The secondary public pages follow the same logic: a chunk fetched on
// navigation costs a fraction of what carrying it on every first paint does.
const AboutPage = lazy(() => import('./pages/AboutPage'))
const EnterprisePage = lazy(() => import('./pages/EnterprisePage'))
const PropertiesPage = lazy(() => import('./pages/PropertiesPage'))
const PropertyDetailPage = lazy(() => import('./pages/PropertyDetailPage'))
const PropertyInfoPage = lazy(() => import('./pages/PropertyInfoPage'))
const ContactPage = lazy(() => import('./pages/ContactPage'))
const NewsPage = lazy(() => import('./pages/NewsPage'))
const NewsPostPage = lazy(() => import('./pages/NewsPostPage'))
const LearnPage = lazy(() => import('./pages/LearnPage'))
const LearnTermPage = lazy(() => import('./pages/LearnTermPage'))
const NotFoundPage = lazy(() => import('./pages/NotFoundPage'))

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
//
// `bg-surface` rather than a fixed colour: the ground it has to match is now
// whichever theme the visitor is in, and a hardcoded dark panel would flash
// black across a light page.
//
// Tagged as a light band like any other section, because for the moment it is
// on screen it *is* the page. Without it the navbar spends the chunk download
// dressed for a dark ground it is no longer standing on.
function RouteFallback() {
  return <div data-band="light" className="min-h-[100dvh] bg-surface" />
}

function Home() {
  return (
    <div data-landing-page>
      <Hero />
      {/* The chapter's ground matches the section's darkest edge. The parallax
          shifts the section a couple of dozen pixels inside a clipped box, so
          whatever colour is set here is what shows at the seams. */}
      <LandingParallaxChapter depth={28} className="bg-void">
        <Partners />
      </LandingParallaxChapter>
      <LandingParallaxChapter depth={22}>
        <FeaturedProperty />
      </LandingParallaxChapter>
      <LandingParallaxChapter depth={26}>
        <Properties />
      </LandingParallaxChapter>
      <LandingParallaxChapter depth={42}>
        <Gallery />
      </LandingParallaxChapter>
      <LandingParallaxChapter depth={30}>
        <Services />
      </LandingParallaxChapter>
      {/* Neither of these two is in the comp either; both are kept by request
          and restyled to match. They sit after the design's own sections so the
          approved page reads end to end before the additions begin. */}
      <LandingParallaxChapter depth={24}>
        <AcademyTeaser />
      </LandingParallaxChapter>
      <LandingParallaxChapter depth={36}>
        <Testimonials />
      </LandingParallaxChapter>
      <LandingParallaxChapter depth={26}>
        <LatestUpdates />
      </LandingParallaxChapter>
    </div>
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

// Sends the document back to the top as the new page mounts, and re-measures
// the scroll triggers now that there is a page to measure. Mounted inside the
// keyed subtree rather than driven by a callback on the transition: under
// `mode="wait"` the new page only mounts once the old one has gone, so this
// already runs during the empty frame — no callback needed to find that moment,
// and nothing to go wrong if one never fires.
//
// The refresh used to hang off the transition's onAnimationComplete, which is
// exactly the callback that does not fire on a first load: AnimatePresence is
// given `initial={false}`, so the first page to mount never animates in and
// never reports completing. ScrollTrigger was therefore left holding whatever
// it measured while the route chunk was still arriving and the images had not
// reserved their boxes — positions that are wrong by the time the page settles,
// which leaves every `gsap.from(..., { opacity: 0 })` section stuck invisible.
// That is the blank page below a correct navbar, and why a second load fixed
// it: with everything cached the first measurement was already right.
function ScrollTop() {
  useEffect(() => {
    lenis.current?.scrollTo(0, { immediate: true })

    // Next frame, so the refresh reads a laid-out page rather than the one
    // being committed around it.
    const raf = requestAnimationFrame(() => ScrollTrigger.refresh())
    return () => cancelAnimationFrame(raf)
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
  const [sharedPropertyTransition, setSharedPropertyTransition] = useState(false)

  useEffect(() => {
    const handleSharedTransition = (event) => setSharedPropertyTransition(Boolean(event.detail))
    window.addEventListener('prime:property-transition', handleSharedTransition)
    return () => window.removeEventListener('prime:property-transition', handleSharedTransition)
  }, [])

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

  // And again when the things that change the document's height finally land.
  // A route mounting is not the end of the layout: images without intrinsic
  // dimensions still have to load and the brand faces still have to swap, and
  // each of those moves every trigger below it. Both are one-shot, both are
  // cheap, and between them they cover the window in which a first load can
  // measure a document that is still assembling itself.
  useEffect(() => {
    const refresh = () => ScrollTrigger.refresh()

    if (document.readyState !== 'complete') {
      window.addEventListener('load', refresh, { once: true })
    }
    document.fonts?.ready.then(refresh).catch(() => {})

    return () => window.removeEventListener('load', refresh)
  }, [])

  return (
    <>
      <Navbar />
      <SectionRevealController />
      {/* Holds the page open through the frame where neither route is mounted.
          Without it the footer flies up to meet the header and drops back. */}
      <main className="min-h-dvh">
        {/* Suspense sits ABOVE AnimatePresence, and the order is load-bearing.
            Nested the other way the two deadlock: AnimatePresence mounts the
            incoming page, that page suspends immediately on its route chunk,
            React discards the mount, and `mode="wait"` never receives the
            signal that the swap finished — so the outgoing page stays on
            screen indefinitely while the URL says otherwise. Every code-split
            route became unreachable by clicking, though a hard load was fine,
            because a hard load never asks AnimatePresence to swap anything.

            The cost is that a route whose chunk is not yet cached shows the
            fallback instead of animating out — for both pages, since one
            Suspense now covers the whole crossfade. That is the right way
            round: the flash lasts one chunk download and only the first time
            a visitor opens that route, and the alternative is navigation that
            does not work at all.

            `mode` and `exit` both switch when a property listing hands off to
            its detail page: `sync` keeps the outgoing card mounted while the
            incoming hero fades in over it instead of waiting for an exit, and
            the zero-duration exit stops the card from also playing its own
            fade underneath. The explicit `location` on Routes is what makes
            `sync` show two different pages at all — read from context instead,
            both instances would resolve to the new URL and render the same
            page twice. */}
        <Suspense fallback={<RouteFallback />}>
          <AnimatePresence mode={sharedPropertyTransition ? 'sync' : 'wait'} initial={false}>
            <motion.div
              key={location.pathname}
              initial={reduced ? false : PAGE.initial}
              animate={PAGE.animate}
              exit={
                sharedPropertyTransition
                  ? { opacity: 1, y: 0, transition: { duration: 0 } }
                  : reduced
                    ? { opacity: 0 }
                    : PAGE.exit
              }
              onAnimationComplete={onArrived}
            >
              <ScrollTop />
              <Routes location={location}>
                <Route path="/" element={<Home />} />
                <Route path="/about" element={<AboutPage />} />
                <Route path="/enterprise" element={<EnterprisePage />} />
                <Route path="/properties" element={<PropertiesPage />} />
                <Route path="/properties/:slug" element={<PropertyDetailPage />} />
                {/* The media set behind a listing — site plan, floor plans, rate
                    sheets, photography. Keyed by slug so further properties can
                    be added to `data/centroPlazaInfo` without a new route; a
                    slug with no set redirects back to its listing. */}
                <Route path="/properties/:slug/info" element={<PropertyInfoPage />} />
                <Route path="/news" element={<NewsPage />} />
                <Route path="/news/:slug" element={<NewsPostPage />} />
                <Route path="/learn" element={<LearnPage />} />
                <Route path="/learn/:slug" element={<LearnTermPage />} />
                <Route path="/contact" element={<ContactPage />} />

                {/* Legacy routes — pre-rename links keep working */}
                <Route path="/projects" element={<Navigate to="/properties" replace />} />
                <Route path="/projects/:slug" element={<RedirectSlug to="/properties" />} />
                <Route path="/blog" element={<Navigate to="/news" replace />} />
                <Route path="/blog/:slug" element={<RedirectSlug to="/news" />} />
                <Route path="*" element={<NotFoundPage />} />
              </Routes>
            </motion.div>
          </AnimatePresence>
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
