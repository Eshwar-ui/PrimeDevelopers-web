import { useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useProject } from '../context/ContentContext'
import { useSectionNav } from '../hooks/useSectionNav'
import PillButton from '../components/PillButton'
import SocialIcon from '../components/SocialIcon'

// Eyebrow section label with the accent dash, matching the site system.
function SectionTag({ children, tone = 'inv' }) {
  const inv = tone === 'inv'
  return (
    <div className="flex items-center gap-4">
      <span aria-hidden className={`h-px w-10 shrink-0 ${inv ? 'bg-accent-soft' : 'bg-accent'}`} />
      <span
        className={`font-body text-[13px] font-bold uppercase tracking-[0.28em] ${
          inv ? 'text-bone/80' : 'text-ink/70'
        }`}
      >
        {children}
      </span>
    </div>
  )
}

function youtubeEmbedUrl(url) {
  const match = url.match(/(?:youtu\.be\/|v=|embed\/)([\w-]{11})/)
  return match ? `https://www.youtube.com/embed/${match[1]}` : url
}

export default function ProjectDetailPage() {
  const { slug } = useParams()
  const project = useProject(slug)
  const go = useSectionNav()
  const [tab, setTab] = useState(0)
  const [galleryMain, setGalleryMain] = useState(0)
  const [openArea, setOpenArea] = useState(0)

  if (!project) {
    return (
      <section className="flex min-h-[70vh] flex-col items-center justify-center gap-6 bg-void px-6 text-center">
        <h1 className="font-display text-3xl font-medium text-bone">Project not found</h1>
        <Link to="/projects" className="eyebrow text-accent-soft">
          ← Back to all projects
        </Link>
      </section>
    )
  }

  const d = project.detail
  const gallery = project.gallery ?? []
  const soldPct = Math.round((project.sold / project.buildings) * 100)

  return (
    <div>
      {/* ── Hero ─────────────────────────────────────────────── */}
      <section
        id="projects-hero"
        className="relative overflow-hidden bg-void px-6 pb-16 pt-32 text-bone md:px-[75px] md:pb-20 md:pt-44"
      >
        <div
          aria-hidden
          className="absolute inset-0"
          style={{
            background:
              'radial-gradient(55% 55% at 100% 0%, rgba(0,115,164,0.14) 0%, rgba(0,115,164,0) 100%)',
          }}
        />
        <div className="relative">
          <Link to="/projects" className="eyebrow mb-8 inline-block text-bone/50 hover:text-bone">
            ← All projects
          </Link>
          <span className="eyebrow mb-5 block text-accent-soft">
            {project.category} · {project.address}
          </span>
          <h1 className="font-display text-h2 font-light leading-[1.0] tracking-[-0.02em]">
            {project.name}
          </h1>
          {d?.tagline && (
            <p className="mt-6 max-w-[52ch] font-body text-lg leading-relaxed text-bone/65">
              {d.tagline}
            </p>
          )}
          {d?.socials?.length > 0 && (
            <div className="mt-7 flex flex-wrap gap-3">
              {d.socials.map(
                (s, i) =>
                  s.url && (
                    <a
                      key={i}
                      href={s.url}
                      target="_blank"
                      rel="noreferrer"
                      aria-label={s.platform}
                      className="flex size-10 items-center justify-center rounded-full border border-[var(--color-line-inv)] text-bone/70 transition-colors hover:border-accent-soft hover:text-accent-soft"
                    >
                      <SocialIcon platform={s.platform} className="size-4" />
                    </a>
                  )
              )}
            </div>
          )}
        </div>

        {project.image && (
          <div className="relative mt-14 h-[300px] overflow-hidden rounded-3xl border border-[var(--color-line-inv)] md:h-[460px]">
            <img src={project.image} alt={project.name} className="h-full w-full object-cover" />
            <div
              aria-hidden
              className="absolute inset-0"
              style={{ background: 'linear-gradient(180deg, transparent 55%, rgba(26,26,26,0.55))' }}
            />
          </div>
        )}
      </section>

      {/* ── Resource links — flyers, listings, floor plan PDFs ─── */}
      {d?.resourceLinks?.length > 0 && (
        <section className="bg-carbon px-6 py-14 text-bone md:px-[75px] md:py-20">
          <SectionTag>Resources</SectionTag>
          <div className="mt-8 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {d.resourceLinks.map(
              (link, i) =>
                link.url &&
                link.label && (
                  <a
                    key={i}
                    href={link.url}
                    target="_blank"
                    rel="noreferrer"
                    className="group flex items-center gap-4 rounded-2xl border border-[var(--color-line-inv)] bg-ink p-4 transition-colors hover:border-bone/25"
                  >
                    {link.thumbnail ? (
                      <img src={link.thumbnail} alt="" className="h-12 w-12 shrink-0 rounded-lg object-cover" />
                    ) : (
                      <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-void">
                        <span className="text-ember">→</span>
                      </span>
                    )}
                    <span className="font-body text-sm font-bold uppercase tracking-[0.1em] text-bone transition-colors group-hover:text-accent-soft">
                      {link.label}
                    </span>
                  </a>
                )
            )}
          </div>
        </section>
      )}

      {/* ── Overview ─────────────────────────────────────────── */}
      {d?.overview?.heading && (
        <section className="bg-ink px-6 py-20 text-bone md:px-[75px] md:py-28">
          <div className="grid gap-12 lg:grid-cols-[1fr_1fr] lg:gap-20">
            {/* Image collage */}
            {gallery.length >= 3 && (
              <div className="grid grid-cols-2 gap-4">
                <img src={gallery[0]} alt="" className="col-span-2 h-64 w-full rounded-2xl object-cover md:h-80" />
                <img src={gallery[1]} alt="" className="h-40 w-full rounded-2xl object-cover md:h-48" />
                <img src={gallery[2]} alt="" className="h-40 w-full rounded-2xl object-cover md:h-48" />
              </div>
            )}

            <div className="flex flex-col justify-center">
              <SectionTag>{d.overview.eyebrow}</SectionTag>
              <h2 className="mt-6 font-display text-h2 font-light leading-[1.05] tracking-[-0.02em]">
                {d.overview.heading}
              </h2>
              <p className="mt-6 max-w-[52ch] font-body text-base leading-relaxed text-bone/60">
                {d.overview.body}
              </p>
              {d.overview.flyer && (
                <div className="mt-8 w-fit">
                  <PillButton href={d.overview.flyer} variant="bone">
                    View Flyer
                  </PillButton>
                </div>
              )}

              {/* Stats box */}
              {d.overview.stats?.length > 0 && (
                <div className="mt-10 grid grid-cols-3 gap-px overflow-hidden rounded-2xl border border-[var(--color-line-inv)] bg-[var(--color-line-inv)]">
                  {d.overview.stats.map((s) => (
                    <div key={s.label} className="flex flex-col gap-1.5 bg-ink px-3 py-6 text-center">
                      <span className="numeral text-xl text-ember">{s.value}</span>
                      <span className="eyebrow text-[0.58rem] text-bone/40">{s.label}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </section>
      )}

      {/* ── Tenants ──────────────────────────────────────────── */}
      {d?.tenants?.length > 0 && (
        <section className="border-y border-[var(--color-line-inv)] bg-carbon px-6 py-12 md:px-[75px]">
          <div className="flex flex-wrap items-center justify-center gap-x-16 gap-y-8">
            {d.tenants.map((logo, i) => (
              <img
                key={i}
                src={logo}
                alt=""
                className="h-10 w-auto object-contain opacity-55 grayscale transition-all duration-300 hover:opacity-100 hover:grayscale-0 md:h-12"
              />
            ))}
          </div>
        </section>
      )}

      {/* ── Project highlights ───────────────────────────────── */}
      {d?.highlights?.heading && (
        <section className="bg-void px-6 py-20 text-bone md:px-[75px] md:py-28">
          <div className="grid gap-12 lg:grid-cols-[1fr_1.1fr] lg:gap-20">
            <div>
              <SectionTag>Project Highlights</SectionTag>
              <h2 className="mt-6 font-display text-h2 font-light leading-[1.05] tracking-[-0.02em]">
                {d.highlights.heading}
              </h2>
              <p className="mt-6 max-w-[48ch] font-body text-base leading-relaxed text-bone/60">
                {d.highlights.body}
              </p>
              {d.highlights.bigStats?.length > 0 && (
                <div className="mt-10 flex gap-12">
                  {d.highlights.bigStats.map((s) => (
                    <div key={s.label} className="flex flex-col gap-1.5">
                      <span className="numeral text-4xl text-ember">{s.value}</span>
                      <span className="eyebrow text-bone/45">{s.label}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {d.highlights.cards?.length > 0 && (
              <div className="grid gap-px overflow-hidden rounded-2xl border border-[var(--color-line-inv)] bg-[var(--color-line-inv)] sm:grid-cols-2">
                {d.highlights.cards.map((c) => (
                  <div key={c.title} className="flex flex-col gap-2.5 bg-ink p-7">
                    <h3 className="font-display text-lg font-medium text-bone">{c.title}</h3>
                    <p className="font-body text-sm leading-relaxed text-bone/55">{c.body}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      )}

      {/* ── Floor plans ──────────────────────────────────────── */}
      {d?.floorPlans?.buildings?.length > 0 && (
        <section className="bg-ink px-6 py-20 text-bone md:px-[75px] md:py-28">
          <SectionTag>Floor Plans</SectionTag>
          <h2 className="mt-6 max-w-[20ch] font-display text-h2 font-light leading-[1.05] tracking-[-0.02em]">
            {d.floorPlans.heading}
          </h2>
          <p className="mt-6 max-w-[70ch] font-body text-base leading-relaxed text-bone/60">
            {d.floorPlans.body}
          </p>

          <div className="mt-10 flex flex-wrap gap-2.5">
            {d.floorPlans.buildings.map((b, i) => (
              <button
                key={b.building}
                type="button"
                onClick={() => setTab(i)}
                className={`rounded-full border px-5 py-2 font-body text-[13px] font-bold uppercase tracking-[0.14em] transition-colors duration-300 ${
                  i === tab
                    ? 'border-accent bg-accent text-void'
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
                  <span className="font-body text-sm text-bone/50">{label}</span>
                  <span className="font-display text-base font-medium text-bone">{value}</span>
                </div>
              ))}
            </div>

            {/* Plan image placeholder */}
            <div className="flex h-[280px] items-center justify-center rounded-2xl border border-[var(--color-line-inv)] bg-void md:h-[380px]">
              <span className="eyebrow text-bone/35">
                Floor plan — {d.floorPlans.buildings[tab].building}
              </span>
            </div>
          </div>
        </section>
      )}

      {/* ── Gateway for growth — light intermission ──────────── */}
      {d?.location?.heading && (
        <section data-band="light" className="bg-bone px-6 py-20 text-ink md:px-[75px] md:py-28">
          <div className="grid gap-12 lg:grid-cols-[1.1fr_1fr] lg:gap-20">
            {/* Image + thumbnails */}
            {gallery.length > 0 && (
              <div>
                <img
                  src={gallery[galleryMain]}
                  alt=""
                  className="h-[300px] w-full rounded-2xl object-cover md:h-[420px]"
                />
                <div className="mt-4 flex gap-3">
                  {gallery.slice(0, 5).map((src, i) => (
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
            )}

            <div className="flex flex-col justify-center">
              <SectionTag tone="ink">{d.location.eyebrow}</SectionTag>
              <h2 className="mt-6 font-display text-h2 font-light leading-[1.05] tracking-[-0.02em] text-ink">
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

      {/* ── Established sites gallery — light intermission ────── */}
      {d?.establishedSites?.heading && gallery.length > 0 && (
        <section data-band="light" className="bg-bone px-6 pb-20 text-ink md:px-[75px] md:pb-28">
          <SectionTag tone="ink">Established Sites</SectionTag>
          <h2 className="mt-6 max-w-[24ch] font-display text-h2 font-light leading-[1.05] tracking-[-0.02em] text-ink">
            {d.establishedSites.heading}
          </h2>
          <div className="mt-12 grid grid-cols-2 gap-4 md:grid-cols-4 md:gap-5">
            {gallery.slice(0, 4).map((src, i) => (
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

      {/* ── Ext. Facade photo strip ──────────────────────────── */}
      {d?.extFacade?.length > 0 && (
        <section className="bg-void px-6 py-20 text-bone md:px-[75px] md:py-28">
          <SectionTag>Ext. Facade</SectionTag>
          <div className="mt-10 grid grid-cols-2 gap-4 md:grid-cols-4 md:gap-5">
            {d.extFacade.map(
              (src, i) =>
                src && (
                  <div key={i} className="overflow-hidden rounded-2xl bg-carbon">
                    <img src={src} alt="" className="h-48 w-full object-cover md:h-56" />
                  </div>
                )
            )}
          </div>
        </section>
      )}

      {/* ── Neighborhoods + map ──────────────────────────────── */}
      {d?.neighborhoods?.items?.length > 0 && (
        <section className="bg-ink px-6 py-20 text-bone md:px-[75px] md:py-28">
          <SectionTag>Head by Areas</SectionTag>
          <h2 className="mt-6 font-display text-h2 font-light tracking-[-0.02em]">Neighborhoods</h2>

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
                      <span className={`text-ember transition-transform ${open ? 'rotate-45' : ''}`}>
                        +
                      </span>
                    </span>
                    {open && n.note && (
                      <span className="max-w-[46ch] font-body text-sm leading-relaxed text-bone/55">
                        {n.note}
                      </span>
                    )}
                  </button>
                )
              })}
            </div>

            {/* Map */}
            {d.neighborhoods.mapQuery && (
              <div className="h-[300px] overflow-hidden rounded-2xl border border-[var(--color-line-inv)] md:h-[380px]">
                <iframe
                  title="Location map"
                  src={`https://www.google.com/maps?q=${encodeURIComponent(d.neighborhoods.mapQuery)}&output=embed`}
                  className="h-full w-full grayscale invert-[0.92]"
                  loading="lazy"
                  referrerPolicy="no-referrer-when-downgrade"
                />
              </div>
            )}
          </div>
        </section>
      )}

      {/* ── Videos ───────────────────────────────────────────── */}
      {d?.videos?.length > 0 && (
        <section className="bg-void px-6 py-20 text-bone md:px-[75px] md:py-28">
          <SectionTag>YouTube</SectionTag>
          <h2 className="mt-6 font-display text-h2 font-light tracking-[-0.02em]">Videos</h2>
          <div className="mt-12 grid grid-cols-1 gap-5 sm:grid-cols-2">
            {d.videos.map(
              (v, i) =>
                v.url && (
                  <div
                    key={i}
                    className="relative aspect-video overflow-hidden rounded-2xl border border-[var(--color-line-inv)] bg-ink"
                  >
                    <iframe
                      title={`Project video ${i + 1}`}
                      src={youtubeEmbedUrl(v.url)}
                      className="h-full w-full"
                      loading="lazy"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen
                    />
                  </div>
                )
            )}
          </div>
        </section>
      )}

      {/* ── CTA ──────────────────────────────────────────────── */}
      <section className="bg-void px-6 pb-20 md:px-[75px] md:pb-28">
        <div className="flex flex-col items-start gap-8 rounded-3xl border border-[var(--color-line-inv)] bg-carbon p-10 text-bone md:flex-row md:items-center md:justify-between md:p-14">
          <div>
            <h3 className="font-display text-3xl font-medium leading-[1.05] tracking-[-0.01em] md:text-4xl">
              Interested in {project.name}?
            </h3>
            <p className="mt-3 font-body text-base text-bone/60">
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
