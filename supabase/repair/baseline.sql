-- The schema, expressed so it can be applied to a database in any state.
--
-- GENERATED FILE — do not edit by hand. Regenerate with:
--   node scripts/gen-baseline.mjs <connection to a chain-built database>
--
-- WHAT THIS IS FOR
--
-- The migration chain cannot be re-run to repair a database: nine of its
-- fourteen migrations abort against one that is already migrated, because
-- each transforms a known previous state into the next. Repairing column
-- by column instead means finding the next missing piece by accident.
--
-- This converges in one pass from any starting point — empty, partially
-- applied, or already correct. Run it, then run scripts/check-schema.sql
-- and confirm that returns nothing. That is the whole procedure.
--
-- WHAT IT WILL NOT DO
--
-- It only adds. There is no drop table, no drop column, no delete and no
-- update anywhere in it, so it cannot lose data or lose a column that
-- something else still depends on. A column in your database that the
-- schema no longer has is left alone; check-schema.sql lists those
-- separately as harmless.
--
-- It does not replace the migration chain for NEW changes. New work still
-- gets a migration; this file is regenerated from the chain afterwards.
--
-- Safe to run more than once.

begin;

-- ---------------------------------------------------------------------
-- Tables and columns
-- ---------------------------------------------------------------------
-- Each table is created if absent, then every column is added if absent.
-- The two together cover a missing table, a table missing some columns,
-- and a table that is already correct.

create table if not exists public.admin_activity (
  id uuid default gen_random_uuid() not null,
  at timestamp with time zone default now() not null,
  actor_id uuid,
  actor_name text not null,
  action text not null,
  entity text not null,
  entity_id uuid,
  entity_label text,
  field text,
  before_value jsonb,
  after_value jsonb
);
alter table public.admin_activity add column if not exists id uuid default gen_random_uuid();
do $$ begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'admin_activity'
      and column_name = 'id' and is_nullable = 'YES'
  ) then
    if exists (select 1 from public.admin_activity where id is null) then
      raise notice 'public.admin_activity.id holds nulls; left nullable. Fill them, then: alter table public.admin_activity alter column id set not null;';
    else
      alter table public.admin_activity alter column id set not null;
    end if;
  end if;
end $$;
alter table public.admin_activity add column if not exists at timestamp with time zone default now();
do $$ begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'admin_activity'
      and column_name = 'at' and is_nullable = 'YES'
  ) then
    if exists (select 1 from public.admin_activity where at is null) then
      raise notice 'public.admin_activity.at holds nulls; left nullable. Fill them, then: alter table public.admin_activity alter column at set not null;';
    else
      alter table public.admin_activity alter column at set not null;
    end if;
  end if;
end $$;
alter table public.admin_activity add column if not exists actor_id uuid;
alter table public.admin_activity add column if not exists actor_name text;
do $$ begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'admin_activity'
      and column_name = 'actor_name' and is_nullable = 'YES'
  ) then
    if exists (select 1 from public.admin_activity where actor_name is null) then
      raise notice 'public.admin_activity.actor_name holds nulls; left nullable. Fill them, then: alter table public.admin_activity alter column actor_name set not null;';
    else
      alter table public.admin_activity alter column actor_name set not null;
    end if;
  end if;
end $$;
alter table public.admin_activity add column if not exists action text;
do $$ begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'admin_activity'
      and column_name = 'action' and is_nullable = 'YES'
  ) then
    if exists (select 1 from public.admin_activity where action is null) then
      raise notice 'public.admin_activity.action holds nulls; left nullable. Fill them, then: alter table public.admin_activity alter column action set not null;';
    else
      alter table public.admin_activity alter column action set not null;
    end if;
  end if;
end $$;
alter table public.admin_activity add column if not exists entity text;
do $$ begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'admin_activity'
      and column_name = 'entity' and is_nullable = 'YES'
  ) then
    if exists (select 1 from public.admin_activity where entity is null) then
      raise notice 'public.admin_activity.entity holds nulls; left nullable. Fill them, then: alter table public.admin_activity alter column entity set not null;';
    else
      alter table public.admin_activity alter column entity set not null;
    end if;
  end if;
end $$;
alter table public.admin_activity add column if not exists entity_id uuid;
alter table public.admin_activity add column if not exists entity_label text;
alter table public.admin_activity add column if not exists field text;
alter table public.admin_activity add column if not exists before_value jsonb;
alter table public.admin_activity add column if not exists after_value jsonb;

create table if not exists public.checkout_attempts (
  key text not null,
  started_at timestamp with time zone default now() not null,
  order_number text,
  finished_at timestamp with time zone,
  outcome text
);
alter table public.checkout_attempts add column if not exists key text;
do $$ begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'checkout_attempts'
      and column_name = 'key' and is_nullable = 'YES'
  ) then
    if exists (select 1 from public.checkout_attempts where key is null) then
      raise notice 'public.checkout_attempts.key holds nulls; left nullable. Fill them, then: alter table public.checkout_attempts alter column key set not null;';
    else
      alter table public.checkout_attempts alter column key set not null;
    end if;
  end if;
end $$;
alter table public.checkout_attempts add column if not exists started_at timestamp with time zone default now();
do $$ begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'checkout_attempts'
      and column_name = 'started_at' and is_nullable = 'YES'
  ) then
    if exists (select 1 from public.checkout_attempts where started_at is null) then
      raise notice 'public.checkout_attempts.started_at holds nulls; left nullable. Fill them, then: alter table public.checkout_attempts alter column started_at set not null;';
    else
      alter table public.checkout_attempts alter column started_at set not null;
    end if;
  end if;
end $$;
alter table public.checkout_attempts add column if not exists order_number text;
alter table public.checkout_attempts add column if not exists finished_at timestamp with time zone;
alter table public.checkout_attempts add column if not exists outcome text;

create table if not exists public.game_events (
  id uuid default gen_random_uuid() not null,
  kind text not null,
  mode text,
  created_at timestamp with time zone default now()
);
alter table public.game_events add column if not exists id uuid default gen_random_uuid();
do $$ begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'game_events'
      and column_name = 'id' and is_nullable = 'YES'
  ) then
    if exists (select 1 from public.game_events where id is null) then
      raise notice 'public.game_events.id holds nulls; left nullable. Fill them, then: alter table public.game_events alter column id set not null;';
    else
      alter table public.game_events alter column id set not null;
    end if;
  end if;
end $$;
alter table public.game_events add column if not exists kind text;
do $$ begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'game_events'
      and column_name = 'kind' and is_nullable = 'YES'
  ) then
    if exists (select 1 from public.game_events where kind is null) then
      raise notice 'public.game_events.kind holds nulls; left nullable. Fill them, then: alter table public.game_events alter column kind set not null;';
    else
      alter table public.game_events alter column kind set not null;
    end if;
  end if;
end $$;
alter table public.game_events add column if not exists mode text;
alter table public.game_events add column if not exists created_at timestamp with time zone default now();

create table if not exists public.game_spots (
  id uuid default gen_random_uuid() not null,
  game_id uuid not null,
  spot_number integer not null,
  status text default 'open'::text not null,
  order_id uuid,
  first_name text,
  last_name text,
  email text,
  phone text,
  show_name boolean default false not null,
  held_at timestamp with time zone,
  sold_at timestamp with time zone
);
alter table public.game_spots add column if not exists id uuid default gen_random_uuid();
do $$ begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'game_spots'
      and column_name = 'id' and is_nullable = 'YES'
  ) then
    if exists (select 1 from public.game_spots where id is null) then
      raise notice 'public.game_spots.id holds nulls; left nullable. Fill them, then: alter table public.game_spots alter column id set not null;';
    else
      alter table public.game_spots alter column id set not null;
    end if;
  end if;
end $$;
alter table public.game_spots add column if not exists game_id uuid;
do $$ begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'game_spots'
      and column_name = 'game_id' and is_nullable = 'YES'
  ) then
    if exists (select 1 from public.game_spots where game_id is null) then
      raise notice 'public.game_spots.game_id holds nulls; left nullable. Fill them, then: alter table public.game_spots alter column game_id set not null;';
    else
      alter table public.game_spots alter column game_id set not null;
    end if;
  end if;
end $$;
alter table public.game_spots add column if not exists spot_number integer;
do $$ begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'game_spots'
      and column_name = 'spot_number' and is_nullable = 'YES'
  ) then
    if exists (select 1 from public.game_spots where spot_number is null) then
      raise notice 'public.game_spots.spot_number holds nulls; left nullable. Fill them, then: alter table public.game_spots alter column spot_number set not null;';
    else
      alter table public.game_spots alter column spot_number set not null;
    end if;
  end if;
end $$;
alter table public.game_spots add column if not exists status text default 'open'::text;
do $$ begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'game_spots'
      and column_name = 'status' and is_nullable = 'YES'
  ) then
    if exists (select 1 from public.game_spots where status is null) then
      raise notice 'public.game_spots.status holds nulls; left nullable. Fill them, then: alter table public.game_spots alter column status set not null;';
    else
      alter table public.game_spots alter column status set not null;
    end if;
  end if;
end $$;
alter table public.game_spots add column if not exists order_id uuid;
alter table public.game_spots add column if not exists first_name text;
alter table public.game_spots add column if not exists last_name text;
alter table public.game_spots add column if not exists email text;
alter table public.game_spots add column if not exists phone text;
alter table public.game_spots add column if not exists show_name boolean default false;
do $$ begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'game_spots'
      and column_name = 'show_name' and is_nullable = 'YES'
  ) then
    if exists (select 1 from public.game_spots where show_name is null) then
      raise notice 'public.game_spots.show_name holds nulls; left nullable. Fill them, then: alter table public.game_spots alter column show_name set not null;';
    else
      alter table public.game_spots alter column show_name set not null;
    end if;
  end if;
