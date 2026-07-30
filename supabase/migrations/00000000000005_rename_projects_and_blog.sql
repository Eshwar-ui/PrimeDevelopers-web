-- Rename the "Projects" feature to "Properties" and "Blog" to "News"
-- site-wide. RENAME statements preserve data, indexes, foreign keys, RLS
-- state and triggers unchanged — nothing here touches a row.

-- ── public.projects → public.properties ─────────────────────────────────
alter table public.projects rename to properties;

alter policy "projects_public_read"    on public.properties rename to "properties_public_read";
alter policy "projects_admin_read_all" on public.properties rename to "properties_admin_read_all";
alter policy "projects_admin_write"    on public.properties rename to "properties_admin_write";
alter policy "projects_admin_update"   on public.properties rename to "properties_admin_update";
alter policy "projects_admin_delete"   on public.properties rename to "properties_admin_delete";

alter trigger projects_set_updated_at on public.properties rename to properties_set_updated_at;

-- ── public.blog_posts → public.news ──────────────────────────────────────
alter table public.blog_posts rename to news;

alter policy "blog_posts_public_read"    on public.news rename to "news_public_read";
alter policy "blog_posts_admin_read_all" on public.news rename to "news_admin_read_all";
alter policy "blog_posts_admin_write"    on public.news rename to "news_admin_write";
alter policy "blog_posts_admin_update"   on public.news rename to "news_admin_update";
alter policy "blog_posts_admin_delete"   on public.news rename to "news_admin_delete";

alter trigger blog_posts_set_updated_at on public.news rename to news_set_updated_at;

-- ── content section keys ─────────────────────────────────────────────────
-- `content.section` is the primary key the app looks up sections by
-- (useSection('projects_home') etc.) — these existing rows must be
-- renamed in place, not just relabelled, so the code's lookups keep working.
update public.content set section = 'properties_home' where section = 'projects_home';
update public.content set section = 'properties_page' where section = 'projects_page';
update public.content set section = 'news_page'       where section = 'blog_page';
