// Scoped demo seed for exercising the complete interiors experience.
// It only replaces the two interiors CMS rows and is safe to re-run.
// Run with: pnpm seed:interiors-demo

import { createClient } from '@supabase/supabase-js'
import { interiorsDemoGallery, interiorsDemoPage } from './interiors-demo-data.mjs'

const url = process.env.SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY

if (!url || !key) throw new Error('Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY')

const supabase = createClient(url, key)
const rows = [
  { section: 'interiors_page', data: interiorsDemoPage },
  { section: 'interiors_gallery', data: interiorsDemoGallery },
]

const { error } = await supabase.from('content').upsert(rows, { onConflict: 'section' })
if (error) throw error

console.log(`Seeded interiors demo: ${interiorsDemoPage.options.length} options and ${interiorsDemoGallery.entries.length} finished spaces.`)