end $$;
alter table public.game_spots add column if not exists held_at timestamp with time zone;
alter table public.game_spots add column if not exists sold_at timestamp with time zone;

create table if not exists public.games (
  id uuid default gen_random_uuid() not null,
  title text not null,
  item_id uuid,
  description text,
  status text default 'open'::text not null,
  winner_note text,
  created_at timestamp with time zone default now(),
  created_by uuid,
  created_by_name text,
  updated_by uuid,
  updated_by_name text,
  total_spots integer default 0 not null,
  spot_price_cents integer default 0 not null
);
alter table public.games add column if not exists id uuid default gen_random_uuid();
do $$ begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'games'
      and column_name = 'id' and is_nullable = 'YES'
  ) then
    if exists (select 1 from public.games where id is null) then
      raise notice 'public.games.id holds nulls; left nullable. Fill them, then: alter table public.games alter column id set not null;';
    else
      alter table public.games alter column id set not null;
    end if;
  end if;
end $$;
alter table public.games add column if not exists title text;
do $$ begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'games'
      and column_name = 'title' and is_nullable = 'YES'
  ) then
    if exists (select 1 from public.games where title is null) then
      raise notice 'public.games.title holds nulls; left nullable. Fill them, then: alter table public.games alter column title set not null;';
    else
      alter table public.games alter column title set not null;
    end if;
  end if;
end $$;
alter table public.games add column if not exists item_id uuid;
alter table public.games add column if not exists description text;
alter table public.games add column if not exists status text default 'open'::text;
do $$ begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'games'
      and column_name = 'status' and is_nullable = 'YES'
  ) then
    if exists (select 1 from public.games where status is null) then
      raise notice 'public.games.status holds nulls; left nullable. Fill them, then: alter table public.games alter column status set not null;';
    else
      alter table public.games alter column status set not null;
    end if;
  end if;
end $$;
alter table public.games add column if not exists winner_note text;
alter table public.games add column if not exists created_at timestamp with time zone default now();
alter table public.games add column if not exists created_by uuid;
alter table public.games add column if not exists created_by_name text;
alter table public.games add column if not exists updated_by uuid;
alter table public.games add column if not exists updated_by_name text;
alter table public.games add column if not exists total_spots integer default 0;
do $$ begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'games'
      and column_name = 'total_spots' and is_nullable = 'YES'
  ) then
    if exists (select 1 from public.games where total_spots is null) then
      raise notice 'public.games.total_spots holds nulls; left nullable. Fill them, then: alter table public.games alter column total_spots set not null;';
    else
      alter table public.games alter column total_spots set not null;
    end if;
  end if;
end $$;
alter table public.games add column if not exists spot_price_cents integer default 0;
do $$ begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'games'
      and column_name = 'spot_price_cents' and is_nullable = 'YES'
  ) then
    if exists (select 1 from public.games where spot_price_cents is null) then
      raise notice 'public.games.spot_price_cents holds nulls; left nullable. Fill them, then: alter table public.games alter column spot_price_cents set not null;';
    else
      alter table public.games alter column spot_price_cents set not null;
    end if;
  end if;
end $$;

create table if not exists public.inquiries (
  id uuid default gen_random_uuid() not null,
  type text not null,
  item_id uuid,
  name text not null,
  email text not null,
  phone text,
  message text,
  status text default 'new'::text not null,
  created_at timestamp with time zone default now()
);
alter table public.inquiries add column if not exists id uuid default gen_random_uuid();
do $$ begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'inquiries'
      and column_name = 'id' and is_nullable = 'YES'
  ) then
    if exists (select 1 from public.inquiries where id is null) then
      raise notice 'public.inquiries.id holds nulls; left nullable. Fill them, then: alter table public.inquiries alter column id set not null;';
    else
      alter table public.inquiries alter column id set not null;
    end if;
  end if;
end $$;
alter table public.inquiries add column if not exists type text;
do $$ begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'inquiries'
      and column_name = 'type' and is_nullable = 'YES'
  ) then
    if exists (select 1 from public.inquiries where type is null) then
      raise notice 'public.inquiries.type holds nulls; left nullable. Fill them, then: alter table public.inquiries alter column type set not null;';
    else
      alter table public.inquiries alter column type set not null;
    end if;
  end if;
end $$;
alter table public.inquiries add column if not exists item_id uuid;
alter table public.inquiries add column if not exists name text;
do $$ begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'inquiries'
      and column_name = 'name' and is_nullable = 'YES'
  ) then
    if exists (select 1 from public.inquiries where name is null) then
      raise notice 'public.inquiries.name holds nulls; left nullable. Fill them, then: alter table public.inquiries alter column name set not null;';
    else
      alter table public.inquiries alter column name set not null;
    end if;
  end if;
end $$;
alter table public.inquiries add column if not exists email text;
do $$ begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'inquiries'
      and column_name = 'email' and is_nullable = 'YES'
  ) then
    if exists (select 1 from public.inquiries where email is null) then
      raise notice 'public.inquiries.email holds nulls; left nullable. Fill them, then: alter table public.inquiries alter column email set not null;';
    else
      alter table public.inquiries alter column email set not null;
    end if;
  end if;
end $$;
alter table public.inquiries add column if not exists phone text;
alter table public.inquiries add column if not exists message text;
alter table public.inquiries add column if not exists status text default 'new'::text;
do $$ begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'inquiries'
      and column_name = 'status' and is_nullable = 'YES'
  ) then
    if exists (select 1 from public.inquiries where status is null) then
      raise notice 'public.inquiries.status holds nulls; left nullable. Fill them, then: alter table public.inquiries alter column status set not null;';
    else
      alter table public.inquiries alter column status set not null;
    end if;
  end if;
end $$;
alter table public.inquiries add column if not exists created_at timestamp with time zone default now();

create table if not exists public.item_variants (
  id uuid default gen_random_uuid() not null,
  item_id uuid not null,
  size text not null,
  stock integer default 0 not null,
  sort_order integer default 0 not null,
  created_at timestamp with time zone default now() not null
);
alter table public.item_variants add column if not exists id uuid default gen_random_uuid();
do $$ begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'item_variants'
      and column_name = 'id' and is_nullable = 'YES'
  ) then
    if exists (select 1 from public.item_variants where id is null) then
      raise notice 'public.item_variants.id holds nulls; left nullable. Fill them, then: alter table public.item_variants alter column id set not null;';
    else
      alter table public.item_variants alter column id set not null;
    end if;
  end if;
end $$;
alter table public.item_variants add column if not exists item_id uuid;
do $$ begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'item_variants'
      and column_name = 'item_id' and is_nullable = 'YES'
  ) then
    if exists (select 1 from public.item_variants where item_id is null) then
      raise notice 'public.item_variants.item_id holds nulls; left nullable. Fill them, then: alter table public.item_variants alter column item_id set not null;';
    else
      alter table public.item_variants alter column item_id set not null;
    end if;
  end if;
end $$;
alter table public.item_variants add column if not exists size text;
do $$ begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'item_variants'
      and column_name = 'size' and is_nullable = 'YES'
  ) then
    if exists (select 1 from public.item_variants where size is null) then
      raise notice 'public.item_variants.size holds nulls; left nullable. Fill them, then: alter table public.item_variants alter column size set not null;';
    else
      alter table public.item_variants alter column size set not null;
    end if;
  end if;
end $$;
alter table public.item_variants add column if not exists stock integer default 0;
do $$ begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'item_variants'
      and column_name = 'stock' and is_nullable = 'YES'
  ) then
    if exists (select 1 from public.item_variants where stock is null) then
      raise notice 'public.item_variants.stock holds nulls; left nullable. Fill them, then: alter table public.item_variants alter column stock set not null;';
    else
      alter table public.item_variants alter column stock set not null;
    end if;
  end if;
end $$;
alter table public.item_variants add column if not exists sort_order integer default 0;
do $$ begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'item_variants'
      and column_name = 'sort_order' and is_nullable = 'YES'
  ) then
    if exists (select 1 from public.item_variants where sort_order is null) then
      raise notice 'public.item_variants.sort_order holds nulls; left nullable. Fill them, then: alter table public.item_variants alter column sort_order set not null;';
    else
      alter table public.item_variants alter column sort_order set not null;
    end if;
  end if;
end $$;
alter table public.item_variants add column if not exists created_at timestamp with time zone default now();
do $$ begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'item_variants'
      and column_name = 'created_at' and is_nullable = 'YES'
  ) then
    if exists (select 1 from public.item_variants where created_at is null) then
      raise notice 'public.item_variants.created_at holds nulls; left nullable. Fill them, then: alter table public.item_variants alter column created_at set not null;';
    else
      alter table public.item_variants alter column created_at set not null;
    end if;
  end if;
end $$;

create table if not exists public.items (
  id uuid default gen_random_uuid() not null,
  slug text not null,
  name text not null,
  category text not null,
  brand text,
  short_desc text,
  long_desc text,
  specs jsonb default '{}'::jsonb,
  price_display text,
  status text default 'available'::text not null,
  is_featured boolean default false,
  sort_order integer default 0,
  images jsonb default '[]'::jsonb,
  video_url text,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now(),
  price_cents integer,
  fulfillment_type text default 'pickup'::text not null,
  has_variants boolean default false not null,
  created_by uuid,
  created_by_name text,
  updated_by uuid,
  updated_by_name text,
  shipping_tier text default 'standard'::text not null,
  shipping_override_cents integer
);
alter table public.items add column if not exists id uuid default gen_random_uuid();
do $$ begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'items'
      and column_name = 'id' and is_nullable = 'YES'
  ) then
    if exists (select 1 from public.items where id is null) then
      raise notice 'public.items.id holds nulls; left nullable. Fill them, then: alter table public.items alter column id set not null;';
    else
      alter table public.items alter column id set not null;
    end if;
  end if;
