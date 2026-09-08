import { Link } from 'react-router-dom'
import { useProperties, useSection } from '../context/ContentContext'
import { sized } from '../lib/images'
import ArrowRight from './ArrowRight'

/**
 * The CAP / NNN listings, shared by /enterprise/invest and /properties.
 *
 * One curated list, one card, two places it renders. The list itself lives in
 * the `invest_page` CMS section and always has — the invest page is where the
 * business decides which properties are structured for stabilized investment,
 * and the properties page is a shortcut into that decision rather than a second
 * copy of it. Keeping the source single means a listing added for one page
 * cannot go missing from the other.
 *
 * Each entry names a property by slug and adds only what the property record
 * itself cannot know: its cap rate and its tenancy note. Everything else — the
 * name, the photograph, the category — is read off the property, so nothing is
 * re-typed and nothing can disagree with the listing page it links to.
 */

/** Curated entries resolved against the live property list, in CMS order. */
export function useCapProperties() {
  const page = useSection('invest_page')
  const properties = useProperties()

  return (page.propertyCap?.properties ?? [])
    .map((entry) => {
      const property = properties.find((p) => p.slug === entry.propertySlug)
      // A slug that no longer resolves is a deleted or unpublished property.
      // Dropping it is the only safe option — the alternative is a card with a
      // photo and no name linking to a 404.
      return property ? { ...entry, property } : null
    })
    .filter(Boolean)
}

export function CapPropertyCard({ property, capRate, tenancy }) {
  const stat = (property.detail?.overview?.stats ?? [])[0]

  return (
    <Link
      to={`/properties/${property.slug}`}
      className="group flex flex-col overflow-hidden rounded-panel border border-line bg-surface transition-[border-color,box-shadow] duration-500 ease-brand hover:border-ember/60 hover:shadow-[0_36px_80px_-52px_rgba(0,0,0,0.85)]"
    >
      <div className="relative aspect-[4/3] overflow-hidden bg-surface-alt">
        {property.image && (
          <img
            src={sized(property.image, 'card')}
            alt=""
            loading="lazy"
            decoding="async"
            className="absolute inset-0 size-full object-cover transition-transform duration-700 ease-brand group-hover:scale-[1.04]"
          />
        )}
        {/* The cap rate is the reason this card exists, so it is the first
            thing on it rather than a line of small print four rows down.
            Ember, because that is the tone the invest page already gives the
            CAP / NNN track — the badge and the track it belongs to match. */}
        <span className="absolute left-4 top-4 rounded-full bg-ember px-3 py-1.5 font-body text-[12px] font-bold uppercase tracking-[0.08em] text-void">
          {capRate ? `${capRate} cap` : 'Cap rate on request'}
        </span>
      </div>

      <div className="flex flex-1 flex-col gap-1.5 p-6">
        <div className="flex items-start justify-between gap-3">
          <h3 className="font-display text-lg font-bold leading-tight text-content">
            {property.name}
          </h3>
          <ArrowRight className="mt-1 size-4 shrink-0 text-content/40 transition-[color,transform] duration-300 ease-brand group-hover:translate-x-1 group-hover:text-ember" />
        </div>
        {property.category && (
          <p className="font-body text-[13px] font-semibold text-ember">{property.category}</p>
        )}
        {/* The tenancy note when the CMS has one, and the property's own
            headline figure when it does not — a card that falls back to
            nothing leaves a ragged row of different heights. */}
        {tenancy ? (
          <p className="mt-1 font-body text-[13px] leading-[1.6] text-content/60">{tenancy}</p>
        ) : (
          stat && (
            <p className="mt-1 font-body text-[13px] text-content/60">
              <span className="numeral font-bold text-content">{stat.value}</span> {stat.label}
            </p>
          )
        )}
      </div>
    </Link>
  )
}

/**
 * The grid, plus the empty state that stands in before any listing has been
 * curated. `limit` is what the properties page uses to show a teaser of the
 * full set; the invest page passes nothing and gets all of them.
 */
export function CapPropertyGrid({ items, limit, emptyState = null, className = '' }) {
  const shown = limit ? items.slice(0, limit) : items

  if (shown.length === 0) return emptyState

  return (
    <div className={`grid gap-6 sm:grid-cols-2 lg:grid-cols-3 ${className}`}>
      {shown.map((item) => (
        <CapPropertyCard
          key={item.property.slug}
          property={item.property}
          capRate={item.capRate}
          tenancy={item.tenancy}
        />
      ))}
    </div>
  )
}
