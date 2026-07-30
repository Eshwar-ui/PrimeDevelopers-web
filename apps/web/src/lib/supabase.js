import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!url || !anonKey) {
  throw new Error('Missing VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY — copy .env.example to .env and fill them in.')
}

export const supabase = createClient(url, anonKey)

const IMAGES_BUCKET = 'images'
const MODELS_BUCKET = 'models'

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

// 3D models get a content-hashed name and a year-long cache. Geometry never
// changes in place — a revised building is a new upload — so the heavy asset
// can be cached hard. Unit data, which does change, is never cached.
export async function uploadModel(file, folder) {
  const path = `${folder}/${crypto.randomUUID()}.glb`
  const { error } = await supabase.storage.from(MODELS_BUCKET).upload(path, file, {
    cacheControl: '31536000',
    contentType: 'model/gltf-binary',
    upsert: false,
  })
  if (error) throw error
  return supabase.storage.from(MODELS_BUCKET).getPublicUrl(path).data.publicUrl
}
