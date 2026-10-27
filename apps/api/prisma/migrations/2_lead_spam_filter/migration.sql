-- Leads the spam checks catch (a filled honeypot, or a form sent faster than a
-- person could) are kept and flagged rather than dropped: a real enquiry that
-- tripped a check by mistake is then still in the admin under "Show filtered"
-- instead of gone for good. Additive; every existing row is a real lead.
alter table public.website_leads
  add column if not exists spam boolean not null default false,
  add column if not exists spam_reason text;
