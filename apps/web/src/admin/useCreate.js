import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useContentRefetch, useNews, useProperties } from '../context/ContentContext'
import { api } from '../lib/api'
import { slugify } from '../lib/slugify'

/**
 * Create a draft and open its editor. Shared by the list pages and the
 * dashboard's shortcuts, so "New property" means the same thing everywhere.
 *
 * Drafts, always: a new record is unpublished until someone ticks Published,
 * so starting one can never put a blank page on the live site. The slug gets a
 * time suffix so two "New Property" drafts cannot collide on the unique index.
 */
function useCreateDraft({ endpoint, editBase, makeBody }) {
  const refetch = useContentRefetch()
  const navigate = useNavigate()
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState(null)

  const create = async () => {
    setError(null)
    setCreating(true)
    try {
      const created = await api.post(endpoint, makeBody())
      await refetch()
      navigate(`${editBase}/${created.id}`)
    } catch (err) {
      setError(err.message)
    } finally {
      setCreating(false)
    }
  }

  return { create, creating, error }
}

export function useCreateProperty() {
  const properties = useProperties()
  return useCreateDraft({
    endpoint: '/admin/properties',
    editBase: '/admin/properties',
    makeBody: () => ({
      name: 'New Property',
      slug: `${slugify('New Property')}-${Date.now().toString(36)}`,
      sortOrder: properties.length,
      published: false,
    }),
  })
}

export function useCreatePost() {
  const posts = useNews()
  return useCreateDraft({
    endpoint: '/admin/news',
    editBase: '/admin/news',
    makeBody: () => ({
      title: 'New Post',
      slug: `${slugify('New Post')}-${Date.now().toString(36)}`,
      sortOrder: posts.length,
      published: false,
    }),
  })
}
