-- Three surfaces, per-item postage, and the early-draw record.
--
-- 1. SURFACE is derived, not stored. See lib/surfaces.ts for the rule and
--    the reasoning; nothing is added here for it. The one schema change
--    it needs is the constraint below, which stops a firearm carrying an
--    online price at all — because a price is what makes a thing
--    cartable, and a firearm must never be.
--
-- 2. Per-item postage, overriding the global tier.
--
-- 3. Whether a draw happened before the game sold out, and by how much.

-- ---------------------------------------------------------------------
-- Per-item postage
-- ---------------------------------------------------------------------
-- The two global tiers stay and remain the default. This is an override
-- for the item that does not fit either — a rifle case that costs more to
-- post than "oversize" assumes, a patch that costs almost nothing.
--
-- Null means "use the tier", which is different from zero: zero is free
-- postage, deliberately chosen, and the owner has to be able to say that.
alter table public.items
  add column if not exists shipping_override_cents integer;

alter table public.items drop constraint if exists items_shipping_override_sane;
alter table public.items
  add constraint items_shipping_override_sane
  check (
    shipping_override_cents is null
    or (shipping_override_cents >= 0 and shipping_override_cents <= 100000)
  );

comment on column public.items.shipping_override_cents is
  'Postage for this item, overriding shipping_tier. NULL = use the tier. 0 = free postage, which is a real choice and not the same as NULL.';

-- ---------------------------------------------------------------------
-- A firearm cannot carry an online price
-- ---------------------------------------------------------------------
-- A firearm is a game prize or an enquiry; it is not added to a cart.
-- The surface an item appears on is derived from its category, so a
-- priced firearm would not reach the shop anyway — but `price_cents` is
-- what the cart reads to decide whether a thing can be bought, and
-- leaving it settable means one future query away from a firearm with a
-- Buy button. Refused at the database instead.
--
-- Existing rows are cleared first, because four firearms carry prices
-- from when they were sold by cart. The price_display text is left alone;
-- it is not a cart price and the shop may still want to show it.
update public.items
set price_cents = null
where price_cents is not null
  and category in ('pistol', 'revolver', 'rifle', 'shotgun', 'pcc');

alter table public.items drop constraint if exists items_firearms_have_no_online_price;
alter table public.items
  add constraint items_firearms_have_no_online_price
  check (
    category not in ('pistol', 'revolver', 'rifle', 'shotgun', 'pcc')
    or price_cents is null
  );

-- ---------------------------------------------------------------------
-- Early draw
-- ---------------------------------------------------------------------
-- The terms say a game runs until every spot sells. The owner can draw
-- before that, and sometimes will have to — but it goes against what
-- buyers agreed to, so it is recorded on the winner rather than left to
-- memory. If a buyer ever asks why the draw happened at 12 of 100, the
-- answer is in the row.
alter table public.winners
  add column if not exists drawn_early   boolean not null default false,
  add column if not exists unsold_spots  integer;

comment on column public.winners.drawn_early is
  'True when the draw ran before every spot sold. The terms buyers accepted say the game runs until the last spot goes.';
comment on column public.winners.unsold_spots is
  'How many spots were still unsold at the moment of the draw. Zero or null on a full game.';
