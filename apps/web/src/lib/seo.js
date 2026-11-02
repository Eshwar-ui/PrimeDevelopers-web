/**
 * What every fixed public route says about itself, in one table.
 *
 * Three things read it and must agree: the pages themselves (through
 * useHead), the sitemap generator and the prerenderer (both under scripts/).
 * A title written into a component is invisible to the other two, which is
 * how a site ends up with a sitemap listing pages whose <title> nobody ever
 * set — so new fixed routes belong here rather than in the page.
 *
 * Routes with a `:slug` are absent on purpose. Their copy belongs to the
 * record being shown, not to the route, so those pages build their own spec
 * from the property, post or term they loaded.
 *
 * Deliberately importing nothing: scripts/seo-assets.mjs and
 * scripts/prerender.mjs load this file directly under plain node, where
 * anything reaching `import.meta.env` would throw.
 */

/**
 * Singular, with "The". Never "Prime Developers" — that spelling is still in
 * some CMS copy and in the old 2023 site, and the two competing in search for
 * the same firm is exactly what a brand name in a title tag is for.
 *
 * `lib/site` re-exports this as BRAND_NAME, which is what the app imports.
 * It lives here because this module is the one both the app and the build
 * scripts can read.
 */
export const BRAND = 'The Prime Developer'

/** `${page} | ${BRAND}`, unless the route states a title that stands alone. */
export const brandedTitle = (title, exact = false) => (exact ? title : `${title} | ${BRAND}`)

/**
 * Descriptions run to about 155 characters, which is roughly where Google
 * truncates on a desktop result. They describe what is on the page rather
 * than what the firm would like the reader to feel: a description is a
 * promise about the content, and the click that bounces costs more than the
 * click never made.
 *
 * `priority` is a hint about this site's own shape, not a ranking lever —
 * listings earn more crawl attention than the legal pages.
 */
export const STATIC_ROUTES = [
  {
    // Led by the category rather than by "commercial real estate developer".
    // The keyword work puts the homepage against branded queries only — the
    // category terms each have a page of their own to win — but the brand is
    // in the title either way, and the words in front of it may as well be the
    // ones the inventory is actually searched for. Office warehouse and flex
    // space are the two largest clusters on the list by some distance.
    //
    // 57 characters once the brand is appended, which is inside where Google
    // truncates. Lengthen it and "The Prime Developer" is the part that falls
    // off the end.
    path: '/',
    title: 'Texas Office Warehouse & Flex Space',
    titleExact: false,
    description:
      'Office warehouse condos, flex space, retail and one-acre lots for sale in Leander, Lewisville and Liberty Hill. One team from acquisition to handover.',
    priority: '1.0',
  },
  {
    path: '/about',
    title: 'About the Firm',
    description:
      'A Texas real estate developer since 2017, owning and operating commercial and residential property from land acquisition through design to sale.',
    priority: '0.6',
  },
  {
    path: '/properties',
    title: 'Properties for Lease and Sale in Texas',
    description:
      'Browse retail, office, flex and land listings across the Texas market, with availability, floor plans and unit-level detail on every development.',
    priority: '0.9',
  },
  {
    path: '/enterprise',
    title: 'Four Ways to Build with Prime',
    description:
      'Interiors, collaborations, franchise and investment — four ways to work with the same teams and the same standards, each with its own enquiry route.',
    priority: '0.7',
  },
  {
    path: '/enterprise/interiors',
    title: 'Interior Finishes and Pricing',
    description:
      'Compare interior finish options by tier, category and price per square foot, and choose a specification that suits your unit before handover.',
    priority: '0.6',
  },
  {
    path: '/enterprise/interiors/gallery',
    title: 'Finished Spaces Gallery',
    description:
      'Real units finished with our interior options, filtered by property and tier, each showing the specification used in the space.',
    priority: '0.4',
  },
  {
    path: '/enterprise/franchise',
    title: 'Franchise Opportunities in Texas Retail',
    description:
      'Established franchise concepts and first-time operators in high-traffic mixed-use retail, food and beverage, and service locations across Texas.',
    priority: '0.6',
  },
  {
    path: '/enterprise/collab',
    title: 'Collab — Co-Own and Co-Operate a Business',
    description:
      'A joint venture model: The Prime Developer co-owns and co-operates the business alongside an operating partner, sharing the risk and the upside.',
    priority: '0.6',
  },
  {
    path: '/enterprise/invest',
    title: 'Invest — Planning Equity and CAP / NNN',
    description:
      'Two ways to put capital to work: planning-phase equity in new development, and stabilized CAP / NNN property that is already producing income.',
    priority: '0.7',
  },
  {
    path: '/cap-properties',
    title: 'CAP and NNN Property Listings',
    description:
      'Income-producing property structured for CAP / NNN investment, where the tenant covers taxes, insurance and maintenance. Filter by current availability.',
    priority: '0.8',
  },
  {
    path: '/news',
    title: 'News and Notes from the Field',
    description: 'Property milestones, market notes and updates from our team across Texas.',
    priority: '0.5',
  },
  {
    path: '/learn',
    title: 'Real Estate Terms, Explained Clearly',
    description:
      'A practical guide to the terms you meet while comparing property, leases and investments — cap rate, NNN, CAM charges, clear height and more.',
    priority: '0.6',
  },
  {
    // Kept verbatim from the hand-written head this route already carried, so
    // the page does not change what it says in search on the day it moves
    // onto the shared primitive.
    path: '/faq',
    title: 'FAQ — Leasing, Buying and Investing in Texas Property',
    titleExact: true,
    description:
      'Answers on leasing, buying and investing in Texas property — availability, tours, brochures, cap rates, land collaborations and franchise partnerships.',
    priority: '0.6',
  },
  {
    path: '/contact',
    title: 'Contact the Team',
    description:
      'Ask about availability, book a site tour, or open a conversation about an investment or partnership. We answer enquiries across the Texas market.',
    priority: '0.7',
  },
  {
    path: '/privacy',
    title: 'Privacy Policy',
    description:
      'What this site collects when you use it, why it is collected, and the rights you can exercise under the Texas Data Privacy and Security Act.',
    priority: '0.2',
  },
  {
    path: '/terms',
    title: 'Terms of Use',
    description:
      'The rules for using this website, and the limits of what the listings, renderings and prices shown on it actually mean.',
    priority: '0.2',
  },
]

