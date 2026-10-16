/**
 * The `cap_listings` section as shipped — the fallback until the admin's
 * CAP / NNN page first saves. See lib/capListings.js for the shape.
 *
 * Transcribed from the client's "CAP & NNN Property Listings" sheets (three
 * pages, seventeen deals), figure for figure. Two things were deliberately not
 * copied: price per SF, which is worked out from price and size (the Devi
 * Liquor sheet's printed figure doesn't match its own numbers), and nothing
 * was "corrected" — where a sheet's cap rate disagrees with rent over price
 * (N & S, Braeburn, Bawarchi), the printed cap rate stands and the admin flags
 * the difference for someone who knows the deal to settle.
 *
 * Photos and logos were cut from those sheets and uploaded to the images
 * bucket under cap/. The sheet photos are small (about 310x400); replacing
 * one from the admin is the way to sharpen it.
 */

const IMG = 'https://nrtqntqutquapydsnjbm.supabase.co/storage/v1/object/public/images/cap/'
const photo = (key) => `${IMG}${key}/photo.jpg`
const logo = (key) => `${IMG}${key}/logo.png`

const LEWISVILLE = '2601 State Hwy 121, Lewisville, TX'
const LEANDER_15101 = '15101 Ronald Reagan Blvd, Leander, TX'
const LEANDER_14300 = '14300 Ronald Reagan Blvd, Leander, TX'
const LEANDER_15901 = '15901 Ronald Reagan Blvd, Leander, TX'

// `propertySlug` / `unitLabel` link a deal to the site's own records where the
// address matches one. 15101 Ronald Reagan Blvd has no property in the CMS, so
// those seven stand alone. A unit is linked only where the label matches one
// record exactly — Mugdha's 103 and Devi's 201, 202 sit inside combined suites
// in the CMS ("101+102+103+106", and 201 and 202 listed separately), so those
// link to Centro Plaza without naming a unit.
const deal = (fields) => ({
  published: true,
  tagline: '',
  logo: '',
  photos: [],
  propertySlug: '',
  unitLabel: '',
  summary: '',
  highlights: [],
  flyerUrl: '',
  ...fields,
})

