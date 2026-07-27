import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!url || !anonKey) {
  throw new Error('Missing VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY — copy .env.example to .env and fill them in.')
}

export const supabase = createClient(url, anonKey)

const IMAGES_BUCKET = 'images'

export function publicImageUrl(path) {
  if (!path) return null
  return supabase.storage.from(IMAGES_BUCKET).getPublicUrl(path).data.publicUrl
}

export async function uploadImage(file, folder) {
  const ext = file.name.split('.').pop()
  const path = `${folder}/${crypto.randomUUID()}.${ext}`
  const { error } = await supabase.storage.from(IMAGES_BUCKET).upload(path, file, {
    cacheControl: '3600',
    upsert: false,
  })
  if (error) throw error
  return publicImageUrl(path)
}
