import { Link } from 'react-router-dom'
import { ArrowRight, ArrowSquareOut, Buildings, Newspaper, PencilSimple, Plus, TextAa, Tray } from '@phosphor-icons/react'
import { useNews, useProperties } from '../context/ContentContext'
import { useAuth } from '../context/AuthContext'
import { useLeads } from './LeadsContext'
import { useCreatePost, useCreateProperty } from './useCreate'
import { SECTIONS } from './content/sectionEditors'
import { QUICK_EDITS } from './content/sectionMeta'
import { Alert, Badge, Button, Card, PageHeader, Skeleton, StatusPill, focusRing } from './components/ui'
import { timeAgo, useAdminTitle } from './adminUtils'

const RECENT_LEADS = 5

function greeting() {
  const h = new Date().getHours()
  return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening'
}

/**
 * The first screen after sign-in. Ordered by what needs a person: new leads
 * are the only thing in the admin that goes stale while nobody looks, so they
 * lead; then what's unfinished (drafts); then the edits made most often.
 *
 * It used to be three counts, one of them hardcoded — "11 site content
 * sections" when there were 29.
 */
export default function DashboardPage() {
  useAdminTitle('Dashboard')
  const { session } = useAuth()
  const properties = useProperties()
  const posts = useNews()
  const { leads, newCount, summary, error: leadsError, reload } = useLeads()
  const newProperty = useCreateProperty()
  const newPost = useCreatePost()

  const liveProperties = properties.filter((p) => p.published).length
  const livePosts = posts.filter((p) => p.published).length
  const availableUnits = properties.reduce((n, p) => n + (Number(p.available) || 0), 0)

  const stats = [
    {
      label: 'New leads',
      value: leads ? newCount : null,
      // The server's count: the list holds only the newest page.
      sub: leads ? `${summary?.total ?? leads.length} enquiries in total` : 'Loading…',
      to: '/admin/leads?status=new',
      icon: Tray,
      attention: newCount > 0,
    },
    {
      label: 'Properties',
      value: properties.length,
      sub: `${liveProperties} live · ${properties.length - liveProperties} draft · ${availableUnits} units available`,
      to: '/admin/properties',
      icon: Buildings,
    },
    {
      label: 'News posts',
      value: posts.length,
      sub: `${livePosts} live · ${posts.length - livePosts} draft`,
      to: '/admin/news',
      icon: Newspaper,
    },
    {
      label: 'Site content',
      value: SECTIONS.length,
      sub: 'sections of text and images',
      to: '/admin/content',
      icon: TextAa,
    },
  ]

  const drafts = [
    ...properties.filter((p) => !p.published).map((p) => ({ id: p.id, title: p.name, kind: 'Property', to: `/admin/properties/${p.id}` })),
    ...posts.filter((p) => !p.published).map((p) => ({ id: p.id, title: p.title, kind: 'Post', to: `/admin/news/${p.id}` })),
  ]

  const quickEdits = QUICK_EDITS.map((key) => SECTIONS.find((s) => s.key === key)).filter(Boolean)
  const name = session?.user?.name?.split(' ')[0]
  const createError = newProperty.error || newPost.error

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        title={name ? `${greeting()}, ${name}` : 'Dashboard'}
        description="What needs attention, and shortcuts to what gets edited most."
        actions={
          <>
            <Button icon={Plus} onClick={newProperty.create} disabled={newProperty.creating}>
              {newProperty.creating ? 'Creating…' : 'New property'}
            </Button>
            <Button icon={Plus} onClick={newPost.create} disabled={newPost.creating}>
              {newPost.creating ? 'Creating…' : 'New post'}
            </Button>
          </>
        }
      />

      {createError && (
        <div className="mt-6">
          <Alert>Could not create that draft — {createError}</Alert>
        </div>
      )}

      <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map((s) => (
          <Link
            key={s.label}
            to={s.to}
            aria-label={s.value === null ? s.label : `${s.label}: ${s.value}. ${s.sub}`}
            className={`group flex flex-col rounded-2xl border bg-carbon p-5 transition-colors hover:border-white/30 ${focusRing} ${
              s.attention ? 'border-ember/50' : 'border-white/10'
            }`}
          >
            <span className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wide text-bone-2">{s.label}</span>
              <s.icon weight="duotone" className={`size-5 ${s.attention ? 'text-ember' : 'text-bone-3'}`} aria-hidden />
            </span>
            {s.value === null ? (
              <Skeleton className="mt-3 h-9 w-12 rounded-lg" />
            ) : (
              <span className={`numeral mt-3 text-4xl ${s.attention ? 'text-ember' : 'text-bone'}`}>{s.value}</span>
            )}
            <span className="mt-2 text-xs text-bone-3">{s.sub}</span>
          </Link>
        ))}
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-5">
        <Card className="lg:col-span-3">
          <div className="flex items-center justify-between gap-4 border-b border-white/10 px-5 py-4">
            <h2 className="font-display text-[16px] font-medium text-bone">Recent leads</h2>
            <Button variant="ghost" size="sm" to="/admin/leads" icon={ArrowRight}>
              All leads
            </Button>
          </div>

          {leadsError && !leads && (
            <div className="p-5">
              <Alert action={<Button size="sm" onClick={reload}>Try again</Button>}>Couldn&apos;t load leads — {leadsError}</Alert>
            </div>
          )}

          {!leads && !leadsError && (
            <div className="flex flex-col gap-3 p-5">
              {Array.from({ length: 3 }, (_, i) => (
                <Skeleton key={i} className="h-12 rounded-xl" />
              ))}
            </div>
          )}

          {leads?.length === 0 && (
            <p className="px-5 py-10 text-center text-sm text-bone-3">
              No enquiries yet. Contact and brochure form submissions will appear here.
            </p>
          )}

          {leads?.length > 0 && (
            <ul className="divide-y divide-white/10">
              {leads.slice(0, RECENT_LEADS).map((l) => (
                <li key={l.id}>
                  <Link
                    to={`/admin/leads#lead-${l.id}`}
                    className={`flex items-center gap-4 px-5 py-3.5 transition-colors hover:bg-white/5 ${focusRing}`}
                  >
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-2">
                        <span className="truncate text-sm font-medium text-bone">{l.name}</span>
                        {l.status === 'new' && <Badge tone="ember">New</Badge>}
                      </span>
                      <span className="block truncate text-xs text-bone-3">
                        {l.unitAttributions?.[0] ? `Unit ${l.unitAttributions[0].unitLabel} · ` : ''}
                        {l.message || l.email}
                      </span>
                    </span>
                    <span className="shrink-0 text-xs text-bone-3" title={new Date(l.createdAt).toLocaleString()}>
                      {timeAgo(l.createdAt)}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <div className="flex flex-col gap-6 lg:col-span-2">
          <Card>
            <div className="border-b border-white/10 px-5 py-4">
              <h2 className="font-display text-[16px] font-medium text-bone">Quick edits</h2>
            </div>
            <ul className="divide-y divide-white/10">
              {quickEdits.map((s) => (
                <li key={s.key}>
                  <Link
                    to={`/admin/content/${s.key}`}
                    className={`flex min-h-12 items-center gap-3 px-5 py-2.5 text-sm text-bone-2 transition-colors hover:bg-white/5 hover:text-bone ${focusRing}`}
                  >
                    <PencilSimple weight="bold" className="size-4 shrink-0 text-bone-3" aria-hidden />
                    <span className="flex-1">{s.label}</span>
                    <ArrowRight weight="bold" className="size-3.5 text-bone-3" aria-hidden />
                  </Link>
                </li>
              ))}
            </ul>
            <div className="border-t border-white/10 px-5 py-3">
              <Button variant="ghost" size="sm" href="/" target="_blank" rel="noreferrer" icon={ArrowSquareOut}>
                View the live site
              </Button>
            </div>
          </Card>

          <Card>
            <div className="border-b border-white/10 px-5 py-4">
              <h2 className="font-display text-[16px] font-medium text-bone">Drafts</h2>
            </div>
            {drafts.length === 0 ? (
              <p className="px-5 py-6 text-sm text-bone-3">Everything is published.</p>
            ) : (
              <ul className="divide-y divide-white/10">
                {drafts.map((d) => (
                  <li key={`${d.kind}-${d.id}`}>
                    <Link
                      to={d.to}
                      className={`flex min-h-12 items-center gap-3 px-5 py-2.5 transition-colors hover:bg-white/5 ${focusRing}`}
                    >
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm text-bone">{d.title || 'Untitled'}</span>
                        <span className="text-xs text-bone-3">{d.kind}</span>
                      </span>
                      <StatusPill live={false} />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>
    </div>
  )
}
