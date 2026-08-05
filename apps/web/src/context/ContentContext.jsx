import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { api } from '../lib/api'
import { withTransformedImages } from '../lib/images'
import { useAuth } from './AuthContext'

// Fallback shape per section so a missing/not-yet-seeded row never crashes a
// component — every field a component reads is guaranteed to exist.
const DEFAULTS = {
  hero: { eyebrow: '', heading: '', paragraph: '', ctaLabel: 'View Properties', ctaHref: '#properties', slides: [] },
  marquee: { eyebrow: '', logos: [] },
  about_home: { heading: '', paragraph1: '', paragraph2: '', ctaLabel: 'About Prime Developers', stats: [] },
  properties_home: { heading: '' },
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
    ctaLabel: 'Explore our properties',
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
  properties_page: { heroEyebrow: '', heroHeading: '', heroParagraph: '' },
  news_page: { heroEyebrow: '', heroHeading: '', heroParagraph: '' },
}

const ContentContext = createContext(null)

export function ContentProvider({ children }) {
  const { session, loading: authLoading } = useAuth()
  const [content, setContent] = useState(null)
  const [properties, setProperties] = useState(null)
  const [news, setNews] = useState(null)
  const [error, setError] = useState(null)

  // Signed-in admins read the admin endpoints, which include unpublished
  // drafts; everyone else reads the public ones, which don't. Under Supabase
  // this distinction was invisible — the same query returned different rows
  // depending on the caller's RLS role. Making it explicit is the point: the
  // admin list would otherwise silently lose its drafts, leaving unpublished
  // properties uneditable.
  const isAdmin = Boolean(session)

  const load = useCallback(async () => {
    const prefix = isAdmin ? '/admin' : ''
    const [contentRes, propertiesRes, newsRes] = await Promise.all([
      api.get('/content'),
      api.get(`${prefix}/properties`),
      api.get(`${prefix}/news`),
    ])
    // Image URLs are rewritten to Supabase's transformer here, at the one point
    // every image enters the app, rather than at each of the ~30 <img> sites.
    // The admin is deliberately excluded: it edits the stored URL, and handing
    // it a derived one would save the transformed URL back into the CMS.
    const transform = (data) => (isAdmin ? data : withTransformedImages(data))

    setContent(transform(contentRes))
    setProperties(transform(propertiesRes))
    setNews(transform(newsRes))
  }, [isAdmin])

  useEffect(() => {
    // Wait for auth to resolve first. Loading as anonymous and then reloading
    // as admin would flash a draft-less list and double every request on the
    // one page that cares.
    if (authLoading) return
    setError(null)
    load().catch((err) => setError(err))
  }, [load, authLoading])

  const value = useMemo(() => {
    const getSection = (section) => ({ ...DEFAULTS[section], ...(content?.[section] ?? {}) })
    const categories = ['All', ...new Set((properties ?? []).map((p) => p.category))]
    return {
      ready: content !== null && properties !== null && news !== null,
      error,
      properties: properties ?? [],
      categories,
      getProperty: (slug) => (properties ?? []).find((p) => p.slug === slug),
      news: news ?? [],
      getNewsPost: (slug) => (news ?? []).find((p) => p.slug === slug),
      getSection,
      refetch: load,
    }
  }, [content, properties, news, error, load])

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
export const useProperties = () => useContentContext().properties
export const useCategories = () => useContentContext().categories
export const useProperty = (slug) => useContentContext().getProperty(slug)
export const useNews = () => useContentContext().news
export const useNewsPost = (slug) => useContentContext().getNewsPost(slug)
export const useContentRefetch = () => useContentContext().refetch
