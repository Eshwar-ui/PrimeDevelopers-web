import { useNavigate } from 'react-router-dom'
import { useSection } from '../context/ContentContext'
import { renderEmphasis } from '../lib/emphasis'
import { sized } from '../lib/images'
import ActionButton from './ActionButton'
import ArrowRight from './ArrowRight'

/**
 * One property, pulled out of the list and given a panel of its own.
 *
 * The list below this section is deliberately uniform — three cards that look
 * alike so they can be compared. That uniformity is exactly why a single
 * feature has to sit outside it: a card made bigger than its neighbours reads
 * as a layout bug, while a card lifted out of the row entirely reads as a
 * choice. This is the one place on the page with a hairline border, and that is
 * the whole of its emphasis.
 */
export default function FeaturedProperty() {
  const f = useSection('featured_home')
  const navigate = useNavigate()

  // The panel is the client's to switch off. With no heading there is no
  // feature this month, and an empty bordered slab is worse than no section.
  if (!f.heading) return null

  const go = (href) => (e) => {
    if (!href || /^https?:/.test(href)) return
    e.preventDefault()
    navigate(href)
  }

  return (
    <section data-band="light" className="bg-base px-gutter pb-6 pt-6 text-content md:px-gutter-lg">
      <div className="mx-auto max-w-[1560px]">
        {/* Two columns only when there is a photograph to put in the second
            one. Without that guard an unset image leaves the copy in a half-
            width column with a half-width hole beside it, which reads as a
            picture that failed to load rather than as a panel of copy. */}
        {/* 1fr / 2fr, which puts the photograph at 60% of the card's *outer*
            width — the measurement that was asked for, and the one the comp
            reads at. The columns divide the content box, which is the card less
            its padding and the gap, so asking those for 60% would land the
            picture at about 54% of the card and read short of the brief.

            Rows stretch rather than centre, and that is what decides the card's
            height. The copy column is the tallest thing here, so the copy sets
            the height and the photograph fills whatever it is given — fitting
            the width it was asked for and cropping on the vertical.

            An aspect ratio on the image did the opposite: at 60% of the measure
            a 16:10 frame is over 500px tall, so the picture set the height and
            the card grew a band of dead space down the copy side. */}
        <div
          className={`grid gap-8 rounded-frame border border-accent/25 bg-surface p-5 md:gap-10 md:p-7 lg:p-9 ${
            f.image ? 'lg:grid-cols-[1fr_2fr]' : ''
          }`}
        >
          {/* ── copy ─────────────────────────────────────────────── */}
          <div
            className={
              f.image ? 'flex flex-col justify-center lg:pr-2' : 'max-w-[68ch]'
            }
          >
            {f.eyebrow && (
              <p className="flex items-center gap-3 font-body text-[11px] font-bold uppercase tracking-[0.28em] text-accent">
                {f.eyebrow}
                <span aria-hidden className="h-px w-8 bg-accent/45" />
              </p>
            )}

            {/* The property's own name is the emphasised half, in saffron. It
                is the only proper noun in the block and the only thing here a
                returning visitor is scanning for. */}
            {/* Sized for the column the 60% photograph leaves behind, not for
                the card. At the old 2.6vw the first line ran past a copy column
                that is now 30% of the card, and "Grow Your Business at" broke
                with "at" stranded on a line of its own. `text-balance` is the
                backstop for the same failure on a heading nobody has written
                yet — it splits the line evenly instead of shedding one word. */}
            <h2
              className="mt-5 text-balance font-display font-bold leading-[1.08] tracking-[-0.02em] text-content"
              style={{ fontSize: 'clamp(1.5rem, 2.1vw, 2.2rem)' }}
            >
              {renderEmphasis(f.heading, 'text-ember')}
            </h2>

            {f.subheading && (
              <p className="mt-4 text-balance font-display text-[clamp(0.95rem,1.15vw,1.15rem)] font-medium leading-snug text-content/85">
                {renderEmphasis(f.subheading, 'text-accent')}
              </p>
            )}

            {f.paragraph && (
              <>
                {/* The comp rules a hairline here. It is doing real work: the
                    two lines above are the pitch and the block below is the
                    detail, and without a division they read as one four-line
                    paragraph that changes voice halfway through. */}
                <span aria-hidden className="mt-6 block h-px w-full max-w-[26rem] bg-gradient-to-r from-ember/40 via-content/12 to-transparent" />
                {/* Italic, as drawn — it sets the supporting copy apart from
                    the subheading above it without another size step. */}
                <p className="mt-6 max-w-[52ch] font-body text-[14px] italic leading-[1.75] text-content/55">
                  {f.paragraph}
                </p>
              </>
            )}

            <div className="mt-8 flex flex-wrap items-center gap-3">
              {f.ctaLabel && (
                <ActionButton href={f.ctaHref || '/properties'} onClick={go(f.ctaHref)}>
                  {f.ctaLabel}
                  {/* A bare arrow rather than the white disc this used to
                      carry. The disc is PrimePill's mark and belongs to the
                      page-level CTA; repeating it here made a card button
                      claim the same rank as the one in the hero. */}
                  <ArrowRight className="size-4 -rotate-45 transition-transform duration-200 ease-brand group-hover:-translate-y-0.5 group-hover:translate-x-0.5 motion-reduce:transform-none" />
                </ActionButton>
              )}

              {f.secondaryLabel && (
                <ActionButton
                  tone="ghost"
                  href={f.secondaryHref || '/contact'}
                  onClick={go(f.secondaryHref)}
                >
                  {f.secondaryLabel}
                </ActionButton>
              )}
            </div>
          </div>

          {/* ── the photograph ───────────────────────────────────── */}
          {f.image && (
            // The min-height is the floor, not the height. On a phone this is a
            // single-column grid, so the row has no sibling to take its height
            // from and `h-full` would resolve to nothing; from `lg` up the copy
            // beside it is always taller and the floor never applies.
            <div className="relative min-h-56 overflow-hidden rounded-panel bg-surface-alt sm:min-h-72 lg:h-full lg:min-h-0">
              <img
                src={sized(f.image, 'card')}
                alt={f.imageAlt || ''}
                loading="lazy"
                decoding="async"
                className="absolute inset-0 size-full object-cover transition-transform duration-700 ease-brand hover:scale-[1.03]"
              />
            </div>
          )}
        </div>
      </div>
    </section>
  )
}
