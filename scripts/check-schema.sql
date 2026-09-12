-- Schema drift check — pure SQL. No clone, no tooling, nothing to install.
--
-- Paste the whole thing into the Supabase SQL editor and run it. It
-- compares this database against the schema the application expects and
-- returns ONE ROW PER PROBLEM — nothing at all if the database is right.
--
-- It is shaped this way on purpose. Dumping information_schema and
-- reading it by eye does not work: the listing runs to hundreds of rows,
-- editors cap results (100 is a common default), and the cap lands in the
-- middle of a table without saying so — which reads exactly like missing
-- columns. This returns only discrepancies, so a cap cannot turn it into
-- a wrong answer.
--
-- It reads nothing and writes nothing. Safe on production, any time.
--
-- GENERATED FILE — do not edit. Regenerate after changing
-- lib/database.types.ts:
--   node scripts/gen-check-schema.mjs > scripts/check-schema.sql
--
-- Expecting 154 columns across 12 tables.

with expected(table_name, column_name) as (values
  ('admin_activity','action'),
  ('admin_activity','actor_id'),
  ('admin_activity','actor_name'),
  ('admin_activity','after_value'),
  ('admin_activity','at'),
  ('admin_activity','before_value'),
  ('admin_activity','entity'),
  ('admin_activity','entity_id'),
  ('admin_activity','entity_label'),
  ('admin_activity','field'),
  ('admin_activity','id'),
  ('game_events','created_at'),
  ('game_events','id'),
  ('game_events','kind'),
  ('game_events','mode'),
  ('game_scoreboard','frozen'),
  ('game_scoreboard','game_id'),
  ('game_scoreboard','sold'),
  ('game_scoreboard','sold_now'),
  ('game_scoreboard','total_spots'),
  ('game_spots','email'),
  ('game_spots','first_name'),
  ('game_spots','game_id'),
  ('game_spots','held_at'),
  ('game_spots','id'),
  ('game_spots','last_name'),
  ('game_spots','order_id'),
  ('game_spots','phone'),
  ('game_spots','sold_at'),
  ('game_spots','spot_number'),
  ('game_spots','status'),
  ('games','created_at'),
  ('games','created_by'),
  ('games','created_by_name'),
  ('games','description'),
  ('games','id'),
  ('games','item_id'),
  ('games','spot_price_cents'),
  ('games','status'),
  ('games','title'),
  ('games','total_spots'),
  ('games','updated_by'),
  ('games','updated_by_name'),
  ('games','winner_note'),
  ('inquiries','created_at'),
  ('inquiries','email'),
  ('inquiries','id'),
  ('inquiries','item_id'),
  ('inquiries','message'),
  ('inquiries','name'),
  ('inquiries','phone'),
  ('inquiries','status'),
  ('inquiries','type'),
  ('item_variants','created_at'),
  ('item_variants','id'),
  ('item_variants','item_id'),
  ('item_variants','size'),
  ('item_variants','sort_order'),
  ('item_variants','stock'),
  ('items','brand'),
  ('items','category'),
  ('items','created_at'),
  ('items','created_by'),
  ('items','created_by_name'),
  ('items','fulfillment_type'),
  ('items','has_variants'),
  ('items','id'),
  ('items','images'),
  ('items','is_featured'),
  ('items','long_desc'),
  ('items','name'),
  ('items','price_cents'),
  ('items','price_display'),
  ('items','shipping_override_cents'),
  ('items','shipping_tier'),
  ('items','short_desc'),
  ('items','slug'),
  ('items','sort_order'),
  ('items','specs'),
  ('items','status'),
  ('items','updated_at'),
  ('items','updated_by'),
  ('items','updated_by_name'),
  ('items','video_url'),
  ('order_items','fulfillment_type'),
  ('order_items','game_id'),
  ('order_items','id'),
  ('order_items','item_id'),
  ('order_items','line_total_cents'),
  ('order_items','line_type'),
  ('order_items','name'),
  ('order_items','order_id'),
  ('order_items','pack_id'),
  ('order_items','quantity'),
  ('order_items','size'),
  ('order_items','spot_numbers'),
  ('order_items','unit_price_cents'),
  ('order_items','variant_id'),
  ('orders','card_brand'),
  ('orders','card_last4'),
  ('orders','confirmation_expires_at'),
  ('orders','confirmation_sent_at'),
  ('orders','confirmation_token'),
  ('orders','created_at'),
  ('orders','disclaimer_accepted_at'),
  ('orders','disclaimer_text'),
  ('orders','disclaimer_version'),
  ('orders','email'),
  ('orders','first_name'),
  ('orders','game_id'),
  ('orders','game_terms_accepted_at'),
  ('orders','game_terms_text'),
  ('orders','gateway'),
  ('orders','gateway_auth_code'),
  ('orders','gateway_response_code'),
  ('orders','gateway_transaction_id'),
  ('orders','has_pickup'),
  ('orders','has_shipment'),
  ('orders','id'),
  ('orders','idempotency_key'),
  ('orders','last_name'),
  ('orders','order_number'),
  ('orders','phone'),
  ('orders','refund_policy_text'),
  ('orders','ship_city'),
  ('orders','ship_line1'),
  ('orders','ship_line2'),
  ('orders','ship_name'),
  ('orders','ship_postal_code'),
  ('orders','ship_region'),
  ('orders','shipping_cents'),
  ('orders','status'),
  ('orders','subtotal_cents'),
  ('orders','tax_cents'),
  ('orders','total_cents'),
  ('settings','key'),
  ('settings','updated_at'),
  ('settings','updated_by'),
  ('settings','updated_by_name'),
  ('settings','value'),
  ('winners','display_name'),
  ('winners','drawn_at'),
  ('winners','drawn_early'),
  ('winners','entry_total'),
  ('winners','game_id'),
  ('winners','id'),
  ('winners','note'),
  ('winners','photo_url'),
  ('winners','pool'),
  ('winners','seed'),
  ('winners','spot_id'),
  ('winners','ticket'),
  ('winners','ticket_index'),
  ('winners','unsold_spots')
),
actual as (
  select table_name, column_name
  from information_schema.columns
  where table_schema = 'public'
),
present as (
  select table_name from information_schema.tables where table_schema = 'public'
  union
  select table_name from information_schema.views where table_schema = 'public'
)
select 'MISSING TABLE' as problem,
       e.table_name,
       '(the whole table)' as column_name,
       'A migration that creates it has not been applied. Run that migration in full.' as meaning
