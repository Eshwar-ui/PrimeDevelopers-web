import { useRef } from 'react'
import { Link } from 'react-router-dom'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { useGSAP } from '@gsap/react'
import { useSection } from '../context/ContentContext'
import { SERVICE_ICON_GLYPHS } from '../lib/serviceIcons'
import ArrowRight from './ArrowRight'

gsap.registerPlugin(ScrollTrigger)

function ServiceIcon({ name, className = 'size-5', strokeWidth = 1.7 }) {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      {SERVICE_ICON_GLYPHS[name] ?? SERVICE_ICON_GLYPHS.compass}
    </svg>
  )
}

function ServiceArtwork({ name }) {
  const common = {
    viewBox: '0 0 180 130',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.15,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    className: 'h-auto w-44',
  }

  if (name === 'map-pin') {
    return (
      <svg {...common}>
        <path d="M18 112h148M32 112V77h25v35M57 112V49h35v63M92 112V23h38v89M130 112V68h25v44" />
        <path d="M43 87h4m-4 9h4m25-35h5m-5 11h5m-5 11h5m34-46h5m-5 12h5m-5 12h5m-5 12h5m26 7h5m-5 11h5" />
        <path d="M111 23v-9m-5 9h10" />
      </svg>
    )
  }

  if (name === 'shield-check') {
    return (
      <svg {...common}>
        <circle cx="48" cy="33" r="13" /><circle cx="132" cy="33" r="13" />
        <path d="M27 111V72c0-14 9-25 21-25s21 11 21 25v12M153 111V72c0-14-9-25-21-25s-21 11-21 25v12" />
        <path d="m54 71 23 18c5 4 10 3 14-1l6-6c4-4 9-5 14-1l16 12" />
        <path d="m67 82 17 14c4 3 8 3 12 0l10-9" />
        <path d="M29 111h38m46 0h38" />
      </svg>
    )
  }

  if (name === 'clock') {
    return (
      <svg {...common}>
        <circle cx="104" cy="42" r="19" />
        <path d="M78 48v-8c0-16 12-29 26-29s26 13 26 29v8" />
        <path d="M78 39h-7v20h11M130 39h7v20h-11M137 58c0 9-7 16-17 16h-7" />
        <path d="M69 114c2-24 15-38 35-38s33 14 35 38" />
        <path d="M85 83c3 12 10 18 19 18s16-6 19-18" />
        <path d="M23 87c18-7 35-7 50 0M16 96c20-8 39-8 57 0" strokeDasharray="1 6" />
      </svg>
    )
  }

  return (
    <svg {...common}>
      <path d="M18 30c35 0 50 12 70 34s39 37 76 37M18 45c30 0 47 10 67 29s42 31 79 31M18 60c26 0 43 8 63 23s44 25 83 25" strokeDasharray="1 7" />
      <path d="M18 75c24 0 42 5 61 16s46 18 85 18M18 90c25 0 44 3 64 11s45 11 82 11" strokeDasharray="1 7" />
      <circle cx="94" cy="69" r="2.5" /><circle cx="112" cy="84" r="2" /><circle cx="132" cy="96" r="1.8" />
    </svg>
  )
}
function ServiceHeading({ children }) {
  const words = String(children ?? '').trim().split(/\s+/)
  if (words.length < 5) return children
  const lineBreak = Math.floor(words.length / 2)
  const firstLine = words.slice(0, lineBreak).join(' ')
  const secondLine = words.slice(lineBreak, -2).join(' ')
  const accent = words.slice(-2).join(' ')

  return (
    <>
      <span className="md:block md:whitespace-nowrap">{firstLine}</span>{' '}
      <span className="md:block md:whitespace-nowrap">{secondLine} <span className="text-accent-soft">{accent}</span></span>
    </>
  )
}

