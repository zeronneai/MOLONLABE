-- Key/value settings plus game telemetry. Key/value shape so new settings
-- never need a migration.

create table public.settings (
  key        text primary key,
  value      jsonb not null default '{}'::jsonb,
  updated_at timestamptz default now()
);

create trigger settings_set_updated_at
before update on public.settings
for each row execute function public.set_updated_at();

create table public.game_events (
  id         uuid primary key default gen_random_uuid(),
  kind       text not null,   -- played | won | code_copied
  mode       text,            -- desktop | mobile
  created_at timestamptz default now()
);

create index game_events_kind_idx on public.game_events (kind, created_at desc);

alter table public.settings enable row level security;
alter table public.game_events enable row level security;

-- Difficulty is public. The offer row is readable by anon ONLY while
-- enabled — when the owner switches it off, the row (and the code inside
-- it) is not merely hidden, it is unreadable with the anon key. The site
-- therefore cannot leak a disabled code even by accident.
create policy "Public read game settings"
  on public.settings for select
  to anon
  using (
    key = 'game_difficulty'
    or (key = 'game_offer' and coalesce((value ->> 'enabled')::boolean, false))
  );

create policy "Owner can read settings"
  on public.settings for select
  to authenticated
  using (true);

create policy "Owner can insert settings"
  on public.settings for insert
  to authenticated
  with check (true);

create policy "Owner can update settings"
  on public.settings for update
  to authenticated
  using (true)
  with check (true);

create policy "Owner can delete settings"
  on public.settings for delete
  to authenticated
  using (true);

-- Telemetry: anyone can append (reached through a server action); only
-- the owner reads.
create policy "Anyone can record a game event"
  on public.game_events for insert
  to anon, authenticated
  with check (kind in ('played', 'won', 'code_copied'));

create policy "Owner can read game events"
  on public.game_events for select
  to authenticated
  using (true);

-- Defaults. The exclusions note is prefilled deliberately: a discount
-- with no stated limits is a discount on everything.
insert into public.settings (key, value) values
  (
    'game_offer',
    '{
      "enabled": true,
      "code": "MOLON10",
      "value": "10% off one accessory",
      "expires": null,
      "note": "Accessories and apparel only. Not valid on firearms."
    }'::jsonb
  ),
  (
    'game_difficulty',
    '{
      "desktop": { "roundMs": 10000, "targetCount": 8, "popMs": 700, "magSize": 6 },
      "mobile":  { "roundMs": 10000, "targetCount": 6, "popMs": 950, "magSize": 6 }
    }'::jsonb
  )
on conflict (key) do nothing;
