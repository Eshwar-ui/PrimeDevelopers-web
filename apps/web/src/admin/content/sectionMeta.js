// Where each site-content section appears, for grouping the index and for the
// editor's "View live" link. Kept beside sectionEditors.jsx rather than inside
// it so the 1,200-line editor registry stays about fields.
//
// A section missing from GROUPS still shows, under "Other" — a new editor can
// never be hidden by forgetting this file. A missing path just means no "View
// live" button.

export const GROUPS = [
  {
    id: 'home',
    label: 'Homepage',
    keys: ['hero', 'featured_home', 'properties_home', 'gallery', 'services_home', 'marquee', 'testimonials', 'news_home', 'cta_home'],
  },
  {
    id: 'global',
    label: 'Every page',
    keys: ['navbar', 'footer', 'texas_map', 'brochure_modal'],
  },
  {
    id: 'pages',
    label: 'Pages',
    keys: ['about_page', 'contact_page', 'properties_page', 'news_page', 'academy'],
  },
  {
    id: 'property',
    label: 'Property pages',
    keys: ['property_detail_page', 'property_info_page'],
  },
  {
    id: 'enterprise',
    label: 'Enterprise',
    keys: [
      'enterprise_page',
      'interiors_page',
      'interiors_gallery',
      'franchise_page',
      'franchise_testimonials',
      'collab_page',
      'collab_testimonials',
      'invest_page',
      'invest_testimonials',
    ],
  },
]

export const SECTION_PATHS = {
  hero: '/',
  featured_home: '/',
  properties_home: '/',
  gallery: '/',
  services_home: '/',
  marquee: '/',
  testimonials: '/',
  news_home: '/',
  cta_home: '/',
  navbar: '/',
  footer: '/',
  texas_map: '/',
  brochure_modal: '/',
  about_page: '/about',
  contact_page: '/contact',
  properties_page: '/properties',
  news_page: '/news',
  academy: '/learn',
  enterprise_page: '/enterprise',
  interiors_page: '/enterprise/interiors',
  interiors_gallery: '/enterprise/interiors/gallery',
  franchise_page: '/enterprise/franchise',
  franchise_testimonials: '/enterprise/franchise',
  collab_page: '/enterprise/collab',
  collab_testimonials: '/enterprise/collab',
  invest_page: '/enterprise/invest',
  invest_testimonials: '/enterprise/invest',
}

/** The most-edited sections, for the dashboard's shortcuts. */
export const QUICK_EDITS = ['hero', 'featured_home', 'marquee', 'testimonials', 'navbar', 'footer', 'contact_page']
