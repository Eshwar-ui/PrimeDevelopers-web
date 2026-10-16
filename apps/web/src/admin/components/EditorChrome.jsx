import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowLeft, ArrowSquareOut, Check, FloppyDisk } from '@phosphor-icons/react'
import { Button, StatusPill, focusRing } from './ui'

/**
 * How long "Saved" stays up. Long enough to be read after the eye comes back
 * from the button; short enough that it stops claiming anything once the
 * editor has moved on.
 */
const SAVED_VISIBLE_MS = 4000

/**
 * The sticky top of every editor — property, post and site-content section.
 *
 * It used to exist on the property editor alone. The content and news editors
 * put Save at the top of the page, and the longest of them (the Interiors
 * catalog) runs to thousands of pixels: an editor finishing at the bottom had
 * to scroll all the way back to find the button.
 *
 * Negative-margined to run full-bleed under <main>'s padding, then re-adds it —
 * the standard trick for a sticky bar inside a padded scroll container. The
 * sticky offset is negative by the same amount: a sticky `top` is measured from
 * the scroll container's *content* edge, so `top-0` held the bar 32px down,
 * over the top of the form. The values mirror <main> in AdminLayout and must
 * move with it.
 *
 * ⌘S / Ctrl+S saves. Browsers bind it to "Save page as…", which on an admin
 * form is never what anyone means.
 */
