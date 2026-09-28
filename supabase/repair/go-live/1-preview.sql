-- GO-LIVE 1 of 3: PREVIEW. Reads only; changes nothing. Safe to run any time.
--
-- Shows exactly what 2-cleanup.sql will do, before it does it.
--
-- WHICH ORDERS ARE SANDBOX ORDERS
--
-- Nothing on an order records which Authorize.net it went through, and
-- the site has only ever been on sandbox. So every order placed BEFORE the
-- production deployment went live is a sandbox order, and every order at
-- or after it is real. That moment is the cutoff.
--
-- 1. Put the cutoff on the line marked CUTOFF below: the time the
--    production deployment became Ready in Vercel, with its timezone,
--    e.g. '2026-09-27 14:05:00-06'. If you run the cleanup BEFORE
--    switching payments to production, use the current time instead.
-- 2. Run this whole file in the Supabase SQL editor. It needs migration
--    20260930100000_in_store_sales.sql applied first (docs/go-live.md).
-- 3. Note the number on the "orders to delete" row. 2-cleanup.sql asks
--    for it and refuses to run if it has changed.
--
-- Nothing here touches items, stock, settings, or any drop's title,
-- description, featured piece, number of guides, price or guide text.

with params as (
  select timestamptz 'PUT-THE-CUTOFF-HERE' as cutoff          -- CUTOFF
),
sandbox as (
  -- Online orders only. An in-store sale is a real sale at the counter,
  -- whenever it was recorded, and is never touched.
  select o.id from public.orders o, params p
  where o.created_at < p.cutoff and o.source = 'online'
),
drawn as (
  select distinct game_id from public.winners
)
select 1 as sort, 'orders to delete' as what,
       'placed before the cutoff (sandbox)' as detail,
       count(*)::text as n
from sandbox
union all
select 2, 'orders kept', 'placed at or after the cutoff, or sold in store (real)',
       count(*)::text
from public.orders o, params p where o.created_at >= p.cutoff or o.source = 'in_store'
union all
select 3, 'guides to return', g.title || ' (' || g.status || ')', count(*)::text
from public.game_spots s join public.games g on g.id = s.game_id
where s.order_id in (select id from sandbox)
group by g.title, g.status
union all
select 4, 'guides to return', g.title || ': sold with no order at all', count(*)::text
from public.game_spots s join public.games g on g.id = s.game_id
where s.status = 'sold' and s.order_id is null
  and s.game_id not in (select game_id from drawn)
group by g.title
union all
select 5, 'guides to return', g.title || ': held by an abandoned checkout', count(*)::text
from public.game_spots s join public.games g on g.id = s.game_id
where s.status = 'held' and s.order_id is null
  and (s.held_at is null or s.held_at < now() - interval '15 minutes')
  and s.game_id not in (select game_id from drawn)
group by g.title
union all
select 6, 'STOP: already drawn with test guides in it', g.title,
       count(*)::text
from public.game_spots s join public.games g on g.id = s.game_id
where s.order_id in (select id from sandbox) and s.game_id in (select game_id from drawn)
group by g.title
union all
select 7, 'stock the test orders took (NOT restored)',
       i.name || coalesce(' / ' || v.size, ''), sum(oi.quantity)::text
from public.order_items oi
join public.items i on i.id = oi.item_id
left join public.item_variants v on v.id = oi.variant_id
where oi.order_id in (select id from sandbox)
group by i.name, v.size
union all
select 8, 'drop, left as it is', g.title,
       g.total_spots || ' guides at $' || to_char(g.spot_price_cents / 100.0, 'FM999990.00')
         || ', status ' || g.status
from public.games g
order by 1, 3;
