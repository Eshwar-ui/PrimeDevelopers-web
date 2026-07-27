-- Prime Developers admin CMS: core schema
-- content: one row per editable site section (hero, about, footer, ...), payload as jsonb
-- projects: the real project/property listing + rich nested detail
-- leads: contact form submissions

create extension if not exists "pgcrypto";

-- ── content ──────────────────────────────────────────────────────────────
create table if not exists public.content (
  section text primary key,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.content enable row level security;

create policy "content_public_read" on public.content
  for select using (true);

create policy "content_admin_write" on public.content
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

-- ── projects ─────────────────────────────────────────────────────────────
create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  name text not null,
  address text not null default '',
  category text not null default 'Retail',
  buildings int not null default 0,
  sold int not null default 0,
  available int not null default 0,
  image text,
  gallery jsonb not null default '[]'::jsonb,
  detail jsonb not null default '{}'::jsonb,
  sort_order int not null default 0,
  published boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.projects enable row level security;

create policy "projects_public_read" on public.projects
  for select using (published = true);

create policy "projects_admin_read_all" on public.projects
  for select using (auth.role() = 'authenticated');

create policy "projects_admin_write" on public.projects
  for insert with check (auth.role() = 'authenticated');

create policy "projects_admin_update" on public.projects
  for update using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

create policy "projects_admin_delete" on public.projects
  for delete using (auth.role() = 'authenticated');

-- ── leads (contact form submissions) ────────────────────────────────────
create table if not exists public.leads (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text not null,
  phone text,
  message text,
  status text not null default 'new',
  created_at timestamptz not null default now()
);

alter table public.leads enable row level security;

create policy "leads_public_insert" on public.leads
  for insert with check (true);

create policy "leads_admin_read" on public.leads
  for select using (auth.role() = 'authenticated');

create policy "leads_admin_update" on public.leads
  for update using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

create policy "leads_admin_delete" on public.leads
  for delete using (auth.role() = 'authenticated');

-- ── storage: public "images" bucket ─────────────────────────────────────
insert into storage.buckets (id, name, public)
values ('images', 'images', true)
on conflict (id) do nothing;

create policy "images_public_read" on storage.objects
  for select using (bucket_id = 'images');

create policy "images_admin_write" on storage.objects
  for insert with check (bucket_id = 'images' and auth.role() = 'authenticated');

create policy "images_admin_update" on storage.objects
  for update using (bucket_id = 'images' and auth.role() = 'authenticated');

create policy "images_admin_delete" on storage.objects
  for delete using (bucket_id = 'images' and auth.role() = 'authenticated');

-- keep updated_at fresh
create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger content_set_updated_at before update on public.content
  for each row execute function public.set_updated_at();

create trigger projects_set_updated_at before update on public.projects
  for each row execute function public.set_updated_at();
