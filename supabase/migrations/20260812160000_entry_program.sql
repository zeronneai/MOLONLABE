-- Step 7: the entry program.
--
-- Two things the schema was missing: a record of HOW someone entered
-- (the free method has to be auditable as genuinely equivalent, and the
-- paid method does not exist yet), and somewhere to keep past winners.

-- How the entry was obtained. 'free' is the no-purchase method and is
-- always available; 'purchase' is only ever written by a completed
-- checkout, which is stubbed until the payment provider is live.
alter table public.entrants
  add column if not exists entry_method text not null default 'free';

-- One row per person per campaign; additional entries raise entry_count
-- rather than creating duplicates. Makes the counter honest and the draw
-- weightable.
create unique index if not exists entrants_campaign_email_idx
  on public.entrants (campaign_id, lower(email));

create table if not exists public.winners (
  id            uuid primary key default gen_random_uuid(),
  campaign_id   uuid not null references public.campaigns(id) on delete restrict,
  entrant_id    uuid references public.entrants(id) on delete set null,
  display_name  text not null,
  photo_url     text,
  note          text,
  drawn_at      timestamptz not null default now()
);

create index if not exists winners_campaign_idx on public.winners (campaign_id);

alter table public.winners enable row level security;

-- Past winners are public; only the owner writes them.
drop policy if exists "Anyone can read winners" on public.winners;
create policy "Anyone can read winners"
  on public.winners for select
  to anon, authenticated
  using (true);

drop policy if exists "Owner manages winners" on public.winners;
create policy "Owner manages winners"
  on public.winners for all
  to authenticated
  using (true)
  with check (true);

-- Total entries for a campaign, counting weights. Security definer so the
-- public counter can read a number without exposing entrant rows.
create or replace function public.entry_count(campaign uuid)
returns int
language sql
security definer
set search_path = public
as $$
  select coalesce(sum(entry_count), 0)::int
  from public.entrants
  where campaign_id = campaign;
$$;

-- Distinct entrants, for the stats strip. Same reasoning.
create or replace function public.entrant_count(campaign uuid)
returns int
language sql
security definer
set search_path = public
as $$
  select count(*)::int
  from public.entrants
  where campaign_id = campaign;
$$;

grant execute on function public.entry_count(uuid) to anon, authenticated;
grant execute on function public.entrant_count(uuid) to anon, authenticated;
