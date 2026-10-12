import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useNews, useContentRefetch } from '../context/ContentContext'
import { api } from '../lib/api'
import { slugify } from '../lib/slugify'
import { Section, TextField, TextAreaField } from './components/Field'
import ImageUploader from './components/ImageUploader'
import { DEFAULT_CATEGORY, parsePost, serializePost } from '../lib/posts'

const toDateInput = (iso) => (iso ? new Date(iso).toISOString().slice(0, 10) : '')

export default function NewsEditPage() {
  const { id } = useParams()
  const posts = useNews()
  const refetch = useContentRefetch()

  const original = useMemo(() => posts.find((p) => p.id === id), [posts, id])
  const [form, setForm] = useState(null)
  const [saving, setSaving] = useState(false)
  const [savedAt, setSavedAt] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (original) setForm({ ...original })
  }, [original])

  if (!original) {
    return (
      <div>
        <p className="text-bone/60">Post not found.</p>
        <Link to="/admin/news" className="text-ember">
          ← Back to news
        </Link>
      </div>
    )
  }
  if (!form) return null

  const patch = (partial) => setForm((f) => ({ ...f, ...partial }))

  // Category and byline live in a front-matter block at the top of the body
  // (see lib/posts.js). These fields edit that block; the textarea shows only
  // the article beneath it.
  const { meta, content } = parsePost(form.body)
  const setMeta = (partial) => patch({ body: serializePost({ ...meta, ...partial }, content) })
  const setContent = (next) => patch({ body: serializePost(meta, next) })

  const save = async () => {
    setSaving(true)
    setError(null)
    const { id: _id, createdAt: _createdAt, updatedAt: _updatedAt, _slugTouched, ...rest } = form
    const payload = {
      ...rest,
      // The date input yields '' when cleared, which the API rejects as an
      // invalid ISO-8601 string. Omit the field entirely in that case.
      ...(form.publishedAt
        ? { publishedAt: new Date(form.publishedAt).toISOString() }
        : {}),
    }
    try {
      await api.patch(`/admin/news/${id}`, payload)
    } catch (err) {
      setSaving(false)
      setError(err.message)
      return
    }
    setSaving(false)
    setSavedAt(Date.now())
    refetch()
  }

  return (
    <div className="pb-24">
      <div className="flex items-center justify-between">
        <div>
          <Link to="/admin/news" className="text-xs font-bold uppercase tracking-wide text-bone-3 hover:text-bone/70">
            ← All posts
          </Link>
          <h1 className="mt-2 font-display text-2xl font-medium">{form.title || 'Untitled post'}</h1>
        </div>
        <div className="flex items-center gap-4">
          {savedAt && <span className="text-xs text-bone-3">Saved</span>}
          {form.published && (
            <a
              href={`/news/${form.slug}`}
              target="_blank"
              rel="noreferrer"
              className="text-xs font-bold uppercase tracking-wide text-bone/50 hover:text-bone"
            >
              View live ↗
            </a>
          )}
          <button
            type="button"
            onClick={save}
            disabled={saving}
            className="rounded-full bg-accent px-6 py-2.5 text-xs font-bold uppercase tracking-wide text-void disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>

      {error && <p className="mt-4 text-sm text-red-400">{error}</p>}

      <div className="mt-8 flex flex-col gap-6">
        <Section title="Post">
          <div className="grid grid-cols-2 gap-5">
            <TextField
              label="Title"
              value={form.title}
              onChange={(title) => patch({ title, slug: form._slugTouched ? form.slug : slugify(title) })}
            />
            <TextField label="Slug (URL)" value={form.slug} onChange={(slug) => patch({ slug, _slugTouched: true })} />
          </div>
          <TextAreaField label="Excerpt" rows={2} value={form.excerpt} onChange={(excerpt) => patch({ excerpt })} />
          <div className="grid grid-cols-3 gap-5">
            <TextField label="Category" value={meta.category ?? ''} onChange={(category) => setMeta({ category })} />
            <TextField label="Author" value={meta.author ?? ''} onChange={(author) => setMeta({ author })} />
            <TextField label="Author role" value={meta.authorRole ?? ''} onChange={(authorRole) => setMeta({ authorRole })} />
          </div>
          <p className="-mt-3 text-[11px] text-bone-3">
            Category shows above the title and on the card (defaults to &quot;{DEFAULT_CATEGORY}&quot;). With no author, the byline reads Prime Developers.
          </p>
          <TextAreaField label="Body" rows={22} value={content} onChange={setContent} />
          <details className="-mt-3 text-[11px] text-bone-3">
            <summary className="cursor-pointer select-none font-bold uppercase tracking-wide hover:text-bone/70">Formatting help</summary>
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
            <p className="mt-3">Section headings (##) also build the &quot;On this page&quot; list beside the article. For an inline image, paste the image&apos;s full URL into an image line.</p>
          </details>
          <ImageUploader label="Cover image" value={form.coverImage} onChange={(coverImage) => patch({ coverImage })} folder="blog" />
          <div className="grid grid-cols-2 gap-5">
            <TextField label="Published date" type="date" value={toDateInput(form.publishedAt)} onChange={(v) => patch({ publishedAt: v })} />
            <TextField label="Sort order" type="number" value={form.sortOrder} onChange={(sortOrder) => patch({ sortOrder })} />
          </div>
          <label className="flex w-fit items-center gap-2.5">
            <input
              type="checkbox"
              checked={form.published}
              onChange={(e) => patch({ published: e.target.checked })}
              className="size-4 accent-ember"
            />
            <span className="text-sm text-bone/70">Published (visible on the public site)</span>
          </label>
        </Section>
      </div>
    </div>
  )
}
