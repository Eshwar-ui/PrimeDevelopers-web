import { useNavigate } from 'react-router-dom'
import { useSection } from '../context/ContentContext'
import { sized } from '../lib/images'
import { serviceImage } from '../lib/expertise'
import watermark from '../assets/watermark-p.svg'
import SectionIntro from './SectionIntro'

/**
 * The four ways to work with Prime beyond buying or leasing a unit.
 *
 * Photographs rather than the icon tiles this section used to carry. Four
 * line-art glyphs in four rounded squares is the shape every services section
 * on the internet already has, and it says nothing — an icon of a chair is not
 * evidence of an interiors practice. A photograph of the work is.
 *
 * The label sits under its image rather than on it. On it, the type has to
 * survive whatever the photograph is doing behind it and picks up a scrim to
 * do so; under it, the picture stays a picture.
 */
export default function Services() {
  const { eyebrow, heading, paragraph, items } = useSection('services_home')
  const navigate = useNavigate()

  if (!items?.length) return null

  const go = (to) => (e) => {
    if (!to || /^https?:/.test(to)) return
    e.preventDefault()
    navigate(to)
  }

  return (
    <section
      id="services"
      data-band="light"
      className="bg-base px-gutter py-20 text-content md:px-gutter-lg md:py-28"
    >
      <div className="mx-auto max-w-[1560px]">
        <SectionIntro
          eyebrow={eyebrow}
          heading={heading}
          paragraph={paragraph}
          align="center"
          className="mx-auto"
        />

        <ul className="mt-14 grid grid-cols-2 gap-5 md:mt-16 md:grid-cols-4 md:gap-6">
          {items.map((item) => {
            // A card with nowhere to go is still worth showing — the four
            // together are the message. It just must not be a link, or the
            // keyboard collects four tab stops that do nothing.
            const Tag = item.href ? 'a' : 'div'
            // The same photograph the Expertise page gives this service. The
            // CMS rows carry an empty `image`, so this band drew its watermark
            // placeholder for all four while the pictures sat unused in
            // `public/images/expertise` — resolved through the shared map, the
            // two pages now agree, and a CMS upload still overrides both.
            const image = serviceImage(item)
            return (
              <li key={item.title}>
                <Tag
                  {...(item.href ? { href: item.href, onClick: go(item.href) } : {})}
                  className="group block outline-none"
                >
                  <div className="relative overflow-hidden rounded-panel bg-surface-alt">
                    {image ? (
                      <img
                        src={sized(image, 'card')}
                        alt=""
                        loading="lazy"
                        decoding="async"
                        className="aspect-4/3 w-full object-cover transition-transform duration-700 ease-brand group-hover:scale-[1.06]"
                      />
                    ) : (
                      // Branded rather than blank, for a service with no
                      // photograph — a fifth capability added through the CMS
                      // before its picture is uploaded. An empty grey rectangle
                      // reads as a broken image; the mark reads as a picture
                      // that is coming. No stand-in photography is invented
                      // here — a stock building presented as Prime's work is a
                      // fabricated claim, however temporary.
                      <div
                        aria-hidden
                        className="flex aspect-4/3 w-full items-center justify-center bg-[radial-gradient(120%_120%_at_50%_0%,var(--color-prime-soft),transparent)]"
                      >
                        <img src={watermark} alt="" className="w-1/4 opacity-25" />
                      </div>
                    )}
                    {item.href && (
                      <span className="pointer-events-none absolute inset-0 rounded-panel ring-0 ring-accent transition-[box-shadow] duration-300 group-focus-visible:ring-2" />
                    )}
                  </div>

                  <p
                    className="mt-4 font-display font-medium leading-tight tracking-[-0.01em] text-content/65 transition-colors duration-300 group-hover:text-content"
                    style={{ fontSize: 'clamp(1.05rem, 1.6vw, 1.5rem)' }}
                  >
                    {item.title}
                  </p>
                </Tag>
              </li>
            )
          })}
        </ul>
      </div>
    </section>
  )
}
