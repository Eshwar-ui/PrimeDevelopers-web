-- ── lead attribution to a specific unit ─────────────────────────────────
-- An enquiry that names the unit it came from lets sales open the call
-- knowing what is being asked about, rather than spending the first minutes
-- establishing it.
--
-- unit_status records availability *at the time of enquiry*. When a prospect
-- asks about a unit that gets leased three days later, sales needs to know it
-- was genuinely available when they asked — otherwise a legitimate enquiry
-- looks like the site served stale data.
alter table public.leads
  add column if not exists unit_label   text,
  add column if not exists unit_status  text,
  add column if not exists building     text,
  add column if not exists source_url   text;

create index if not exists leads_unit_label_idx on public.leads (unit_label)
  where unit_label is not null;
