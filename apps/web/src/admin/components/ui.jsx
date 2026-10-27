import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'

// The admin's shared vocabulary. Every page used to hand-roll its own button
// and badge strings — six button styles between them — so a fix to one never
// reached the others.
//
// Colours are pigments, not role tokens: the admin ground is dark in both
// themes, so nothing here may follow the theme. That is why the primary fill is
// `accent-soft` and not `accent` — `accent` is CG Blue under the light theme,
// and near-black type on it measured 3.6:1.

export const focusRing =
  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-soft'

const BUTTON_BASE =
  'inline-flex shrink-0 cursor-pointer items-center justify-center gap-2 rounded-full font-bold uppercase tracking-wide transition-colors disabled:cursor-not-allowed disabled:opacity-50'

const BUTTON_SIZES = {
  // 44px — the touch-target floor.
  md: 'min-h-11 px-5 text-xs',
  // For dense rows inside a card, where a 44px control would outweigh the
  // content it acts on. Still 36px, never a bare text link.
  sm: 'min-h-9 px-3.5 text-[11px]',
}

const BUTTON_VARIANTS = {
  primary: 'bg-accent-soft text-void hover:bg-accent-hi',
  secondary: 'border border-white/20 text-bone hover:border-white/40 hover:bg-white/5',
  ghost: 'text-bone-2 hover:bg-white/5 hover:text-bone',
  danger: 'bg-red-400 text-void hover:bg-red-300',
  'danger-ghost': 'text-red-300 hover:bg-red-400/10 hover:text-red-200',
}

/**
 * One button for the whole admin. `to` renders a router Link, `href` a plain
 * anchor, anything else a <button> — so an action that navigates and one that
 * submits look identical, which is the point.
 */
export function Button({
  variant = 'secondary',
  size = 'md',
  icon: Icon,
  to,
  href,
  className = '',
  children,
  ...rest
}) {
  const cls = `${BUTTON_BASE} ${BUTTON_SIZES[size]} ${BUTTON_VARIANTS[variant]} ${focusRing} ${className}`
  const content = (
    <>
      {Icon && <Icon weight="bold" className={size === 'sm' ? 'size-3.5' : 'size-4'} aria-hidden />}
      {children}
    </>
  )
  if (to) {
    return (
      <Link to={to} className={cls} {...rest}>
        {content}
      </Link>
    )
  }
  if (href) {
    return (
      <a href={href} className={cls} {...rest}>
        {content}
      </a>
    )
  }
  return (
    <button type="button" className={cls} {...rest}>
      {content}
    </button>
  )
}

/** Icon-only control. `label` is required — it is the only name the control has. */
export function IconButton({ icon: Icon, label, size = 'md', href, className = '', ...rest }) {
  const cls = `inline-flex shrink-0 cursor-pointer items-center justify-center rounded-full text-bone-2 transition-colors hover:bg-white/10 hover:text-bone disabled:cursor-not-allowed disabled:opacity-35 disabled:hover:bg-transparent ${
    size === 'sm' ? 'size-9' : 'size-11'
  } ${focusRing} ${className}`
  const icon = <Icon weight="bold" className="size-4" aria-hidden />
  if (href) {
    return (
      <a href={href} aria-label={label} title={label} className={cls} {...rest}>
        {icon}
      </a>
    )
  }
  return (
    <button type="button" aria-label={label} title={label} className={cls} {...rest}>
      {icon}
    </button>
  )
}

const BADGE_TONES = {
  neutral: 'bg-white/10 text-bone-2',
  accent: 'bg-accent-soft/15 text-accent-soft',
  ember: 'bg-ember/15 text-ember',
  success: 'bg-status-available/15 text-status-available',
  danger: 'bg-red-400/15 text-red-300',
}

