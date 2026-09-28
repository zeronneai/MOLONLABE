-- DROP CHECK 2 of 2: which orders could have been meant for another drop?
--
-- Reads only; changes nothing. Run after file 1.
--
-- Until each drop had its own page, every button on the site (the home
-- page, every card on the drops list, "Get your guide") went to one
-- address that showed the newest drop still open. So whenever two drops
-- were open, a buyer who clicked the older one was shown the newer one,
-- and could only buy the newer one. The database recorded exactly what
-- they paid for; it cannot know what they meant.
--
-- This lists every ONLINE guide order and the other drops that were open
-- at the moment it was paid:
--
--   OK      no other drop was open. This drop was the only one on sale,
--           so it is what the buyer meant.
--   REVIEW  another drop was open at the time. The buyer may have meant
--           it. Contact them to ask (the email and phone are here).
--
-- In-store sales are not listed: staff chose the drop on its own admin
-- page. When a drop sold out is taken as the time its last guide sold;
-- a drop drawn later was closed from that moment.

with closed as (
  select g.id, g.title, g.created_at,
         case when g.status in ('full', 'drawn') then max(s.sold_at) end as closed_at
  from public.games g
  left join public.game_spots s on s.game_id = g.id and s.status = 'sold'
  group by g.id
),
guide_orders as (
  select o.id, o.order_number, o.created_at, o.first_name, o.last_name, o.email, o.phone,
         o.game_id, o.status, o.voided_at,
         (select array_to_string(oi.spot_numbers, ', ') from public.order_items oi
           where oi.order_id = o.id and oi.line_type = 'game_spot' limit 1) as guides
  from public.orders o
  where o.game_id is not null and o.source = 'online'
)
select
  case when count(c.id) = 0 then 'OK' else 'REVIEW' end as verdict,
  go.order_number,
  to_char(go.created_at at time zone 'America/Denver', 'YYYY-MM-DD HH24:MI') as paid_at_el_paso,
  g.title as drop_bought,
  i.name as featured_piece,
  go.guides,
  go.first_name || ' ' || go.last_name as buyer,
  go.email,
  go.phone,
  coalesce(string_agg(c.title, '; ' order by c.created_at), '') as other_drops_open_then,
  case when go.voided_at is not null or go.status in ('cancelled', 'refunded')
       then 'not standing (' || go.status || ')' else '' end as note
from guide_orders go
join public.games g on g.id = go.game_id
left join public.items i on i.id = g.item_id
left join closed c
  on c.id <> go.game_id
 and c.created_at <= go.created_at
 and (c.closed_at is null or c.closed_at > go.created_at)
group by go.id, go.order_number, go.created_at, g.title, i.name, go.guides,
         go.first_name, go.last_name, go.email, go.phone, go.status, go.voided_at
order by verdict desc, go.created_at;
