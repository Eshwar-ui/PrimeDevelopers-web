-- Prime Developers Website CMS: production setup
-- Applied to shared Supabase project that already has a construction-mgmt schema.
-- All website CMS tables are prefixed with `website_` where name conflicts exist.
-- `leads` is already taken by construction-mgmt, so website contact submissions
-- go into `website_leads`.

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

-- ── properties ────────────────────────────────────────────────────────────
create table if not exists public.properties (
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

alter table public.properties enable row level security;

create policy "properties_public_read" on public.properties
  for select using (published = true);

create policy "properties_admin_read_all" on public.properties
  for select using (auth.role() = 'authenticated');

create policy "properties_admin_write" on public.properties
  for insert with check (auth.role() = 'authenticated');

create policy "properties_admin_update" on public.properties
  for update using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

create policy "properties_admin_delete" on public.properties
  for delete using (auth.role() = 'authenticated');

-- ── website_leads (contact form submissions) ────────────────────────────
-- Named `website_leads` to avoid conflict with construction-mgmt `leads` table.
create table if not exists public.website_leads (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text not null,
  phone text,
  message text,
  status text not null default 'new',
  created_at timestamptz not null default now()
);

alter table public.website_leads enable row level security;

create policy "website_leads_public_insert" on public.website_leads
  for insert with check (true);

create policy "website_leads_admin_read" on public.website_leads
  for select using (auth.role() = 'authenticated');

create policy "website_leads_admin_update" on public.website_leads
  for update using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

create policy "website_leads_admin_delete" on public.website_leads
  for delete using (auth.role() = 'authenticated');

-- ── news ─────────────────────────────────────────────────────────────────
create table if not exists public.news (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  title text not null,
  summary text not null default '',
  body text not null default '',
  image text,
  sort_order int not null default 0,
  published boolean not null default false,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.news enable row level security;

create policy "news_public_read" on public.news
  for select using (published = true);

create policy "news_admin_read_all" on public.news
  for select using (auth.role() = 'authenticated');

create policy "news_admin_write" on public.news
  for insert with check (auth.role() = 'authenticated');

create policy "news_admin_update" on public.news
  for update using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

create policy "news_admin_delete" on public.news
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

-- ── storage: public "models" bucket ──────────────────────────────────────
insert into storage.buckets (id, name, public)
values ('models', 'models', true)
on conflict (id) do nothing;

create policy "models_public_read" on storage.objects
  for select using (bucket_id = 'models');

create policy "models_admin_write" on storage.objects
  for insert with check (bucket_id = 'models' and auth.role() = 'authenticated');

create policy "models_admin_update" on storage.objects
  for update using (bucket_id = 'models' and auth.role() = 'authenticated');

create policy "models_admin_delete" on storage.objects
  for delete using (bucket_id = 'models' and auth.role() = 'authenticated');

-- ── updated_at trigger ──────────────────────────────────────────────────
create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger content_set_updated_at before update on public.content
  for each row execute function public.set_updated_at();

create trigger properties_set_updated_at before update on public.properties
  for each row execute function public.set_updated_at();

create trigger news_set_updated_at before update on public.news
  for each row execute function public.set_updated_at();

-- ── lead_unit_attribution ─────────────────────────────────────────────
-- Tracks which unit(s) a website lead enquired about (from migration 4).
create table if not exists public.website_lead_unit_attributions (
  lead_id uuid references public.website_leads(id) on delete cascade,
  property_id uuid references public.properties(id) on delete cascade,
  unit_label text not null,
  building_label text,
  created_at timestamptz not null default now(),
  primary key (lead_id, unit_label)
);

alter table public.website_lead_unit_attributions enable row level security;

create policy "website_lead_unit_attr_admin_read" on public.website_lead_unit_attributions
  for select using (auth.role() = 'authenticated');

create policy "website_lead_unit_attr_public_insert" on public.website_lead_unit_attributions
  for insert with check (true);