export function Badge({ tone = 'neutral', dot = false, children, className = '' }) {
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold uppercase leading-none tracking-wide ${BADGE_TONES[tone]} ${className}`}
    >
      {dot && <span className="size-1.5 rounded-full bg-current" aria-hidden />}
      {children}
    </span>
  )
}

/**
 * Live / Draft, always spelled out. Draft used to be shown and Live wasn't, so
 * "published" was something an editor had to infer from a badge being absent.
 */
export function StatusPill({ live }) {
  return live ? (
    <Badge tone="success" dot>
      Live
    </Badge>
  ) : (
    <Badge tone="neutral" dot>
      Draft
    </Badge>
  )
}

export function Card({ as: Tag = 'div', className = '', children, ...rest }) {
  return (
    <Tag className={`rounded-2xl border border-white/10 bg-carbon ${className}`} {...rest}>
      {children}
    </Tag>
  )
}

/** Page title row. Wraps rather than squeezes, so actions drop under the title on a phone. */
export function PageHeader({ title, description, actions, children }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-4">
      <div className="min-w-0">
        {children}
        <h1 className="font-display text-2xl font-medium text-bone">{title}</h1>
        {description && <p className="mt-1 max-w-prose text-sm text-bone-3">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  )
}

export function Alert({ children, action }) {
  return (
    <div
      role="alert"
      className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-red-400/30 bg-red-400/10 px-4 py-3 text-sm text-red-200"
    >
      <p className="min-w-0">{children}</p>
      {action}
    </div>
  )
}

export function EmptyState({ icon: Icon, title, children, action }) {
  return (
    <Card className="flex flex-col items-center px-6 py-14 text-center">
      {Icon && (
        <span className="grid size-12 place-items-center rounded-full bg-white/5 text-bone-3">
          <Icon weight="duotone" className="size-6" aria-hidden />
        </span>
      )}
      <p className="mt-4 font-display text-[16px] font-medium text-bone">{title}</p>
      {children && <p className="mt-1 max-w-sm text-sm text-bone-3">{children}</p>}
      {action && <div className="mt-6">{action}</div>}
    </Card>
  )
}

export function Skeleton({ className = '' }) {
  return <div aria-hidden className={`rounded-2xl bg-carbon/70 motion-safe:animate-pulse ${className}`} />
}

/**
 * Search box for a list page. 16px text on phones — anything smaller makes
 * iOS zoom the page on focus.
 */
export function SearchInput({ value, onChange, placeholder = 'Search', label = 'Search', icon: Icon }) {
  return (
    <label className="relative block w-full sm:w-72">
      <span className="sr-only">{label}</span>
      {Icon && (
        <Icon weight="bold" className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-bone-3" aria-hidden />
      )}
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={`min-h-11 w-full rounded-full border border-white/15 bg-black/20 pr-4 text-[16px] text-bone outline-none transition-colors placeholder:text-bone-3 hover:border-white/25 focus:border-accent-soft focus:ring-2 focus:ring-accent-soft/25 sm:text-sm ${
          Icon ? 'pl-10' : 'pl-4'
        }`}
      />
    </label>
  )
}

/**
 * Two-step destructive action drawn by the page itself.
 *
 * Never `window.confirm`: browsers offer "prevent this page from creating more
 * dialogs" after a couple of prompts, and once that is ticked `confirm()`
 * returns false forever without showing anything — the Delete button then does
 * nothing, silently, for the rest of the tab's life. That shipped once on the
 * Properties list (see the note there).
 *
 * The confirmation also lands on the row it is about, rather than in a system
 * alert that doesn't say which one it means.
 */
export function ConfirmButton({
  onConfirm,
  label = 'Delete',
  prompt = 'Delete permanently?',
  confirmLabel = 'Yes, delete',
  busyLabel = 'Deleting…',
  icon,
  size = 'sm',
  // Locked rather than hidden, with `title` saying why — a missing Delete
  // reads as a bug, a greyed one with a reason reads as a rule.
  disabled = false,
  title,
}) {
  const [armed, setArmed] = useState(false)
  const [busy, setBusy] = useState(false)
  const confirmRef = useRef(null)
  const triggerRef = useRef(null)
  const wasArmed = useRef(false)

  // Focus follows the swap both ways: onto "Yes, delete" when armed, and back
  // to the trigger on cancel — otherwise the button holding focus unmounts and
  // a keyboard user is dropped at the top of the document.
  useEffect(() => {
    if (armed) confirmRef.current?.focus()
    else if (wasArmed.current) triggerRef.current?.focus()
    wasArmed.current = armed
  }, [armed])

  const confirm = async () => {
    setBusy(true)
    try {
      await onConfirm()
      setArmed(false)
    } finally {
      setBusy(false)
    }
  }

  if (!armed) {
    return (
      <Button
        ref={triggerRef}
        variant="danger-ghost"
        size={size}
        icon={icon}
        onClick={() => setArmed(true)}
        disabled={disabled}
        title={title}
        className="disabled:cursor-not-allowed disabled:opacity-40"
      >
        {label}
      </Button>
    )
  }

  return (
    <span
      className="inline-flex flex-wrap items-center gap-2"
      onKeyDown={(e) => {
        if (e.key === 'Escape' && !busy) setArmed(false)
      }}
    >
      <span className="text-xs text-bone-2">{prompt}</span>
      <Button ref={confirmRef} variant="danger" size={size} onClick={confirm} disabled={busy}>
        {busy ? busyLabel : confirmLabel}
      </Button>
      <Button variant="ghost" size={size} onClick={() => setArmed(false)} disabled={busy}>
        Cancel
      </Button>
    </span>
  )
}
