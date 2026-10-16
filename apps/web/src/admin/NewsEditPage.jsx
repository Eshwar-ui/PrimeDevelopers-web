import { useEffect, useMemo, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import { ArrowLeft } from '@phosphor-icons/react'
import { useNews, useContentRefetch } from '../context/ContentContext'
import { api } from '../lib/api'
import { slugify } from '../lib/slugify'
import { CheckboxField, Section, TextField, TextAreaField } from './components/Field'
import { stable, useAdminTitle } from './adminUtils'
import ImageUploader from './components/ImageUploader'
import { EditorBar, LeaveGuard } from './components/EditorChrome'
import { Alert, Button, EmptyState } from './components/ui'
import { DEFAULT_CATEGORY, parsePost, serializePost } from '../lib/posts'

const toDateInput = (iso) => (iso ? new Date(iso).toISOString().slice(0, 10) : '')

export default function NewsEditPage() {
  const { id } = useParams()
  const posts = useNews()
  const refetch = useContentRefetch()

  const original = useMemo(() => posts.find((p) => p.id === id), [posts, id])
  const [form, setForm] = useState(null)
  const [baseline, setBaseline] = useState(null)
  const [saving, setSaving] = useState(false)
  const [savedAt, setSavedAt] = useState(null)
  const [error, setError] = useState(null)
  useAdminTitle(form?.title || 'Post')

  // Seeded once per post, not on every change of `original`'s identity. `save`
  // ends in `refetch()`, which hands back a new `original` — and re-seeding
  // from that threw away anything typed while the request was in flight, and
  // reset the slug lock. Same fix as PropertyEditPage.
  const loadedFor = useRef(null)
  useEffect(() => {
    if (!original || loadedFor.current === id) return
    loadedFor.current = id
    setForm({ ...original })
    setBaseline({ ...original })
  }, [original, id])

  if (!original) {
    return (
      <EmptyState
        title="Post not found"
        action={
          <Button to="/admin/news" icon={ArrowLeft}>
            All posts
          </Button>
        }
      >
        It may have been deleted.
      </EmptyState>
    )
  }
  if (!form) return null

  const dirty = stable(form) !== stable(baseline)
  const patch = (partial) => setForm((f) => ({ ...f, ...partial }))

  // Category and byline live in a front-matter block at the top of the body
  // (see lib/posts.js). These fields edit that block; the textarea shows only
  // the article beneath it.
  const { meta, content } = parsePost(form.body)
  const setMeta = (partial) => patch({ body: serializePost({ ...meta, ...partial }, content) })
  const setContent = (next) => patch({ body: serializePost(meta, next) })

  /** Resolves true when the save landed — LeaveGuard's "Save and leave" relies on it. */
  const save = async () => {
    setSaving(true)
    setError(null)
    const snapshot = form
    const { id: _id, createdAt: _createdAt, updatedAt: _updatedAt, _slugTouched, ...rest } = form
    const payload = {
      ...rest,
      // The date input yields '' when cleared, which the API rejects as an
      // invalid ISO-8601 string. Omit the field entirely in that case.
      ...(form.publishedAt ? { publishedAt: new Date(form.publishedAt).toISOString() } : {}),
    }
    try {
      await api.patch(`/admin/news/${id}`, payload)
    } catch (err) {
      setSaving(false)
      setError(err.message)
      return false
    }
    setSaving(false)
    setSavedAt(Date.now())
    setBaseline(snapshot)
    refetch()
    return true
  }

  return (
    <div className="pb-24">
      <EditorBar
        backTo="/admin/news"
        backLabel="All posts"
        title={form.title || 'Untitled post'}
        live={form.published}
        viewHref={baseline.published ? `/news/${baseline.slug}` : undefined}
        dirty={dirty}
        saving={saving}
        savedAt={savedAt}
        error={error}
        onSave={save}
      />

      <LeaveGuard when={dirty} onSave={save} />

      <div className="mx-auto max-w-4xl">
        {error && (
          <div className="mt-6">
            <Alert>Couldn&apos;t save — {error}</Alert>
          </div>
        )}

        <div className="mt-8 flex flex-col gap-6">
          <Section title="Post">
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
              <TextField
                label="Title"
                value={form.title}
                onChange={(title) => patch({ title, slug: form._slugTouched ? form.slug : slugify(title) })}
              />
              <TextField
                label="Slug (URL)"
                value={form.slug}
                onChange={(slug) => patch({ slug, _slugTouched: true })}
                hint={`The address: /news/${form.slug || '…'}`}
              />
            </div>
            <TextAreaField
              label="Excerpt"
              rows={2}
              value={form.excerpt}
              onChange={(excerpt) => patch({ excerpt })}
              hint="One or two sentences shown on the news card and in search results."
            />
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
              <TextField label="Category" value={meta.category ?? ''} onChange={(category) => setMeta({ category })} placeholder={DEFAULT_CATEGORY} />
              <TextField label="Author" value={meta.author ?? ''} onChange={(author) => setMeta({ author })} placeholder="Prime Developers" />
              <TextField label="Author role" value={meta.authorRole ?? ''} onChange={(authorRole) => setMeta({ authorRole })} />
            </div>
            <p className="-mt-3 text-xs text-bone-3">
              Category shows above the title and on the card (defaults to &quot;{DEFAULT_CATEGORY}&quot;). With no author, the byline reads Prime Developers.
            </p>
          </Section>

          <Section title="Article">
            <TextAreaField label="Body" rows={22} value={content} onChange={setContent} />
            <details className="-mt-2 rounded-xl border border-white/10 bg-black/15 px-4 py-3 text-xs text-bone-3">
              <summary className="cursor-pointer select-none font-bold uppercase tracking-wide hover:text-bone">Formatting help</summary>
              <div className="mt-3 grid gap-x-8 gap-y-1.5 font-mono sm:grid-cols-2">
                <span>Blank line — new paragraph</span>
                <span>## Section heading</span>
                <span>### Sub-heading</span>
                <span>**bold** · *italic*</span>
                <span>[link text](/properties) or (https://…)</span>
                <span>- bullet item</span>
                <span>1. numbered item</span>
                <span>&gt; pull quote</span>
                <span>![alt text](image URL &quot;caption&quot;)</span>
                <span>--- divider</span>
              </div>
              <p className="mt-3">
                Section headings (##) also build the &quot;On this page&quot; list beside the article. For an inline image, paste the image&apos;s full URL into an image line.
              </p>
            </details>
          </Section>

          <Section title="Cover & publishing">
            <ImageUploader label="Cover image" value={form.coverImage} onChange={(coverImage) => patch({ coverImage })} folder="blog" />
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
              <TextField label="Published date" type="date" value={toDateInput(form.publishedAt)} onChange={(v) => patch({ publishedAt: v })} />
              <TextField
                label="Sort order"
                type="number"
                value={form.sortOrder}
                onChange={(sortOrder) => patch({ sortOrder })}
                hint="Lower numbers show first."
              />
            </div>
            <CheckboxField
              label="Published"
              value={form.published}
              onChange={(published) => patch({ published })}
              hint="Visible on the public site once saved. Untick to take it down without deleting it."
            />
          </Section>
        </div>
      </div>
    </div>
  )
}