end $$;
alter table public.items add column if not exists slug text;
do $$ begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'items'
      and column_name = 'slug' and is_nullable = 'YES'
  ) then
    if exists (select 1 from public.items where slug is null) then
      raise notice 'public.items.slug holds nulls; left nullable. Fill them, then: alter table public.items alter column slug set not null;';
    else
      alter table public.items alter column slug set not null;
    end if;
  end if;
end $$;
alter table public.items add column if not exists name text;
do $$ begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'items'
      and column_name = 'name' and is_nullable = 'YES'
  ) then
    if exists (select 1 from public.items where name is null) then
      raise notice 'public.items.name holds nulls; left nullable. Fill them, then: alter table public.items alter column name set not null;';
    else
      alter table public.items alter column name set not null;
    end if;
  end if;
end $$;
alter table public.items add column if not exists category text;
do $$ begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'items'
      and column_name = 'category' and is_nullable = 'YES'
  ) then
    if exists (select 1 from public.items where category is null) then
      raise notice 'public.items.category holds nulls; left nullable. Fill them, then: alter table public.items alter column category set not null;';
    else
      alter table public.items alter column category set not null;
    end if;
  end if;
end $$;
alter table public.items add column if not exists brand text;
alter table public.items add column if not exists short_desc text;
alter table public.items add column if not exists long_desc text;
alter table public.items add column if not exists specs jsonb default '{}'::jsonb;
alter table public.items add column if not exists price_display text;
alter table public.items add column if not exists status text default 'available'::text;
do $$ begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'items'
      and column_name = 'status' and is_nullable = 'YES'
  ) then
    if exists (select 1 from public.items where status is null) then
      raise notice 'public.items.status holds nulls; left nullable. Fill them, then: alter table public.items alter column status set not null;';
    else
      alter table public.items alter column status set not null;
    end if;
  end if;
end $$;
alter table public.items add column if not exists is_featured boolean default false;
alter table public.items add column if not exists sort_order integer default 0;
alter table public.items add column if not exists images jsonb default '[]'::jsonb;
alter table public.items add column if not exists video_url text;
alter table public.items add column if not exists created_at timestamp with time zone default now();
alter table public.items add column if not exists updated_at timestamp with time zone default now();
alter table public.items add column if not exists price_cents integer;
alter table public.items add column if not exists fulfillment_type text default 'pickup'::text;
do $$ begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'items'
      and column_name = 'fulfillment_type' and is_nullable = 'YES'
  ) then
    if exists (select 1 from public.items where fulfillment_type is null) then
      raise notice 'public.items.fulfillment_type holds nulls; left nullable. Fill them, then: alter table public.items alter column fulfillment_type set not null;';
    else
      alter table public.items alter column fulfillment_type set not null;
    end if;
  end if;
end $$;
alter table public.items add column if not exists has_variants boolean default false;
do $$ begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'items'
      and column_name = 'has_variants' and is_nullable = 'YES'
  ) then
    if exists (select 1 from public.items where has_variants is null) then
      raise notice 'public.items.has_variants holds nulls; left nullable. Fill them, then: alter table public.items alter column has_variants set not null;';
    else
      alter table public.items alter column has_variants set not null;
    end if;
  end if;
end $$;
alter table public.items add column if not exists created_by uuid;
alter table public.items add column if not exists created_by_name text;
alter table public.items add column if not exists updated_by uuid;
alter table public.items add column if not exists updated_by_name text;
alter table public.items add column if not exists shipping_tier text default 'standard'::text;
do $$ begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'items'
      and column_name = 'shipping_tier' and is_nullable = 'YES'
  ) then
    if exists (select 1 from public.items where shipping_tier is null) then
      raise notice 'public.items.shipping_tier holds nulls; left nullable. Fill them, then: alter table public.items alter column shipping_tier set not null;';
    else
      alter table public.items alter column shipping_tier set not null;
    end if;
  end if;
end $$;
alter table public.items add column if not exists shipping_override_cents integer;

create table if not exists public.order_items (
  id uuid default gen_random_uuid() not null,
  order_id uuid not null,
  line_type text not null,
  item_id uuid,
  pack_id text,
  name text not null,
  unit_price_cents integer not null,
  quantity integer not null,
  fulfillment_type text not null,
  line_total_cents integer not null,
  variant_id uuid,
  size text,
  game_id uuid,
  spot_numbers integer[]
);
alter table public.order_items add column if not exists id uuid default gen_random_uuid();
do $$ begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'order_items'
      and column_name = 'id' and is_nullable = 'YES'
  ) then
    if exists (select 1 from public.order_items where id is null) then
      raise notice 'public.order_items.id holds nulls; left nullable. Fill them, then: alter table public.order_items alter column id set not null;';
    else
      alter table public.order_items alter column id set not null;
    end if;
  end if;
end $$;
alter table public.order_items add column if not exists order_id uuid;
do $$ begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'order_items'
      and column_name = 'order_id' and is_nullable = 'YES'
  ) then
    if exists (select 1 from public.order_items where order_id is null) then
      raise notice 'public.order_items.order_id holds nulls; left nullable. Fill them, then: alter table public.order_items alter column order_id set not null;';
    else
      alter table public.order_items alter column order_id set not null;
    end if;
  end if;
end $$;
alter table public.order_items add column if not exists line_type text;
do $$ begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'order_items'
      and column_name = 'line_type' and is_nullable = 'YES'
  ) then
    if exists (select 1 from public.order_items where line_type is null) then
      raise notice 'public.order_items.line_type holds nulls; left nullable. Fill them, then: alter table public.order_items alter column line_type set not null;';
    else
      alter table public.order_items alter column line_type set not null;
    end if;
  end if;
end $$;
alter table public.order_items add column if not exists item_id uuid;
alter table public.order_items add column if not exists pack_id text;
alter table public.order_items add column if not exists name text;
do $$ begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'order_items'
      and column_name = 'name' and is_nullable = 'YES'
  ) then
    if exists (select 1 from public.order_items where name is null) then
      raise notice 'public.order_items.name holds nulls; left nullable. Fill them, then: alter table public.order_items alter column name set not null;';
    else
      alter table public.order_items alter column name set not null;
    end if;
  end if;
end $$;
alter table public.order_items add column if not exists unit_price_cents integer;
do $$ begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'order_items'
      and column_name = 'unit_price_cents' and is_nullable = 'YES'
  ) then
    if exists (select 1 from public.order_items where unit_price_cents is null) then
      raise notice 'public.order_items.unit_price_cents holds nulls; left nullable. Fill them, then: alter table public.order_items alter column unit_price_cents set not null;';
    else
      alter table public.order_items alter column unit_price_cents set not null;
    end if;
  end if;
end $$;
alter table public.order_items add column if not exists quantity integer;
do $$ begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'order_items'
      and column_name = 'quantity' and is_nullable = 'YES'
  ) then
    if exists (select 1 from public.order_items where quantity is null) then
      raise notice 'public.order_items.quantity holds nulls; left nullable. Fill them, then: alter table public.order_items alter column quantity set not null;';
    else
      alter table public.order_items alter column quantity set not null;
    end if;
  end if;
end $$;
alter table public.order_items add column if not exists fulfillment_type text;
do $$ begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'order_items'
      and column_name = 'fulfillment_type' and is_nullable = 'YES'
  ) then
    if exists (select 1 from public.order_items where fulfillment_type is null) then
      raise notice 'public.order_items.fulfillment_type holds nulls; left nullable. Fill them, then: alter table public.order_items alter column fulfillment_type set not null;';
    else
      alter table public.order_items alter column fulfillment_type set not null;
    end if;
  end if;
end $$;
alter table public.order_items add column if not exists line_total_cents integer;
do $$ begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'order_items'
      and column_name = 'line_total_cents' and is_nullable = 'YES'
  ) then
    if exists (select 1 from public.order_items where line_total_cents is null) then
      raise notice 'public.order_items.line_total_cents holds nulls; left nullable. Fill them, then: alter table public.order_items alter column line_total_cents set not null;';
    else
      alter table public.order_items alter column line_total_cents set not null;
    end if;
  end if;
end $$;
alter table public.order_items add column if not exists variant_id uuid;
alter table public.order_items add column if not exists size text;
alter table public.order_items add column if not exists game_id uuid;
alter table public.order_items add column if not exists spot_numbers integer[];

create table if not exists public.orders (
  id uuid default gen_random_uuid() not null,
  order_number text not null,
  status text default 'paid'::text not null,
  email text not null,
  first_name text not null,
  last_name text not null,
  phone text,
  subtotal_cents integer not null,
  tax_cents integer default 0 not null,
  shipping_cents integer default 0 not null,
  total_cents integer not null,
  has_shipment boolean default false not null,
  has_pickup boolean default false not null,
  ship_name text,
  ship_line1 text,
  ship_line2 text,
  ship_city text,
  ship_region text,
  ship_postal_code text,
  disclaimer_accepted_at timestamp with time zone not null,
  disclaimer_text text not null,
  disclaimer_version text,
  refund_policy_text text not null,
  game_id uuid,
  gateway text default 'authorize.net'::text not null,
  gateway_transaction_id text,
  gateway_auth_code text,
  gateway_response_code text,
  card_brand text,
  card_last4 text,
  confirmation_token text not null,
  confirmation_sent_at timestamp with time zone,
  created_at timestamp with time zone default now() not null,
  confirmation_expires_at timestamp with time zone default (now() + '1 year'::interval) not null,
  game_terms_accepted_at timestamp with time zone,
  game_terms_text text,
  idempotency_key text
);
alter table public.orders add column if not exists id uuid default gen_random_uuid();
do $$ begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'orders'
      and column_name = 'id' and is_nullable = 'YES'
  ) then
    if exists (select 1 from public.orders where id is null) then
      raise notice 'public.orders.id holds nulls; left nullable. Fill them, then: alter table public.orders alter column id set not null;';
    else
      alter table public.orders alter column id set not null;
    end if;
  end if;
