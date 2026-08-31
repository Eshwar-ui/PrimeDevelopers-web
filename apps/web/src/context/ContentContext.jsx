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
  properties_home: {
    heading: '',
    unitsLabel: 'units',
    viewLabel: 'View property',
    brochureLabel: 'Download brochure',
  },
  brochure_modal: {
    eyebrow: 'Property brochure',
    // `{name}` is substituted with the property's own name at render time.
    heading: 'Receive {name} by email',
    paragraph: "Share your details and we'll send the brochure directly to your inbox.",
    namePlaceholder: 'Full name',
    emailPlaceholder: 'Email address',
    phonePlaceholder: 'Phone number',
    sendingLabel: 'Sending…',
    submitLabel: 'Email brochure',
    errorMessage: "We couldn't send the brochure. Please check your details and try again.",
    successHeading: 'Check your inbox',
    successBody: 'The {name} brochure has been sent to your email.',
    // Shown when the request was recorded but no brochure actually went
    // out — email not configured, no brochure on file, or the send failed.
    // Promising an inbox delivery that never happens is worse than saying
    // a person will follow up.
    receivedHeading: 'Request received',
    receivedBody: 'Thanks — our team will send the {name} brochure across shortly.',
    doneLabel: 'Done',
  },
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
      { title: 'Interiors', image: '', href: '/enterprise/interiors' },
      { title: 'Collaborations', image: '', href: '/enterprise/collab' },
      { title: 'Franchise', image: '', href: '/enterprise/franchise' },
      { title: 'Invest', image: '', href: '/enterprise/invest' },
    ],
  },
  academy: {
    heading: 'Real estate, explained clearly.',
    paragraph: 'A practical guide to the terms you will hear while comparing properties, leases, and investment opportunities.',
    exploreLinkLabel: 'Explore the field guide',
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
    scrollLabel: 'Scroll to explore',
    // Distinct from `paragraph` above — this sits in the "follow strip" at the
    // bottom of the section, next to the social links, not under the heading.
    followText: 'Follow along for site progress, leasing news and open days.',
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
    quickLinksHeading: 'Quick links',
    portfolioHeading: 'Portfolio',
    socialHeading: 'Social',
    allPropertiesLabel: 'All properties',
  },
  navbar: {
    links: [],
    // Used at both the desktop and mobile nav's CTA button.
    enquireLabel: 'Enquire',
    whatsappMessage: "Hi, I'd like to join the Prime Developer WhatsApp group.",
    whatsappDialogHeading: 'Stay updated on WhatsApp',
    whatsappDialogParagraph:
      'Join the updates group for the latest property announcements, project updates, and news from Prime Developer. Prefer a private conversation? You can chat directly with our team.',
    whatsappJoinLabel: 'Join the updates group',
    whatsappChatLabel: 'Chat with our team',
  },
  // The map itself is decorative (Footer.jsx), keyed by city so a property's
  // address resolves to a marker. A city missing from this list silently gets
  // no marker at all, so it's seeded with every city currently in use.
  texas_map: {
    cities: [
      { name: 'Lewisville', lat: 33.0462, lon: -96.9942 },
      { name: 'Leander', lat: 30.5788, lon: -97.8531 },
      { name: 'Cedar Park', lat: 30.5052, lon: -97.8203 },
      { name: 'Liberty Hill', lat: 30.6649, lon: -97.9225 },
      { name: 'Austin', lat: 30.2672, lon: -97.7431 },
      { name: 'Georgetown', lat: 30.6333, lon: -97.6779 },
      { name: 'Round Rock', lat: 30.5083, lon: -97.6789 },
      { name: 'Pflugerville', lat: 30.4394, lon: -97.62 },
      { name: 'Hutto', lat: 30.5427, lon: -97.5467 },
      { name: 'Taylor', lat: 30.571, lon: -97.4092 },
      { name: 'Kyle', lat: 29.9891, lon: -97.8772 },
      { name: 'Buda', lat: 30.0855, lon: -97.8403 },
      { name: 'San Marcos', lat: 29.8833, lon: -97.9414 },
      { name: 'Frisco', lat: 33.1507, lon: -96.8236 },
      { name: 'Anna', lat: 33.3487, lon: -96.5486 },
      { name: 'Plano', lat: 33.0198, lon: -96.6989 },
      { name: 'McKinney', lat: 33.1972, lon: -96.6389 },
      { name: 'Denton', lat: 33.2148, lon: -97.1331 },
      { name: 'Dallas', lat: 32.7767, lon: -96.797 },
      { name: 'Fort Worth', lat: 32.7555, lon: -97.3308 },
      { name: 'Houston', lat: 29.7604, lon: -95.3698 },
      { name: 'San Antonio', lat: 29.4241, lon: -98.4936 },
      { name: 'Waco', lat: 31.5493, lon: -97.1467 },
    ],
  },
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
    heroEyebrow: "We're here to help",
    heroHeading: "Let's Build Something Great Together",
    heroParagraph:
      'Have a property question, investment opportunity, or project in mind? Our team is ready to help you find the right path forward.',
    heroSubheading: 'Start a Conversation',
    email: '',
    phone: '',
    location: '',
    socials: [],
    formEyebrow: 'Send us a message',
    formHeading: "Tell Us What You're Looking For",
    formParagraph:
      'Have a question or opportunity to discuss? Send us a message and our team will get back to you.',
    mapEyebrow: 'Find us in Texas',
    mapHeading: "We're here to serve across Texas",
    mapParagraph: 'Serving investors, businesses and property owners across the Texas market.',
    mapQuery: 'Texas, USA',
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
    capabilitiesSubheading: 'Each service has its own team, process and direct enquiry route.',
    practiceLabel: 'Our practice',
    capabilities: [
      {
        title: 'Interiors',
        image: '/images/expertise/interiors.webp',
        body: 'Bespoke interior design and fit-out, handled in-house. The team that delivers the shell finishes the space, so specification, procurement and snagging answer to one contract rather than three — and the detail you were shown is the detail you get.',
        href: '/enterprise/interiors',
      },
      {
        title: 'Collaborations',
        image: '/images/expertise/collaborations.webp',
        body: 'Joint development with landowners and partner developers. You bring the land or the capital; we bring entitlement, design and delivery, structured as a genuine partnership with terms agreed before a drawing is issued.',
        href: '/enterprise/collab',
      },
      {
        title: 'Franchise',
        image: '/images/expertise/franchise.webp',
        body: 'Operate under the Prime name in your own market. Partners take on our processes, supplier network and brand system with hands-on onboarding, held to the standards that earned the name in the first place.',
        href: '/enterprise/franchise',
      },
      {
        title: 'Invest',
        image: '/images/expertise/invest.webp',
        body: 'Participate in our commercial and residential pipeline. Opportunities are presented with the whole picture — hold period, exit assumptions, and the risks set out beside the returns — so you can weigh them on the same terms we do.',
        href: '/enterprise/invest',
      },
    ],
    stats: [],
    closingHeading: 'Tell us which door you want to come through',
    closingLabel: 'Start a conversation',
    closingHref: '/contact',
  },
  // The Interiors catalog — /enterprise/interiors and its typology detail
  // pages. Ships with a handful of realistic seed options per tier, the same
  // way `academy` ships with 3 seed terms rather than a full glossary: enough
  // for the template to render correctly, with the rest added by the admin
  // once real photography and pricing exist.
  interiors_page: {
    heading: 'Finish your space, your way',
    paragraph:
      'Three tiers of interior finish-outs, priced per square foot and ready to compare. Browse by tier, see real examples, and fold a finish package into your unit enquiry.',
    options: [
      {
        slug: 'polished-concrete-warm-gray',
        tier: 'Basic',
        name: 'Polished Concrete — Warm Gray',
        category: 'Flooring',
        pricePerSqft: '4.50',
        thumbnail: '/images/expertise/interiors.webp',
        beforeImage: '',
        heroImage: '/images/expertise/interiors.webp',
        images: [],
        description:
          'A ground-and-sealed concrete slab finished to a warm gray tone. Durable, low-maintenance, and suited to retail and light-industrial units that see heavy foot or cart traffic.',
        videoUrl: '',
        specs: [
          { label: 'Material', value: 'Sealed polished concrete' },
          { label: 'Maintenance', value: 'Dust-mop and damp-mop; reseal every 3–5 years' },
        ],
      },
      {
        slug: 'painted-drywall-bright-white',
        tier: 'Basic',
        name: 'Painted Drywall — Bright White',
        category: 'Wall finish',
        pricePerSqft: '2.25',
        thumbnail: '/images/expertise/interiors.webp',
        beforeImage: '',
        heroImage: '/images/expertise/interiors.webp',
        images: [],
        description:
          'Taped, floated and painted drywall in a bright, neutral white. The standard base finish for a unit that will carry its own branding or signage.',
        videoUrl: '',
        specs: [
          { label: 'Material', value: 'Level-4 finish drywall, eggshell paint' },
          { label: 'Maintenance', value: 'Wipe-clean; touch-up paint as needed' },
        ],
      },
      {
        slug: 'luxury-vinyl-plank-natural-oak',
        tier: 'Mid-range',
        name: 'Luxury Vinyl Plank — Natural Oak',
        category: 'Flooring',
        pricePerSqft: '7.80',
        thumbnail: '/images/expertise/interiors.webp',
        beforeImage: '',
        heroImage: '/images/expertise/interiors.webp',
        images: [],
        description:
          'A wood-look waterproof vinyl plank in a natural oak tone. Warmer underfoot than concrete or tile, with the durability to suit office and showroom space.',
        videoUrl: '',
        specs: [
          { label: 'Material', value: 'Rigid-core luxury vinyl plank, 20 mil wear layer' },
          { label: 'Maintenance', value: 'Sweep and damp-mop; no refinishing required' },
        ],
      },
      {
        slug: 'acoustic-ceiling-standard-grid',
        tier: 'Mid-range',
        name: 'Suspended Acoustic Ceiling — Standard Grid',
        category: 'Ceiling',
        pricePerSqft: '5.20',
        thumbnail: '/images/expertise/interiors.webp',
        beforeImage: '',
        heroImage: '/images/expertise/interiors.webp',
        images: [],
        description:
          'A standard 2×2 suspended grid with acoustic tile, concealing mechanical and electrical runs while damping sound between adjoining suites.',
        videoUrl: '',
        specs: [
          { label: 'Material', value: '2×2 mineral-fiber acoustic tile, white grid' },
          { label: 'Maintenance', value: 'Replace individual tiles as needed' },
        ],
      },
      {
        slug: 'engineered-hardwood-walnut',
        tier: 'High-end',
        name: 'Engineered Hardwood — Wide Plank Walnut',
        category: 'Flooring',
        pricePerSqft: '16.75',
        thumbnail: '/images/expertise/interiors.webp',
        beforeImage: '',
        heroImage: '/images/expertise/interiors.webp',
        images: [],
        description:
          'Wide-plank engineered walnut with a low-sheen finish, for a flagship retail floor, private office, or reception area where the flooring itself is part of the brand.',
        videoUrl: '',
        specs: [
          { label: 'Material', value: 'Engineered walnut, 7.5" plank, matte finish' },
          { label: 'Maintenance', value: 'Sweep and dry-mop; avoid standing water' },
        ],
      },
      {
        slug: 'glass-storefront-partition',
        tier: 'High-end',
        name: 'Glass Storefront Partition System',
        category: 'Fixtures',
        pricePerSqft: '28.00',
        thumbnail: '/images/expertise/interiors.webp',
        beforeImage: '',
        heroImage: '/images/expertise/interiors.webp',
        images: [],
        description:
          "A full-height glass partition system with slim aluminum framing, opening a suite's interior to the storefront or common corridor without sacrificing a defined lease line.",
        videoUrl: '',
        specs: [
          { label: 'Material', value: 'Tempered glass, anodized aluminum frame' },
          { label: 'Maintenance', value: 'Standard glass cleaning' },
        ],
      },
    ],
  },
  // The finished-unit gallery ships empty rather than with example entries —
  // each entry is a factual claim about a specific real unit ("this space was
  // finished with these options"), which only the business can make. Same
  // reasoning as `enterprise_page.stats` above: an invented example here would
  // read as a real finished unit that does not exist.
  interiors_gallery: {
    heading: 'Finished spaces',
    entries: [],
  },
  franchise_page: {
    heroEyebrow: 'Franchise',
    heading: 'Bring your brand to Prime',
    paragraph:
      'Prime Developer welcomes established franchise concepts and first-time operators into its properties — retail, food & beverage, and service-based businesses that fit a high-traffic, mixed-use setting.',
    // Falls back to the same photograph the hub's own Franchise tile uses —
    // see `enterprise_page.capabilities` above — rather than an empty hero.
    heroImage: '/images/expertise/franchise.webp',
    // Ships empty for the same reason `enterprise_page.stats` does — a listed
    // brand and property pairing is a factual claim only the business can
    // make. The admin adds real franchisees here as they sign.
    existingFranchisees: [],
    openToNew: {
      paragraph:
        'We work with operators at every stage — from a first location to an established regional brand — and support site selection, buildout coordination, and opening.',
      footprintRange: '800 – 3,500 sq ft',
      whyPartner: [
        'A portfolio of high-traffic retail and mixed-use developments across Texas',
        'Hands-on support through site selection, buildout, and opening',
        'A growing network of complementary tenants and brands',
      ],
    },
  },
  collab_page: {
    heroEyebrow: 'Collab',
    heading: 'Build it together, own it together',
    paragraph:
      'Collab is not a landlord-tenant relationship. The Prime Developer co-owns and co-operates the business alongside a partner, sharing both the risk and the upside from day one.',
    heroImage: '/images/expertise/collaborations.webp',
    existingPartnerships: [],
    howItWorks: {
      contributesUs: 'Space, development capital, and delivery expertise — sourcing the site, funding the build-out, and managing construction.',
      contributesPartner: 'The concept, day-to-day operation, and brand — running the business the partnership is built around.',
      equitySplit:
        'Equity and decision-making are structured deal by deal, weighted to what each side contributes in capital, sweat equity, and ongoing operating responsibility.',
      idealPartner:
        'An operator with a proven concept or track record, a clear stage of growth, and the capital position to share meaningfully in the investment.',
    },
  },
  invest_page: {
    heroEyebrow: 'Invest',
    heading: 'Two ways to put capital to work',
    paragraph:
      'Planning-phase equity and stabilized property investment attract different investor profiles and different levels of risk. Each is explained on its own terms below.',
    heroImage: '/images/expertise/invest.webp',
    planningPhase: {
      description:
        "Entry during a property's planning or pre-development stage, at a lower cost basis, with the upside realized as the project moves through development and stabilizes.",
      entryCost: 'Lower cost basis than a stabilized asset — capital is deployed ahead of construction.',
      timeline: 'Multi-year horizon, tracking the project from entitlement through lease-up.',
      riskProfile: 'Higher risk than a stabilized property, offset by the greater upside of entering before value is built in.',
    },
    propertyCap: {
      description:
        'Entry into an already-stabilized, income-producing property, earning landlord-style returns through a triple-net (NNN) lease structure — tenants cover taxes, insurance, and maintenance.',
      capRateRange: 'Typical cap rates vary by asset and market; current ranges are shared directly with qualified investors.',
      leaseStructure: 'Triple-net (NNN) — tenants pay their share of property taxes, insurance, and common-area maintenance.',
      passiveIncomeNote: 'Largely passive: the lease structure keeps day-to-day operating involvement to a minimum.',
    },
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
  // Page-template chrome shared by every property's detail page — not the
  // per-property `detail.*` content, which has its own admin (PropertyEditPage).
  property_detail_page: {
    notFoundHeading: 'Property not found',
    notFoundBackLabel: '← Back to all properties',
    resourcesLabel: 'Resources',
    overviewEnquireLabel: 'Enquire',
    highlightsEyebrow: 'Property Highlights',
    establishedSitesLabel: 'Established Sites',
    extFacadeLabel: 'Ext. Facade',
    neighborhoodsLabel: 'Head by Areas',
    neighborhoodsHeading: 'Neighborhoods',
    videosLabel: 'YouTube',
    videosHeading: 'Videos',
    closingLabel: 'Enquire',
    // `{name}` and `{soldPct}` are substituted at render time.
    closingHeading: 'Interested in {name}?',
    closingParagraph: 'Talk to our team about availability, pricing, and tours. ({soldPct}% currently reserved.)',
    closingCtaLabel: 'Enquire now',
  },
  // Shared chrome for the /properties/:slug/info template — independent of
  // which properties currently have an info set (see PropertyInfoPage.jsx).
  property_info_page: {
    listingsLabel: 'Listings',
    elsewhereHeading: 'Elsewhere',
    enquiriesLabel: 'Enquiries',
    talkToTeamHeading: 'Talk to the team',
    emailLinkLabel: 'Email',
    legalDisclaimer:
      'Figures shown on the summary sheets are as published and are subject to change. Real estate investments carry risk and no return is assured; seek independent legal, tax and financial advice before investing.',
  },
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
