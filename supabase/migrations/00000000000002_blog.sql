-- Blog: company news/articles, admin-managed.
create table if not exists public.blog_posts (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  title text not null,
  excerpt text not null default '',
  cover_image text,
  body text not null default '',
  published boolean not null default false,
  published_at timestamptz,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.blog_posts enable row level security;

create policy "blog_posts_public_read" on public.blog_posts
  for select using (published = true);

create policy "blog_posts_admin_read_all" on public.blog_posts
  for select using (auth.role() = 'authenticated');

create policy "blog_posts_admin_write" on public.blog_posts
  for insert with check (auth.role() = 'authenticated');

create policy "blog_posts_admin_update" on public.blog_posts
  for update using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

create policy "blog_posts_admin_delete" on public.blog_posts
  for delete using (auth.role() = 'authenticated');

create trigger blog_posts_set_updated_at before update on public.blog_posts
  for each row execute function public.set_updated_at();
