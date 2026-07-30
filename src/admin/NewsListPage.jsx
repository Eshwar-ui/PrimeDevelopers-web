import { Link, useNavigate } from 'react-router-dom'
import { useNews, useContentRefetch } from '../context/ContentContext'
import { supabase } from '../lib/supabase'
import { slugify } from '../lib/slugify'

export default function NewsListPage() {
  const posts = useNews()
  const refetch = useContentRefetch()
  const navigate = useNavigate()

  const createPost = async () => {
    const title = 'New Post'
    const slug = `${slugify(title)}-${Date.now().toString(36)}`
    const { data, error } = await supabase
      .from('news')
      .insert({ title, slug, sort_order: posts.length, published: false })
      .select()
      .single()
    if (error) return alert(error.message)
    await refetch()
    navigate(`/admin/news/${data.id}`)
  }

  const remove = async (id) => {
    if (!confirm('Delete this post? This cannot be undone.')) return
    const { error } = await supabase.from('news').delete().eq('id', id)
    if (error) return alert(error.message)
    refetch()
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-medium">News</h1>
          <p className="mt-1 text-sm text-bone/50">{posts.length} posts</p>
        </div>
        <button
          type="button"
          onClick={createPost}
          className="rounded-full bg-accent px-5 py-2.5 text-xs font-bold uppercase tracking-wide text-void"
        >
          + New post
        </button>
      </div>

      <div className="mt-8 flex flex-col gap-3">
        {posts.map((post) => (
          <div key={post.id} className="flex items-center gap-4 rounded-2xl border border-white/10 bg-carbon p-4">
            <div className="h-14 w-20 shrink-0 overflow-hidden rounded-lg bg-black/20">
              {post.cover_image && <img src={post.cover_image} alt="" className="h-full w-full object-cover" />}
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <p className="font-display text-base font-medium">{post.title}</p>
                {!post.published && (
                  <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-bone/50">
                    Draft
                  </span>
                )}
              </div>
              <p className="text-xs text-bone/45">{post.excerpt}</p>
            </div>
            <div className="flex shrink-0 items-center gap-4 text-xs font-bold uppercase tracking-wide">
              <Link to={`/admin/news/${post.id}`} className="text-bone/60 hover:text-bone">
                Edit
              </Link>
              <button type="button" onClick={() => remove(post.id)} className="text-red-400/70 hover:text-red-400">
                Delete
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
