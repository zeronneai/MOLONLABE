-- Apparel, and optional size variants.
--
-- The shape of the problem: a rifle is one unit and the status column
-- already models that correctly. A shirt is eight in medium and three in
-- large, which the status column cannot express at all. Rather than
-- reshape every item to carry stock it does not need, variants are an
-- optional layer — an item either has them or behaves exactly as it did
-- before.

-- The toggle, stored rather than derived. `has_variants` true with no
-- rows yet is a real editing state (the owner ticked the box and has not
-- typed the sizes), and deriving the flag from a count would make that
-- state impossible to hold.
alter table public.items
  add column if not exists has_variants boolean not null default false;

create table if not exists public.item_variants (
  id          uuid primary key default gen_random_uuid(),
  item_id     uuid not null references public.items(id) on delete cascade,
  -- Free text on purpose. S/M/L/XL covers shirts and nothing else; a
  -- one-size hat, a 34 waist belt and a 9.5 boot all have to fit here.
  size        text not null,
  stock       integer not null default 0,
  sort_order  integer not null default 0,
  created_at  timestamptz not null default now()
);

alter table public.item_variants
  drop constraint if exists item_variants_stock_not_negative;
alter table public.item_variants
  add constraint item_variants_stock_not_negative check (stock >= 0);

-- One row per size per item. Case-insensitive so "Medium" and "medium"
-- cannot both exist and split the stock between them.
create unique index if not exists item_variants_item_size_idx
  on public.item_variants (item_id, lower(size));

create index if not exists item_variants_item_idx
  on public.item_variants (item_id, sort_order);

alter table public.item_variants enable row level security;

-- Sizes and their stock are public: the shop page needs to grey out the
-- large that has gone. Only the owner writes them.
drop policy if exists "Anyone can read variants" on public.item_variants;
create policy "Anyone can read variants"
  on public.item_variants for select
  to anon, authenticated
  using (true);

drop policy if exists "Owner manages variants" on public.item_variants;
create policy "Owner manages variants"
  on public.item_variants for all
  to authenticated
  using (true)
  with check (true);

-- Which size was bought. Snapshotted as text alongside the id, because a
-- variant row can be deleted when the shop stops carrying that size and
-- the order still has to say "Medium" a year later.
alter table public.order_items
  add column if not exists variant_id uuid references public.item_variants(id) on delete set null,
  add column if not exists size text;

-- Claiming stock.
--
-- The decrement and the "is there enough" check have to be one statement.
-- Read-then-write would let two simultaneous checkouts both see 1 in
-- stock and both sell it. The WHERE clause carries the check, so the
-- second one updates no rows and gets false back.
create or replace function public.claim_variant_stock(
  p_variant uuid,
  p_qty     int
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
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
$$;

-- Putting it back when a charge fails. No upper bound check: this only
-- ever undoes a claim this server made moments earlier.
create or replace function public.release_variant_stock(
  p_variant uuid,
  p_qty     int
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_qty is null or p_qty <= 0 then
    return;
  end if;
  update public.item_variants
     set stock = stock + p_qty
   where id = p_variant;
end;
$$;

-- Server-side only. The anon key must never be able to move stock.
revoke execute on function public.claim_variant_stock(uuid, int) from anon, authenticated;
revoke execute on function public.release_variant_stock(uuid, int) from anon, authenticated;
