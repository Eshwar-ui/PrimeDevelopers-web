import { useEffect, useRef, useState } from 'react'
import { ImageSquare, UploadSimple, X } from '@phosphor-icons/react'
import { uploadImage, assertImageOk, IMAGE_ACCEPT, IMAGE_TYPES, IMAGE_MAX_BYTES, formatBytes } from '../../lib/uploads'
import { Button } from './ui'

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

  // The upload resolves seconds after the file was picked. Calling the
  // `onChange` from that render handed the parent a callback built around the
  // form as it was then — typing done during the upload, or a second upload
  // finishing first, was written over. The latest one is read at the end
  // instead; the editors' updaters (resolveNext in adminUtils) cover the rest.
  const onChangeRef = useRef(onChange)
  useEffect(() => {
    onChangeRef.current = onChange
  })

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
      onChangeRef.current(url)
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
      {label && <span className="text-xs font-bold uppercase tracking-wide text-bone-3">{label}</span>}
      <div className="flex flex-wrap items-center gap-4">
        {/* The frame itself picks a file too — it is the biggest target on the
            row and the obvious thing to click. */}
        <button
          type="button"
          onClick={pick}
          disabled={busy}
          aria-label={value ? 'Replace image' : 'Upload image'}
          className="relative flex h-20 w-28 shrink-0 cursor-pointer items-center justify-center overflow-hidden rounded-lg border border-dashed border-white/20 bg-black/20 transition-colors hover:border-accent-soft focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-soft disabled:cursor-wait"
        >
          {shown ? (
            <img src={shown} alt="" className="h-full w-full object-cover" />
          ) : (
            <span className="flex flex-col items-center gap-1 text-[11px] text-bone-3">
              <ImageSquare weight="duotone" className="size-6" aria-hidden />
              No image
            </span>
          )}
          {/* Over the picture rather than replacing it: the editor is checking
              they chose the right frame, and hiding it to say "working" takes
              away the one thing they are looking at. */}
          {busy && (
            <span className="absolute inset-0 grid place-items-center bg-black/55 text-[11px] font-bold uppercase tracking-wide text-bone">
              Uploading…
            </span>
          )}
        </button>
        <div className="flex flex-wrap items-center gap-1">
          <Button size="sm" icon={UploadSimple} onClick={pick} disabled={busy}>
            {busy ? 'Uploading…' : value ? 'Replace' : 'Upload'}
          </Button>
          {value && !busy && (
            <Button
              size="sm"
              variant="danger-ghost"
              icon={X}
              onClick={() => {
                clearPreview()
                onChange('')
              }}
            >
              Remove
            </Button>
          )}
        </div>
        <input ref={inputRef} type="file" accept={IMAGE_ACCEPT} className="hidden" onChange={onFile} />
      </div>

      {/* Said once, here, rather than in a dozen section descriptions that
          would drift apart. The order is the recommendation. */}
      {hint && (
        <p className="text-xs leading-relaxed text-bone-3">
          {IMAGE_TYPES.map((t) => t.ext).join(', ')} · up to {formatBytes(IMAGE_MAX_BYTES)}. WebP is
          smallest; use JPEG for photographs and keep PNG for logos and flat graphics.
        </p>
      )}

      {error && (
        <p role="alert" className="text-xs text-red-300">
          {error}
        </p>
      )}
    </div>
  )
}
