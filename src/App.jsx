import { useEffect } from 'react'
import { Routes, Route, useLocation } from 'react-router-dom'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { useSmoothScroll, lenis } from './hooks/useSmoothScroll'
import Navbar from './components/Navbar'
import Hero from './components/Hero'
import Marquee from './components/Marquee'
import About from './components/About'
import Projects from './components/Projects'
import Gallery from './components/Gallery'
import Testimonials from './components/Testimonials'
import Footer from './components/Footer'
import CinematicLayer from './components/CinematicLayer'
import AboutPage from './pages/AboutPage'
import ProjectsPage from './pages/ProjectsPage'
import ProjectDetailPage from './pages/ProjectDetailPage'
import ContactPage from './pages/ContactPage'
import BlogPage from './pages/BlogPage'
import BlogPostPage from './pages/BlogPostPage'
import LoginPage from './admin/LoginPage'
import RequireAuth from './admin/RequireAuth'
import AdminLayout from './admin/AdminLayout'
import DashboardPage from './admin/DashboardPage'
import ProjectsListPage from './admin/ProjectsListPage'
import ProjectEditPage from './admin/ProjectEditPage'
import ContentIndexPage from './admin/ContentIndexPage'
import ContentSectionPage from './admin/ContentSectionPage'
import LeadsPage from './admin/LeadsPage'
import BlogListPage from './admin/BlogListPage'
import BlogEditPage from './admin/BlogEditPage'

function Home() {
  return (
    <>
      <Hero />
      <Marquee />
      <About />
      <Projects />
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
          <Route path="/projects" element={<ProjectsPage />} />
          <Route path="/projects/:slug" element={<ProjectDetailPage />} />
          <Route path="/blog" element={<BlogPage />} />
          <Route path="/blog/:slug" element={<BlogPostPage />} />
          <Route path="/contact" element={<ContactPage />} />
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
        <Route path="projects" element={<ProjectsListPage />} />
        <Route path="projects/:id" element={<ProjectEditPage />} />
        <Route path="content" element={<ContentIndexPage />} />
        <Route path="content/:section" element={<ContentSectionPage />} />
        <Route path="blog" element={<BlogListPage />} />
        <Route path="blog/:id" element={<BlogEditPage />} />
        <Route path="leads" element={<LeadsPage />} />
      </Route>
      <Route path="/*" element={<PublicSite />} />
    </Routes>
  )
}

export default App
