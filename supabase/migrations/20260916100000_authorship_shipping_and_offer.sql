-- Authorship and an activity log, tiered shipping, Texas sales tax, and
-- switching off a discount nobody chose.

-- ---------------------------------------------------------------------
-- 1. The seeded discount
-- ---------------------------------------------------------------------
-- 20260812100000 seeded game_offer with enabled=true and the code
-- MOLON10. That was mine, not the client's, and it has been live. It goes
-- off until they pick their own.
--
-- Conditional on the seeded values still being in place: if the client
-- has since edited any of it, that is their choice and this leaves it
-- alone. The exclusions note stays because a discount with no stated
-- limits is a discount on everything, and the admin re-fills it anyway.
update public.settings
set value = jsonb_build_object(
      'enabled', false,
      'code', '',
      'value', '',
      'expires', null,
      'note', coalesce(value ->> 'note', '')
    )
where key = 'game_offer'
  and value ->> 'code' = 'MOLON10'
  and value ->> 'value' = '10% off one accessory';

-- ---------------------------------------------------------------------
-- 2. Who changed what
-- ---------------------------------------------------------------------
-- The id is the record; the name is a snapshot taken at write time. Both,
-- because a name can change afterwards and an audit line should say who
-- it was *then*, while the id is what still resolves to a real account.
--
-- Names, never email addresses. Nothing here is ever rendered publicly.
alter table public.items
  add column if not exists created_by uuid references auth.users(id) on delete set null,
  add column if not exists created_by_name text,
  add column if not exists updated_by uuid references auth.users(id) on delete set null,
  add column if not exists updated_by_name text;

alter table public.campaigns
  add column if not exists created_by uuid references auth.users(id) on delete set null,
  add column if not exists created_by_name text,
  add column if not exists updated_by uuid references auth.users(id) on delete set null,
  add column if not exists updated_by_name text;

alter table public.settings
  add column if not exists updated_by uuid references auth.users(id) on delete set null,
  add column if not exists updated_by_name text;

/*
 * Stamps the ids from the session, so they cannot be forged by anything
 * that reaches PostgREST — not the browser, and not a signed-in user
 * hand-crafting a PATCH. The application sets the display names; only the
 * ids are enforced here, because the database cannot know them.
 *
 * The coalesce matters: checkout writes to items with the service role,
 * which has no auth.uid(). Without it, every purchase would erase the
 * authorship of the item it sold.
 */
create or replace function public.stamp_authorship()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'INSERT' then
    new.created_by := coalesce(auth.uid(), new.created_by);
    new.updated_by := coalesce(auth.uid(), new.updated_by);
  else
    -- Who created a record never changes.
    new.created_by := old.created_by;
    new.created_by_name := old.created_by_name;
    new.updated_by := coalesce(auth.uid(), old.updated_by);
    if auth.uid() is null then
      new.updated_by_name := old.updated_by_name;
    end if;
  end if;
  return new;
end;
$$;

/* settings has no created_by, so it gets its own smaller version. */
create or replace function public.stamp_authorship_updated_only()
returns trigger
language plpgsql
as $$
begin
  new.updated_by := coalesce(auth.uid(), new.updated_by);
  if auth.uid() is null and tg_op = 'UPDATE' then
    new.updated_by := old.updated_by;
    new.updated_by_name := old.updated_by_name;
  end if;
  return new;
end;
$$;

drop trigger if exists items_stamp_authorship on public.items;
create trigger items_stamp_authorship
  before insert or update on public.items
  for each row execute function public.stamp_authorship();

drop trigger if exists campaigns_stamp_authorship on public.campaigns;
create trigger campaigns_stamp_authorship
  before insert or update on public.campaigns
  for each row execute function public.stamp_authorship();

drop trigger if exists settings_stamp_authorship on public.settings;
create trigger settings_stamp_authorship
  before insert or update on public.settings
  for each row execute function public.stamp_authorship_updated_only();

-- ---------------------------------------------------------------------
-- 3. The activity log
-- ---------------------------------------------------------------------
-- Append-only in practice: the owner reads it, nothing edits it. `before`
-- is the point of the whole table — knowing a price changed is far less
-- useful than knowing what it changed from.
create table if not exists public.admin_activity (
  id            uuid primary key default gen_random_uuid(),
  at            timestamptz not null default now(),
  actor_id      uuid references auth.users(id) on delete set null,
  actor_name    text not null,
  action        text not null,
  entity        text not null,
  entity_id     uuid,
  /* Name or title as it was, so a deleted record is still identifiable. */
  entity_label  text,
  field         text,
  before_value  jsonb,
  after_value   jsonb
);

create index if not exists admin_activity_at_idx on public.admin_activity (at desc);
create index if not exists admin_activity_entity_idx
  on public.admin_activity (entity, entity_id);

alter table public.admin_activity enable row level security;

-- Owner only, in both directions. No anon policy of any kind: this
-- records what the shop does internally and is nobody else's business.
drop policy if exists "Owner reads activity" on public.admin_activity;
create policy "Owner reads activity"
  on public.admin_activity for select
  to authenticated
  using (true);

drop policy if exists "Owner writes activity" on public.admin_activity;
create policy "Owner writes activity"
  on public.admin_activity for insert
  to authenticated
  with check (true);

-- ---------------------------------------------------------------------
-- 4. Shipping tiers
-- ---------------------------------------------------------------------
-- Fulfilment says whether a thing ships at all; the tier says what it
-- costs to ship. A t-shirt and a gun safe both "ship" and are not the
-- same postage, so the two are separate fields rather than one overloaded
-- one. Collected items ignore this entirely.
alter table public.items
  add column if not exists shipping_tier text not null default 'standard';

alter table public.items
  drop constraint if exists items_shipping_tier_valid;
alter table public.items
  add constraint items_shipping_tier_valid
  check (shipping_tier in ('standard', 'oversize'));

-- ---------------------------------------------------------------------
-- 5. Tax and shipping rates
-- ---------------------------------------------------------------------
-- Shipping amounts are placeholders and the admin says so on screen. The
-- tax rate is not a placeholder: 8.25% is the El Paso combined rate the
-- client gave us.
insert into public.settings (key, value)
values (
  'commerce',
  jsonb_build_object(
    'tax_rate_bps', 825,
    'shipping_standard_cents', 1000,
    'shipping_oversize_cents', 2000
  )
)
-- Existing values win, so this fills gaps rather than resetting anything
-- already chosen.
on conflict (key) do update
  set value = excluded.value || public.settings.value;

-- ...except the tax rate, which is set deliberately.
update public.settings
set value = jsonb_set(value, '{tax_rate_bps}', '825'::jsonb)
where key = 'commerce';

-- The single flat rate this replaces, removed so nothing reads a stale
-- number that no longer means anything.
update public.settings
set value = value - 'shipping_flat_cents'
where key = 'commerce';
