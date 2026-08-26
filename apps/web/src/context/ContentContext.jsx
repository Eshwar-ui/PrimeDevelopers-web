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
    // `eyebrow` postdates the live row, so it carries its copy here for the
    // same reason the film does — an empty default would leave the section's
    // kicker missing until someone opened the admin.
    eyebrow: 'Our Partners',
    heading: '',
    paragraph1: '',
    videoUrl: '/about-video.mp4',
    videoPoster: '/about-poster.jpg',
    stats: [],
  },
  properties_home: { heading: '' },
  // The one property lifted out of the list into a panel of its own. Ships with
  // its copy so the section renders before anyone has touched the admin; blank
  // the heading there and the whole panel hides itself, which is how the client
  // switches the feature off between developments.
  featured_home: {
    eyebrow: 'Featured Property',
    // *asterisks* mark the saffron half — the property's own name.
    heading: 'Grow Your Business at\n*Centro Plaza*',
    subheading: 'Premium Commercial Spaces in a *Prime Location.*',
    paragraph:
      'Discover modern retail and office spaces designed for visibility, accessibility, and long-term business growth. Secure your space at Centro Plaza today.',
    ctaLabel: 'Explore Property',
    ctaHref: '/properties/centro-plaza',
    secondaryLabel: 'Schedule a Visit',
    secondaryHref: '/contact',
    image: '',
    imageAlt: '',
  },
  // Ships with its copy rather than waiting on a seed, for the same reason
  // about_home's film does: the live content row predates this key entirely, so
  // an empty default would hide the section until someone opened the admin.
  // The items carry `image` and `href` now rather than `icon` and `body`. The
  // section became four photographs with a name under each, so the icon name
  // has nothing to render and the body copy has nowhere to sit. Old rows still
  // merge cleanly — an `icon` the component no longer reads is simply ignored,
  // and a missing `image` falls back to a branded tile rather than a hole.
  services_home: {
    eyebrow: 'Our Services',
    heading: 'More Ways to Build, Grow & Invest',
    paragraph:
      'From transforming spaces to building partnerships and investment opportunities, we offer flexible ways to create long-term value together.',
    items: [
      { title: 'Interiors', image: '', href: '/enterprise' },
      { title: 'Collaborations', image: '', href: '/enterprise' },
      { title: 'Franchise', image: '', href: '/enterprise' },
      { title: 'Invest', image: '', href: '/contact' },
    ],
  },
  academy: {
    heading: 'Real estate, explained clearly.',
    paragraph: 'A practical guide to the terms you will hear while comparing properties, leases, and investment opportunities.',
    terms: [
      {
        slug: 'flex-space', term: 'Flex Space', category: 'Property types', videoUrl: '',
        shortDefinition: 'A property combining warehouse, showroom, office, or light-production space in one adaptable unit.',
        explanation: 'Flex space supports more than one business function under the same roof. The mix can change by tenant, making it useful for companies that need an office in front and storage, assembly, or distribution space behind it.',
        example: 'A contractor leases one unit with offices for the project team, a customer showroom, and warehouse space for equipment and materials.',
        whyItMatters: 'The office-to-warehouse mix affects rent, operating efficiency, loading access, and how easily the unit can adapt as the business changes.',
        related: 'parking-ratio, nnn-lease',
      },
      {
        slug: 'nnn-lease', term: 'NNN Lease', category: 'Leasing', videoUrl: '',
        shortDefinition: 'A triple-net lease where the tenant pays base rent plus its share of property taxes, insurance, and common-area expenses.',
        explanation: 'NNN refers to three expense categories commonly passed through to tenants: real-estate taxes, building insurance, and maintenance or common-area costs. The lease defines what is included and how the tenant share is calculated.',
        example: 'A suite is advertised at a base rent, with an additional estimated NNN charge per square foot covering the tenant’s allocated operating expenses.',
        whyItMatters: 'Base rent alone can understate total occupancy cost. Ask for the current estimate, historical expenses, reconciliation process, and any caps or exclusions.',
        related: 'flex-space, parking-ratio',
      },
      {
        slug: 'parking-ratio', term: 'Parking Ratio', category: 'Property metrics', videoUrl: '',
        shortDefinition: 'The number of parking spaces available relative to building area, commonly stated per 1,000 square feet.',
        explanation: 'A parking ratio of 4:1,000 means four spaces for every 1,000 square feet of building area. The useful ratio depends on property type, local requirements, employee density, customer traffic, and whether spaces are shared or reserved.',
        example: 'A 10,000-square-foot office with a 4:1,000 ratio is associated with approximately 40 spaces, subject to the lease and site plan.',
        whyItMatters: 'A space can fit the business physically but still fail operationally if employees, customers, or fleet vehicles cannot park reliably.',
        related: 'flex-space, nnn-lease',
      },
    ],
  },  // eyebrow/paragraph/features postdate the live row the same way services_home
  // does, so they carry their copy here; heading stays blank and comes from the
  // row, which has always had one.
  // `features` is no longer read — the section is a photographic mosaic now,
  // not a spec list. Left in the shape so an existing row carrying it still
  // merges without complaint.
  gallery: {
    heading: 'Explore Our Properties',
    eyebrow: 'Curated Portfolio',
    paragraph:
      'Discover our portfolio of commercial spaces, retail destinations, and thoughtfully developed properties designed for long-term value and business growth.',
    ctaLabel: 'See more projects',
    features: [],
  },
  testimonials: {
    eyebrow: 'Testimonials',
    heading: 'Trusted by Property Owners & Investors',
    paragraph:
      'Real stories from the owners, tenants and investors who have built with Prime across Central Texas.',
    items: [],
  },
  // Still keyed `news_home` because the live row under that name already holds
  // this section's heading and paragraph, and renaming the key would strand
  // them. What the section shows has widened: journal posts merge with `items`,
  // which are social posts an admin has pointed at by URL.
  news_home: {
    heading: 'Latest from Prime',
    paragraph:
      'Site progress, leasing news and open days — from our journal and across our channels.',
    items: [],
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

  // Two timers, both governing the splash and neither faking progress.
  //
  // `minimumElapsed` is a floor, not a delay: on a warm API the content lands in
  // a few hundred milliseconds, and a splash that appears and vanishes inside
  // that reads as a flicker rather than as an entrance. 1.2s is long enough for
  // the mark to resolve once.
  //
  // `slowStart` is the ceiling nobody can control. The API sleeps when idle, so
  // the first visit after a quiet spell waits on a cold start that can run past
  // half a minute. There is no percentage to show — the server either answers or
  // it does not — so at six seconds the screen stops looking broken and says
  // what it is waiting for instead.
  //
  // Timers rather than rAF, deliberately: rAF does not fire in a tab that is not
  // rendering, which would leave a backgrounded first visit stuck on the splash
  // until it was focused (DESIGN.md §9).
  const [minimumElapsed, setMinimumElapsed] = useState(false)
  const [slowStart, setSlowStart] = useState(false)

  useEffect(() => {
    const floor = setTimeout(() => setMinimumElapsed(true), 1200)
    const slow = setTimeout(() => setSlowStart(true), 6000)
    return () => {
      clearTimeout(floor)
      clearTimeout(slow)
    }
  }, [])

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

  if (!value.ready || !minimumElapsed) {
    return (
      <LogoLoader
        hint={
          slowStart
            ? 'Waking the server — the first visit after a quiet spell takes a moment.'
            : null
        }
      />
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
export const useAcademyTerms = () => useContentContext().getSection('academy').terms ?? []
export const useContentRefetch = () => useContentContext().refetch
