-- What of the migration chain has not landed on this database.
--
-- Paste into the Supabase SQL editor. It reports PROBLEMS ONLY, so a
-- clean database returns no rows — which in the SQL editor reads as
-- "Success. No rows returned". That is the answer you want.
--
-- Why this exists alongside scripts/check-schema.sql: that one compares
-- COLUMNS against what the application declares, which is most of the
-- surface but not all of it. A migration can fail to land without
-- costing a single column — a missing view, a missing constraint, a
-- trigger that stopped stamping updated_at, a view that lost the
-- security_invoker setting that lets the public read counts. None of
-- those show up as a column, and the last one is silent in the worst
-- way: row level security answers an unauthorised read with an empty
-- set rather than an error, so the page renders a zero and nothing logs.
--
-- Run both. This one for objects, check-schema.sql for columns.
--
-- If anything comes back MISSING, the fix is one script and it does not
-- matter how far behind the database is:
--
--     supabase/repair/baseline.sql
--
-- It only ever adds — no drop table, no drop column, no data touched —
-- so it is safe from any starting state. A STRAY COLUMN is the one thing
-- it will not fix, deliberately: removing things is a decision a person
-- should make, not a repair script.

with expected(kind, name) as (values
  ('table','admin_activity'), ('table','checkout_attempts'), ('table','game_events'),
  ('table','game_spots'), ('table','games'), ('table','inquiries'),
  ('table','item_variants'), ('table','items'), ('table','order_items'),
  ('table','orders'), ('table','settings'), ('table','winners'),
  ('view','game_scoreboard'),
  ('function','claim_checkout'), ('function','claim_game_spots'),
  ('function','claim_variant_stock'), ('function','finish_checkout'),
  ('function','game_spots_remaining'), ('function','release_checkout'),
  ('function','release_game_spots'), ('function','release_variant_stock'),
  ('function','sell_game_spots'), ('function','set_updated_at'),
  ('function','stamp_authorship'), ('function','stamp_authorship_updated_only'),
  ('trigger','campaigns_stamp_authorship'), ('trigger','items_set_updated_at'),
  ('trigger','items_stamp_authorship'), ('trigger','settings_set_updated_at'),
  ('trigger','settings_stamp_authorship'),
  ('constraint','games_status_valid'), ('constraint','game_spots_status_valid'),
  ('constraint','items_shipping_override_sane'),
  ('constraint','items_firearms_have_no_online_price'),
  ('constraint','order_items_line_type_valid'),
  ('constraint','winners_one_per_game_idx')
),
actual(kind, name) as (
  select 'table', relname from pg_class c join pg_namespace n on n.oid=c.relnamespace
    where n.nspname='public' and relkind='r'
  union all
  select 'view', relname from pg_class c join pg_namespace n on n.oid=c.relnamespace
    where n.nspname='public' and relkind='v'
  union all
  select 'function', proname from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and prokind='f'
  union all
  select 'trigger', tgname from pg_trigger where not tgisinternal
  union all
  select 'constraint', conname from pg_constraint c join pg_namespace n on n.oid=c.connamespace
    where n.nspname='public'
  union all
  select 'constraint', indexname from pg_indexes where schemaname='public'
)
select 'MISSING' as problem, e.kind, e.name
from expected e
where not exists (select 1 from actual a where a.kind=e.kind and a.name=e.name)

union all

-- The board view and its name column were removed deliberately. A
-- reappearance means somebody re-ran an old migration over the top.
select 'STRAY VIEW (should have been dropped)', 'view', 'game_spot_board'
where to_regclass('public.game_spot_board') is not null

union all

select 'STRAY COLUMN', 'game_spots', 'show_name'
where exists (select 1 from information_schema.columns
              where table_schema='public' and table_name='game_spots'
                and column_name='show_name')

union all

select 'STRAY COLUMN', 'items', 'surface'
where exists (select 1 from information_schema.columns
              where table_schema='public' and table_name='items' and column_name='surface')

union all

select 'VIEW NOT ANON-READABLE', 'view', c.relname
from pg_class c join pg_namespace n on n.oid=c.relnamespace
where n.nspname='public' and c.relkind='v'
  and c.relname = 'game_scoreboard'
  and not has_table_privilege('anon', c.oid, 'select')

union all

select 'VIEW RUNS AS INVOKER (must be false)', 'view', c.relname
from pg_class c join pg_namespace n on n.oid=c.relnamespace
where n.nspname='public' and c.relkind='v'
  and c.relname = 'game_scoreboard'
  and coalesce(array_to_string(c.reloptions,','),'') not like '%security_invoker=false%'

order by 1, 2, 3;
