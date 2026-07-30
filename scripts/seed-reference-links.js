// One-time update: adds social links (site-wide accounts) to every property,
// and real resource links for Centro Plaza, sourced from the client's
// existing per-property page at theprimedeveloper.info/m/Centro-Plaza.
//
// Run with: node --env-file=.env.seed scripts/seed-reference-links.js

import { createClient } from '@supabase/supabase-js'

const url = process.env.SUPABASE_URL
const key = process.env.SUPABASE_SECRET_KEY
if (!url || !key) {
  throw new Error('Missing SUPABASE_URL / SUPABASE_SECRET_KEY — run with: node --env-file=.env.seed scripts/seed-reference-links.js')
}

const supabase = createClient(url, key)

const SOCIALS = [
  { platform: 'instagram', url: 'https://www.instagram.com/theprimedeveloper_official/' },
  { platform: 'facebook', url: 'https://www.facebook.com/profile.php?id=61557388995595' },
  { platform: 'youtube', url: 'https://www.youtube.com/@theprimedeveloper6986' },
  { platform: 'email', url: 'mailto:sales@theprimedeveloper.com' },
]

const CENTRO_PLAZA_LINKS = [
  { label: 'CAP Rate flyer B1', url: 'https://theprimedeveloper.info/4bmL7lL?r=lp&m=Moc9kiWVffI', thumbnail: '' },
  { label: 'CAP Rate flyer B2', url: 'https://theprimedeveloper.info/4vDiNDP?r=lp&m=Moc9kiWVffI', thumbnail: '' },
  { label: 'CAP Rate flyer B6', url: 'https://theprimedeveloper.info/4vtkfrP?r=lp&m=Moc9kiWVffI', thumbnail: '' },
  { label: 'CAP Rate flyer B9 · Lava Leander', url: 'https://theprimedeveloper.info/4y2tlOz?r=lp&m=Moc9kiWVffI', thumbnail: '' },
  { label: 'Location', url: 'https://bit.ly/4f8VBEG?r=lp&m=Moc9kiWVffI', thumbnail: '' },
  { label: 'Crexi', url: 'https://theprimedeveloper.info/47sHl7S?r=lp&m=Moc9kiWVffI', thumbnail: '' },
  { label: 'Loopnet', url: 'https://bit.ly/4sb5fNT?r=lp&m=Moc9kiWVffI', thumbnail: '' },
  { label: 'Flyer', url: 'https://theprimedeveloper.info/4bdwq3D?r=lp&m=Moc9kiWVffI', thumbnail: '' },
  { label: 'Floor Plans', url: 'https://theprimedeveloper.info/4ae1e3Q?r=lp&m=Moc9kiWVffI', thumbnail: '' },
]

async function main() {
  const { data: properties, error } = await supabase.from('properties').select('id, slug, detail')
  if (error) throw error

  for (const p of properties) {
    const detail = { ...p.detail, socials: SOCIALS }
    if (p.slug === 'centro-plaza') {
      detail.resourceLinks = CENTRO_PLAZA_LINKS
    }
    const { error: updateError } = await supabase.from('properties').update({ detail }).eq('id', p.id)
    if (updateError) throw updateError
    console.log(`Updated ${p.slug}`)
  }

  console.log('Done.')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
