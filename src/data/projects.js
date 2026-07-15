import p1 from '../assets/property-1-enhanced.png'
import s1 from '../assets/hero/slide-1-enhanced.png'
import s2 from '../assets/hero/slide-2-enhanced.png'
import s3 from '../assets/hero/slide-3-enhanced.png'
import s4 from '../assets/hero/slide-4-enhanced.png'
import s5 from '../assets/hero/slide-5-enhanced.png'
import s6 from '../assets/hero/slide-6-enhanced.png'
import t1 from '../assets/logos/22yards.webp'
import t2 from '../assets/logos/farm2cook.webp'
import t3 from '../assets/logos/sevenoaks.webp'
import t4 from '../assets/logos/qahwah.webp'
import t5 from '../assets/logos/lego.webp'

const imgs = [p1, s1, s2, s3, s4, s5, s6]
const gallery = [s1, s2, s3, s4, s5, s6, p1]
const tenants = [t1, t2, t3, t4, t5]

const slugify = (n) =>
  n
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')

// Base listing data (shown on /projects). `category` is a best-guess mapping
// from the old site's filter — adjust freely.
const base = [
  {
    name: 'POW Lewisville Phase I',
    address: '2601 State Hwy 121, Lewisville, TX 75067',
    category: 'Flex',
    buildings: 77,
    sold: 63,
    available: 14,
    // Full detail content transcribed from the old project page.
    detail: {
      tagline: 'Dynamic Business Spaces at Leora Ln & E State Hwy 121!',
      overview: {
        eyebrow: 'Prime Office Warehouse',
        heading: 'Hybrid Retail Ready Workspaces',
        body: 'Offering a distinctive fusion of warehouse, retail, and office space. Each unit boasts a welcoming storefront design, inviting customers to enter as if it were a retail store. Additionally, each unit can be tailored to serve as either traditional office space or warehouse, with flexible open floor plans to accommodate various business needs.',
        flyer: '#',
        stats: [
          { value: '185,238', label: 'SFT Project Size' },
          { value: '77', label: 'Total Units' },
          { value: '14', label: 'Available Units' },
        ],
      },
      tenants,
      highlights: {
        heading: 'Tailored Spaces For Your Success',
        body: '294,512 sq ft across 6–7 buildings on Highway 121, Leora Lane, offering flexible options from 3,375 to 9,270 sq ft. With high visibility and zoning for diverse businesses like car service stations and sign shops, it’s a prime commercial hub accessible from all corners of Dallas Fort Worth.',
        bigStats: [
          { value: '9,270+', label: 'SFT Unit Size' },
          { value: '2,607+', label: 'SFT Floor Size' },
        ],
        cards: [
          { title: 'Expansive Project', body: 'Spans from 294,512 square feet on 21 E State HWY.' },
          { title: 'Mezzanine Allowance', body: '50% base floor plan for versatile layouts.' },
          { title: 'Premium Features', body: 'Private balconies, restrooms, and glass entrance doors.' },
          { title: 'High Traffic Location', body: 'Exceeds 90,000 vehicles per day on US Road.' },
        ],
      },
      floorPlans: {
        heading: 'Crafting Contemporary Spaces',
        body: 'Every unit on our site has a contemporary flair, whether it’s for a small business or a modern office space. We understand the importance of creating an attractive environment that enhances productivity, leaving a positive impression on customers. With our commitment to delivering innovative solutions, we leave no stone unturned in ensuring excellence.',
        buildings: [
          { building: 'Building 4', area: '185,238', number: 4, units: 14, available: 4, parking: 'Yes' },
          { building: 'Building 5', area: '185,238', number: 5, units: 17, available: 9, parking: 'Yes' },
        ],
      },
      location: {
        eyebrow: 'Tailored',
        heading: 'Gateway For Growth',
        sub: 'Strategic Location & Zoning',
        body: 'Prime Office Warehouses offer over 125,000 square feet of office space spread across 5 buildings, with unit sizes ranging from 1,250 to 30,000 square feet. Whether you’re buying, leasing, or opting for a “built to suit” option, our diverse value propositions cater to your business needs. Strategically located on Highway 121, Leora Lane, our property boasts high visibility with over 125,000 daily vehicles, making it easily accessible from all corners of the greater Dallas Fort Worth Area. With zoning suitable for various businesses such as gymnastics centers, car service stations, roofing contractors, and more, it’s an ideal location for entrepreneurs seeking growth opportunities in a rapidly expanding suburb.',
      },
      establishedSites: {
        heading: 'Transforming Properties Into Unique Visions',
      },
      neighborhoods: {
        mapQuery: '2601 State Hwy 121, Lewisville, TX 75067',
        items: [
          { name: 'Castle Hills Residential Community', note: 'A 2,900-acre award-winning community with 4,300+ homes — fostering living, working, playing, and thriving.' },
          { name: 'Walmart Super Centre Lewisville', note: 'Major retail anchor minutes from the site.' },
          { name: 'Nebraska Furniture Mart', note: 'Regional destination retail.' },
          { name: 'The Colony High School', note: 'Established community school nearby.' },
        ],
      },
      videos: 4,
    },
  },
  { name: 'Reagan Crossing Phase II', address: '15101 Ronald Reagan Blvd, Leander, TX 78641', category: 'Retail', buildings: 36, sold: 28, available: 8 },
  { name: 'Centro Plaza', address: '14300 Ronald Reagan Blvd, Cedar Park, TX 78641', category: 'Retail', buildings: 102, sold: 81, available: 21 },
  { name: 'Spur Plaza', address: '2085 Highway 183, Leander, TX 78641', category: 'Retail', buildings: 103, sold: 40, available: 63 },
  { name: 'POW Leander', address: '15901 Ronald Reagan Blvd, Leander, TX 78641', category: 'Flex', buildings: 81, sold: 48, available: 33 },
  { name: 'POW Lewisville Phase II', address: '2601 TX-121, Lewisville, TX 75056', category: 'Flex', buildings: 22, sold: 22, available: 0 },
  { name: 'Rio Ranch 1 Acre Lots', address: '3150 CR 258, Liberty Hill, TX 78642', category: 'Open Plots', buildings: 55, sold: 36, available: 19 },
  { name: 'Rio Ranch Commercial Lots', address: '3150 CR 258, Liberty Hill, TX 78642', category: 'Open Plots', buildings: 15, sold: 6, available: 9 },
  { name: 'CAP Rate Projects', address: 'Austin, TX', category: 'Office', buildings: 12, sold: 7, available: 5 },
]

export const projects = base.map((p, i) => ({
  ...p,
  slug: slugify(p.name),
  image: imgs[i % imgs.length],
  gallery,
}))

export const categories = ['All', 'Retail', 'Flex', 'Office', 'Open Plots']

export const getProject = (slug) => projects.find((p) => p.slug === slug)