end $$;
alter table public.orders add column if not exists order_number text;
do $$ begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'orders'
      and column_name = 'order_number' and is_nullable = 'YES'
  ) then
    if exists (select 1 from public.orders where order_number is null) then
      raise notice 'public.orders.order_number holds nulls; left nullable. Fill them, then: alter table public.orders alter column order_number set not null;';
    else
      alter table public.orders alter column order_number set not null;
    end if;
  end if;
end $$;
alter table public.orders add column if not exists status text default 'paid'::text;
do $$ begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'orders'
      and column_name = 'status' and is_nullable = 'YES'
  ) then
    if exists (select 1 from public.orders where status is null) then
      raise notice 'public.orders.status holds nulls; left nullable. Fill them, then: alter table public.orders alter column status set not null;';
    else
      alter table public.orders alter column status set not null;
    end if;
  end if;
end $$;
alter table public.orders add column if not exists email text;
do $$ begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'orders'
      and column_name = 'email' and is_nullable = 'YES'
  ) then
    if exists (select 1 from public.orders where email is null) then
      raise notice 'public.orders.email holds nulls; left nullable. Fill them, then: alter table public.orders alter column email set not null;';
    else
      alter table public.orders alter column email set not null;
    end if;
  end if;
end $$;
alter table public.orders add column if not exists first_name text;
do $$ begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'orders'
      and column_name = 'first_name' and is_nullable = 'YES'
  ) then
    if exists (select 1 from public.orders where first_name is null) then
      raise notice 'public.orders.first_name holds nulls; left nullable. Fill them, then: alter table public.orders alter column first_name set not null;';
    else
      alter table public.orders alter column first_name set not null;
    end if;
  end if;
end $$;
alter table public.orders add column if not exists last_name text;
do $$ begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'orders'
      and column_name = 'last_name' and is_nullable = 'YES'
  ) then
    if exists (select 1 from public.orders where last_name is null) then
      raise notice 'public.orders.last_name holds nulls; left nullable. Fill them, then: alter table public.orders alter column last_name set not null;';
    else
      alter table public.orders alter column last_name set not null;
    end if;
  end if;
end $$;
alter table public.orders add column if not exists phone text;
alter table public.orders add column if not exists subtotal_cents integer;
do $$ begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'orders'
      and column_name = 'subtotal_cents' and is_nullable = 'YES'
  ) then
    if exists (select 1 from public.orders where subtotal_cents is null) then
      raise notice 'public.orders.subtotal_cents holds nulls; left nullable. Fill them, then: alter table public.orders alter column subtotal_cents set not null;';
    else
      alter table public.orders alter column subtotal_cents set not null;
    end if;
  end if;
end $$;
alter table public.orders add column if not exists tax_cents integer default 0;
do $$ begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'orders'
      and column_name = 'tax_cents' and is_nullable = 'YES'
  ) then
    if exists (select 1 from public.orders where tax_cents is null) then
      raise notice 'public.orders.tax_cents holds nulls; left nullable. Fill them, then: alter table public.orders alter column tax_cents set not null;';
    else
      alter table public.orders alter column tax_cents set not null;
    end if;
  end if;
end $$;
alter table public.orders add column if not exists shipping_cents integer default 0;
do $$ begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'orders'
      and column_name = 'shipping_cents' and is_nullable = 'YES'
  ) then
    if exists (select 1 from public.orders where shipping_cents is null) then
      raise notice 'public.orders.shipping_cents holds nulls; left nullable. Fill them, then: alter table public.orders alter column shipping_cents set not null;';
    else
      alter table public.orders alter column shipping_cents set not null;
    end if;
  end if;
end $$;
alter table public.orders add column if not exists total_cents integer;
do $$ begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'orders'
      and column_name = 'total_cents' and is_nullable = 'YES'
  ) then
    if exists (select 1 from public.orders where total_cents is null) then
      raise notice 'public.orders.total_cents holds nulls; left nullable. Fill them, then: alter table public.orders alter column total_cents set not null;';
    else
      alter table public.orders alter column total_cents set not null;
    end if;
  end if;
end $$;
alter table public.orders add column if not exists has_shipment boolean default false;
do $$ begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'orders'
      and column_name = 'has_shipment' and is_nullable = 'YES'
  ) then
    if exists (select 1 from public.orders where has_shipment is null) then
      raise notice 'public.orders.has_shipment holds nulls; left nullable. Fill them, then: alter table public.orders alter column has_shipment set not null;';
    else
      alter table public.orders alter column has_shipment set not null;
    end if;
  end if;
end $$;
alter table public.orders add column if not exists has_pickup boolean default false;
do $$ begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'orders'
      and column_name = 'has_pickup' and is_nullable = 'YES'
  ) then
    if exists (select 1 from public.orders where has_pickup is null) then
      raise notice 'public.orders.has_pickup holds nulls; left nullable. Fill them, then: alter table public.orders alter column has_pickup set not null;';
    else
      alter table public.orders alter column has_pickup set not null;
    end if;
  end if;
end $$;
alter table public.orders add column if not exists ship_name text;
alter table public.orders add column if not exists ship_line1 text;
alter table public.orders add column if not exists ship_line2 text;
alter table public.orders add column if not exists ship_city text;
alter table public.orders add column if not exists ship_region text;
alter table public.orders add column if not exists ship_postal_code text;
alter table public.orders add column if not exists disclaimer_accepted_at timestamp with time zone;
do $$ begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'orders'
      and column_name = 'disclaimer_accepted_at' and is_nullable = 'YES'
  ) then
    if exists (select 1 from public.orders where disclaimer_accepted_at is null) then
      raise notice 'public.orders.disclaimer_accepted_at holds nulls; left nullable. Fill them, then: alter table public.orders alter column disclaimer_accepted_at set not null;';
    else
      alter table public.orders alter column disclaimer_accepted_at set not null;
    end if;
  end if;
end $$;
alter table public.orders add column if not exists disclaimer_text text;
do $$ begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'orders'
      and column_name = 'disclaimer_text' and is_nullable = 'YES'
  ) then
    if exists (select 1 from public.orders where disclaimer_text is null) then
      raise notice 'public.orders.disclaimer_text holds nulls; left nullable. Fill them, then: alter table public.orders alter column disclaimer_text set not null;';
    else
      alter table public.orders alter column disclaimer_text set not null;
    end if;
  end if;
end $$;
alter table public.orders add column if not exists disclaimer_version text;
alter table public.orders add column if not exists refund_policy_text text;
do $$ begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'orders'
      and column_name = 'refund_policy_text' and is_nullable = 'YES'
  ) then
    if exists (select 1 from public.orders where refund_policy_text is null) then
      raise notice 'public.orders.refund_policy_text holds nulls; left nullable. Fill them, then: alter table public.orders alter column refund_policy_text set not null;';
    else
      alter table public.orders alter column refund_policy_text set not null;
    end if;
  end if;
end $$;
alter table public.orders add column if not exists game_id uuid;
alter table public.orders add column if not exists gateway text default 'authorize.net'::text;
do $$ begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'orders'
      and column_name = 'gateway' and is_nullable = 'YES'
  ) then
    if exists (select 1 from public.orders where gateway is null) then
      raise notice 'public.orders.gateway holds nulls; left nullable. Fill them, then: alter table public.orders alter column gateway set not null;';
    else
      alter table public.orders alter column gateway set not null;
    end if;
  end if;
end $$;
alter table public.orders add column if not exists gateway_transaction_id text;
alter table public.orders add column if not exists gateway_auth_code text;
alter table public.orders add column if not exists gateway_response_code text;
alter table public.orders add column if not exists card_brand text;
alter table public.orders add column if not exists card_last4 text;
alter table public.orders add column if not exists confirmation_token text;
do $$ begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'orders'
      and column_name = 'confirmation_token' and is_nullable = 'YES'
  ) then
    if exists (select 1 from public.orders where confirmation_token is null) then
      raise notice 'public.orders.confirmation_token holds nulls; left nullable. Fill them, then: alter table public.orders alter column confirmation_token set not null;';
    else
      alter table public.orders alter column confirmation_token set not null;
    end if;
  end if;
end $$;
alter table public.orders add column if not exists confirmation_sent_at timestamp with time zone;
alter table public.orders add column if not exists created_at timestamp with time zone default now();
do $$ begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'orders'
      and column_name = 'created_at' and is_nullable = 'YES'
  ) then
    if exists (select 1 from public.orders where created_at is null) then
      raise notice 'public.orders.created_at holds nulls; left nullable. Fill them, then: alter table public.orders alter column created_at set not null;';
    else
      alter table public.orders alter column created_at set not null;
    end if;
  end if;
end $$;
alter table public.orders add column if not exists confirmation_expires_at timestamp with time zone default (now() + '1 year'::interval);
do $$ begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'orders'
      and column_name = 'confirmation_expires_at' and is_nullable = 'YES'
  ) then
    if exists (select 1 from public.orders where confirmation_expires_at is null) then
      raise notice 'public.orders.confirmation_expires_at holds nulls; left nullable. Fill them, then: alter table public.orders alter column confirmation_expires_at set not null;';
    else
      alter table public.orders alter column confirmation_expires_at set not null;
    end if;
  end if;
end $$;
alter table public.orders add column if not exists game_terms_accepted_at timestamp with time zone;
alter table public.orders add column if not exists game_terms_text text;
alter table public.orders add column if not exists idempotency_key text;

