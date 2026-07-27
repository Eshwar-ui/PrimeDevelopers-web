import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'

// Fallback shape per section so a missing/not-yet-seeded row never crashes a
// component — every field a component reads is guaranteed to exist.
const DEFAULTS = {
  hero: { eyebrow: '', heading: '', paragraph: '', ctaLabel: 'View Projects', ctaHref: '#projects', slides: [] },
  marquee: { eyebrow: '', logos: [] },
  about_home: { heading: '', paragraph1: '', paragraph2: '', ctaLabel: 'About Prime Developers', stats: [] },
  projects_home: { heading: '' },
  gallery: { heading: '' },
  testimonials: { items: [] },
  footer: {
    email: '',
    phone: '',
    studio: '',
    ctaHeading: '',
    quickLinks: [],
    socials: [],
    copyrightLeft: '',
    copyrightRight: '',
  },
  navbar: { links: [] },
  about_page: {
    heroEyebrow: '',
    heroHeading: '',
    heroParagraph: '',
    heroImage: '',
    firmHeading: '',
    firmParagraph1: '',
    firmParagraph2: '',
    ctaLabel: 'Explore our projects',
    stats: [],
    principles: [],
    founders: [],
    foundersClosing: '',
    closingHeading: '',
    closingImage: '',
  },
  contact_page: {
    heroEyebrow: '',
    heroHeading: '',
    heroParagraph: '',
    email: '',
    phone: '',
    location: '',
    socials: [],
  },
  projects_page: { heroEyebrow: '', heroHeading: '', heroParagraph: '' },
  blog_page: { heroEyebrow: '', heroHeading: '', heroParagraph: '' },
}

const ContentContext = createContext(null)

export function ContentProvider({ children }) {
  const [content, setContent] = useState(null)
  const [projects, setProjects] = useState(null)
  const [posts, setPosts] = useState(null)
  const [error, setError] = useState(null)

  const load = useCallback(async () => {
    const [contentRes, projectsRes, postsRes] = await Promise.all([
      supabase.from('content').select('section, data'),
      supabase.from('projects').select('*').order('sort_order', { ascending: true }),
      supabase.from('blog_posts').select('*').order('sort_order', { ascending: true }),
    ])
    if (contentRes.error) throw contentRes.error
    if (projectsRes.error) throw projectsRes.error
    if (postsRes.error) throw postsRes.error

    const bySection = {}
    for (const row of contentRes.data) bySection[row.section] = row.data
    setContent(bySection)
    setProjects(projectsRes.data)
    setPosts(postsRes.data)
  }, [])

  useEffect(() => {
    load().catch((err) => setError(err))
  }, [load])

  const value = useMemo(() => {
    const getSection = (section) => ({ ...DEFAULTS[section], ...(content?.[section] ?? {}) })
    const categories = ['All', ...new Set((projects ?? []).map((p) => p.category))]
    return {
      ready: content !== null && projects !== null && posts !== null,
      error,
      projects: projects ?? [],
      categories,
      getProject: (slug) => (projects ?? []).find((p) => p.slug === slug),
      posts: posts ?? [],
      getPost: (slug) => (posts ?? []).find((p) => p.slug === slug),
      getSection,
      refetch: load,
    }
  }, [content, projects, posts, error, load])

  if (error) {
    return (
      <div className="flex min-h-[100dvh] flex-col items-center justify-center gap-3 bg-void px-6 text-center text-bone">
        <p className="font-display text-xl">Couldn&apos;t load the site.</p>
        <p className="max-w-md font-body text-sm text-bone/60">{error.message}</p>
      </div>
    )
  }

  if (!value.ready) {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center bg-void">
        <span className="h-8 w-8 animate-spin rounded-full border-2 border-bone/20 border-t-ember" />
      </div>
    )
  }

  return <ContentContext.Provider value={value}>{children}</ContentContext.Provider>
}

function useContentContext() {
  const ctx = useContext(ContentContext)
  if (!ctx) throw new Error('useContent* hooks must be used within <ContentProvider>')
  return ctx
}

export const useSection = (section) => useContentContext().getSection(section)
export const useProjects = () => useContentContext().projects
export const useCategories = () => useContentContext().categories
export const useProject = (slug) => useContentContext().getProject(slug)
export const useBlogPosts = () => useContentContext().posts
export const useBlogPost = (slug) => useContentContext().getPost(slug)
export const useContentRefetch = () => useContentContext().refetch
