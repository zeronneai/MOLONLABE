-- Checkout: orders, line items, purchasable inventory, and the entry rate.
--
-- Three things the schema could not express before:
--   1. A price you can do arithmetic on. `items.price_display` is free
--      text holding "Call for price"; it can be shown but never summed.
--   2. Whether an item ships or is collected at the counter. This is a
--      legal distinction, not a UX one, so it is set per item by the
--      owner and never inferred from category.
--   3. What a completed purchase is, and what it granted.

-- Purchasable price, in cents. Integer because money in floating point is
-- a bug waiting for a rounding error. NULL means the item is not for sale
-- online — `price_display` still shows "Call for price" and the item
-- cannot enter a cart. That is the default, so nothing becomes buyable by
-- accident when this migration runs.
alter table public.items
  add column if not exists price_cents integer;

alter table public.items
  drop constraint if exists items_price_cents_positive;
alter table public.items
  add constraint items_price_cents_positive
  check (price_cents is null or price_cents > 0);

-- How the buyer receives it.
--   ship   — ammunition, optics, holsters, accessories, apparel
--   pickup — firearms, collected in person, where the background check
--            and any waiting period actually happen
--
-- Defaults to 'pickup' deliberately. If the owner forgets to set it, the
-- failure mode is an accessory that has to be collected in store, which
-- is an inconvenience. The opposite default would make a firearm
-- shippable by omission.
alter table public.items
  add column if not exists fulfillment_type text not null default 'pickup';

alter table public.items
  drop constraint if exists items_fulfillment_type_valid;
alter table public.items
  add constraint items_fulfillment_type_valid
  check (fulfillment_type in ('ship', 'pickup'));

-- Entries granted per whole dollar of merchandise. Per campaign, so a
-- promotion can run hotter than the one before it without rewriting code.
alter table public.campaigns
  add column if not exists entries_per_dollar integer not null default 1;

alter table public.campaigns
  drop constraint if exists campaigns_entries_per_dollar_sane;
alter table public.campaigns
  add constraint campaigns_entries_per_dollar_sane
  check (entries_per_dollar >= 0 and entries_per_dollar <= 1000);

-- A completed purchase. Written only by the server after the gateway has
-- approved the transaction; there is no path from the browser to this
-- table.
create table if not exists public.orders (
  id                   uuid primary key default gen_random_uuid(),
  order_number         text not null unique,
  status               text not null default 'paid',

  -- Buyer. Kept on the order rather than joined to entrants, because an
  -- order is a record of a moment and must not change when a person later
  -- edits their details.
  email                text not null,
  first_name           text not null,
  last_name            text not null,
  phone                text,

  -- Money, all in cents, all snapshots. Recomputing a total from current
  -- prices is how order history quietly becomes fiction.
  subtotal_cents       integer not null,
  tax_cents            integer not null default 0,
  shipping_cents       integer not null default 0,
  total_cents          integer not null,

  -- Fulfilment. An order can need both: an optic that ships and a pistol
  -- collected at the counter.
  has_shipment         boolean not null default false,
  has_pickup           boolean not null default false,
  ship_name            text,
  ship_line1           text,
  ship_line2           text,
  ship_city            text,
  ship_region          text,
  ship_postal_code     text,

  -- The legal record. The timestamp is the point of all of this, and the
  -- text is what makes the timestamp mean anything: without knowing what
  -- was on screen, "they accepted at 14:02" proves nothing. Both are NOT
  -- NULL, so an order cannot exist without an acceptance.
  disclaimer_accepted_at timestamptz not null,
  disclaimer_text        text not null,
  disclaimer_version     text,
  refund_policy_text     text not null,

  -- Sweepstakes. The rate is stored as it was at purchase, so an owner
  -- raising the rate next month never rewrites what this order earned.
  campaign_id          uuid references public.campaigns(id) on delete set null,
  entries_per_dollar   integer,
  entries_awarded      integer not null default 0,

  -- Gateway. No card number, no expiry, no CVV — those never reach this
  -- server, which is the entire point of Accept.js tokenization. Brand and
  -- last four come back from the gateway and are safe to keep.
  gateway              text not null default 'authorize.net',
  gateway_transaction_id text unique,
  gateway_auth_code    text,
  gateway_response_code text,
  card_brand           text,
  card_last4           text,

  -- Lets the buyer see their own confirmation without an account and
  -- without orders being readable by the public key. The page looks up on
  -- (order_number, token); guessing an order number gets you nothing.
  confirmation_token   text not null,

  confirmation_sent_at timestamptz,
  created_at           timestamptz not null default now()
);