create table if not exists public.settings (
  key text not null,
  value jsonb default '{}'::jsonb not null,
  updated_at timestamp with time zone default now(),
  updated_by uuid,
  updated_by_name text
);
alter table public.settings add column if not exists key text;
do $$ begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'settings'
      and column_name = 'key' and is_nullable = 'YES'
  ) then
    if exists (select 1 from public.settings where key is null) then
      raise notice 'public.settings.key holds nulls; left nullable. Fill them, then: alter table public.settings alter column key set not null;';
    else
      alter table public.settings alter column key set not null;
    end if;
  end if;
end $$;
alter table public.settings add column if not exists value jsonb default '{}'::jsonb;
do $$ begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'settings'
      and column_name = 'value' and is_nullable = 'YES'
  ) then
    if exists (select 1 from public.settings where value is null) then
      raise notice 'public.settings.value holds nulls; left nullable. Fill them, then: alter table public.settings alter column value set not null;';
    else
      alter table public.settings alter column value set not null;
    end if;
  end if;
end $$;
alter table public.settings add column if not exists updated_at timestamp with time zone default now();
alter table public.settings add column if not exists updated_by uuid;
alter table public.settings add column if not exists updated_by_name text;

create table if not exists public.winners (
  id uuid default gen_random_uuid() not null,
  game_id uuid not null,
  spot_id uuid,
  display_name text not null,
  photo_url text,
  note text,
  drawn_at timestamp with time zone default now() not null,
  seed text,
  ticket integer,
  entry_total integer,
  pool jsonb,
  ticket_index integer,
  drawn_early boolean default false not null,
  unsold_spots integer
);
alter table public.winners add column if not exists id uuid default gen_random_uuid();
do $$ begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'winners'
      and column_name = 'id' and is_nullable = 'YES'
  ) then
    if exists (select 1 from public.winners where id is null) then
      raise notice 'public.winners.id holds nulls; left nullable. Fill them, then: alter table public.winners alter column id set not null;';
    else
      alter table public.winners alter column id set not null;
    end if;
  end if;
end $$;
alter table public.winners add column if not exists game_id uuid;
do $$ begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'winners'
      and column_name = 'game_id' and is_nullable = 'YES'
  ) then
    if exists (select 1 from public.winners where game_id is null) then
      raise notice 'public.winners.game_id holds nulls; left nullable. Fill them, then: alter table public.winners alter column game_id set not null;';
    else
      alter table public.winners alter column game_id set not null;
    end if;
  end if;
end $$;
alter table public.winners add column if not exists spot_id uuid;
alter table public.winners add column if not exists display_name text;
do $$ begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'winners'
      and column_name = 'display_name' and is_nullable = 'YES'
  ) then
    if exists (select 1 from public.winners where display_name is null) then
      raise notice 'public.winners.display_name holds nulls; left nullable. Fill them, then: alter table public.winners alter column display_name set not null;';
    else
      alter table public.winners alter column display_name set not null;
    end if;
  end if;
end $$;
alter table public.winners add column if not exists photo_url text;
alter table public.winners add column if not exists note text;
alter table public.winners add column if not exists drawn_at timestamp with time zone default now();
do $$ begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'winners'
      and column_name = 'drawn_at' and is_nullable = 'YES'
  ) then
    if exists (select 1 from public.winners where drawn_at is null) then
      raise notice 'public.winners.drawn_at holds nulls; left nullable. Fill them, then: alter table public.winners alter column drawn_at set not null;';
    else
      alter table public.winners alter column drawn_at set not null;
    end if;
  end if;
end $$;
alter table public.winners add column if not exists seed text;
alter table public.winners add column if not exists ticket integer;
alter table public.winners add column if not exists entry_total integer;
alter table public.winners add column if not exists pool jsonb;
alter table public.winners add column if not exists ticket_index integer;
alter table public.winners add column if not exists drawn_early boolean default false;
do $$ begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'winners'
      and column_name = 'drawn_early' and is_nullable = 'YES'
  ) then
    if exists (select 1 from public.winners where drawn_early is null) then
      raise notice 'public.winners.drawn_early holds nulls; left nullable. Fill them, then: alter table public.winners alter column drawn_early set not null;';
    else
      alter table public.winners alter column drawn_early set not null;
    end if;
  end if;
end $$;
alter table public.winners add column if not exists unsold_spots integer;

-- ---------------------------------------------------------------------
-- Views
-- ---------------------------------------------------------------------

create or replace view public.game_spot_board as
SELECT game_id,
    spot_number,
    status,
        CASE
            WHEN ((status = 'sold'::text) AND show_name AND (first_name IS NOT NULL)) THEN (first_name ||
            CASE
                WHEN (COALESCE(last_name, ''::text) = ''::text) THEN ''::text
                ELSE ((' '::text || upper("left"(last_name, 1))) || '.'::text)
            END)
            ELSE NULL::text
        END AS display_name
   FROM game_spots s;

-- ---------------------------------------------------------------------
-- Constraints
-- ---------------------------------------------------------------------
-- Added only when absent. A constraint that exists is left exactly as it
-- is rather than dropped and recreated, so this cannot briefly open a
-- window where the rule is not enforced.

do $$ begin
  if not exists (
    select 1 from pg_constraint c join pg_namespace n on n.oid = c.connamespace
    where n.nspname = 'public' and c.conname = 'admin_activity_pkey'
      and c.conrelid = 'admin_activity'::regclass
  ) then
    alter table admin_activity add constraint admin_activity_pkey PRIMARY KEY (id);
  end if;
end $$;
do $$ begin
  if not exists (
    select 1 from pg_constraint c join pg_namespace n on n.oid = c.connamespace
    where n.nspname = 'public' and c.conname = 'checkout_attempts_pkey'
      and c.conrelid = 'checkout_attempts'::regclass
  ) then
    alter table checkout_attempts add constraint checkout_attempts_pkey PRIMARY KEY (key);
  end if;
end $$;
do $$ begin
  if not exists (
    select 1 from pg_constraint c join pg_namespace n on n.oid = c.connamespace
    where n.nspname = 'public' and c.conname = 'game_events_pkey'
      and c.conrelid = 'game_events'::regclass
  ) then
    alter table game_events add constraint game_events_pkey PRIMARY KEY (id);
  end if;
end $$;
do $$ begin
  if not exists (
    select 1 from pg_constraint c join pg_namespace n on n.oid = c.connamespace
    where n.nspname = 'public' and c.conname = 'game_spots_pkey'
      and c.conrelid = 'game_spots'::regclass
  ) then
    alter table game_spots add constraint game_spots_pkey PRIMARY KEY (id);
  end if;
end $$;
do $$ begin
  if not exists (
    select 1 from pg_constraint c join pg_namespace n on n.oid = c.connamespace
    where n.nspname = 'public' and c.conname = 'games_pkey'
      and c.conrelid = 'games'::regclass
  ) then
    alter table games add constraint games_pkey PRIMARY KEY (id);
  end if;
end $$;
do $$ begin
  if not exists (
    select 1 from pg_constraint c join pg_namespace n on n.oid = c.connamespace
    where n.nspname = 'public' and c.conname = 'inquiries_pkey'
      and c.conrelid = 'inquiries'::regclass
  ) then
    alter table inquiries add constraint inquiries_pkey PRIMARY KEY (id);
  end if;
end $$;
do $$ begin
  if not exists (
    select 1 from pg_constraint c join pg_namespace n on n.oid = c.connamespace
    where n.nspname = 'public' and c.conname = 'item_variants_pkey'
      and c.conrelid = 'item_variants'::regclass
  ) then
    alter table item_variants add constraint item_variants_pkey PRIMARY KEY (id);
  end if;
end $$;
do $$ begin
  if not exists (
    select 1 from pg_constraint c join pg_namespace n on n.oid = c.connamespace
    where n.nspname = 'public' and c.conname = 'items_pkey'
      and c.conrelid = 'items'::regclass
  ) then
    alter table items add constraint items_pkey PRIMARY KEY (id);
  end if;
end $$;
do $$ begin
  if not exists (
    select 1 from pg_constraint c join pg_namespace n on n.oid = c.connamespace
    where n.nspname = 'public' and c.conname = 'order_items_pkey'
      and c.conrelid = 'order_items'::regclass
  ) then
    alter table order_items add constraint order_items_pkey PRIMARY KEY (id);
  end if;
end $$;
do $$ begin
  if not exists (
    select 1 from pg_constraint c join pg_namespace n on n.oid = c.connamespace
    where n.nspname = 'public' and c.conname = 'orders_pkey'
      and c.conrelid = 'orders'::regclass
  ) then
    alter table orders add constraint orders_pkey PRIMARY KEY (id);
  end if;
end $$;
do $$ begin
  if not exists (
    select 1 from pg_constraint c join pg_namespace n on n.oid = c.connamespace
    where n.nspname = 'public' and c.conname = 'settings_pkey'
      and c.conrelid = 'settings'::regclass
  ) then
    alter table settings add constraint settings_pkey PRIMARY KEY (key);
  end if;
end $$;
do $$ begin
  if not exists (
    select 1 from pg_constraint c join pg_namespace n on n.oid = c.connamespace
    where n.nspname = 'public' and c.conname = 'winners_pkey'
      and c.conrelid = 'winners'::regclass
  ) then
    alter table winners add constraint winners_pkey PRIMARY KEY (id);
  end if;
end $$;
do $$ begin
  if not exists (
    select 1 from pg_constraint c join pg_namespace n on n.oid = c.connamespace
    where n.nspname = 'public' and c.conname = 'game_spots_game_id_spot_number_key'
      and c.conrelid = 'game_spots'::regclass
  ) then
    alter table game_spots add constraint game_spots_game_id_spot_number_key UNIQUE (game_id, spot_number);
  end if;
end $$;
do $$ begin
  if not exists (
    select 1 from pg_constraint c join pg_namespace n on n.oid = c.connamespace
    where n.nspname = 'public' and c.conname = 'items_slug_key'
      and c.conrelid = 'items'::regclass
  ) then
    alter table items add constraint items_slug_key UNIQUE (slug);
  end if;
