-- Initial schema for MLF x SCO — PROJECT_BRIEF.md section 6.
-- Apply with `supabase db push`, or paste into the Supabase SQL editor.

-- inventory items
create table public.items (
  id            uuid primary key default gen_random_uuid(),
  slug          text unique not null,
  name          text not null,
  category      text not null,          -- pistol | rifle | revolver | pcc | optic | accessory
  brand         text,
  short_desc    text,
  long_desc     text,
  specs         jsonb default '{}'::jsonb,   -- freeform key/value pairs
  price_display text,                    -- string, so the owner can write "Call for price"
  status        text not null default 'available', -- available | reserved | sold | hidden
  is_featured   boolean default false,   -- appears in the entry program feature slot
  sort_order    int default 0,
  images        jsonb default '[]'::jsonb,  -- array of Cloudinary URLs
  video_url     text,                    -- direct mp4 or an embed URL
  created_at    timestamptz default now(),
  updated_at    timestamptz default now()
);

-- the entry program
create table public.campaigns (
  id            uuid primary key default gen_random_uuid(),
  title         text not null,
  item_id       uuid references public.items(id),
  description   text,
  opens_at      timestamptz,
  closes_at     timestamptz,
  status        text not null default 'draft', -- draft | live | closed | awarded
  winner_note   text,
  created_at    timestamptz default now()
);

create table public.entrants (
  id            uuid primary key default gen_random_uuid(),
  campaign_id   uuid references public.campaigns(id) on delete cascade,
  first_name    text not null,
  last_name     text not null,
  email         text not null,
  phone         text,
  entry_count   int not null default 1,
  source        text default 'online',   -- online | in_store | mail
  created_at    timestamptz default now()
);

-- general inquiries and transfer requests
create table public.inquiries (
  id            uuid primary key default gen_random_uuid(),
  type          text not null,           -- item | transfer | general | service
  item_id       uuid references public.items(id),
  name          text not null,
  email         text not null,
  phone         text,
  message       text,
  status        text not null default 'new', -- new | contacted | closed
  created_at    timestamptz default now()
);

create index items_status_idx on public.items (status);
create index items_category_idx on public.items (category);
create index items_created_at_idx on public.items (created_at desc);
create index campaigns_status_idx on public.campaigns (status);
create index entrants_campaign_idx on public.entrants (campaign_id);
create index inquiries_status_idx on public.inquiries (status);

-- keep items.updated_at fresh
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger items_set_updated_at
before update on public.items
for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Row level security.
-- Public: read items that are not hidden, read live campaigns, insert
-- inquiries and entrants (only ever reached through server actions).
-- Everything else requires the authenticated owner.
-- ---------------------------------------------------------------------------

alter table public.items enable row level security;
alter table public.campaigns enable row level security;
alter table public.entrants enable row level security;
alter table public.inquiries enable row level security;

-- items
create policy "Public can read visible items"
  on public.items for select
  to anon
  using (status <> 'hidden');

create policy "Owner can read all items"
  on public.items for select
  to authenticated
  using (true);

create policy "Owner can insert items"
  on public.items for insert
  to authenticated
  with check (true);

create policy "Owner can update items"
  on public.items for update
  to authenticated
  using (true)
  with check (true);

create policy "Owner can delete items"
  on public.items for delete
  to authenticated
  using (true);

-- campaigns
create policy "Public can read live campaigns"
  on public.campaigns for select
  to anon
  using (status = 'live');

create policy "Owner can read all campaigns"
  on public.campaigns for select
  to authenticated
  using (true);

create policy "Owner can insert campaigns"
  on public.campaigns for insert
  to authenticated
  with check (true);

create policy "Owner can update campaigns"
  on public.campaigns for update
  to authenticated
  using (true)
  with check (true);

create policy "Owner can delete campaigns"
  on public.campaigns for delete
  to authenticated
  using (true);

-- entrants: anon can insert (via server action), never read
create policy "Anyone can submit an entry"
  on public.entrants for insert
  to anon, authenticated
  with check (true);

create policy "Owner can read entrants"
  on public.entrants for select
  to authenticated
  using (true);

create policy "Owner can update entrants"
  on public.entrants for update
  to authenticated
  using (true)
  with check (true);

create policy "Owner can delete entrants"
  on public.entrants for delete
  to authenticated
  using (true);

-- inquiries: anon can insert (via server action), never read
create policy "Anyone can submit an inquiry"
  on public.inquiries for insert
  to anon, authenticated
  with check (true);

create policy "Owner can read inquiries"
  on public.inquiries for select
  to authenticated
  using (true);

create policy "Owner can update inquiries"
  on public.inquiries for update
  to authenticated
  using (true)
  with check (true);

create policy "Owner can delete inquiries"
  on public.inquiries for delete
  to authenticated
  using (true);

-- ---------------------------------------------------------------------------
-- Public entry counter. Entrant rows are never readable by anon, so the
-- live counter on the featured section goes through a definer function
-- that returns only the aggregate.
-- ---------------------------------------------------------------------------

create or replace function public.entry_count(campaign uuid)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(sum(entry_count), 0)::int
  from public.entrants
  where campaign_id = campaign;
$$;

grant execute on function public.entry_count(uuid) to anon, authenticated;
