import { useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { getProject } from '../data/projects'
import { useSectionNav } from '../hooks/useSectionNav'
import PillButton from '../components/PillButton'

// Small eyebrow section label with the accent dash, matching the site system.
function SectionTag({ children, tone = 'ink' }) {
  const inv = tone === 'inv'
  return (
    <div className="flex items-center gap-4">
      <span aria-hidden className={`h-px w-10 shrink-0 ${inv ? 'bg-accent-soft' : 'bg-accent'}`} />
      <span
        className={`font-body text-[13px] font-bold uppercase tracking-[0.24em] ${
          inv ? 'text-bone/80' : 'text-ink/70'
        }`}
      >
        {children}
      </span>
    </div>
  )
}

export default function ProjectDetailPage() {
  const { slug } = useParams()
  const project = getProject(slug)
  const go = useSectionNav()
  const [tab, setTab] = useState(0)
  const [galleryMain, setGalleryMain] = useState(0)
  const [openArea, setOpenArea] = useState(0)

  if (!project) {
    return (
      <section className="flex min-h-[70vh] flex-col items-center justify-center gap-6 bg-bone px-6 text-center">
        <h1 className="font-display text-2xl font-medium text-ink">Project not found</h1>
        <Link to="/projects" className="eyebrow text-accent">
          ← Back to all projects
        </Link>
      </section>
    )
  }

  const d = project.detail
  const soldPct = Math.round((project.sold / project.buildings) * 100)

  return (
    <div>
      {/* ── Hero ─────────────────────────────────────────────── */}
      <section
        id="projects-hero"
        className="relative overflow-hidden bg-ink px-6 pb-16 pt-32 text-bone md:px-[75px] md:pb-20 md:pt-40"
      >
        <div
          aria-hidden
          className="absolute inset-0"
          style={{
            background:
              'radial-gradient(55% 55% at 100% 0%, rgba(0,155,222,0.35) 0%, rgba(0,155,222,0) 100%)',
          }}
        />
        <div className="relative">
          <Link to="/projects" className="eyebrow mb-8 inline-block text-bone/60 hover:text-bone">
            ← All projects
          </Link>
          <span className="eyebrow mb-5 block text-accent-soft">
            {project.category} · {project.address}
          </span>
          <h1
            className="font-display font-light uppercase leading-[1.05] tracking-[0.02em]"
            style={{ fontSize: 'clamp(2rem, 4.4vw, 3.5rem)' }}
          >
            {project.name}
          </h1>
          {d?.tagline && (
            <p className="mt-6 max-w-[52ch] font-body text-lg leading-relaxed text-bone/75">
              {d.tagline}
            </p>
          )}
        </div>

        <div className="relative mt-14 h-[300px] overflow-hidden rounded-3xl border border-[var(--color-line-inv)] md:h-[440px]">
          <img src={project.image} alt={project.name} className="h-full w-full object-cover" />
        </div>
      </section>

      {/* ── Overview ─────────────────────────────────────────── */}
      {d?.overview && (
        <section className="bg-bone px-6 py-20 md:px-[75px] md:py-28">
          <div className="grid gap-12 lg:grid-cols-[1fr_1fr] lg:gap-20">
            {/* Image collage */}
            <div className="grid grid-cols-2 gap-4">
              <img src={project.gallery[0]} alt="" className="col-span-2 h-64 w-full rounded-2xl object-cover md:h-80" />
              <img src={project.gallery[1]} alt="" className="h-40 w-full rounded-2xl object-cover md:h-48" />
              <img src={project.gallery[2]} alt="" className="h-40 w-full rounded-2xl object-cover md:h-48" />
            </div>

            <div className="flex flex-col justify-center">
              <SectionTag>{d.overview.eyebrow}</SectionTag>
              <h2 className="mt-6 font-display text-3xl font-medium leading-[1.15] tracking-[-0.01em] text-ink md:text-[40px]">
                {d.overview.heading}
              </h2>
              <p className="mt-6 max-w-[52ch] font-body text-base leading-relaxed text-muted">
                {d.overview.body}
              </p>
              {d.overview.flyer && (
                <div className="mt-8 w-fit">
                  <PillButton href={d.overview.flyer} variant="ink">
                    View Flyer
                  </PillButton>
                </div>
              )}

              {/* Stats box */}
              <div className="mt-10 grid grid-cols-3 gap-px overflow-hidden rounded-2xl border border-[var(--color-line)] bg-[var(--color-line)]">
                {d.overview.stats.map((s) => (
                  <div key={s.label} className="flex flex-col gap-1.5 bg-bone px-3 py-6 text-center">
                    <span className="font-display text-2xl font-light leading-none text-ink">
                      {s.value}
                    </span>
                    <span className="eyebrow text-[0.6rem] text-muted">{s.label}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>
      )}

      {/* ── Tenants ──────────────────────────────────────────── */}
      {d?.tenants && (
        <section className="border-y border-[var(--color-line)] bg-bone-deep px-6 py-12 md:px-[75px]">
          <div className="flex flex-wrap items-center justify-center gap-x-16 gap-y-8">
            {d.tenants.map((logo, i) => (
              <img
                key={i}
                src={logo}
                alt=""
                className="h-10 w-auto object-contain opacity-70 grayscale transition-all duration-300 hover:opacity-100 hover:grayscale-0 md:h-12"
              />
            ))}
          </div>
        </section>
      )}

      {/* ── Project highlights ───────────────────────────────── */}
      {d?.highlights && (
        <section className="bg-bone px-6 py-20 md:px-[75px] md:py-28">
          <div className="grid gap-12 lg:grid-cols-[1fr_1.1fr] lg:gap-20">
            <div>
              <SectionTag>Project Highlights</SectionTag>
              <h2 className="mt-6 font-display text-3xl font-medium leading-[1.15] tracking-[-0.01em] text-ink md:text-[40px]">
                {d.highlights.heading}
              </h2>
              <p className="mt-6 max-w-[48ch] font-body text-base leading-relaxed text-muted">
                {d.highlights.body}
              </p>
              <div className="mt-10 flex gap-12">
                {d.highlights.bigStats.map((s) => (
                  <div key={s.label} className="flex flex-col gap-1.5">
                    <span className="font-display text-4xl font-light leading-none text-ink">
                      {s.value}
                    </span>
                    <span className="eyebrow text-accent">{s.label}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="grid gap-px overflow-hidden rounded-2xl border border-[var(--color-line)] bg-[var(--color-line)] sm:grid-cols-2">
              {d.highlights.cards.map((c) => (
                <div key={c.title} className="flex flex-col gap-2.5 bg-bone p-7">
                  <h3 className="font-display text-lg font-medium text-ink">{c.title}</h3>
                  <p className="font-body text-sm leading-relaxed text-muted">{c.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ── Floor plans ──────────────────────────────────────── */}
      {d?.floorPlans && (
        <section className="bg-ink px-6 py-20 text-bone md:px-[75px] md:py-28">
          <SectionTag tone="inv">Floor Plans</SectionTag>
          <h2 className="mt-6 max-w-[20ch] font-display text-3xl font-medium leading-[1.15] tracking-[-0.01em] md:text-[40px]">
            {d.floorPlans.heading}
          </h2>
          <p className="mt-6 max-w-[70ch] font-body text-base leading-relaxed text-bone/65">
            {d.floorPlans.body}
          </p>

          <div className="mt-10 flex flex-wrap gap-2.5">
            {d.floorPlans.buildings.map((b, i) => (
              <button
                key={b.building}
                type="button"
                onClick={() => setTab(i)}
                className={`rounded-full border px-5 py-2 font-body text-sm font-bold uppercase tracking-[0.14em] transition-colors duration-300 ${
                  i === tab
                    ? 'border-accent bg-accent text-bone'
                    : 'border-[var(--color-line-inv)] text-bone/55 hover:border-bone/40 hover:text-bone'
                }`}
              >
                {b.building}
              </button>
            ))}
          </div>

          <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_1.4fr] lg:gap-12">
            {/* Spec table */}
            <div className="divide-y divide-[var(--color-line-inv)] rounded-2xl border border-[var(--color-line-inv)]">
              {[
                ['Total Area', `${d.floorPlans.buildings[tab].area} sq ft`],
                ['Building No.', d.floorPlans.buildings[tab].number],
                ['Total Units', d.floorPlans.buildings[tab].units],
                ['Available Units', d.floorPlans.buildings[tab].available],
                ['Parking Available', d.floorPlans.buildings[tab].parking],
              ].map(([label, value]) => (
                <div key={label} className="flex items-center justify-between px-6 py-4">
                  <span className="font-body text-sm text-bone/60">{label}</span>
                  <span className="font-display text-base font-medium text-bone">{value}</span>
                </div>
              ))}
            </div>

            {/* Plan image placeholder */}
            <div className="flex h-[280px] items-center justify-center rounded-2xl border border-[var(--color-line-inv)] bg-[#141418] md:h-[380px]">
              <span className="eyebrow text-bone/40">
                Floor plan — {d.floorPlans.buildings[tab].building}
              </span>
            </div>
          </div>
        </section>
      )}

      {/* ── Gateway for growth ───────────────────────────────── */}
      {d?.location && (
        <section className="bg-bone px-6 py-20 md:px-[75px] md:py-28">
          <div className="grid gap-12 lg:grid-cols-[1.1fr_1fr] lg:gap-20">
            {/* Image + thumbnails */}
            <div>
              <img
                src={project.gallery[galleryMain]}
                alt=""
                className="h-[300px] w-full rounded-2xl object-cover md:h-[420px]"
              />
              <div className="mt-4 flex gap-3">
                {project.gallery.slice(0, 5).map((src, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => setGalleryMain(i)}
                    className={`h-16 w-20 shrink-0 overflow-hidden rounded-lg border transition-colors ${
                      i === galleryMain ? 'border-accent' : 'border-transparent opacity-60 hover:opacity-100'
                    }`}
                  >
                    <img src={src} alt="" className="h-full w-full object-cover" />
                  </button>
                ))}
              </div>
            </div>

            <div className="flex flex-col justify-center">
              <SectionTag>{d.location.eyebrow}</SectionTag>
              <h2 className="mt-6 font-display text-3xl font-medium leading-[1.1] tracking-[-0.01em] text-ink md:text-[40px]">
                {d.location.heading}
              </h2>
              <p className="mt-3 font-display text-lg font-medium text-accent">{d.location.sub}</p>
              <p className="mt-6 max-w-[58ch] font-body text-base leading-relaxed text-muted">
                {d.location.body}
              </p>
            </div>
          </div>
        </section>
      )}

      {/* ── Established sites gallery ─────────────────────────── */}
      {d?.establishedSites && (
        <section className="bg-bone px-6 pb-20 md:px-[75px] md:pb-28">
          <SectionTag>Established Sites</SectionTag>
          <h2 className="mt-6 max-w-[24ch] font-display text-3xl font-medium leading-[1.15] tracking-[-0.01em] text-ink md:text-[40px]">
            {d.establishedSites.heading}
          </h2>
          <div className="mt-12 grid grid-cols-2 gap-4 md:grid-cols-4 md:gap-5">
            {project.gallery.slice(0, 4).map((src, i) => (
              <div key={i} className="group overflow-hidden rounded-2xl bg-bone-deep">
                <img
                  src={src}
                  alt=""
                  className="h-48 w-full object-cover grayscale transition-all duration-700 ease-out group-hover:scale-[1.04] group-hover:grayscale-0 md:h-56"
                />
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ── Neighborhoods + map ──────────────────────────────── */}
      {d?.neighborhoods && (
        <section className="bg-ink px-6 py-20 text-bone md:px-[75px] md:py-28">
          <SectionTag tone="inv">Head by Areas</SectionTag>
          <h2 className="mt-6 font-display text-3xl font-medium tracking-[-0.01em] md:text-[40px]">
            Neighborhoods
          </h2>

          <div className="mt-12 grid gap-10 lg:grid-cols-[1fr_1.2fr] lg:gap-16">
            {/* Accordion */}
            <div className="divide-y divide-[var(--color-line-inv)] border-y border-[var(--color-line-inv)]">
              {d.neighborhoods.items.map((n, i) => {
                const open = i === openArea
                return (
                  <button
                    key={n.name}
                    type="button"
                    onClick={() => setOpenArea(open ? -1 : i)}
                    className="flex w-full flex-col items-start gap-2 py-5 text-left"
                  >
                    <span className="flex w-full items-center justify-between gap-4">
                      <span className="font-display text-lg font-medium text-bone">{n.name}</span>
                      <span className={`text-accent-soft transition-transform ${open ? 'rotate-45' : ''}`}>
                        +
                      </span>
                    </span>
                    {open && n.note && (
                      <span className="max-w-[46ch] font-body text-sm leading-relaxed text-bone/60">
                        {n.note}
                      </span>
                    )}
                  </button>
                )
              })}
            </div>

            {/* Map */}
            <div className="h-[300px] overflow-hidden rounded-2xl border border-[var(--color-line-inv)] md:h-[380px]">
              <iframe
                title="Location map"
                src={`https://www.google.com/maps?q=${encodeURIComponent(d.neighborhoods.mapQuery)}&output=embed`}
                className="h-full w-full grayscale"
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
              />
            </div>
          </div>
        </section>
      )}

      {/* ── Videos ───────────────────────────────────────────── */}
      {d?.videos > 0 && (
        <section className="bg-bone px-6 py-20 md:px-[75px] md:py-28">
          <SectionTag>YouTube</SectionTag>
          <h2 className="mt-6 font-display text-3xl font-medium tracking-[-0.01em] text-ink md:text-[40px]">
            Videos
          </h2>
          <div className="mt-12 grid grid-cols-1 gap-5 sm:grid-cols-2">
            {Array.from({ length: d.videos }).map((_, i) => (
              <div
                key={i}
                className="group relative flex aspect-video items-center justify-center overflow-hidden rounded-2xl border border-[var(--color-line)] bg-bone-deep"
              >
                <img
                  src={project.gallery[i % project.gallery.length]}
                  alt=""
                  className="absolute inset-0 h-full w-full object-cover opacity-40 grayscale"
                />
                <span className="relative flex size-16 items-center justify-center rounded-full bg-accent text-bone shadow-lg transition-transform group-hover:scale-110">
                  <span className="ml-1 text-xl leading-none">▶</span>
                </span>
              </div>
            ))}
          </div>
          <p className="eyebrow mt-6 text-muted">Add YouTube links to enable playback.</p>
        </section>
      )}

      {/* ── CTA ──────────────────────────────────────────────── */}
      <section className="bg-bone px-6 pb-20 md:px-[75px] md:pb-28">
        <div className="flex flex-col items-start gap-8 rounded-3xl bg-ink p-10 text-bone md:flex-row md:items-center md:justify-between md:p-14">
          <div>
            <h3 className="font-display text-2xl font-medium leading-[1.15] tracking-[-0.01em] md:text-3xl">
              Interested in {project.name}?
            </h3>
            <p className="mt-3 font-body text-base text-bone/70">
              Talk to our team about availability, pricing, and tours. ({soldPct}% currently reserved.)
            </p>
          </div>
          <PillButton
            href="/contact"
            variant="accent"
            onClick={(e) => {
              e.preventDefault()
              go('/contact')
            }}
          >
            Enquire now
          </PillButton>
        </div>
      </section>
    </div>
  )
}