from (select distinct table_name from expected) e
where e.table_name not in (select table_name from present)

union all

select 'MISSING COLUMN', e.table_name, e.column_name,
       'Every query touching this fails at runtime.'
from expected e
where e.table_name in (select table_name from present)
  and not exists (
    select 1 from actual a
    where a.table_name = e.table_name and a.column_name = e.column_name
  )

union all

-- A column the application does not declare. Two very different things
-- arrive here and the wording used to call both harmless:
--
--   a column a migration SUPERSEDED — left behind on purpose, because
--   the repair script only ever adds. Nothing to do.
--
--   a column somebody ADDED BY HAND that was never in the schema. That
--   one is worth removing, and "no action needed" is the wrong advice:
--   a stored column nothing reads is a lever somebody will eventually
--   pull, expecting the site to change.
--
-- This cannot tell them apart — it only knows the app does not declare
-- the column — so it says so and leaves the judgement where it belongs.
select 'EXTRA COLUMN', a.table_name, a.column_name,
       'The app does not declare this. Fine if a migration superseded it; remove it if it was added by hand.'
from actual a
where a.table_name in (select distinct table_name from expected)
  and not exists (
    select 1 from expected e
    where e.table_name = a.table_name and e.column_name = a.column_name
  )

order by 1, 2, 3;
