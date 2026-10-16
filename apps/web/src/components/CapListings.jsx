import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useSection } from '../context/ContentContext'
import { sized } from '../lib/images'
import { capStatus, formatSf, unitLine } from '../lib/capListings'
import { CAP_LISTINGS_DEFAULTS } from '../data/capListings'
import ArrowRight from './ArrowRight'

/**
 * The `cap_listings` section, merged over the shipped set.
 *
 * Merged here rather than through ContentContext's DEFAULTS so seventeen
 * listings' worth of figures never ride along in the main bundle — every page
 * that shows them is lazy, and this module is only reached through them.
 */
export function useCapListingsSection() {
  const stored = useSection('cap_listings')
  // Stable identity across renders — `useSection` returns a new object each
  // call, and anything keyed on this section would otherwise recompute (or,
  // with an effect, loop) every render.
  const key = JSON.stringify(stored)
  return useMemo(() => ({ ...CAP_LISTINGS_DEFAULTS, ...stored }), [key]) // eslint-disable-line react-hooks/exhaustive-deps
}

/** Published listings, in the order the admin set. */
export function useCapListings() {
  const section = useCapListingsSection()
  return useMemo(() => (section.items ?? []).filter((l) => l?.published !== false && l?.slug), [section])
}

const BADGE_TONES = {
  available: 'bg-[var(--color-status-available)] text-void',
  ember: 'bg-ember text-void',
  sold: 'bg-[var(--color-status-leased)] text-void',
}

/** Just listed / Under contract / Sold — the corner ribbon on the client's sheets, as a pill. */
export function CapStatusBadge({ status, className = '' }) {
  const s = capStatus(status)
  return (
    <span
      className={`inline-flex items-center rounded-full px-3 py-1.5 font-body text-[12px] font-bold uppercase tracking-[0.08em] ${BADGE_TONES[s.tone]} ${className}`}
    >
      {s.label}
    </span>
  )
}

/**
 * A tenant mark on a white panel. Several of these logos are dark artwork on a
 * transparent ground (Seven Oaks, Harvest Depot) and vanish on the dark theme;
 * the white panel is what the partner wall does for the same reason.
 */
export function TenantLogo({ src, alt, className = '' }) {
  if (!src) return null
  return (
    <span className={`flex items-center justify-center rounded-xl bg-white p-2 shadow-[0_8px_24px_-12px_rgba(0,0,0,0.5)] ${className}`}>
      <img src={sized(src, 'logo')} alt={alt} loading="lazy" decoding="async" className="max-h-full max-w-full object-contain" />
    </span>
  )
}

/**
 * The card: photograph, who, where, which unit, how big. The figures — price,
 * cap rate, term — are on the listing page; a grid of seventeen cards each
 * carrying six numbers stops being browsable.
 */
export function CapListingCard({ listing }) {
  const sf = formatSf(listing.sf)
  const unit = unitLine(listing.units)

  return (
    <Link
      to={`/cap-properties/${listing.slug}`}
      className="group flex flex-col overflow-hidden rounded-panel border border-line bg-surface transition-[border-color,box-shadow] duration-500 ease-brand hover:border-ember/60 hover:shadow-[0_36px_80px_-52px_rgba(0,0,0,0.85)] focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-accent"
    >
      <div className="relative aspect-[4/3] overflow-hidden bg-surface-alt">
        {listing.photo && (
          <img
            src={sized(listing.photo, 'card')}
            alt={`${listing.tenant} — ${listing.address}`}
            loading="lazy"
            decoding="async"
            className="absolute inset-0 size-full object-cover transition-transform duration-700 ease-brand group-hover:scale-[1.04]"
          />
        )}
        <CapStatusBadge status={listing.status} className="absolute left-4 top-4" />
        <TenantLogo src={listing.logo} alt={`${listing.tenant} logo`} className="absolute bottom-4 left-4 h-14 w-28" />
      </div>

      <div className="flex flex-1 flex-col p-6">
        <div className="flex items-start justify-between gap-3">
          <h3 className="font-display text-lg font-bold leading-tight text-content">{listing.tenant}</h3>
          <ArrowRight className="mt-1 size-4 shrink-0 text-content/40 transition-[color,transform] duration-300 ease-brand group-hover:translate-x-1 group-hover:text-ember" />
        </div>
        {listing.address && (
          <p className="mt-2 flex items-start gap-1.5 font-body text-[13px] leading-snug text-content/60">
            <svg viewBox="0 0 24 24" aria-hidden className="mt-0.5 size-3.5 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 21s-7-5.5-7-11a7 7 0 1 1 14 0c0 5.5-7 11-7 11Z" />
              <circle cx="12" cy="10" r="2.5" />
            </svg>
            {listing.address}
          </p>
        )}
        {(unit || sf) && (
          <dl className="mt-auto flex flex-wrap gap-2 pt-5">
            {unit && (
              <div className="rounded-full border border-line px-3 py-1.5 font-body text-[13px] font-semibold text-content">
                <dt className="sr-only">Unit</dt>
                <dd>{unit}</dd>
              </div>
            )}
            {sf && (
              <div className="rounded-full border border-line px-3 py-1.5 font-body text-[13px] font-semibold tabular-nums text-content">
                <dt className="sr-only">Total area</dt>
                <dd>{sf}</dd>
              </div>
            )}
          </dl>
        )}
      </div>
    </Link>
  )
}

export function CapListingGrid({ items, limit, emptyState = null, className = '' }) {
  const shown = limit ? items.slice(0, limit) : items
  if (shown.length === 0) return emptyState
  return (
    <div className={`grid gap-6 sm:grid-cols-2 lg:grid-cols-3 ${className}`}>
      {shown.map((listing) => (
        <CapListingCard key={listing.id ?? listing.slug} listing={listing} />
      ))}
    </div>
  )
}
