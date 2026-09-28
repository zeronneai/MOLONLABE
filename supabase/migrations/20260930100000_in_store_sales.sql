-- In-store sales of guides.
--
-- The shop sells guides for a drop at the counter, paid at the register.
-- They have to come off what the website can sell, or the drop oversells,
-- and they cannot be a count deducted from a total: an in-store buyer is
-- in the drawing like anybody else (rules clause 12: every guide sold is
-- in the drawing), so the roster, the wheel and the guides sold have to
-- include them by name. So an in-store sale is recorded as a real sale:
-- an order, marked in store, holding real guide numbers.
--
-- WHAT CHANGES
--
-- orders gains:
--   source           'online' (every existing row) or 'in_store'
--   recorded_by,     who entered an in-store sale, from the staff table
--   recorded_by_name
--   voided_at,       set when the owner voids an in-store sale
--   voided_by_name
--
-- Four columns that only an online checkout can fill (email, and the
-- website's disclaimer and refund acceptance) become nullable, with a
-- check that keeps them required on every online order. An in-store
-- buyer may not give an email, and did not tick the website's boxes;
-- what they agreed to at the counter is stored in game_terms_text, and a
-- second check requires it on every in-store order.
--
-- Two functions do the work, both in one transaction each:
--
--   record_in_store_sale  staff (owner or manager). Takes the lowest
--                         available guide numbers with the same row locks
--                         online checkout uses (FOR UPDATE SKIP LOCKED),
--                         so a counter sale and an online purchase can
--                         never be given the same guide. All or nothing.
--   void_in_store_sale    owner only, and refused once the drop has a
--                         winner. Returns the guides to available.
--
-- No existing row is changed except that every order gets source
-- 'online', which is what each of them is. Column names are unchanged.

begin;

-- ------------------------------------------------------------- columns

alter table public.orders add column if not exists source text not null default 'online';
alter table public.orders add column if not exists recorded_by uuid references auth.users(id) on delete set null;
alter table public.orders add column if not exists recorded_by_name text;
alter table public.orders add column if not exists voided_at timestamptz;
alter table public.orders add column if not exists voided_by_name text;

alter table public.orders drop constraint if exists orders_source_valid;
alter table public.orders add constraint orders_source_valid
  check (source in ('online', 'in_store'));

alter table public.orders alter column email drop not null;
alter table public.orders alter column disclaimer_accepted_at drop not null;
alter table public.orders alter column disclaimer_text drop not null;
alter table public.orders alter column refund_policy_text drop not null;

-- Online orders keep every field they always had to have.
alter table public.orders drop constraint if exists orders_online_complete;
alter table public.orders add constraint orders_online_complete check (
  source <> 'online' or (
    email is not null and disclaimer_accepted_at is not null
    and disclaimer_text is not null and refund_policy_text is not null
  )
);

-- An in-store sale always carries what the buyer agreed to, when, and
-- who recorded it.
alter table public.orders drop constraint if exists orders_in_store_recorded;
alter table public.orders add constraint orders_in_store_recorded check (
  source <> 'in_store' or (
    game_terms_text is not null and game_terms_accepted_at is not null
    and recorded_by_name is not null and game_id is not null
  )
);

comment on column public.orders.source is
  'online: bought on the website. in_store: sold at the counter, paid at the register, recorded by staff.';
comment on column public.orders.recorded_by_name is
  'Who recorded an in-store sale, from the staff table.';

-- ------------------------------------------------------- record a sale

create or replace function public.record_in_store_sale(
  p_game         uuid,
  p_qty          integer,
  p_first_name   text,
  p_last_name    text,
  p_email        text,
  p_phone        text,
  p_ack          text,
  p_order_number text,
  p_token        text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_game     public.games%rowtype;
  v_name     text := public.staff_name();
  v_open     integer;
  v_held     integer;
  v_numbers  integer[];
  v_ids      uuid[];
  v_order    uuid;
  v_email    text := nullif(btrim(coalesce(p_email, '')), '');
  v_phone    text := nullif(btrim(coalesce(p_phone, '')), '');
begin
  if not public.is_staff() then
    raise exception 'Only staff can record an in-store sale.' using errcode = '42501';
  end if;
  if p_qty is null or p_qty < 1 then
    raise exception 'Enter how many guides were sold.' using errcode = '22023';
  end if;
  if btrim(coalesce(p_first_name, '')) = '' or btrim(coalesce(p_last_name, '')) = '' then
    raise exception 'Enter the buyer''s first and last name.' using errcode = '22023';
  end if;
  if v_phone is null then
    raise exception 'Enter the buyer''s phone number, so the shop can reach them if they win.' using errcode = '22023';
  end if;
  if btrim(coalesce(p_ack, '')) = '' then
    raise exception 'The buyer has to have been shown the rules and agreed.' using errcode = '22023';
  end if;

  select * into v_game from public.games where id = p_game;
  if not found then
    raise exception 'There is no such drop.' using errcode = 'P0002';
  end if;
  if v_game.status <> 'open' then
    raise exception 'This drop is %, so no more guides can be sold.',
      case v_game.status when 'full' then 'sold out' when 'drawn' then 'already drawn' else v_game.status end
      using errcode = 'P0001';
  end if;

  -- Abandoned checkouts go back first, exactly as claim_game_spots does.
  update public.game_spots
     set status = 'open', held_at = null
   where game_id = p_game and status = 'held'
     and held_at < now() - interval '15 minutes';

  -- The lowest available numbers, locked. SKIP LOCKED is the same
  -- protection online checkout has: a row another transaction is taking
  -- right now is passed over, never shared.
  with picked as (
    select id, spot_number
      from public.game_spots
     where game_id = p_game and status = 'open'
     order by spot_number
     limit p_qty
       for update skip locked
  )
  select array_agg(spot_number order by spot_number), array_agg(id)
    into v_numbers, v_ids
    from picked;

  if coalesce(array_length(v_numbers, 1), 0) < p_qty then
    select count(*) filter (where status = 'open'),
           count(*) filter (where status = 'held')
      into v_open, v_held
      from public.game_spots where game_id = p_game;
    raise exception '% guide% requested, but only % % available%. Nothing was recorded.',
      p_qty, case when p_qty = 1 then ' was' else 's were' end,
      v_open, case when v_open = 1 then 'is' else 'are' end,
      case when v_held > 0 then format(' (%s more in an online checkout right now)', v_held) else '' end
      using errcode = 'P0001';
  end if;

  insert into public.orders (
    order_number, status, source, email, first_name, last_name, phone,
    subtotal_cents, tax_cents, shipping_cents, total_cents,
    has_shipment, has_pickup, game_id, gateway, confirmation_token,
    game_terms_accepted_at, game_terms_text, recorded_by, recorded_by_name
  ) values (
    p_order_number, 'paid', 'in_store', v_email, btrim(p_first_name), btrim(p_last_name), v_phone,
    p_qty * v_game.spot_price_cents, 0, 0, p_qty * v_game.spot_price_cents,
    false, false, p_game, 'in_store', p_token,
    now(), btrim(p_ack), auth.uid(), coalesce(v_name, 'Staff')
  )
  returning id into v_order;

  insert into public.order_items (
    order_id, line_type, game_id, spot_numbers, name,
    unit_price_cents, quantity, fulfillment_type, line_total_cents
  ) values (
    v_order, 'game_spot', p_game, v_numbers,
    v_game.title || ': ' || case when p_qty = 1 then 'guide number ' else 'guide numbers ' end
      || array_to_string(v_numbers, ', '),
    v_game.spot_price_cents, p_qty, 'none', p_qty * v_game.spot_price_cents
  );

  update public.game_spots
     set status = 'sold', sold_at = now(), held_at = null, order_id = v_order,
         first_name = btrim(p_first_name), last_name = btrim(p_last_name),
         email = v_email, phone = v_phone
   where id = any(v_ids);

  update public.games g
     set status = 'full'
   where g.id = p_game and g.status = 'open'
     and not exists (select 1 from public.game_spots where game_id = p_game and status <> 'sold');

  return jsonb_build_object('order_id', v_order, 'numbers', to_jsonb(v_numbers));
end;
$$;

revoke execute on function public.record_in_store_sale(uuid, integer, text, text, text, text, text, text, text)
  from public, anon, authenticated;
grant execute on function public.record_in_store_sale(uuid, integer, text, text, text, text, text, text, text)
  to authenticated;

-- --------------------------------------------------------- void a sale

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

  -- A drop that was full has guides to sell again.
  update public.games g
     set status = 'open'
   where g.id = v_order.game_id and g.status = 'full'
     and exists (select 1 from public.game_spots s where s.game_id = g.id and s.status <> 'sold');

  return v_n;
end;
$$;

revoke execute on function public.void_in_store_sale(uuid) from public, anon, authenticated;
grant execute on function public.void_in_store_sale(uuid) to authenticated;

commit;
