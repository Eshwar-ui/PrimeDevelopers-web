-- ── lead source + structured context ────────────────────────────────────
-- QuoteForm.jsx is now the one enquiry form behind the contact page and the
-- Interiors/Franchise/Collab/Invest pages. Every submission needs to say
-- which of those it came through, and each source has its own structured
-- detail worth keeping as real fields rather than losing it in free text —
-- an interior option slug, a franchise's desired property, an investment
-- track.
--
-- `source` defaults to 'contact' so every row written before this column
-- existed reads the same as a plain enquiry, which is what it was.
alter table public.website_leads
  add column if not exists source  text not null default 'contact',
  add column if not exists context jsonb;

create index if not exists website_leads_source_idx on public.website_leads (source);
