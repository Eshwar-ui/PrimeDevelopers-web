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

/**
 * What the API will accept, restated here so the browser can refuse a file
 * before spending a minute uploading it only to be told no. These must track
 * UploadsService — a limit only the server knows is a limit the editor meets
 * as a failure at the end of a slow upload.
 *
 * SVG is deliberately absent: it can carry script, and these files are served
 * from a public bucket the admin panel embeds.
 */
export const IMAGE_MAX_BYTES = 10 * 1024 * 1024

/**
 * Keyed by MIME type, valued by how the format actually behaves once it is on
 * the site — which is what an editor choosing between two exports needs to
 * know, and what the accept list alone cannot tell them.
 *
 * Everything is served through Supabase's render endpoint, which re-encodes to
 * WebP when the browser's Accept header allows it. So the stored format mostly
 * decides upload size and how much detail survives that re-encode, not what
 * visitors download — with one exception worth stating: PNG is lossless, so a
 * photograph stored as PNG is many times larger than the same frame as JPEG
 * for no visible gain, and it is the format the client's exports kept arriving
 * in.
 */
export const IMAGE_TYPES = [
  { mime: 'image/webp', ext: 'WebP', note: 'Best. Smallest upload, and already the format visitors are served.' },
  { mime: 'image/avif', ext: 'AVIF', note: 'Smallest of all, but slower to encode and not every tool exports it.' },
  { mime: 'image/jpeg', ext: 'JPEG', note: 'Right for photographs. Use this if WebP is not an option.' },
  { mime: 'image/png', ext: 'PNG', note: 'Logos and flat graphics only — lossless, so photographs come out huge.' },
]

export const IMAGE_ACCEPT = IMAGE_TYPES.map((t) => t.mime).join(',')

export const formatBytes = (bytes) =>
  bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.round(bytes / 1024)} KB`

/** Throws with a message meant for the editor, not for a log. */
export function assertImageOk(file) {
  if (!IMAGE_TYPES.some((t) => t.mime === file.type)) {
    throw new Error(
      `${file.type || 'That file'} is not an image type we accept. Use ${IMAGE_TYPES.map((t) => t.ext).join(', ')}.`,
    )
  }
  if (file.size > IMAGE_MAX_BYTES) {
    throw new Error(
      `That image is ${formatBytes(file.size)} — the limit is ${formatBytes(IMAGE_MAX_BYTES)}. ` +
        'Export it smaller, or save it as WebP or JPEG rather than PNG.',
    )
  }
}

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

export const uploadImage = (file, folder) => {
  assertImageOk(file)
  return upload('image', file, folder)
}
export const uploadModel = (file, folder) => upload('model', file, folder)