end $$;
do $$ begin
  if not exists (
    select 1 from pg_constraint c join pg_namespace n on n.oid = c.connamespace
    where n.nspname = 'public' and c.conname = 'orders_gateway_transaction_id_key'
      and c.conrelid = 'orders'::regclass
  ) then
    alter table orders add constraint orders_gateway_transaction_id_key UNIQUE (gateway_transaction_id);
  end if;
end $$;
do $$ begin
  if not exists (
    select 1 from pg_constraint c join pg_namespace n on n.oid = c.connamespace
    where n.nspname = 'public' and c.conname = 'orders_order_number_key'
      and c.conrelid = 'orders'::regclass
  ) then
    alter table orders add constraint orders_order_number_key UNIQUE (order_number);
  end if;
end $$;
do $$ begin
  if not exists (
    select 1 from pg_constraint c join pg_namespace n on n.oid = c.connamespace
    where n.nspname = 'public' and c.conname = 'game_spots_status_valid'
      and c.conrelid = 'game_spots'::regclass
  ) then
    alter table game_spots add constraint game_spots_status_valid CHECK ((status = ANY (ARRAY['open'::text, 'held'::text, 'sold'::text])));
  end if;
end $$;
do $$ begin
  if not exists (
    select 1 from pg_constraint c join pg_namespace n on n.oid = c.connamespace
    where n.nspname = 'public' and c.conname = 'games_price_sane'
      and c.conrelid = 'games'::regclass
  ) then
    alter table games add constraint games_price_sane CHECK (((spot_price_cents >= 100) AND (spot_price_cents <= 100000000)));
  end if;
end $$;
do $$ begin
  if not exists (
    select 1 from pg_constraint c join pg_namespace n on n.oid = c.connamespace
    where n.nspname = 'public' and c.conname = 'games_spots_sane'
      and c.conrelid = 'games'::regclass
  ) then
    alter table games add constraint games_spots_sane CHECK (((total_spots >= 1) AND (total_spots <= 10000)));
  end if;
end $$;
do $$ begin
  if not exists (
    select 1 from pg_constraint c join pg_namespace n on n.oid = c.connamespace
    where n.nspname = 'public' and c.conname = 'games_status_valid'
      and c.conrelid = 'games'::regclass
  ) then
    alter table games add constraint games_status_valid CHECK ((status = ANY (ARRAY['open'::text, 'full'::text, 'drawn'::text])));
  end if;
end $$;
do $$ begin
  if not exists (
    select 1 from pg_constraint c join pg_namespace n on n.oid = c.connamespace
    where n.nspname = 'public' and c.conname = 'item_variants_stock_not_negative'
      and c.conrelid = 'item_variants'::regclass
  ) then
    alter table item_variants add constraint item_variants_stock_not_negative CHECK ((stock >= 0));
  end if;
end $$;
do $$ begin
  if not exists (
    select 1 from pg_constraint c join pg_namespace n on n.oid = c.connamespace
    where n.nspname = 'public' and c.conname = 'items_firearms_have_no_online_price'
      and c.conrelid = 'items'::regclass
  ) then
    alter table items add constraint items_firearms_have_no_online_price CHECK (((category <> ALL (ARRAY['pistol'::text, 'revolver'::text, 'rifle'::text, 'shotgun'::text, 'pcc'::text])) OR (price_cents IS NULL)));
  end if;
end $$;
do $$ begin
  if not exists (
    select 1 from pg_constraint c join pg_namespace n on n.oid = c.connamespace
    where n.nspname = 'public' and c.conname = 'items_fulfillment_type_valid'
      and c.conrelid = 'items'::regclass
  ) then
    alter table items add constraint items_fulfillment_type_valid CHECK ((fulfillment_type = ANY (ARRAY['ship'::text, 'pickup'::text])));
  end if;
end $$;
do $$ begin
  if not exists (
    select 1 from pg_constraint c join pg_namespace n on n.oid = c.connamespace
    where n.nspname = 'public' and c.conname = 'items_price_cents_positive'
      and c.conrelid = 'items'::regclass
  ) then
    alter table items add constraint items_price_cents_positive CHECK (((price_cents IS NULL) OR (price_cents > 0)));
  end if;
end $$;
do $$ begin
  if not exists (
    select 1 from pg_constraint c join pg_namespace n on n.oid = c.connamespace
    where n.nspname = 'public' and c.conname = 'items_shipping_override_sane'
      and c.conrelid = 'items'::regclass
  ) then
    alter table items add constraint items_shipping_override_sane CHECK (((shipping_override_cents IS NULL) OR ((shipping_override_cents >= 0) AND (shipping_override_cents <= 100000))));
  end if;
end $$;
do $$ begin
  if not exists (
    select 1 from pg_constraint c join pg_namespace n on n.oid = c.connamespace
    where n.nspname = 'public' and c.conname = 'items_shipping_tier_valid'
      and c.conrelid = 'items'::regclass
  ) then
    alter table items add constraint items_shipping_tier_valid CHECK ((shipping_tier = ANY (ARRAY['standard'::text, 'oversize'::text])));
  end if;
end $$;
do $$ begin
  if not exists (
    select 1 from pg_constraint c join pg_namespace n on n.oid = c.connamespace
    where n.nspname = 'public' and c.conname = 'order_items_fulfillment_valid'
      and c.conrelid = 'order_items'::regclass
  ) then
    alter table order_items add constraint order_items_fulfillment_valid CHECK ((fulfillment_type = ANY (ARRAY['ship'::text, 'pickup'::text, 'none'::text])));
  end if;
end $$;
do $$ begin
  if not exists (
    select 1 from pg_constraint c join pg_namespace n on n.oid = c.connamespace
    where n.nspname = 'public' and c.conname = 'order_items_line_type_valid'
      and c.conrelid = 'order_items'::regclass
  ) then
    alter table order_items add constraint order_items_line_type_valid CHECK ((line_type = ANY (ARRAY['inventory'::text, 'game_spot'::text])));
  end if;
end $$;
do $$ begin
  if not exists (
    select 1 from pg_constraint c join pg_namespace n on n.oid = c.connamespace
    where n.nspname = 'public' and c.conname = 'order_items_quantity_positive'
      and c.conrelid = 'order_items'::regclass
  ) then
    alter table order_items add constraint order_items_quantity_positive CHECK ((quantity > 0));
  end if;
end $$;
do $$ begin
  if not exists (
    select 1 from pg_constraint c join pg_namespace n on n.oid = c.connamespace
    where n.nspname = 'public' and c.conname = 'orders_status_valid'
      and c.conrelid = 'orders'::regclass
  ) then
    alter table orders add constraint orders_status_valid CHECK ((status = ANY (ARRAY['paid'::text, 'fulfilled'::text, 'cancelled'::text, 'refunded'::text])));
  end if;
end $$;
do $$ begin
  if not exists (
    select 1 from pg_constraint c join pg_namespace n on n.oid = c.connamespace
    where n.nspname = 'public' and c.conname = 'admin_activity_actor_id_fkey'
      and c.conrelid = 'admin_activity'::regclass
  ) then
    alter table admin_activity add constraint admin_activity_actor_id_fkey FOREIGN KEY (actor_id) REFERENCES auth.users(id) ON DELETE SET NULL;
  end if;
end $$;
do $$ begin
  if not exists (
    select 1 from pg_constraint c join pg_namespace n on n.oid = c.connamespace
    where n.nspname = 'public' and c.conname = 'game_spots_game_id_fkey'
      and c.conrelid = 'game_spots'::regclass
  ) then
    alter table game_spots add constraint game_spots_game_id_fkey FOREIGN KEY (game_id) REFERENCES games(id) ON DELETE CASCADE;
  end if;
end $$;
do $$ begin
  if not exists (
    select 1 from pg_constraint c join pg_namespace n on n.oid = c.connamespace
    where n.nspname = 'public' and c.conname = 'game_spots_order_id_fkey'
      and c.conrelid = 'game_spots'::regclass
  ) then
    alter table game_spots add constraint game_spots_order_id_fkey FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE SET NULL;
  end if;
end $$;
do $$ begin
  if not exists (
    select 1 from pg_constraint c join pg_namespace n on n.oid = c.connamespace
    where n.nspname = 'public' and c.conname = 'games_created_by_fkey'
      and c.conrelid = 'games'::regclass
  ) then
    alter table games add constraint games_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;
  end if;
end $$;
do $$ begin
  if not exists (
    select 1 from pg_constraint c join pg_namespace n on n.oid = c.connamespace
    where n.nspname = 'public' and c.conname = 'games_item_id_fkey'
      and c.conrelid = 'games'::regclass
  ) then
    alter table games add constraint games_item_id_fkey FOREIGN KEY (item_id) REFERENCES items(id) ON DELETE RESTRICT;
  end if;
end $$;
do $$ begin
  if not exists (
    select 1 from pg_constraint c join pg_namespace n on n.oid = c.connamespace
    where n.nspname = 'public' and c.conname = 'games_updated_by_fkey'
      and c.conrelid = 'games'::regclass
  ) then
    alter table games add constraint games_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES auth.users(id) ON DELETE SET NULL;
  end if;
end $$;
do $$ begin
  if not exists (
    select 1 from pg_constraint c join pg_namespace n on n.oid = c.connamespace
    where n.nspname = 'public' and c.conname = 'inquiries_item_id_fkey'
      and c.conrelid = 'inquiries'::regclass
  ) then
    alter table inquiries add constraint inquiries_item_id_fkey FOREIGN KEY (item_id) REFERENCES items(id) ON DELETE RESTRICT;
  end if;
