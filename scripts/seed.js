// One-time local seed: uploads today's hardcoded site assets to Supabase
// Storage and inserts the equivalent `content` + `properties` rows, so the
// site keeps working immediately after cutover to the CMS.
//
// Run with: node --env-file=.env.seed scripts/seed.js

import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, '..')
const assets = (p) => path.join(root, 'src/assets', p)

const url = process.env.SUPABASE_URL
const key = process.env.SUPABASE_SECRET_KEY
if (!url || !key) {
  throw new Error('Missing SUPABASE_URL / SUPABASE_SECRET_KEY — run with: node --env-file=.env.seed scripts/seed.js')
}

const supabase = createClient(url, key)

async function uploadAsset(localPath, storagePath) {
  const buffer = readFileSync(assets(localPath))
  const ext = localPath.split('.').pop()
  const contentType = ext === 'svg' ? 'image/svg+xml' : ext === 'webp' ? 'image/webp' : 'image/png'
  const { error } = await supabase.storage.from('images').upload(storagePath, buffer, {
    contentType,
    upsert: true,
  })
  if (error) throw error
  return supabase.storage.from('images').getPublicUrl(storagePath).data.publicUrl
}

async function main() {
  console.log('Uploading assets…')
  const hero = {}
  for (let i = 1; i <= 6; i++) {
    hero[`s${i}`] = await uploadAsset(`hero/slide-${i}-enhanced.png`, `site/hero/slide-${i}.png`)
  }
  const propertyImg = await uploadAsset('property-1-enhanced.png', 'site/property-1.png')

  const logos = {}
  for (const name of ['22yards', 'farm2cook', 'sevenoaks', 'lego', 'qahwah']) {
    logos[name] = await uploadAsset(`logos/${name}.webp`, `site/logos/${name}.webp`)
  }
  console.log('Assets uploaded.')

  // ── content ──────────────────────────────────────────────────────────
  const content = {
    hero: {
      eyebrow: 'Prime Developer — Est. 2017',
      heading: 'We build the *landmarks* of Texas',
      paragraph:
        'Retail in Cedar Park. Flex space in Leander. Open lots in Liberty Hill. One team, start to finish — acquisition, design, and handover.',
      ctaLabel: 'View Properties',
      ctaHref: '#properties',
      slides: [
        { image: hero.s1, place: 'Lewisville', kind: 'Mixed-use' },
        { image: hero.s2, place: 'Leander', kind: 'Residential' },
        { image: hero.s3, place: 'Cedar Park', kind: 'Commercial' },
        { image: hero.s4, place: 'Liberty Hill', kind: 'Master-planned' },
        { image: hero.s5, place: 'Austin', kind: 'High-rise' },
        { image: hero.s6, place: 'Dallas–Fort Worth', kind: 'Retail' },
      ],
    },
    marquee: {
      eyebrow: 'Trusted by teams building across Texas',
      logos: [
        { image: logos['22yards'], alt: '22 Yards' },
        { image: logos.farm2cook, alt: 'Farm2Cook' },
        { image: logos.sevenoaks, alt: 'Sevenoaks' },
        { image: logos.lego, alt: 'Lego' },
        { image: logos.qahwah, alt: 'Qahwah' },
      ],
    },
    about_home: {
      heading: 'Experienced professionals turning raw land into *finished Texas developments*.',
      paragraph1:
        "Since 2017, Prime Developers has grown into one of Texas's most active developers — owning and operating retail, flex, and residential properties across Dallas–Fort Worth and Austin.",
      paragraph2:
        'Our team pairs a proven track record in large-scale, complex development with a hands-on approach to investment — from permitting through handover, every detail engineered to last.',
      ctaLabel: 'About Prime Developers',
      stats: [
        { value: 9, label: 'Years of Experience' },
        { value: 10, label: 'Properties Completed' },
        { value: 5, label: 'Team Collaborations' },
        { value: 3, label: 'Industry Awards Won' },
      ],
    },
    properties_home: { heading: 'Developments that *hold the line.*' },
    gallery: { heading: "Places we've *brought to life.*" },
    testimonials: {
      items: [
        {
          quote:
            'Prime carried our mixed-use development from permitting through handover without a single missed milestone. The build quality speaks for itself.',
          name: 'Marisol Treviño',
          role: 'Managing Partner · Balcones Capital',
        },
        {
          quote:
            'We have co-developed three properties with Prime. They underwrite conservatively and execute aggressively — a rare combination in this market.',
          name: 'Dov Ackerman',
          role: 'Principal · Lometa Holdings',
        },
        {
          quote:
            'Their team treated our retail center like their own asset. We reached 94% occupancy within eight months of delivery.',
          name: 'Priya Raghunathan',
          role: 'Director of Development · Verdanta Group',
        },
        {
          quote:
            'Straight-talking, detail-obsessed, dependable. Prime is the first call we make for ground-up commercial work in Central Texas.',
          name: 'Cael Ferro',
          role: 'VP Acquisitions · Hillstead Partners',
        },
      ],
    },
    navbar: {
      links: [
        { label: 'About', to: '/about' },
        { label: 'Properties', to: '/properties' },
        { label: 'Contact', to: '/contact' },
      ],
    },
    footer: {
      email: 'hello@primedevelopers.com',
      phone: '+1 (512) 419-2837',
      studio: 'East 6th Street, Austin, TX',
      ctaHeading: "Let's build\nsomething *lasting.*",
      quickLinks: [
        { label: 'Home', href: '/' },
        { label: 'About', href: '/about' },
        { label: 'Properties', href: '/properties' },
        { label: 'Contact', href: '/contact' },
      ],
      socials: [
        { label: 'Instagram', href: '#' },
        { label: 'LinkedIn', href: '#' },
        { label: 'X', href: '#' },
        { label: 'Facebook', href: '#' },
      ],
      copyrightLeft: '© 2026 Prime Developers',
      copyrightRight: 'Austin · Texas',
    },
    about_page: {
      heroEyebrow: 'About — Est. 2017',
      heroHeading: 'Innovating spaces,\nbuilding *dreams.*',
      heroParagraph:
        'A rapidly expanding real estate developer owning and operating iconic commercial and residential properties across the vibrant Texas market.',
      heroImage: hero.s2,
      firmHeading: 'Experienced professionals crafting *iconic properties.*',
      firmParagraph1:
        'Prime Developers, a rapidly expanding real estate developer, has been offering services since 2017. Specializing in iconic commercial and residential properties, we own and operate in the vibrant Texas market.',
      firmParagraph2:
        'Our team comprises dedicated and experienced professionals with a proven track record in large-scale, intricate property development and investment — from land acquisition through design and sales.',
      ctaLabel: 'Explore our properties',
      stats: [
        { value: 9, label: 'Years in Texas' },
        { value: 10, label: 'Iconic Properties' },
        { value: 5, label: 'Team Collaborations' },
        { value: 3, label: 'Industry Awards' },
      ],
      principles: [
        {
          title: 'Mission',
          body: 'Offering a comprehensive investment opportunity for everyone, providing an ultimate solution encompassing land acquisition, design, and sales, leading to exceptional return on investment.',
        },
        {
          title: 'Leadership',
          body: 'Our exceptional leaders are committed to a guaranteed, intuitive, and proven approach to financing, hands-on value creation, and ethical practices that positively impact our society.',
        },
        {
          title: 'Vision',
          body: 'Prime Developers is devoted to crafting distinctive, state-of-the-art architecture that transcends conventional human experience, offering flexibility and financial freedom to enhance lifestyles.',
        },
      ],
      founders: [
        { name: 'Raju Padigala', role: 'Co-Founder & Partner', image: '' },
        { name: 'Mallikarjuna Gilakattula', role: 'Co-Founder & Partner', image: '' },
      ],
      foundersClosing:
        'Our exceptional leaders are committed to a guaranteed, intuitive, and proven approach to financing, hands-on value creation, and ethical practices that positively impact our society.',
      closingHeading: 'Building the\n*landmarks* of Texas.',
      closingImage: hero.s4,
    },
    contact_page: {
      heroEyebrow: 'Contact — Prime Developers',
      heroHeading: 'Explore options\nwith us *today.*',
      heroParagraph: 'Experienced Texas property leaders. Tell us about your goals and our team will be in touch.',
      email: 'sales@theprimedeveloper.com',
      phone: '+1 512-761-8025',
      location: 'Texas, United States',
      socials: [
        { label: 'WhatsApp', href: 'https://wa.me/15127618025' },
        { label: 'LinkedIn', href: '#' },
        { label: 'Instagram', href: '#' },
        { label: 'Facebook', href: '#' },
      ],
    },
    properties_page: {
      heroEyebrow: 'Our Portfolio — Texas',
      heroHeading: 'Iconic properties,\nbuilt to *last.*',
      heroParagraph:
        'In Texas, we own and manage iconic properties in a dynamic market. With a skilled team, we excel in large-scale property development and investment.',
    },
  }

  console.log('Seeding content…')
  for (const [section, data] of Object.entries(content)) {
    const { error } = await supabase.from('content').upsert({ section, data })
    if (error) throw error
  }

  // ── properties ───────────────────────────────────────────────────────
  const galleryUrls = [hero.s1, hero.s2, hero.s3, hero.s4, hero.s5, hero.s6, propertyImg]
  const imgs = [propertyImg, hero.s1, hero.s2, hero.s3, hero.s4, hero.s5, hero.s6]
  const slugify = (n) =>
    n
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '')

  const properties = [
    {
      name: 'POW Lewisville Phase I',
      address: '2601 State Hwy 121, Lewisville, TX 75067',
      category: 'Flex',
      buildings: 77,
      sold: 63,
      available: 14,
      detail: {
        tagline: 'Dynamic Business Spaces at Leora Ln & E State Hwy 121!',
        overview: {
          eyebrow: 'Prime Office Warehouse',
          heading: 'Hybrid Retail Ready Workspaces',
          body: 'Offering a distinctive fusion of warehouse, retail, and office space. Each unit boasts a welcoming storefront design, inviting customers to enter as if it were a retail store. Additionally, each unit can be tailored to serve as either traditional office space or warehouse, with flexible open floor plans to accommodate various business needs.',
          flyer: '#',
          stats: [
            { value: '185,238', label: 'SFT Property Size' },
            { value: '77', label: 'Total Units' },
            { value: '14', label: 'Available Units' },
          ],
        },
        tenants: [logos['22yards'], logos.farm2cook, logos.sevenoaks, logos.qahwah, logos.lego],
        highlights: {
          heading: 'Tailored Spaces For Your Success',
          body: '294,512 sq ft across 6–7 buildings on Highway 121, Leora Lane, offering flexible options from 3,375 to 9,270 sq ft. With high visibility and zoning for diverse businesses like car service stations and sign shops, it’s a prime commercial hub accessible from all corners of Dallas Fort Worth.',
          bigStats: [
            { value: '9,270+', label: 'SFT Unit Size' },
            { value: '2,607+', label: 'SFT Floor Size' },
          ],
          cards: [
            { title: 'Expansive Property', body: 'Spans from 294,512 square feet on 21 E State HWY.' },
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
        establishedSites: { heading: 'Transforming Properties Into Unique Visions' },
        neighborhoods: {
          mapQuery: '2601 State Hwy 121, Lewisville, TX 75067',
          items: [
            {
              name: 'Castle Hills Residential Community',
              note: 'A 2,900-acre award-winning community with 4,300+ homes — fostering living, working, playing, and thriving.',
            },
            { name: 'Walmart Super Centre Lewisville', note: 'Major retail anchor minutes from the site.' },
            { name: 'Nebraska Furniture Mart', note: 'Regional destination retail.' },
            { name: 'The Colony High School', note: 'Established community school nearby.' },
          ],
        },
        videos: [],
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

  console.log('Seeding properties…')
  for (const [i, p] of properties.entries()) {
    const row = {
      slug: slugify(p.name),
      name: p.name,
      address: p.address,
      category: p.category,
      buildings: p.buildings,
      sold: p.sold,
      available: p.available,
      image: imgs[i % imgs.length],
      gallery: galleryUrls,
      detail: p.detail ?? {},
      sort_order: i,
      published: true,
    }
    const { error } = await supabase.from('properties').upsert(row, { onConflict: 'slug' })
    if (error) throw error
  }

  console.log('Done. Seeded content + properties.')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