export const CAP_LISTINGS_DEFAULTS = {
  eyebrow: 'CAP & NNN',
  heading: 'CAP & NNN property listings',
  intro: 'Income-producing properties structured for CAP / NNN investment — tenants cover taxes, insurance and maintenance.',
  contacts: [
    { name: 'Malik Gilakattula', phone: '+1 (512) 761-8025' },
    { name: 'Raju Padigala', phone: '+1 (512) 866-3485' },
  ],
  email: 'sales@theprimedeveloper.com',
  disclaimer:
    'Real estate investments are subject to risk, and no assurance of returns is made; investors should seek independent legal, tax, and financial advice before investing.',
  items: [
    deal({ id: 'cap-ns-retail-516', slug: 'ns-retail-e-commerce-unit-516', status: 'listed', tenant: 'N & S', tagline: 'Retail e-commerce', photo: photo('ns-retail-e-commerce'), address: LEWISVILLE, propertySlug: 'pow-lewisville-phase-i', units: '516', sf: 1815, price: 695750, capRate: 6.5, leaseTerm: 3, rent: 41745, nnn: 23595 }),
    deal({ id: 'cap-ojas-102', slug: 'ojas-natural-foods-unit-102', status: 'listed', tenant: 'OJAS Natural Foods', tagline: 'Organic · Artisanal · Premium', logo: logo('ojas-natural-foods'), photo: photo('ojas-natural-foods'), address: LEANDER_15101, units: '102', sf: 1430, price: 884000, capRate: 5.5, leaseTerm: 15, rent: 48620, nnn: 18590 }),
    deal({ id: 'cap-jeremiahs-902b', slug: 'jeremiahs-italian-ice-unit-902-b', status: 'listed', tenant: "Jeremiah's Italian Ice", logo: logo('jeremiahs-italian-ice'), photo: photo('jeremiahs-italian-ice'), address: LEANDER_15101, units: '902-B', sf: 1219, price: 997364, capRate: 5.5, leaseTerm: 10, rent: 54855, nnn: 15847 }),
    deal({ id: 'cap-smoke-shop-1108', slug: 'smoke-shop-unit-1108', status: 'listed', tenant: 'Smoke Shop', photo: photo('smoke-shop'), address: LEANDER_15101, units: '1108', sf: 1968, price: 1145018, capRate: 5.5, leaseTerm: 10, rent: 62976, nnn: 25584 }),
    deal({ id: 'cap-seven-oaks-702', slug: 'seven-oaks-coffee-unit-702', status: 'listed', tenant: 'Seven Oaks Coffee', logo: logo('seven-oaks-coffee'), photo: photo('seven-oaks-coffee'), address: LEANDER_15101, units: '702', sf: 1804, price: 1183096, capRate: 5.5, leaseTerm: 10, rent: 65070, nnn: 23452 }),
    deal({ id: 'cap-srishti-1201', slug: 'srishti-unit-1201', status: 'listed', tenant: 'Srishti', tagline: 'Discover India', logo: logo('srishti'), photo: photo('srishti'), address: LEANDER_15101, units: '1201', sf: 1927, price: 1226273, capRate: 5.5, leaseTerm: 10, rent: 67445, nnn: 25051 }),
    deal({ id: 'cap-liquor-shop-1101', slug: 'liquor-shop-unit-1101-1102', status: 'listed', tenant: 'Liquor Shop', photo: photo('liquor-shop'), address: LEANDER_15101, units: '1101, 1102', sf: 2834, price: 1648873, capRate: 5.5, leaseTerm: 10, rent: 90688, nnn: 36842 }),
    deal({ id: 'cap-harvest-depot-513', slug: 'harvest-depot-unit-513-515', status: 'listed', tenant: 'Harvest Depot', tagline: 'Without mezzanine', logo: logo('harvest-depot'), photo: photo('harvest-depot'), address: LEWISVILLE, propertySlug: 'pow-lewisville-phase-i', units: '513, 515', sf: 3150, price: 1526538, capRate: 6.5, leaseTerm: 5, rent: 99225, nnn: 40950 }),
    deal({ id: 'cap-brickerz-203', slug: 'brickerz-club-unit-203-204', status: 'listed', tenant: 'BrickerZ Club', logo: logo('brickerz-club'), photo: photo('brickerz-club'), address: LEANDER_14300, propertySlug: 'centro-plaza', unitLabel: '203+204', units: '203, 204', sf: 3020, price: 1702182, capRate: 5.5, leaseTerm: 10, rent: 93620, nnn: 39260 }),
    deal({ id: 'cap-mohey-700', slug: 'mohey-manyavar-unit-700-701', status: 'listed', tenant: 'Mohey Manyavar', logo: logo('mohey-manyavar'), photo: photo('mohey-manyavar'), address: LEANDER_15101, units: '700, 701', sf: 3050, price: 1885454, capRate: 5.5, leaseTerm: 10, rent: 103700, nnn: 39650 }),
    deal({ id: 'cap-braeburn-501', slug: 'braeburn-unit-501', status: 'listed', tenant: 'Braeburn', tagline: 'Systems & thermostats', logo: logo('braeburn'), photo: photo('braeburn'), address: LEWISVILLE, propertySlug: 'pow-lewisville-phase-i', units: '501', sf: 5530, price: 2041846, capRate: 6, leaseTerm: 15, rent: 132720, nnn: 71890 }),
    deal({ id: 'cap-kids-activity-605', slug: 'kids-activity-studio-unit-605', status: 'under-contract', tenant: 'Kids Activity Studio', photo: photo('kids-activity-studio'), address: LEANDER_14300, propertySlug: 'centro-plaza', unitLabel: '605', units: '605', sf: 1057, price: 510883, capRate: 6, leaseTerm: 15, rent: 30653, nnn: 13741 }),
    deal({ id: 'cap-perfect-posture-410', slug: 'perfect-posture-unit-410', status: 'under-contract', tenant: 'Perfect Posture', logo: logo('perfect-posture'), photo: photo('perfect-posture'), address: LEANDER_15901, propertySlug: 'pow-leander', units: '410', sf: 1650, price: 715000, capRate: 6, leaseTerm: 10, rent: 42900, nnn: 11550 }),
    deal({ id: 'cap-mugdha-103', slug: 'mugdha-dallas-unit-103', status: 'under-contract', tenant: 'Mugdha Dallas', tagline: 'South India wedding mall', logo: logo('mugdha-dallas'), photo: photo('mugdha-dallas'), address: LEANDER_14300, propertySlug: 'centro-plaza', units: '103', sf: 1511, price: 934073, capRate: 5.5, leaseTerm: 15, rent: 51374, nnn: 19643 }),
    deal({ id: 'cap-three-wheels-335', slug: 'three-wheels-strength-unit-335', status: 'sold', tenant: 'Three Wheels Strength', logo: logo('three-wheels-strength'), photo: photo('three-wheels-strength'), address: LEANDER_15901, propertySlug: 'pow-leander', units: '335', sf: 1650, price: 715000, capRate: 6, leaseTerm: 10, rent: 42900, nnn: 35919 }),
    deal({ id: 'cap-devi-liquor-201', slug: 'devi-liquor-unit-201-202', status: 'sold', tenant: 'Devi Liquor', tagline: 'Fine wine & liquor', logo: logo('devi-liquor'), photo: photo('devi-liquor'), address: LEANDER_14300, propertySlug: 'centro-plaza', units: '201, 202', sf: 2763, price: 1414656, capRate: 6.25, leaseTerm: 5, rent: 88416, nnn: 35919 }),
    deal({ id: 'cap-bawarchi-501', slug: 'bawarchi-indian-cuisine-unit-501', status: 'sold', tenant: 'Bawarchi Indian Cuisine', logo: logo('bawarchi-indian-cuisine'), photo: photo('bawarchi-indian-cuisine'), address: LEANDER_15901, propertySlug: 'pow-leander', units: '501', sf: 5850, price: 3217455, capRate: 5.5, leaseTerm: 10, rent: 198900, nnn: 40950 }),
  ],
}