export function EditorBar({
  backTo,
  backLabel,
  title,
  live,
  viewHref,
  dirty,
  saving,
  savedAt,
  error,
  onSave,
  maxWidth = 'max-w-4xl',
  children,
}) {
  const [justSaved, setJustSaved] = useState(false)

  useEffect(() => {
    if (!savedAt) return
    setJustSaved(true)
    const t = setTimeout(() => setJustSaved(false), SAVED_VISIBLE_MS)
    return () => clearTimeout(t)
  }, [savedAt])

  // Read through a ref so the listener is bound once rather than on every
  // keystroke in the form.
  const latest = useRef({ dirty, saving, onSave })
  latest.current = { dirty, saving, onSave }

  useEffect(() => {
    const onKeyDown = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 's') {
        e.preventDefault()
        const { dirty, saving, onSave } = latest.current
        if (dirty && !saving) onSave()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  const status = saving
    ? { text: 'Saving…', tone: 'text-bone-2' }
    : error
      ? { text: 'Not saved', tone: 'text-red-300' }
      : dirty
        ? { text: 'Unsaved changes', tone: 'text-ember', dot: true }
        : justSaved
          ? { text: 'Saved', tone: 'text-status-available', check: true }
          : null

  return (
    <div className="sticky -top-4 z-20 -mx-4 -mt-4 border-b border-white/10 bg-carbon/95 px-4 pb-3 pt-3 backdrop-blur sm:pb-4 sm:-top-6 sm:-mx-6 sm:-mt-6 sm:px-6 sm:pt-6 lg:-top-8 lg:-mx-8 lg:-mt-8 lg:px-8 lg:pt-6">
      {/* Full-bleed ground, content held to the same measure as the form
          below it, so Save lines up with the fields' right edge. */}
      <div className={`mx-auto ${maxWidth}`}>
        <div className="flex items-center gap-3">
          <Link
            to={backTo}
            className={`inline-flex min-h-9 items-center gap-1.5 whitespace-nowrap rounded text-xs font-bold uppercase tracking-wide text-bone-3 transition-colors hover:text-bone ${focusRing}`}
          >
            <ArrowLeft weight="bold" className="size-3.5" aria-hidden />
            {backLabel}
          </Link>
          {/* On a phone the pill rides up here, so the title keeps its row. */}
          {live !== undefined && (
            <span className="sm:hidden">
              <StatusPill live={live} />
            </span>
          )}
        </div>

        {/* One row, not wrapping: on a phone a wrapped action row made the
            sticky chrome 200px tall. The title truncates instead. */}
        <div className="flex items-center justify-between gap-3 sm:gap-6">
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <h1 className="truncate font-display text-xl font-medium text-bone sm:text-2xl" title={title}>
              {title}
            </h1>
            {live !== undefined && (
              <span className="hidden shrink-0 sm:inline-flex">
                <StatusPill live={live} />
              </span>
            )}
          </div>

          <div className="flex shrink-0 items-center gap-1 sm:gap-3">
            {/* Kept in the DOM when empty (as sr-only) — a live region that
                mounts with its message is often not announced. */}
            <span
              role="status"
              aria-live="polite"
              className={status ? `flex min-h-11 items-center gap-1.5 text-xs font-medium ${status.tone}` : 'sr-only'}
            >
              {status?.dot && <span className="size-1.5 rounded-full bg-current" aria-hidden />}
              {status?.check && <Check weight="bold" className="size-3.5" aria-hidden />}
              {/* Dot only on a phone — Save's enabled state already says there
                  is something to save, and the words would push the title out. */}
              <span className="max-sm:sr-only">{status?.text}</span>
            </span>
            {viewHref && (
              <Button
                variant="ghost"
                href={viewHref}
                target="_blank"
                rel="noreferrer"
                icon={ArrowSquareOut}
                aria-label="View live (opens in a new tab)"
                className="max-sm:px-3"
              >
                <span className="hidden sm:inline">View live</span>
              </Button>
            )}
            <Button
              variant="primary"
              icon={FloppyDisk}
              onClick={onSave}
              disabled={saving || !dirty}
              title={dirty ? 'Save (⌘S / Ctrl+S)' : 'No changes to save'}
            >
              {saving ? 'Saving…' : 'Save'}
            </Button>
          </div>
        </div>
        {children}
      </div>
    </div>
  )
}

/**
 * Stops unsaved work being thrown away by a stray click.
 *
 * Two routes out of an editor, two mechanisms:
 *
 * - Closing or reloading the tab: `beforeunload`, which makes the browser ask.
 * - An in-app link (the sidebar, a back link, a card): intercepted in the
 *   capture phase at the document, before React Router's own handler sees the
 *   click, and replaced by a dialog the page draws itself.
 *
 * Browser Back is not covered. That needs `useBlocker`, which only exists on a
 * data router, and the app mounts a plain <BrowserRouter>.
 *
 * `onSave` must resolve to true when the save landed, so "Save and leave" only
 * leaves if there is nothing left to lose.
 */
export function LeaveGuard({ when, onSave }) {
  const navigate = useNavigate()
  const dialogRef = useRef(null)
  const [pending, setPending] = useState(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!when) return

    const onBeforeUnload = (e) => {
      e.preventDefault()
      // Still required by Chrome for the prompt to show at all.
      e.returnValue = ''
    }

    const onClick = (e) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return
      const anchor = e.target.closest?.('a[href]')
      if (!anchor || anchor.target === '_blank' || anchor.hasAttribute('download')) return
      const url = new URL(anchor.href, window.location.href)
      if (url.origin !== window.location.origin) return
      // Same page, different hash — an in-page jump, nothing is lost.
      if (url.pathname === window.location.pathname && url.search === window.location.search) return
      e.preventDefault()
      e.stopPropagation()
      setPending(`${url.pathname}${url.search}${url.hash}`)
    }

    window.addEventListener('beforeunload', onBeforeUnload)
    document.addEventListener('click', onClick, true)
    return () => {
      window.removeEventListener('beforeunload', onBeforeUnload)
      document.removeEventListener('click', onClick, true)
    }
  }, [when])

  // A native <dialog> in the top layer: the browser makes the page behind it
  // inert, traps focus, closes on Escape and hands focus back afterwards.
  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    if (pending && !dialog.open) dialog.showModal()
    if (!pending && dialog.open) dialog.close()
  }, [pending])

  const leave = (to) => {
    // Closed here rather than left to the effect above: navigating unmounts
    // this component in the same render, before that effect could run, and a
    // modal dialog should leave the top layer through close(), not removal.
    dialogRef.current?.close()
    setPending(null)
    navigate(to)
  }

  const saveAndLeave = async () => {
    setSaving(true)
    const ok = await onSave()
    setSaving(false)
    if (ok) leave(pending)
    else setPending(null)
  }

  return (
    <dialog
      ref={dialogRef}
      onCancel={(e) => {
        e.preventDefault()
        if (!saving) setPending(null)
      }}
      aria-labelledby="leave-guard-title"
      className="m-auto w-[calc(100%-2rem)] max-w-lg rounded-2xl border border-white/15 bg-overlay p-6 text-bone shadow-2xl backdrop:bg-void/80"
    >
      <h2 id="leave-guard-title" className="font-display text-lg font-medium">
        Leave without saving?
      </h2>
      <p className="mt-2 text-sm text-bone-2">You have changes on this page that haven&apos;t been saved yet.</p>
      {/* Stacked full-width on a phone, primary on top; a row on anything wider. */}
      <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button variant="ghost" onClick={() => setPending(null)} disabled={saving} autoFocus className="max-sm:w-full">
          Keep editing
        </Button>
        <Button variant="danger-ghost" onClick={() => leave(pending)} disabled={saving} className="max-sm:w-full">
          Discard changes
        </Button>
        <Button variant="primary" onClick={saveAndLeave} disabled={saving} className="max-sm:w-full">
          {saving ? 'Saving…' : 'Save and leave'}
        </Button>
      </div>
    </dialog>
  )
}