alter table public.orders
  drop constraint if exists orders_status_valid;
alter table public.orders
  add constraint orders_status_valid
  check (status in ('paid', 'fulfilled', 'cancelled', 'refunded'));

create index if not exists orders_created_idx on public.orders (created_at desc);
create index if not exists orders_email_idx on public.orders (lower(email));

-- Line items. Every buyer-facing value is snapshotted: the name, the unit
-- price and the fulfilment type at the moment of sale. Re-reading them
-- from `items` later would make a receipt change after the fact.
create table if not exists public.order_items (
  id                uuid primary key default gen_random_uuid(),
  order_id          uuid not null references public.orders(id) on delete cascade,
  line_type         text not null,
  -- Restricted, not cascaded: an item that has been sold is part of the
  -- record and must not be deletable out from under it. The admin's
  -- delete already counts references and explains the refusal.
  item_id           uuid references public.items(id) on delete restrict,
  pack_id           text,
  name              text not null,
  unit_price_cents  integer not null,
  quantity          integer not null,
  fulfillment_type  text not null,
  line_total_cents  integer not null
);

alter table public.order_items
  drop constraint if exists order_items_line_type_valid;
alter table public.order_items
  add constraint order_items_line_type_valid
  check (line_type in ('inventory', 'entry_pack'));

alter table public.order_items
  drop constraint if exists order_items_quantity_positive;
alter table public.order_items
  add constraint order_items_quantity_positive
  check (quantity > 0);

create index if not exists order_items_order_idx on public.order_items (order_id);

alter table public.orders enable row level security;
alter table public.order_items enable row level security;

-- Orders carry names, emails, postal addresses and purchase history.
-- There is no anon policy of any kind here, deliberately: the public key
-- must not be able to read a single row. Buyers see their confirmation
-- from the server render that follows their own checkout, not from a
-- query. Writes come from the service role, which bypasses RLS.
drop policy if exists "Owner reads orders" on public.orders;
create policy "Owner reads orders"
  on public.orders for all
  to authenticated
  using (true)
  with check (true);

drop policy if exists "Owner reads order items" on public.order_items;
create policy "Owner reads order items"
  on public.order_items for all
  to authenticated
  using (true)
  with check (true);

-- Adding purchase entries atomically.
--
-- Two orders from the same address at the same moment would otherwise
-- race: both read entry_count = 3, both write 8, and four entries
-- evaporate. ON CONFLICT makes the read and the write one statement, so
-- the second order adds to whatever the first one left.
--
-- entry_method records how somebody got in. Someone who entered free and
-- then bought is genuinely both, and flattening that to 'purchase' would
-- misrepresent the free method's usage in exactly the records that prove
-- it works.
create or replace function public.add_purchase_entries(
  p_campaign   uuid,
  p_email      text,
  p_first_name text,
  p_last_name  text,
  p_phone      text,
  p_entries    int
)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  final_count int;
begin
  if p_entries is null or p_entries <= 0 then
    return 0;
  end if;

  insert into public.entrants (
    campaign_id, first_name, last_name, email, phone,
    entry_count, entry_method, source
  )
  values (
    p_campaign, p_first_name, p_last_name, p_email, p_phone,
    p_entries, 'purchase', 'online'
  )
  on conflict (campaign_id, lower(email)) do update
    set entry_count  = public.entrants.entry_count + excluded.entry_count,
        entry_method = case
          when public.entrants.entry_method = 'purchase' then 'purchase'
          else 'mixed'
        end,
        phone = coalesce(public.entrants.phone, excluded.phone)
  returning entry_count into final_count;

  return final_count;
end;
$$;

-- Callable only by the server. The anon key must never be able to mint
-- entries; the free method goes through its own validated action.
revoke execute on function public.add_purchase_entries(uuid, text, text, text, text, int) from anon, authenticated;
