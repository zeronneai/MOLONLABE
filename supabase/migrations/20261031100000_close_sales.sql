-- Close a drop's sales before it sells out.
--
-- Why. The rules said a drop runs until every guide sells, and the
-- database refused a winner for any drop that had not (20260929100000).
-- On 30 October the shop wanted to draw BOOM STICK for Halloween at 44 of
-- 66 guides. The site would not allow it, so the drawing was run outside
-- the site and the manager recorded the 22 unsold guides as an in-store
-- sale to himself to stop the drop selling. That kept buyers safe but
-- left a fake sale on the books and a winner the site never recorded.
-- The client has decided the shop may end a drop early; this is the
-- honest version of what was improvised.
--
-- What it does.
--
--   1. games.sales_closed_at / sales_closed_by_name: when and by whom.
--   2. close_drop_sales(p_game): owner or manager. Only an open drop with
--      at least one guide sold. Sets the drop to 'full' (nothing can be
--      bought in a full drop) and stamps the close.
--   3. A closed drop can never be bought into again by any path: a
--      trigger refuses moving one of its guides from open to held, which
--      is the first step of every online purchase and every in-store sale.
--   4. refuse_early_draw: a winner may be recorded for a drop that sold
--      out, or for one whose sales were closed. Still refused for a drop
--      that is simply short. The winner row records how many were unsold.
--   5. void_in_store_sale: voiding a sale no longer reopens a closed drop.
--      The voided guides go back to open, and stay unbuyable.
--
-- Changes no existing data. Safe to run twice.

begin;

-- 1. ------------------------------------------------------------------

alter table public.games
  add column if not exists sales_closed_at timestamptz,
  add column if not exists sales_closed_by_name text;

-- 2. ------------------------------------------------------------------

create or replace function public.close_drop_sales(p_game uuid)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_game public.games%rowtype;
  v_sold integer;
begin
  if not public.is_staff() then
    raise exception 'Only staff can close a drop.' using errcode = '42501';
  end if;

  select * into v_game from public.games where id = p_game for update;
  if not found then
    raise exception 'There is no such drop.' using errcode = 'P0002';
  end if;
  if v_game.sales_closed_at is not null then
    raise exception 'Sales for this drop are already closed.' using errcode = 'P0001';
  end if;
  if v_game.status <> 'open' then
    raise exception 'This drop is not open, so there are no sales to close.' using errcode = 'P0001';
  end if;

  select count(*) into v_sold
    from public.game_spots
   where game_id = p_game and status = 'sold';
  if v_sold < 1 then
    raise exception 'No guides have sold yet, so there is nobody to draw from. Close sales once at least one guide has sold.'
      using errcode = 'P0001';
  end if;

  update public.games
     set status = 'full',
         sales_closed_at = now(),
         sales_closed_by_name = coalesce(public.staff_name(), 'Staff')
   where id = p_game;

  return v_sold;
end;
$$;

revoke execute on function public.close_drop_sales(uuid) from public, anon, authenticated;
grant execute on function public.close_drop_sales(uuid) to authenticated;

-- 3. ------------------------------------------------------------------

create or replace function public.refuse_closed_drop_hold()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.status = 'open' and new.status <> 'open'
     and exists (select 1 from public.games g
                  where g.id = new.game_id and g.sales_closed_at is not null) then
    raise exception 'Sales for this drop are closed.' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

revoke execute on function public.refuse_closed_drop_hold() from public, anon, authenticated;

drop trigger if exists game_spots_refuse_closed_drop on public.game_spots;
create trigger game_spots_refuse_closed_drop
  before update of status on public.game_spots
  for each row execute function public.refuse_closed_drop_hold();

-- 4. ------------------------------------------------------------------

create or replace function public.refuse_early_draw()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_total  integer;
  v_closed timestamptz;
  v_sold   integer;
begin
  select total_spots, sales_closed_at into v_total, v_closed
    from public.games where id = new.game_id;
  if v_total is null then
    raise exception 'There is no drop with id %.', new.game_id
      using errcode = 'P0001';
  end if;
  select count(*) into v_sold
    from public.game_spots
   where game_id = new.game_id and status = 'sold';
  if v_sold < 1 then
    raise exception 'This drop has no guides sold, so there is nobody to draw from.'
      using errcode = 'P0001';
  end if;
  if v_sold < v_total and v_closed is null then
    raise exception 'This drop has % of % guides sold. Sell every guide, or close sales, before drawing.',
      v_sold, v_total
      using errcode = 'P0001';
  end if;
  new.drawn_early := v_sold < v_total;
  new.unsold_spots := greatest(v_total - v_sold, 0);
  return new;
end;
$$;

revoke all on function public.refuse_early_draw() from public;

-- 5. ------------------------------------------------------------------

create or replace function public.void_in_store_sale(p_order uuid)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order public.orders%rowtype;
  v_n     integer;
begin
  if not public.is_owner() then
    raise exception 'Only the owner can void an in-store sale.' using errcode = '42501';
  end if;

  select * into v_order from public.orders where id = p_order for update;
  if not found then
    raise exception 'There is no such sale.' using errcode = 'P0002';
  end if;
  if v_order.source <> 'in_store' then
    raise exception 'Only an in-store sale can be voided here. An online order is refunded through the payment processor.'
      using errcode = 'P0001';
  end if;
  if v_order.voided_at is not null then
    raise exception 'This sale was already voided.' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.winners where game_id = v_order.game_id) then
    raise exception 'This drop has been drawn, so its sales can no longer be voided.' using errcode = 'P0001';
  end if;

  update public.game_spots
     set status = 'open', order_id = null, first_name = null, last_name = null,
         email = null, phone = null, held_at = null, sold_at = null
   where order_id = p_order and status = 'sold';
  get diagnostics v_n = row_count;

  update public.orders
     set status = 'cancelled', voided_at = now(),
         voided_by_name = coalesce(public.staff_name(), 'Owner')
   where id = p_order;

  -- A drop that was full has guides to sell again, unless its sales were
  -- closed: a closed drop stays closed whatever is voided.
  update public.games g
     set status = 'open'
   where g.id = v_order.game_id and g.status = 'full'
     and g.sales_closed_at is null
     and exists (select 1 from public.game_spots s where s.game_id = g.id and s.status <> 'sold');

  return v_n;
end;
$$;
revoke execute on function public.void_in_store_sale(uuid) from public, anon, authenticated;
grant execute on function public.void_in_store_sale(uuid) to authenticated;

commit;
