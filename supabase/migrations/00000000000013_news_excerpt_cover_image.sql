-- Bring `news` column names in line with the Prisma schema and the API.
--
-- Migration 6 created this table with `summary` and `image`. The deleted
-- production project knghxhtfkbswzhphhigy did NOT have those names — it had
-- `excerpt` and `cover_image`, which is what prisma/schema.prisma, the news
-- module and the admin CMS have all addressed since commit e0ee37f ("fix(api):
-- news columns are excerpt/cover_image"). The rename was applied to that
-- database by hand and never written down, so migration 6 has been describing
-- a table shape production did not have for over a month.
--
-- It surfaced on 2 Sep 2026 when the CMS was rebuilt on a fresh project
-- (nrtqntqutquapydsnjbm): every other table matched `prisma db pull` exactly
-- and only `news` came back with the migration-6 names, which broke
-- scripts/seed-news.js with PGRST204 on the first insert.
--
-- Written as a rename rather than a correction to migration 6 so that the file
-- already applied to a database stays applied — and so this file is a no-op on
-- any database that was patched by hand.
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'news' and column_name = 'summary'
  ) then
    alter table public.news rename column summary to excerpt;
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'news' and column_name = 'image'
  ) then
    alter table public.news rename column image to cover_image;
  end if;
end $$;
