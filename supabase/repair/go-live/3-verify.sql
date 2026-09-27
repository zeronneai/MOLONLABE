-- GO-LIVE 3 of 3: VERIFY. Reads only; changes nothing. Run after the
-- cleanup, and again any time. Every row should say PASS; the last rows
-- list each drop so you can compare them with the preview.

with drawn as (select distinct game_id from public.winners),
counts as (
  select g.id, g.title, g.status, g.total_spots, g.spot_price_cents,
         count(s.*) filter (where s.status = 'sold') as sold,
         count(s.*) filter (where s.status = 'held') as held,
         count(s.*) filter (where s.status = 'open') as open,
         count(s.*) as rows
  from public.games g left join public.game_spots s on s.game_id = g.id
  group by g.id
)
select 1 as sort, 'no guide points at an order that does not exist' as check,
       case when count(*) = 0 then 'PASS' else 'FAIL' end as result,
       count(*) || ' guides' as detail
from public.game_spots s
where s.order_id is not null and not exists (select 1 from public.orders o where o.id = s.order_id)
union all
select 2, 'every sold guide in an undrawn drop belongs to an order',
       case when count(*) = 0 then 'PASS' else 'FAIL' end, count(*) || ' guides'
from public.game_spots s
where s.status = 'sold' and s.order_id is null and s.game_id not in (select game_id from drawn)
union all
select 3, 'no guide is held by a checkout abandoned over 15 minutes ago',
       case when count(*) = 0 then 'PASS' else 'FAIL' end, count(*) || ' guides'
from public.game_spots s
where s.status = 'held' and (s.held_at is null or s.held_at < now() - interval '15 minutes')
  and s.game_id not in (select game_id from drawn)
union all
select 4, 'no returned guide still carries a buyer''s details',
       case when count(*) = 0 then 'PASS' else 'FAIL' end, count(*) || ' guides'
from public.game_spots s
where s.status = 'open'
  and (s.order_id is not null or s.email is not null or s.first_name is not null or s.sold_at is not null)
union all
select 5, 'every drop has exactly its number of guides',
       case when count(*) = 0 then 'PASS' else 'FAIL' end,
       coalesce(string_agg(title || ' has ' || rows || ' of ' || total_spots, '; '), 'all match')
from counts where rows <> total_spots
union all
select 6, 'no undrawn drop is marked full with guides still to sell',
       case when count(*) = 0 then 'PASS' else 'FAIL' end,
       coalesce(string_agg(title, '; '), 'none')
from counts where status = 'full' and sold < total_spots and id not in (select game_id from drawn)
union all
select 7, 'orders remaining (before going live this should be 0)',
       'INFO',
       count(*) || coalesce(', earliest ' || min(created_at)::text, '')
from public.orders
union all
select 8, 'drop: ' || title,
       'INFO',
       status || ', ' || total_spots || ' guides at $' || to_char(spot_price_cents / 100.0, 'FM999990.00')
         || ': ' || sold || ' sold, ' || held || ' held, ' || open || ' available'
from counts
order by 1, 2;
