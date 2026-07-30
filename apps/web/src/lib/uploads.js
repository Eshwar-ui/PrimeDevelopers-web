import { apiFetch, ensureFreshSession } from './api'

/**
 * Admin file uploads, via the API rather than straight to Supabase Storage.
 *
 * The browser no longer holds any Supabase credential, so it cannot write to a
 * bucket itself. It posts the file to the API, which uploads with the
 * service-role key and returns the public URL. Reads are unaffected: the
 * buckets stay public, so every stored URL keeps working in an <img> or the
 * GLB loader with no credential at all.
 *
 * Both functions keep the `(file, folder) -> url` signature the previous
 * Supabase helpers had, so ImageUploader and ModelManager did not change.
 */

async function upload(kind, file, folder) {
  // A multipart body can't be replayed after a 401-triggered refresh — the
  // stream is already consumed — so make sure the token is good beforehand.
  await ensureFreshSession()

  const body = new FormData()
  body.append('file', file)
  body.append('folder', folder)

  const { url } = await apiFetch(`/uploads/${kind}`, { method: 'POST', body })
  return url
}

export const uploadImage = (file, folder) => upload('image', file, folder)
export const uploadModel = (file, folder) => upload('model', file, folder)