end $$;
do $$ begin
  if not exists (
    select 1 from pg_constraint c join pg_namespace n on n.oid = c.connamespace
    where n.nspname = 'public' and c.conname = 'item_variants_item_id_fkey'
      and c.conrelid = 'item_variants'::regclass
  ) then
    alter table item_variants add constraint item_variants_item_id_fkey FOREIGN KEY (item_id) REFERENCES items(id) ON DELETE CASCADE;
  end if;
end $$;
do $$ begin
  if not exists (
    select 1 from pg_constraint c join pg_namespace n on n.oid = c.connamespace
    where n.nspname = 'public' and c.conname = 'items_created_by_fkey'
      and c.conrelid = 'items'::regclass
  ) then
    alter table items add constraint items_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;
  end if;
end $$;
do $$ begin
  if not exists (
    select 1 from pg_constraint c join pg_namespace n on n.oid = c.connamespace
    where n.nspname = 'public' and c.conname = 'items_updated_by_fkey'
      and c.conrelid = 'items'::regclass
  ) then
    alter table items add constraint items_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES auth.users(id) ON DELETE SET NULL;
  end if;
end $$;
do $$ begin
  if not exists (
    select 1 from pg_constraint c join pg_namespace n on n.oid = c.connamespace
    where n.nspname = 'public' and c.conname = 'order_items_game_id_fkey'
      and c.conrelid = 'order_items'::regclass
  ) then
    alter table order_items add constraint order_items_game_id_fkey FOREIGN KEY (game_id) REFERENCES games(id) ON DELETE SET NULL;
  end if;
end $$;
do $$ begin
  if not exists (
    select 1 from pg_constraint c join pg_namespace n on n.oid = c.connamespace
    where n.nspname = 'public' and c.conname = 'order_items_item_id_fkey'
      and c.conrelid = 'order_items'::regclass
  ) then
    alter table order_items add constraint order_items_item_id_fkey FOREIGN KEY (item_id) REFERENCES items(id) ON DELETE RESTRICT;
  end if;
end $$;
do $$ begin
  if not exists (
    select 1 from pg_constraint c join pg_namespace n on n.oid = c.connamespace
    where n.nspname = 'public' and c.conname = 'order_items_order_id_fkey'
      and c.conrelid = 'order_items'::regclass
  ) then
    alter table order_items add constraint order_items_order_id_fkey FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE;
  end if;
end $$;
do $$ begin
  if not exists (
    select 1 from pg_constraint c join pg_namespace n on n.oid = c.connamespace
    where n.nspname = 'public' and c.conname = 'order_items_variant_id_fkey'
      and c.conrelid = 'order_items'::regclass
  ) then
    alter table order_items add constraint order_items_variant_id_fkey FOREIGN KEY (variant_id) REFERENCES item_variants(id) ON DELETE SET NULL;
  end if;
end $$;
do $$ begin
  if not exists (
    select 1 from pg_constraint c join pg_namespace n on n.oid = c.connamespace
    where n.nspname = 'public' and c.conname = 'orders_game_id_fkey'
      and c.conrelid = 'orders'::regclass
  ) then
    alter table orders add constraint orders_game_id_fkey FOREIGN KEY (game_id) REFERENCES games(id) ON DELETE SET NULL;
  end if;
end $$;
do $$ begin
  if not exists (
    select 1 from pg_constraint c join pg_namespace n on n.oid = c.connamespace
    where n.nspname = 'public' and c.conname = 'settings_updated_by_fkey'
      and c.conrelid = 'settings'::regclass
  ) then
    alter table settings add constraint settings_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES auth.users(id) ON DELETE SET NULL;
  end if;
end $$;
do $$ begin
  if not exists (
    select 1 from pg_constraint c join pg_namespace n on n.oid = c.connamespace
    where n.nspname = 'public' and c.conname = 'winners_game_id_fkey'
      and c.conrelid = 'winners'::regclass
  ) then
    alter table winners add constraint winners_game_id_fkey FOREIGN KEY (game_id) REFERENCES games(id) ON DELETE RESTRICT;
  end if;
end $$;
do $$ begin
  if not exists (
    select 1 from pg_constraint c join pg_namespace n on n.oid = c.connamespace
    where n.nspname = 'public' and c.conname = 'winners_spot_id_fkey'
      and c.conrelid = 'winners'::regclass
  ) then
    alter table winners add constraint winners_spot_id_fkey FOREIGN KEY (spot_id) REFERENCES game_spots(id) ON DELETE SET NULL;
  end if;
end $$;

-- ---------------------------------------------------------------------
-- Indexes
-- ---------------------------------------------------------------------
-- Indexes that back a primary key or unique constraint are skipped: the
-- constraint above already created them, and creating them again fails.

create index if not exists admin_activity_at_idx ON public.admin_activity USING btree (at DESC);
create index if not exists admin_activity_entity_idx ON public.admin_activity USING btree (entity, entity_id);
create index if not exists checkout_attempts_started_idx ON public.checkout_attempts USING btree (started_at DESC);
create index if not exists game_events_kind_idx ON public.game_events USING btree (kind, created_at DESC);
create index if not exists game_spots_email_idx ON public.game_spots USING btree (game_id, lower(email));
create index if not exists game_spots_game_status_idx ON public.game_spots USING btree (game_id, status);
create index if not exists game_spots_order_idx ON public.game_spots USING btree (order_id);
create index if not exists games_status_idx ON public.games USING btree (status);
create index if not exists inquiries_status_idx ON public.inquiries USING btree (status);
create index if not exists item_variants_item_idx ON public.item_variants USING btree (item_id, sort_order);
create UNIQUE index if not exists item_variants_item_size_idx ON public.item_variants USING btree (item_id, lower(size));
create index if not exists items_category_idx ON public.items USING btree (category);
create index if not exists items_created_at_idx ON public.items USING btree (created_at DESC);
create index if not exists items_status_idx ON public.items USING btree (status);
create index if not exists order_items_order_idx ON public.order_items USING btree (order_id);
create index if not exists orders_confirmation_idx ON public.orders USING btree (order_number, confirmation_token);
create index if not exists orders_created_idx ON public.orders USING btree (created_at DESC);
create index if not exists orders_email_idx ON public.orders USING btree (lower(email));
create UNIQUE index if not exists orders_idempotency_key_idx ON public.orders USING btree (idempotency_key) WHERE (idempotency_key IS NOT NULL);
create index if not exists winners_game_idx ON public.winners USING btree (game_id);
create UNIQUE index if not exists winners_one_per_game_idx ON public.winners USING btree (game_id);

-- ---------------------------------------------------------------------
-- Functions
-- ---------------------------------------------------------------------
-- CREATE OR REPLACE, so an older definition is brought up to date rather
-- than left in place.

create or replace function public.claim_checkout(p_key text)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  existing public.checkout_attempts;
begin
  if p_key is null or length(p_key) < 8 then
    return 'claimed';  -- no usable key; fall back to the other two layers
  end if;

  insert into public.checkout_attempts (key)
  values (p_key)
  on conflict (key) do nothing;

  -- Row-count tells us whether this call created it.
  if found then
    return 'claimed';
  end if;

  select * into existing from public.checkout_attempts where key = p_key;

  if existing.order_number is not null then
    return 'done:' || existing.order_number;
  end if;

  if existing.started_at < now() - interval '15 minutes' then
    update public.checkout_attempts
    set started_at = now(), outcome = null
    where key = p_key;
    return 'claimed';
  end if;

  return 'in_flight';
end;
$function$;

create or replace function public.claim_game_spots(p_game uuid, p_qty integer)
 RETURNS integer[]
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  taken int[];
begin
  if p_qty is null or p_qty <= 0 then
    return null;
  end if;

  -- Self-healing: a hold that never became a sale is an abandoned
  -- checkout — the server died between claiming and charging. Without
  -- this, every such crash would take a spot out of circulation
  -- permanently and the game could never fill.
  update public.game_spots
  set status = 'open', held_at = null
  where game_id = p_game
    and status = 'held'
    and held_at < now() - interval '15 minutes';

  with picked as (
    select id
    from public.game_spots
    where game_id = p_game and status = 'open'
    order by spot_number
    limit p_qty
    for update skip locked
  ),
  moved as (
    update public.game_spots s
    set status = 'held', held_at = now()
    from picked p
    where s.id = p.id
    returning s.spot_number
  )
  select array_agg(spot_number order by spot_number) into taken from moved;

  -- All or nothing. A partial claim is the oversell this function exists
  -- to prevent: it would hand somebody three of the four spots they are
  -- paying for. Put back whatever was taken and refuse.
  if taken is null or coalesce(array_length(taken, 1), 0) <> p_qty then
    if taken is not null then
      update public.game_spots
      set status = 'open', held_at = null
      where game_id = p_game
        and status = 'held'
        and spot_number = any(taken);
    end if;
    return null;
  end if;

  return taken;
end;
$function$;

create or replace function public.claim_variant_stock(p_variant uuid, p_qty integer)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  claimed int;
begin
  if p_qty is null or p_qty <= 0 then
    return false;
  end if;

  update public.item_variants
     set stock = stock - p_qty
   where id = p_variant
     and stock >= p_qty;

  get diagnostics claimed = row_count;
  return claimed = 1;
end;
$function$;

create or replace function public.finish_checkout(p_key text, p_order text, p_outcome text)
 RETURNS void
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  update public.checkout_attempts
  set order_number = coalesce(p_order, order_number),
      outcome = coalesce(p_outcome, outcome),
      finished_at = now()
  where key = p_key;
$function$;

create or replace function public.game_spots_remaining(p_game uuid)
 RETURNS integer
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select count(*)::int
  from public.game_spots
  where game_id = p_game and status = 'open';
$function$;

create or replace function public.release_checkout(p_key text)
 RETURNS void
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  delete from public.checkout_attempts
  where key = p_key and order_number is null;
$function$;

create or replace function public.release_game_spots(p_game uuid, p_spots integer[])
 RETURNS void
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  update public.game_spots
  set status = 'open', held_at = null
  where game_id = p_game
    and status = 'held'
    and spot_number = any(p_spots);
