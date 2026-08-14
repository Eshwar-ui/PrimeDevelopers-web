import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { api } from '../lib/api'
import { withTransformedImages } from '../lib/images'
import { useAuth } from './AuthContext'
import LogoLoader from '../components/LogoLoader'

// Fallback shape per section so a missing/not-yet-seeded row never crashes a
// component — every field a component reads is guaranteed to exist.
const DEFAULTS = {
  hero: { eyebrow: '', heading: '', paragraph: '', ctaLabel: 'View Properties', ctaHref: '#properties', slides: [] },
  marquee: { logos: [] },
  // The film ships with the app rather than being uploaded, so it lands here
  // as a default: the live content row predates these two keys, and a key the
  // row doesn't carry is exactly what the defaults are for. Setting either in
  // the admin still overrides it.
  about_home: {
    heading: '',
    paragraph1: '',
    videoUrl: '/about-video.mp4',
    videoPoster: '/about-poster.jpg',
    stats: [],
  },
  properties_home: { heading: '' },
  // Ships with its copy rather than waiting on a seed, for the same reason
  // about_home's film does: the live content row predates this key entirely, so
  // an empty default would hide the section until someone opened the admin.
  services_home: {
    eyebrow: 'Our Services',
    heading: 'Expert support across every stage of your property journey.',
    items: [
      {
        icon: 'compass',
        title: 'Expert Guidance',
        body: 'Personalized advice from experienced real estate professionals.',
      },
      {
        icon: 'map-pin',
        title: 'Premium Locations',
        body: 'Access to prime neighborhoods and sought-after developments.',
      },
      {
        icon: 'shield-check',
        title: 'Trusted Partners',
        body: 'Vetted vendors and partners for a seamless experience.',
      },
      { icon: 'clock', title: '24/7 Support', body: 'Responsive care whenever you need it.' },
    ],
  },
  // eyebrow/paragraph/features postdate the live row the same way services_home
  // does, so they carry their copy here; heading stays blank and comes from the
  // row, which has always had one.
  gallery: {
    heading: '',
    eyebrow: 'Curated Portfolio',
    paragraph:
      'Explore our collection of award-winning architectural designs, bespoke luxury interiors, and breath-taking coastal estates. Each space is custom-crafted to redefine modern premium living in Texas.',
    features: [{ title: 'High-End Modern Materials' }, { title: 'Bespoke Light Integration' }],
  },
  testimonials: {
    heading: 'What Our Clients Say',
    paragraph:
      'Real stories from homeowners and investors who have partnered with Prime to bring their vision to life.',
    items: [],
  },
  news_home: {
    heading: 'News & Insights',
    paragraph: 'Stay updated on the latest real estate trends and market insights.',
  },
  // No cta_home row exists yet, so this object is what the panel actually
  // renders — an empty `image` here meant the photo column never mounted and
  // the panel read as a bare slab of copy. Pointing it at a photo already in
  // storage is the same value the admin's uploader would write, so replacing it
  // from Content → Closing call to action → Panel image needs no code change.
  cta_home: {
    heading: 'Ready to Find Your Dream Property?',
    paragraph:
      "Whether you're looking for a luxury residence or a strategic investment opportunity, our team is here to guide you every step of the way.",
    ctaLabel: 'Get Started',
    ctaHref: '/contact',
    image:
      'https://knghxhtfkbswzhphhigy.supabase.co/storage/v1/object/public/images/site/property-1.png',
  },
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
  // No enterprise_page row exists and every field here was blank, so /enterprise
  // rendered a single band containing nothing but its own CTA button: an empty
  // <h1> above three sections that each hide themselves on an empty array. The
  // copy ships here for the same reason services_home's and cta_home's does — a
  // default is what stands in for a row that was never seeded, and every field
  // is still overridden the moment someone saves the section in the admin.
  //
  // `stats` stays empty deliberately. That section hides itself on an empty
  // array, and the figures it asks for — projects delivered, square footage,
  // years active — are claims about the business that only the business can
  // make. Inventing plausible ones would put fabricated numbers on a public
  // page. Same for `heroImage`: the block is conditional, so an unset one costs
  // nothing, where picking a photograph is a content decision.
  enterprise_page: {
    heroEyebrow: 'Expertise',
    heroHeading: 'Four ways to build with Prime',
    heroParagraph:
      'Development is where we started, not where we stop. Interiors, collaborations, franchise and investment each open a different door into the same practice — the same teams, the same standards, and one line of accountability from first drawing to handover.',
    heroImage: '',
    ctaLabel: 'Talk to us',
    ctaHref: '/contact',
    capabilitiesHeading: 'What we do',
    capabilities: [
      {
        title: 'Interiors',
        image: '/images/expertise/interiors.webp',
        body: 'Bespoke interior design and fit-out, handled in-house. The team that delivers the shell finishes the space, so specification, procurement and snagging answer to one contract rather than three — and the detail you were shown is the detail you get.',
      },
      {
        title: 'Collaborations',
        image: '/images/expertise/collaborations.webp',
        body: 'Joint development with landowners and partner developers. You bring the land or the capital; we bring entitlement, design and delivery, structured as a genuine partnership with terms agreed before a drawing is issued.',
      },
      {
        title: 'Franchise',
        image: '/images/expertise/franchise.webp',
        body: 'Operate under the Prime name in your own market. Partners take on our processes, supplier network and brand system with hands-on onboarding, held to the standards that earned the name in the first place.',
      },
      {
        title: 'Invest',
        image: '/images/expertise/invest.webp',
        body: 'Participate in our commercial and residential pipeline. Opportunities are presented with the whole picture — hold period, exit assumptions, and the risks set out beside the returns — so you can weigh them on the same terms we do.',
      },
    ],
    stats: [],
    closingHeading: 'Tell us which door you want to come through',
    closingLabel: 'Start a conversation',
    closingHref: '/contact',
  },
  // The live row predates every key below `heroParagraph`, so these ship as
  // defaults rather than waiting on a seed — same reason about_home's film and
  // services_home's copy do. `heroSlides` stays empty on purpose: the strip
  // falls back to the listings' own photographs, which is the right content
  // for a properties carousel and needs no upload.
  properties_page: {
    heroEyebrow: '',
    heroHeading: 'Explore Our Properties',
    heroParagraph:
      'Discover a curated collection of premium residential, retail, and commercial spaces across the heart of Texas.',
    ctaLabel: 'Browse Listings',
    ctaHref: '#collection',
    ctaSecondaryLabel: 'Schedule a Tour',
    ctaSecondaryHref: '/contact',
    heroSlides: [],
    curatedEyebrow: 'Featured Projects',
    curatedHeading: 'The Curated Collection',
    curatedParagraph:
      "Since 2017, Prime Developer has grown into one of Texas's most active real estate developers — owning and operating iconic commercial and residential properties in dynamic, fast-moving markets.",
  },
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
    // Image URLs are rewritten to Supabase's transformer here, at the one point
    // every image enters the app, rather than at each of the ~30 <img> sites.
    // The admin is deliberately excluded: it edits the stored URL, and handing
    // it a derived one would save the transformed URL back into the CMS.
    const transform = (data) => (isAdmin ? data : withTransformedImages(data))

    // Each response is applied the moment it lands rather than awaited together.
    // Under `Promise.all` the header and hero — which only need `/content` —
    // sat behind `/properties`, the slowest and largest of the three, for no
    // reason beyond the three having been requested in one statement.
    const settle = (promise, apply) => promise.then((data) => apply(transform(data)))

    return Promise.all([
      settle(api.get('/content'), setContent),
      settle(api.get(`${prefix}/properties`), setProperties),
      settle(api.get(`${prefix}/news`), setNews),
    ])
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
      // `/content` alone is what the shell needs — navbar, hero, footer. The
      // property and news lists feed sections further down, and every consumer
      // of them already renders nothing for an empty array, so holding the
      // whole page behind them bought a blank screen and nothing else.
      //
      // The admin still waits for all three: its lists are the entire point of
      // the screen, and flashing "no properties" at an editor mid-load reads as
      // data loss rather than as loading.
      ready: content !== null && (!isAdmin || (properties !== null && news !== null)),
      error,
      properties: properties ?? [],
      categories,
      getProperty: (slug) => (properties ?? []).find((p) => p.slug === slug),
      news: news ?? [],
      getNewsPost: (slug) => (news ?? []).find((p) => p.slug === slug),
      getSection,
      refetch: load,
    }
  }, [content, properties, news, error, load, isAdmin])

  if (error) {
    return (
      <div className="flex min-h-[100dvh] flex-col items-center justify-center gap-3 bg-void px-6 text-center text-bone">
        <p className="font-display text-xl">Couldn&apos;t load the site.</p>
        <p className="max-w-md font-body text-sm text-bone/60">{error.message}</p>
      </div>
    )
  }

  if (!value.ready) {
    return <LogoLoader />
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
