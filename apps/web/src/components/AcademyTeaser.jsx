import { useRef } from 'react'
import { Link } from 'react-router-dom'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { useGSAP } from '@gsap/react'
import { useSection } from '../context/ContentContext'
import ArrowRight from './ArrowRight'
import SectionIntro from './SectionIntro'

gsap.registerPlugin(ScrollTrigger)

/**
 * Three terms from the learning centre, as a ruled list.
 *
 * Not in the approved comp — kept at the client's instruction and restyled into
 * the same language as everything above it. A list rather than three more
 * cards, deliberately: the page already spends four sections on cards, and a
 * fifth grid of them would flatten the difference between a property, a service
 * and a definition into one texture.
 */
export default function AcademyTeaser() {
  const { heading, paragraph, terms = [], exploreLinkLabel } = useSection('academy')
  const featured = terms.slice(0, 3)
  const scope = useRef(null)

  // Deliberately not the card entrance the grids above use. This section is a
  // ruled list for the reason the note above gives, and a list that lands like
  // a set of cards undoes that distinction in motion after the layout went to
  // the trouble of making it: shorter lift, quicker, tighter stagger, so three
  // rules fill in one after another rather than three objects arriving.
  useGSAP(
    () => {
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
      gsap.from('[data-term-row]', {
        y: 18,
        opacity: 0,
        duration: 0.55,
        ease: 'power3.out',
        stagger: 0.07,
        clearProps: 'transform,opacity',
        scrollTrigger: { trigger: scope.current, start: 'top 82%' },
      })
    },
    // The terms come from the CMS after mount, so the tween has to be rebuilt
    // once they land or it is built over an empty list and never runs.
    { scope, dependencies: [featured.length], revertOnUpdate: true }
  )

  if (!featured.length) return null

  return (
    <section
      data-band="light"
      ref={scope}
      className="bg-base px-gutter py-section text-content md:py-section-lg"
    >
      <div className="mx-auto max-w-[1560px]">
        <div className="flex flex-col gap-8 md:flex-row md:items-end md:justify-between md:gap-16">
          <SectionIntro heading={heading} paragraph={paragraph} className="min-w-0" />

          <Link
            to="/learn"
            className="group inline-flex min-h-11 shrink-0 items-center gap-3 font-body text-[13px] font-bold uppercase tracking-[0.12em] text-accent outline-none focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-accent"
          >
            {exploreLinkLabel}
            <ArrowRight className="size-4 transition-transform duration-300 ease-brand group-hover:translate-x-1 motion-reduce:transform-none" />
          </Link>
        </div>

        <ol className="mt-12 border-t border-content/10">
          {featured.map((item, index) => (
            <li key={item.slug} data-term-row>
              <Link
                to={`/learn/${item.slug}`}
                className="group grid gap-3 border-b border-content/10 py-7 outline-none transition-colors duration-300 focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-accent md:grid-cols-[3.5rem_minmax(11rem,0.75fr)_1.4fr_auto] md:items-center md:gap-8">
                {/* The index is information here, not decoration: these are the
                    first three of an ordered field guide, and the numeral is
                    what says the list continues past what is shown. */}
                <span className="numeral text-[13px] text-content/30">0{index + 1}</span>
                <strong className="font-display text-[1.15rem] font-bold tracking-[-0.01em] text-content transition-colors duration-300 group-hover:text-accent">
                  {item.term}
                </strong>
                <span className="font-body text-[14px] leading-[1.7] text-content/55">
                  {item.shortDefinition}
                </span>
                <ArrowRight className="size-4 text-content/40 transition-[transform,color] duration-300 ease-brand group-hover:translate-x-1 group-hover:text-accent motion-reduce:transform-none" />
              </Link>
            </li>
          ))}
        </ol>
      </div>
    </section>
  )
}