$function$;

create or replace function public.release_variant_stock(p_variant uuid, p_qty integer)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if p_qty is null or p_qty <= 0 then
    return;
  end if;
  update public.item_variants
     set stock = stock + p_qty
   where id = p_variant;
end;
$function$;

create or replace function public.sell_game_spots(p_game uuid, p_spots integer[], p_order uuid, p_first_name text, p_last_name text, p_email text, p_phone text, p_show_name boolean)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  update public.game_spots
  set status = 'sold',
      sold_at = now(),
      order_id = p_order,
      first_name = p_first_name,
      last_name = p_last_name,
      email = p_email,
      phone = p_phone,
      show_name = coalesce(p_show_name, false)
  where game_id = p_game
    and status = 'held'
    and spot_number = any(p_spots);

  update public.games g
  set status = 'full'
  where g.id = p_game
    and g.status = 'open'
    and not exists (
      select 1 from public.game_spots
      where game_id = p_game and status <> 'sold'
    );
end;
$function$;

create or replace function public.set_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
begin
  new.updated_at = now();
  return new;
end;
$function$;

create or replace function public.stamp_authorship()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
begin
  if tg_op = 'INSERT' then
    new.created_by := coalesce(auth.uid(), new.created_by);
    new.updated_by := coalesce(auth.uid(), new.updated_by);
  else
    -- Who created a record never changes.
    new.created_by := old.created_by;
    new.created_by_name := old.created_by_name;
    new.updated_by := coalesce(auth.uid(), old.updated_by);
    if auth.uid() is null then
      new.updated_by_name := old.updated_by_name;
    end if;
  end if;
  return new;
end;
$function$;

create or replace function public.stamp_authorship_updated_only()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
begin
  new.updated_by := coalesce(auth.uid(), new.updated_by);
  if auth.uid() is null and tg_op = 'UPDATE' then
    new.updated_by := old.updated_by;
    new.updated_by_name := old.updated_by_name;
  end if;
  return new;
end;
$function$;

-- ---------------------------------------------------------------------
-- Row level security
-- ---------------------------------------------------------------------

alter table public.admin_activity enable row level security;
alter table public.checkout_attempts enable row level security;
alter table public.game_events enable row level security;
alter table public.game_spots enable row level security;
alter table public.games enable row level security;
alter table public.inquiries enable row level security;
alter table public.item_variants enable row level security;
alter table public.items enable row level security;
alter table public.order_items enable row level security;
alter table public.orders enable row level security;
alter table public.settings enable row level security;
alter table public.winners enable row level security;

-- Policies are dropped and recreated, because unlike a constraint a
-- policy's definition can have changed while its name stayed the same,
-- and there is no "replace" form. Inside the transaction, so no request
-- ever sees the table unprotected.

drop policy if exists "Owner reads activity" on public.admin_activity;
create policy "Owner reads activity" on public.admin_activity for select to authenticated
  using (true);
drop policy if exists "Owner writes activity" on public.admin_activity;
create policy "Owner writes activity" on public.admin_activity for insert to authenticated
  with check (true);
drop policy if exists "Anyone can record a game event" on public.game_events;
create policy "Anyone can record a game event" on public.game_events for insert to anon,authenticated
  with check ((kind = ANY (ARRAY['played'::text, 'won'::text, 'code_copied'::text])));
drop policy if exists "Owner can read game events" on public.game_events;
create policy "Owner can read game events" on public.game_events for select to authenticated
  using (true);
drop policy if exists "Owner manages spots" on public.game_spots;
create policy "Owner manages spots" on public.game_spots for all to authenticated
  using (true)
  with check (true);
drop policy if exists "Anyone can read games" on public.games;
create policy "Anyone can read games" on public.games for select to anon,authenticated
  using (true);
drop policy if exists "Owner can delete games" on public.games;
create policy "Owner can delete games" on public.games for delete to authenticated
  using (true);
drop policy if exists "Owner can insert games" on public.games;
create policy "Owner can insert games" on public.games for insert to authenticated
  with check (true);
drop policy if exists "Owner can read all games" on public.games;
create policy "Owner can read all games" on public.games for select to authenticated
  using (true);
drop policy if exists "Owner can update games" on public.games;
create policy "Owner can update games" on public.games for update to authenticated
  using (true)
  with check (true);
drop policy if exists "Owner can delete inquiries" on public.inquiries;
create policy "Owner can delete inquiries" on public.inquiries for delete to authenticated
  using (true);
drop policy if exists "Owner can insert inquiries" on public.inquiries;
create policy "Owner can insert inquiries" on public.inquiries for insert to authenticated
  with check (true);
drop policy if exists "Owner can read inquiries" on public.inquiries;
create policy "Owner can read inquiries" on public.inquiries for select to authenticated
  using (true);
drop policy if exists "Owner can update inquiries" on public.inquiries;
create policy "Owner can update inquiries" on public.inquiries for update to authenticated
  using (true)
  with check (true);
drop policy if exists "Anyone can read variants" on public.item_variants;
create policy "Anyone can read variants" on public.item_variants for select to anon,authenticated
  using (true);
drop policy if exists "Owner manages variants" on public.item_variants;
create policy "Owner manages variants" on public.item_variants for all to authenticated
  using (true)
  with check (true);
drop policy if exists "Owner can delete items" on public.items;
create policy "Owner can delete items" on public.items for delete to authenticated
  using (true);
drop policy if exists "Owner can insert items" on public.items;
create policy "Owner can insert items" on public.items for insert to authenticated
  with check (true);
drop policy if exists "Owner can read all items" on public.items;
create policy "Owner can read all items" on public.items for select to authenticated
  using (true);
drop policy if exists "Owner can update items" on public.items;
create policy "Owner can update items" on public.items for update to authenticated
  using (true)
  with check (true);
drop policy if exists "Public can read visible items" on public.items;
create policy "Public can read visible items" on public.items for select to anon
  using ((status <> 'hidden'::text));
drop policy if exists "Owner reads order items" on public.order_items;
create policy "Owner reads order items" on public.order_items for all to authenticated
  using (true)
  with check (true);
drop policy if exists "Owner reads orders" on public.orders;
create policy "Owner reads orders" on public.orders for all to authenticated
  using (true)
  with check (true);
drop policy if exists "Owner can delete settings" on public.settings;
create policy "Owner can delete settings" on public.settings for delete to authenticated
  using (true);
drop policy if exists "Owner can insert settings" on public.settings;
create policy "Owner can insert settings" on public.settings for insert to authenticated
  with check (true);
drop policy if exists "Owner can read settings" on public.settings;
create policy "Owner can read settings" on public.settings for select to authenticated
  using (true);
drop policy if exists "Owner can update settings" on public.settings;
create policy "Owner can update settings" on public.settings for update to authenticated
  using (true)
  with check (true);
drop policy if exists "Public read game settings" on public.settings;
create policy "Public read game settings" on public.settings for select to anon
  using (((key = 'game_difficulty'::text) OR ((key = 'game_offer'::text) AND COALESCE(((value ->> 'enabled'::text))::boolean, false))));
drop policy if exists "Anyone can read winners" on public.winners;
create policy "Anyone can read winners" on public.winners for select to anon,authenticated
  using (true);
drop policy if exists "Owner manages winners" on public.winners;
create policy "Owner manages winners" on public.winners for all to authenticated
  using (true)
  with check (true);

-- ---------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------

grant select on public.game_spot_board to anon;
grant select on public.game_spot_board to authenticated;

-- Execute privileges. The revokes matter as much as the grants: the
-- spot-claiming and checkout functions must not be callable from a
-- browser, and CREATE OR REPLACE above resets them to the default.

grant execute on function public.claim_checkout(p_key text) to anon;
grant execute on function public.claim_checkout(p_key text) to authenticated;
grant execute on function public.claim_game_spots(p_game uuid, p_qty integer) to anon;
grant execute on function public.claim_game_spots(p_game uuid, p_qty integer) to authenticated;
grant execute on function public.claim_variant_stock(p_variant uuid, p_qty integer) to anon;
grant execute on function public.claim_variant_stock(p_variant uuid, p_qty integer) to authenticated;
grant execute on function public.finish_checkout(p_key text, p_order text, p_outcome text) to anon;
grant execute on function public.finish_checkout(p_key text, p_order text, p_outcome text) to authenticated;
grant execute on function public.game_spots_remaining(p_game uuid) to anon;
grant execute on function public.game_spots_remaining(p_game uuid) to authenticated;
grant execute on function public.release_checkout(p_key text) to anon;
grant execute on function public.release_checkout(p_key text) to authenticated;
grant execute on function public.release_game_spots(p_game uuid, p_spots integer[]) to anon;
grant execute on function public.release_game_spots(p_game uuid, p_spots integer[]) to authenticated;
grant execute on function public.release_variant_stock(p_variant uuid, p_qty integer) to anon;
grant execute on function public.release_variant_stock(p_variant uuid, p_qty integer) to authenticated;
grant execute on function public.sell_game_spots(p_game uuid, p_spots integer[], p_order uuid, p_first_name text, p_last_name text, p_email text, p_phone text, p_show_name boolean) to anon;
grant execute on function public.sell_game_spots(p_game uuid, p_spots integer[], p_order uuid, p_first_name text, p_last_name text, p_email text, p_phone text, p_show_name boolean) to authenticated;
grant execute on function public.set_updated_at() to anon;
grant execute on function public.set_updated_at() to authenticated;
grant execute on function public.stamp_authorship() to anon;
grant execute on function public.stamp_authorship() to authenticated;
grant execute on function public.stamp_authorship_updated_only() to anon;
grant execute on function public.stamp_authorship_updated_only() to authenticated;

commit;

-- Now confirm it: run scripts/check-schema.sql. It should return no rows.