const BY_PATH = new Map(STATIC_ROUTES.map((route) => [route.path, route]))

/**
 * The head spec for a fixed route, or undefined for one not in the table.
 *
 * Returns the spec rather than applying it, so the prerenderer can ask for
 * the same object the running page would have built.
 */
export function staticHead(path) {
  const route = BY_PATH.get(path)
  if (!route) return undefined
  return {
    path: route.path,
    title: brandedTitle(route.title, route.titleExact),
    description: route.description,
  }
}

/**
 * Fills in the parts of a spec that depend on where the page is being served
 * from rather than on what is on it: the brand, the absolute canonical, and
 * whether this copy of the site may be indexed.
 *
 * useHead and the prerenderer both call it, which is what keeps the tags a
 * scraper is served and the tags a browser ends up with identical. They differ
 * only in how they learn those two facts — the app reads the hostname it is
 * running on, the build is told the target origin on the command line.
 *
 * A spec that states its own `canonical` or `robots` keeps them: the 404 is
 * `noindex` wherever it is served.
 */
export function resolveHead(spec, { origin, robots } = {}) {
  if (!spec) return undefined
  const { path, ...rest } = spec
  return {
    siteName: BRAND,
    ...rest,
    canonical: rest.canonical ?? (path && origin ? `${origin}${path}` : undefined),
    robots: rest.robots ?? robots,
  }
}

/** The robots line for an indexable page; staging copies override it. */
export const INDEXABLE = 'index, follow, max-image-preview:large'

/**
 * The head a property page describes itself with, from its own `detail.seo`
 * and its record for anything that block leaves unsaid.
 *
 * Lives here, not in usePropertyHead, because the prerenderer has to produce
 * exactly these tags for the same property while running under node, hours
 * before any browser sees the page. Two implementations of "what does a
 * property page call itself" would disagree the first time either changed,
 * and the disagreement would be invisible: the scraper reads one, the
 * visitor's browser the other.
 *
 * JSON-LD is not built here. It is the caller's to add — the page attaches
 * the full graph, while the prerenderer deliberately skips it, since the
 * crawlers that cannot run JavaScript are the social scrapers, and none of
 * them reads JSON-LD.
 */
export function propertyHead(property) {
  if (!property?.slug) return undefined
  const detail = property.detail ?? {}
  const seo = detail.seo ?? {}
  const title = seo.title || brandedTitle(property.name)
  const description = seo.description || detail.tagline || ''

  return {
    path: `/properties/${property.slug}`,
    title,
    description,
    ogTitle: seo.ogTitle,
    ogDescription: seo.ogDescription,
    twitterDescription: seo.twitterDescription,
    // `detail.covers.detailHero` is the hero placement — the same expression
    // coverImage() in lib/covers resolves, inlined so this module can stay
    // free of imports and run under plain node.
    image: seo.ogImage || detail.covers?.detailHero || property.image || undefined,
    // Only a purpose-made card has known dimensions; a hero photograph
    // reused as one does not.
    imageSized: Boolean(seo.ogImage),
    imageAlt: seo.ogImageAlt || seo.heroAlt || property.name,
    extraMeta: {
      'geo.region': seo.geoRegion,
      'geo.placename': seo.geoPlacename,
      // Numbers, never strings — a quoted coordinate drops the tag silently.
      'geo.position':
        Number.isFinite(seo.latitude) && Number.isFinite(seo.longitude)
          ? `${seo.latitude};${seo.longitude}`
          : undefined,
    },
  }
}

/** The same, for one journal post. */
export function newsHead(post) {
  if (!post?.slug) return undefined
  return {
    path: `/news/${post.slug}`,
    title: brandedTitle(plainText(post.title)),
    description: plainText(post.excerpt) || undefined,
    type: 'article',
    image: post.coverImage || undefined,
    imageAlt: plainText(post.title),
  }
}

/**
 * Headings come out of the CMS carrying the site's own emphasis markup —
 * `We build the *landmarks* of Texas` renders the starred word in the accent
 * colour. A title tag has no accent colour, only the asterisks, so anything
 * quoting CMS copy into the head runs it through this first.
 */
export const plainText = (value) => String(value ?? '').replace(/\*/g, '').replace(/\s+/g, ' ').trim()