export default function Services() {
  const { eyebrow, heading, items = [] } = useSection('services_home')
  const scope = useRef(null)

  useGSAP(
    () => {
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

      gsap.from('[data-services-heading]', {
        y: 24,
        opacity: 0,
        duration: 0.8,
        ease: 'power3.out',
        clearProps: 'transform,opacity',
        scrollTrigger: { trigger: scope.current, start: 'top 78%' },
      })
      gsap.from('[data-service]', {
        y: 32,
        opacity: 0,
        duration: 0.78,
        ease: 'power3.out',
        stagger: 0.09,
        clearProps: 'transform,opacity',
        scrollTrigger: { trigger: scope.current, start: 'top 72%' },
      })
    },
    { scope }
  )

  if (items.length === 0) return null

  return (
    <section
      id="services"
      ref={scope}
      className="relative overflow-hidden bg-void px-gutter py-16 text-bone md:px-gutter-lg md:py-20 xl:flex xl:min-h-[100svh] xl:items-center"
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-[34rem] opacity-70"
        style={{ background: 'radial-gradient(circle at 50% 10%, color-mix(in oklab, var(--color-accent) 13%, transparent), transparent 62%)' }}
      />

      <div className="relative mx-auto w-full max-w-[1380px]">
        {(eyebrow || heading) && (
          <div data-services-heading className="mx-auto mb-10 max-w-[1000px] text-center md:mb-10">
            {eyebrow && (
              <div className="flex items-center justify-center gap-5">
                <span aria-hidden className="h-px w-11 bg-accent-soft/30" />
                <p className="font-body text-[12px] font-bold uppercase tracking-[0.3em] text-accent-soft">{eyebrow}</p>
                <span aria-hidden className="h-px w-11 bg-accent-soft/30" />
              </div>
            )}
            {heading && (
              <>
                <h2 className="mx-auto mt-5 max-w-none text-balance font-display text-[clamp(1.8rem,3.25vw,3rem)] font-bold leading-[1.08] tracking-[-0.03em] text-bone">
                  <ServiceHeading>{heading}</ServiceHeading>
                </h2>
                <div aria-hidden className="mx-auto mt-7 flex w-24 items-center justify-center">
                  <span className="h-px flex-1 bg-bone/12" />
                  <span className="h-0.5 w-8 bg-accent-soft" />
                  <span className="h-px flex-1 bg-bone/12" />
                </div>
              </>
            )}
          </div>
        )}

        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4">
          {items.map((service, index) => (
            <Link
              key={`${service.title}-${index}`}
              to="/contact"
              data-service
              className="group relative flex min-h-[350px] flex-col overflow-hidden rounded-2xl border border-accent-soft/20 bg-[linear-gradient(145deg,#0d2232_0%,#081722_100%)] p-6 shadow-[0_28px_55px_-38px_rgba(0,0,0,0.95)] transition-[border-color,transform,box-shadow] duration-500 ease-brand hover:-translate-y-1.5 hover:border-accent-soft/55 hover:shadow-[0_34px_70px_-34px_rgba(0,115,164,0.42)] focus-visible:border-accent-soft/55 focus-visible:shadow-[0_34px_70px_-34px_rgba(0,115,164,0.42)] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent-soft motion-reduce:transform-none md:min-h-[370px] md:p-7 xl:min-h-[min(400px,46svh)] xl:p-8"
            >
              <span aria-hidden className="pointer-events-none absolute -bottom-24 -left-10 h-56 w-[130%] origin-bottom scale-y-0 rounded-[50%] bg-accent/14 opacity-0 blur-2xl transition-[transform,opacity] duration-500 ease-brand group-hover:scale-y-100 group-hover:opacity-100 group-focus-visible:scale-y-100 group-focus-visible:opacity-100 motion-reduce:transform-none motion-reduce:transition-opacity" />
              <span aria-hidden className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_25%_15%,rgba(62,155,199,0.14),transparent_44%)] opacity-0 transition-opacity duration-300 group-hover:opacity-100 group-focus-visible:opacity-100" />
              <div aria-hidden className="pointer-events-none absolute -right-5 top-8 text-accent-soft opacity-[0.09] transition-[opacity,transform] duration-500 ease-brand group-hover:-translate-x-2 group-hover:scale-[1.04] group-hover:opacity-[0.18] group-focus-visible:-translate-x-2 group-focus-visible:scale-[1.04] group-focus-visible:opacity-[0.18] motion-reduce:transform-none">
                <ServiceArtwork name={service.icon} />
              </div>

              <span className="relative flex size-16 items-center xl:size-20 justify-center rounded-full border border-accent-soft/35 text-accent-soft shadow-[inset_0_0_28px_rgba(62,155,199,0.08)] transition-[border-color,background-color,transform,box-shadow] duration-400 ease-brand group-hover:-translate-y-1 group-hover:scale-[1.04] group-hover:border-accent-soft/80 group-hover:bg-accent-soft/10 group-hover:shadow-[inset_0_0_34px_rgba(62,155,199,0.16)] group-focus-visible:border-accent-soft/80 group-focus-visible:bg-accent-soft/10 motion-reduce:transform-none">
                <span className="flex size-9 items-center xl:size-11 justify-center rounded-full border-2 border-accent-soft text-accent-soft">
                  <ServiceIcon name={service.icon} className="size-5 xl:size-6" strokeWidth={1.8} />
                </span>
              </span>

              <div className="relative mt-7 xl:mt-9">
                <h3 className="font-display text-[22px] font-bold leading-tight tracking-[-0.02em] text-bone transition-transform duration-300 ease-brand group-hover:translate-x-1 group-focus-visible:translate-x-1 motion-reduce:transform-none">{service.title}</h3>
                <span aria-hidden className="mt-4 block h-0.5 w-9 bg-accent-soft transition-[width] duration-300 ease-brand group-hover:w-14 group-focus-visible:w-14" />
                <p className="mt-4 max-w-[28ch] font-body text-[16px] leading-[1.75] text-bone/62 transition-colors duration-300 group-hover:text-bone/78 group-focus-visible:text-bone/78">{service.body}</p>
              </div>

              <span className="relative mt-auto flex size-11 items-center justify-center rounded-full border border-accent-soft text-accent-soft transition-[background-color,color,transform] duration-300 ease-brand group-hover:bg-accent-soft group-hover:text-void group-hover:translate-x-1 group-focus-visible:bg-accent-soft group-focus-visible:text-void group-focus-visible:translate-x-1 motion-reduce:transform-none">
                <ArrowRight className="size-4 transition-transform duration-300 ease-brand group-hover:translate-x-0.5 group-focus-visible:translate-x-0.5 motion-reduce:transform-none" />
              </span>
              <span className="sr-only">Contact Prime Developer about {service.title}</span>
            </Link>
          ))}
        </div>
      </div>
    </section>
  )
}