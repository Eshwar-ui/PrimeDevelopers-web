-- updated_at maintained by the database, as supabase/migrations/…06 and …08 do on
-- Supabase. Prisma cannot express triggers, so they live here rather than in the
-- schema; this was previously re-applied by hand by every deploy.
create or replace function public.set_updated_at() returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists content_set_updated_at on public.content;
create trigger content_set_updated_at before update on public.content
  for each row execute function public.set_updated_at();

drop trigger if exists properties_set_updated_at on public.properties;
create trigger properties_set_updated_at before update on public.properties
  for each row execute function public.set_updated_at();

drop trigger if exists news_set_updated_at on public.news;
create trigger news_set_updated_at before update on public.news
  for each row execute function public.set_updated_at();

drop trigger if exists website_admin_users_set_updated_at on public.website_admin_users;
create trigger website_admin_users_set_updated_at before update on public.website_admin_users
  for each row execute function public.set_updated_at();
