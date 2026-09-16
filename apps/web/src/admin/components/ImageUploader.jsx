import { useEffect, useRef, useState } from 'react'
import { uploadImage, assertImageOk, IMAGE_ACCEPT, IMAGE_TYPES, IMAGE_MAX_BYTES, formatBytes } from '../../lib/uploads'

/**
 * Pick an image, see it immediately, then upload it.
 *
 * The preview is the point. This used to show the *stored* image only — so
 * from clicking Upload to the request returning, the frame still showed the
 * old picture, or "No image", and an editor replacing a hero slide had no
 * confirmation they had picked the right file until it was already live. A
 * local object URL closes that gap: the frame switches the instant the file is
 * chosen, and the upload happens underneath it.
 *
 * The object URL is revoked once the real one arrives, and on unmount. Left
 * alone it pins the whole file in memory for the life of the tab, which on a
 * 10MB photograph across a dozen slide uploads is a real leak.
 */
export default function ImageUploader({ value, onChange, folder, label, hint = true }) {
  const inputRef = useRef(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  // The just-picked file, shown while it uploads. Null at rest.
  const [preview, setPreview] = useState(null)

  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview) }, [preview])

  const pick = () => inputRef.current?.click()

  const clearPreview = () => setPreview((url) => { if (url) URL.revokeObjectURL(url); return null })

  const onFile = async (e) => {
    const file = e.target.files?.[0]
    // Reset immediately so picking the same file twice still fires a change.
    e.target.value = ''
    if (!file) return

    setError(null)
    // Checked before the preview so a rejected file never flashes into the
    // frame as though it had been accepted.
    try {
      assertImageOk(file)
    } catch (err) {
      setError(err.message)
      return
    }

    const localUrl = URL.createObjectURL(file)
    setPreview((old) => { if (old) URL.revokeObjectURL(old); return localUrl })
    setBusy(true)
    try {
      const url = await uploadImage(file, folder)
      onChange(url)
    } catch (err) {
      setError(err.message)
      // The upload failed, so the frame must go back to what is actually
      // stored rather than keep showing a picture that never landed.
      clearPreview()
    } finally {
      setBusy(false)
    }
  }

  // The local preview outranks the stored URL only while one exists — which is
  // from selection until the upload resolves, after which `value` is the truth.
  const shown = preview ?? value

  return (
    <div className="flex flex-col gap-2">
      {label && <span className="text-xs font-bold uppercase tracking-wide text-bone/50">{label}</span>}
      <div className="flex items-center gap-4">
        <div className="relative flex h-20 w-28 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-white/15 bg-black/20">
          {shown ? (
            <img src={shown} alt="" className="h-full w-full object-cover" />
          ) : (
            <span className="text-[10px] text-bone/30">No image</span>
          )}
          {/* Over the picture rather than replacing it: the editor is checking
              they chose the right frame, and hiding it to say "working" takes
              away the one thing they are looking at. */}
          {busy && (
            <span className="absolute inset-0 grid place-items-center bg-black/55 text-[10px] font-bold uppercase tracking-wide text-bone">
              Uploading…
            </span>
          )}
        </div>
        <div className="flex flex-col gap-2">
          <button
            type="button"
            onClick={pick}
            disabled={busy}
            className="rounded-full border border-white/20 px-4 py-1.5 text-xs font-bold uppercase tracking-wide text-bone/80 hover:border-ember hover:text-ember disabled:opacity-50"
          >
            {busy ? 'Uploading…' : value ? 'Replace' : 'Upload'}
          </button>
          {value && !busy && (
            <button
              type="button"
              onClick={() => { clearPreview(); onChange('') }}
              className="text-left text-[11px] text-bone-3 hover:text-bone/70"
            >
              Remove
            </button>
          )}
        </div>
        <input ref={inputRef} type="file" accept={IMAGE_ACCEPT} className="hidden" onChange={onFile} />
      </div>

      {/* Said once, here, rather than in a dozen section descriptions that
          would drift apart. The order is the recommendation. */}
      {hint && (
        <p className="text-[11px] leading-relaxed text-bone-3">
          {IMAGE_TYPES.map((t) => t.ext).join(', ')} · up to {formatBytes(IMAGE_MAX_BYTES)}. WebP is
          smallest; use JPEG for photographs and keep PNG for logos and flat graphics.
        </p>
      )}

      {error && <p className="text-xs text-red-400">{error}</p>}
    </div>
  )
}
