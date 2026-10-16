import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowSquareOut, MagnifyingGlass, Newspaper, PencilSimple, Plus, Trash } from '@phosphor-icons/react'
import { useNews, useContentRefetch } from '../context/ContentContext'
import { api } from '../lib/api'
import { useCreatePost } from './useCreate'
import { Alert, Button, Card, ConfirmButton, EmptyState, IconButton, PageHeader, SearchInput, StatusPill, focusRing } from './components/ui'
import { useAdminTitle } from './adminUtils'

const dateLabel = (iso) =>
  iso ? new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) : 'No date'

export default function NewsListPage() {
  useAdminTitle('News')
  const posts = useNews()
  const refetch = useContentRefetch()
  const { create, creating, error: createError } = useCreatePost()
  const [error, setError] = useState(null)
  const [query, setQuery] = useState('')

  // Confirmed inline rather than with `window.confirm` / `alert` — see
  // ConfirmButton for why a native dialog can silently stop working.
  const remove = async (id) => {
    setError(null)
    try {
      await api.del(`/admin/news/${id}`)
      await refetch()
    } catch (err) {
      setError(`Could not delete that post — ${err.message}`)
    }
  }

  const q = query.trim().toLowerCase()
  const shown = q ? posts.filter((p) => [p.title, p.excerpt, p.slug].some((f) => f?.toLowerCase().includes(q))) : posts
  const drafts = posts.filter((p) => !p.published).length

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        title="News"
        description={`${posts.length} posts · ${posts.length - drafts} live · ${drafts} draft.`}
        actions={
          <Button variant="primary" icon={Plus} onClick={create} disabled={creating}>
            {creating ? 'Creating…' : 'New post'}
          </Button>
        }
      />

      {posts.length > 5 && (
        <div className="mt-6">
          <SearchInput value={query} onChange={setQuery} placeholder="Search posts…" label="Search posts" icon={MagnifyingGlass} />
        </div>
      )}

      {(error || createError) && (
        <div className="mt-6">
          <Alert>{error || `Could not create a post — ${createError}`}</Alert>
        </div>
      )}

      <div className="mt-6 flex flex-col gap-3">
        {posts.length === 0 && (
          <EmptyState
            icon={Newspaper}
            title="No posts yet"
            action={
              <Button variant="primary" icon={Plus} onClick={create} disabled={creating}>
                Write the first post
              </Button>
            }
          >
            A new post starts as a draft, so nothing appears on the site until you publish it.
          </EmptyState>
        )}

        {posts.length > 0 && shown.length === 0 && (
          <p className="py-8 text-center text-sm text-bone-3">No posts match “{query}”.</p>
        )}

        {shown.map((post) => (
          <Card key={post.id} className="flex flex-wrap items-center gap-x-4 gap-y-3 p-3 sm:flex-nowrap sm:p-4">
            <Link to={`/admin/news/${post.id}`} className={`flex min-w-0 flex-1 items-center gap-4 rounded-xl ${focusRing}`}>
              <span className="h-14 w-20 shrink-0 overflow-hidden rounded-lg bg-black/20">
                {post.coverImage && <img src={post.coverImage} alt="" className="h-full w-full object-cover" />}
              </span>
              <span className="min-w-0">
                <span className="flex flex-wrap items-center gap-2">
                  <span className="truncate font-display text-[16px] font-medium text-bone">{post.title || 'Untitled post'}</span>
                  <StatusPill live={post.published} />
                </span>
                <span className="block text-xs text-bone-3">{dateLabel(post.publishedAt)}</span>
                {post.excerpt && <span className="line-clamp-1 text-xs text-bone-3">{post.excerpt}</span>}
              </span>
            </Link>
            <div className="flex w-full shrink-0 items-center justify-end gap-1 sm:w-auto">
              {post.published && (
                <IconButton
                  icon={ArrowSquareOut}
                  label={`View “${post.title}” on the site`}
                  size="sm"
                  href={`/news/${post.slug}`}
                  target="_blank"
                  rel="noreferrer"
                />
              )}
              <Button size="sm" to={`/admin/news/${post.id}`} icon={PencilSimple}>
                Edit
              </Button>
              <ConfirmButton icon={Trash} onConfirm={() => remove(post.id)} />
            </div>
          </Card>
        ))}
      </div>
    </div>
  )
}
