-- DROP CHECK 1 of 2: is every guide recorded against one drop?
--
-- Reads only; changes nothing. Paste into the Supabase SQL editor and
-- run. Every row should say PASS. A FAIL names the orders involved.
--
-- What it proves: for every guide sale (online or in store), the order,
-- its guide line, and the guides it holds all name the SAME drop, and
-- the guide numbers on the receipt are exactly the guides it holds. That
-- is "recorded against the drop the buyer paid on". Whether that was the
-- drop they MEANT is file 2.

with live as (
  -- Sales that stand: not voided, not cancelled or refunded.
  select o.* from public.orders o
  where o.voided_at is null and o.status in ('paid', 'fulfilled')
),
lines as (
  select oi.order_id, oi.game_id, oi.spot_numbers
  from public.order_items oi where oi.line_type = 'game_spot'
),
held as (
  -- Every guide the order holds, in any drop.
  select s.order_id, array_agg(s.spot_number order by s.spot_number) as numbers
  from public.game_spots s where s.order_id is not null
  group by s.order_id
),
sorted_lines as (
  select l.order_id, l.game_id,
         (select array_agg(n order by n) from unnest(l.spot_numbers) n) as numbers
  from lines l
)
select 1 as sort, 'every guide line is for the same drop as its order' as check,
       case when count(*) = 0 then 'PASS' else 'FAIL' end as result,
       coalesce(string_agg(o.order_number, ', '), 'all match') as detail
from live o join lines l on l.order_id = o.id
where l.game_id is distinct from o.game_id
union all
select 2, 'every guide an order holds is in that order''s drop',
       case when count(*) = 0 then 'PASS' else 'FAIL' end,
       coalesce(string_agg(distinct o.order_number, ', '), 'all match')
from live o join public.game_spots s on s.order_id = o.id
where s.game_id is distinct from o.game_id
union all
select 3, 'every order with a drop has a guide line, and the reverse',
       case when count(*) = 0 then 'PASS' else 'FAIL' end,
       coalesce(string_agg(o.order_number, ', '), 'all match')
from live o
where (o.game_id is not null) <> exists (select 1 from lines l where l.order_id = o.id)
union all
select 4, 'the guide numbers on each receipt are exactly the guides it holds',
       case when count(*) = 0 then 'PASS' else 'FAIL' end,
       coalesce(string_agg(o.order_number || ' (receipt ' || coalesce(array_to_string(sl.numbers, ','), 'none')
         || ', holds ' || coalesce(array_to_string(h.numbers, ','), 'none') || ')', '; '), 'all match')
from live o
join sorted_lines sl on sl.order_id = o.id
left join held h on h.order_id = o.id
where sl.numbers is distinct from h.numbers
union all
select 5, 'every guide held as sold belongs to a standing order',
       case when count(*) = 0 then 'PASS' else 'FAIL' end,
       count(*) || ' guides'
from public.game_spots s
where s.status = 'sold' and s.order_id is not null
  and not exists (select 1 from live o where o.id = s.order_id)
union all
select 6, 'drop: ' || g.title, 'INFO',
       count(distinct o.id) filter (where o.source = 'online') || ' online orders, '
         || count(distinct o.id) filter (where o.source = 'in_store') || ' in-store sales, '
         || count(s.id) || ' guides sold of ' || g.total_spots
from public.games g
left join public.game_spots s on s.game_id = g.id and s.status = 'sold'
left join live o on o.id = s.order_id
group by g.id, g.title, g.total_spots
order by 1, 2;
