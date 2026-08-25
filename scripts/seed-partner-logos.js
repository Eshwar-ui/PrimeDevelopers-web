import { createClient } from '@supabase/supabase-js'
import { existsSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const logoDir = path.join(root, 'apps/web/src/assets/logos')
const extensions = ['png', 'webp', 'svg', 'jpg', 'jpeg']

const manifest = [
  { file: 'niva-dental', alt: 'NIVA Dental Specialists', darkPanel: true },
  { file: 'shipley-donuts', alt: 'Shipley Do-Nuts' },
  { file: 'brass-tap', alt: 'The Brass Tap' },
  { file: 'learning-experience', alt: 'The Learning Experience' },
  { file: 'ups', alt: 'UPS' },
  { file: 'shield-crest', alt: '' },
  { file: 'deutschtuning', alt: 'DT DeutschTuning' },
  { file: '22yards', alt: '22 Yards' },
  { file: 'teapioca', alt: 'Teapioca International' },
  { file: 'sangam', alt: 'Sangam Chettinad' },
  { file: 'sevenoaks', alt: 'Seven Oaks' },
  { file: 'society-kitchen', alt: 'Society Kitchen + Kocktails' },
  { file: 'vivek-flowers', alt: 'Vivek Flowers' },
  { file: 'parinama-academy', alt: 'Parinama Academy' },
  { file: 'pizza-depot', alt: 'Pizza Depot' },
  { file: 'india-bazaar', alt: 'India Bazaar' },
  { file: 'lava', alt: 'LAVA' },
  { file: 'bawarchi', alt: 'Bawarchi Indian Cuisine' },
  { file: 'farm2cook', alt: 'Farm2Cook' },
  { file: 'lego', alt: 'LEGO' },
  { file: 'qahwah', alt: 'Qahwah House' },
]

const url = process.env.SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !key) throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')

const supabase = createClient(url, key)

const contentType = (extension) => {
  if (extension === 'svg') return 'image/svg+xml'
  if (extension === 'webp') return 'image/webp'
  if (extension === 'jpg' || extension === 'jpeg') return 'image/jpeg'
  return 'image/png'
}

async function main() {
  const logos = []

  for (const entry of manifest) {
    const extension = extensions.find((candidate) =>
      existsSync(path.join(logoDir, `${entry.file}.${candidate}`))
    )
    if (!extension) throw new Error(`Missing logo asset: ${entry.file}`)

    const localPath = path.join(logoDir, `${entry.file}.${extension}`)
    const storagePath = `site/logos/${entry.file}.${extension}`
    const { error } = await supabase.storage.from('images').upload(
      storagePath,
      readFileSync(localPath),
      { contentType: contentType(extension), upsert: true }
    )
    if (error) throw error

    const image = supabase.storage.from('images').getPublicUrl(storagePath).data.publicUrl
    logos.push({ image, alt: entry.alt, darkPanel: Boolean(entry.darkPanel) })
  }

  const { data: current, error: readError } = await supabase
    .from('content')
    .select('data')
    .eq('section', 'marquee')
    .maybeSingle()
  if (readError) throw readError

  const { error: writeError } = await supabase.from('content').upsert({
    section: 'marquee',
    data: { ...(current?.data ?? {}), logos },
  })
  if (writeError) throw writeError

  console.log(`Seeded ${logos.length} unique partner logos into marquee.`)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})