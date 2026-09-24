-- Roles: owner and manager.
--
-- WHAT CHANGES
--
-- Until now, being signed in was the permission. Every policy said
-- `to authenticated using (true)`, so any account that could sign in
-- could do anything, including accounts nobody meant to create: if email
-- signups are enabled on the Supabase project, anyone with the public key
-- could register and become a full admin.
--
-- From here, being signed in grants nothing. Access comes from a row in
-- public.staff, and that row says which of two roles the account has:
--
--   owner    everything, exactly as before
--   manager  runs the shop day to day, and cannot: permanently delete
--            anything, change tax or shipping, change the discount offer,
--            read the activity log, or manage accounts
--
-- An account with no staff row can sign in and can do nothing: every
-- admin table answers it with an empty set, and every write is refused.
--
-- WHY THE DATABASE, NOT JUST THE SCREENS
--
-- The admin hides and disables controls, and the server actions check
-- the role before writing. Neither is a permission. A manager holds a
-- real session token and can call the database directly with it, so the
-- rule has to be one the database enforces. These policies are that rule.
--
-- WHAT THE DATABASE CANNOT ENFORCE
--
-- Bulk export. A manager may read orders and the spot ledger, because he
-- needs them to do the job; a person who can read a list can copy it.
-- The CSV export is refused by the server for managers. That is the
-- honest limit and it is written down in docs/roles.md.
--
-- ACCOUNTS
--
-- public.staff has NO insert, update or delete policy for anyone. Roles
-- are granted in the Supabase SQL editor and nowhere else, so no session,
-- owner or manager, can grant a role or raise its own. See docs/roles.md
-- for the exact statements.
--
-- EXISTING ACCOUNTS BECOME OWNERS
--
-- Every account that exists when this runs is made an owner, which is
-- what keeps today's access exactly as it is. The consequence to know:
-- create the manager's account AFTER applying this, not before, or it
-- will be made an owner too. docs/roles.md has the query to check.

-- ONE TRANSACTION. Either every policy is replaced or none is; a half
-- applied version of this file could leave the old "any signed-in
-- account" policies next to the new ones, and permissive policies are
-- OR'ed, so the old ones would win.
begin;

-- ---------------------------------------------------------------------
-- 1. Who is staff, and as what
-- ---------------------------------------------------------------------
create table if not exists public.staff (
  user_id      uuid primary key references auth.users(id) on delete cascade,
  role         text not null check (role in ('owner', 'manager')),
  -- The name every log line and authorship stamp uses. Held here rather
  -- than in auth user metadata because a signed-in user can rewrite their
  -- own metadata from the browser, and an audit trail whose names the
  -- audited can edit is not an audit trail.
  display_name text not null check (length(btrim(display_name)) > 0),
  created_at   timestamptz not null default now()
);

comment on table public.staff is
  'Admin access. No row, no access. Written from the SQL editor only.';

alter table public.staff enable row level security;

-- Each person can see their own row, so the admin can tell them what they
-- are. The owner can see everybody's, so he knows who else has access.
drop policy if exists "Staff read own row" on public.staff;
create policy "Staff read own row" on public.staff for select
  to authenticated
  using (user_id = auth.uid());

-- Deliberately no insert, update or delete policy. See the header.

-- ---------------------------------------------------------------------
-- 2. The questions every policy asks
-- ---------------------------------------------------------------------
-- SECURITY DEFINER so they can read public.staff without going through
-- its own RLS, which would otherwise recurse. They only ever answer about
-- the caller, so there is nothing to leak.
create or replace function public.staff_role()
returns text
language sql stable security definer
set search_path = ''
as $$
  select s.role from public.staff s where s.user_id = auth.uid()
$$;

create or replace function public.staff_name()
returns text
language sql stable security definer
set search_path = ''
as $$
  select s.display_name from public.staff s where s.user_id = auth.uid()
$$;

create or replace function public.is_staff()
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (select 1 from public.staff s where s.user_id = auth.uid())
$$;

create or replace function public.is_owner()
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.staff s where s.user_id = auth.uid() and s.role = 'owner'
  )
$$;

-- The owner may see the whole team. Defined after is_owner exists.
drop policy if exists "Owner reads all staff" on public.staff;
create policy "Owner reads all staff" on public.staff for select
  to authenticated
  using ((select public.is_owner()));

-- Default deny, then grant exactly who needs them. Never anon. See
-- docs/function-grants.md.
--
-- `service_role` as well as `authenticated`, and it is not optional: the
-- authorship triggers below call staff_name(), and a function called
-- INSIDE a trigger is checked against the role doing the write. Checkout
-- marks items sold with the service role. Without this grant every sale
-- of a single-unit item would fail at the moment the card has already
-- been charged.
revoke execute on function public.staff_role() from public, anon, authenticated;
revoke execute on function public.staff_name() from public, anon, authenticated;
revoke execute on function public.is_staff()   from public, anon, authenticated;
revoke execute on function public.is_owner()   from public, anon, authenticated;
grant  execute on function public.staff_role() to authenticated, service_role;
grant  execute on function public.staff_name() to authenticated, service_role;
grant  execute on function public.is_staff()   to authenticated, service_role;
grant  execute on function public.is_owner()   to authenticated, service_role;

-- ---------------------------------------------------------------------
-- 3. Everyone who exists today is an owner
-- ---------------------------------------------------------------------
-- The name comes from whatever the account already carries, and falls
-- back to something that is obviously a placeholder rather than to the
-- email address, which never appears in the admin.
--
-- ONLY WHILE THE TABLE IS EMPTY. This runs once, on the day roles
-- arrive. If the file is ever applied again, it must not quietly make
-- an owner of every account created since, which would include a
-- manager whose login exists and whose role has not been given yet.
insert into public.staff (user_id, role, display_name)
select u.id,
       'owner',
       coalesce(
         nullif(btrim(u.raw_user_meta_data ->> 'full_name'), ''),
         nullif(btrim(u.raw_user_meta_data ->> 'name'), ''),
         nullif(btrim(u.raw_user_meta_data ->> 'display_name'), ''),
         'Owner (set a name)'
       )
from auth.users u
where not exists (select 1 from public.staff)
on conflict (user_id) do nothing;

-- ---------------------------------------------------------------------
-- 4. Names come from the staff table, not from whoever is typing
-- ---------------------------------------------------------------------
-- Replaces the two authorship triggers. The ids were already stamped from
-- the session; now the names are too, so neither can be forged by
-- anything that reaches the database. `create or replace` keeps the
-- existing execute grants (revoked from public in 20260925100000).
--
-- Writes with no session behind them — checkout marking an item sold,
-- with the service role — keep the previous names, as before.
create or replace function public.stamp_authorship()
returns trigger
language plpgsql
as $$
declare
  v_name text := public.staff_name();
begin
  if tg_op = 'INSERT' then
    new.created_by := coalesce(auth.uid(), new.created_by);
    new.updated_by := coalesce(auth.uid(), new.updated_by);
    if v_name is not null then
      new.created_by_name := v_name;
      new.updated_by_name := v_name;
    end if;
  else
    new.created_by := old.created_by;
    new.created_by_name := old.created_by_name;
    new.updated_by := coalesce(auth.uid(), old.updated_by);
    if auth.uid() is null then
      new.updated_by_name := old.updated_by_name;
    elsif v_name is not null then
      new.updated_by_name := v_name;
    end if;
  end if;
  return new;
end;
$$;

create or replace function public.stamp_authorship_updated_only()
returns trigger
language plpgsql
as $$
declare
  v_name text := public.staff_name();
begin
  new.updated_by := coalesce(auth.uid(), new.updated_by);
  if auth.uid() is null and tg_op = 'UPDATE' then
    new.updated_by := old.updated_by;
    new.updated_by_name := old.updated_by_name;
  elsif v_name is not null then
    new.updated_by_name := v_name;
  end if;
  return new;
end;
$$;

-- ---------------------------------------------------------------------
-- 5. The activity log cannot be signed by anyone else
-- ---------------------------------------------------------------------
-- The application writes each line, but the database decides whose it
-- is. A manager posting a line straight to the API with somebody else's
-- name in it gets his own name on it instead.
--
-- Append-only was already true — there has never been an update or
-- delete policy on this table — and stays true.
create or replace function public.stamp_activity_actor()
returns trigger
language plpgsql
as $$
begin
  if auth.uid() is not null then
    new.actor_id := auth.uid();
    new.actor_name := coalesce(public.staff_name(), 'Unknown account');
  end if;
  new.at := now();
  return new;
end;
$$;

revoke execute on function public.stamp_activity_actor() from public, anon, authenticated;

drop trigger if exists admin_activity_stamp_actor on public.admin_activity;
create trigger admin_activity_stamp_actor
  before insert on public.admin_activity
  for each row execute function public.stamp_activity_actor();

create index if not exists admin_activity_actor_idx
  on public.admin_activity (actor_id, at desc);

-- ---------------------------------------------------------------------
-- 6. Creating a game, in one piece
-- ---------------------------------------------------------------------
-- A game and its spots used to be written in separate requests, with a
-- delete of the game as the clean-up if laying out the spots failed half
-- way. A manager may not delete games, so that clean-up would have been
-- refused and left a game on sale with holes in its board. Doing both in
-- one transaction removes the clean-up and the failure it cleaned up.
create or replace function public.create_game(
  p_title text,
  p_description text,
  p_winner_note text,
  p_item_id uuid,
  p_guide_why text,
  p_guide_care text,
  p_guide_pairs text,
  p_total_spots integer,
  p_spot_price_cents integer
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  if not public.is_staff() then
    raise exception 'Only staff can create a game.' using errcode = '42501';
  end if;
  if p_total_spots is null or p_total_spots < 1 or p_total_spots > 10000 then
    raise exception 'Spots must be between 1 and 10,000.' using errcode = '22023';
  end if;

  insert into public.games (
    title, description, winner_note, item_id,
    guide_why, guide_care, guide_pairs,
    total_spots, spot_price_cents, status
  ) values (
    p_title, p_description, p_winner_note, p_item_id,
    p_guide_why, p_guide_care, p_guide_pairs,
    p_total_spots, p_spot_price_cents, 'open'
  )
  returning id into v_id;

  insert into public.game_spots (game_id, spot_number)
  select v_id, n from generate_series(1, p_total_spots) as n;

  return v_id;
end;
$$;

revoke execute on function public.create_game(text, text, text, uuid, text, text, text, integer, integer)
  from public, anon, authenticated;
grant execute on function public.create_game(text, text, text, uuid, text, text, text, integer, integer)
  to authenticated;

-- ---------------------------------------------------------------------
-- 7. Every admin policy, rewritten
-- ---------------------------------------------------------------------
-- Old policies are dropped by name and replaced. The public ones — anon
-- reads of games, variants, winners, visible items and the game settings,
-- and anyone recording a game event — are not touched.

-- items: staff read, add and edit; only the owner deletes.
drop policy if exists "Owner can read all items" on public.items;
drop policy if exists "Owner can insert items"   on public.items;
drop policy if exists "Owner can update items"   on public.items;
drop policy if exists "Owner can delete items"   on public.items;
drop policy if exists "Staff read all items" on public.items;
create policy "Staff read all items" on public.items for select
  to authenticated using ((select public.is_staff()));
drop policy if exists "Staff add items" on public.items;
create policy "Staff add items" on public.items for insert
  to authenticated with check ((select public.is_staff()));
drop policy if exists "Staff edit items" on public.items;
create policy "Staff edit items" on public.items for update
  to authenticated using ((select public.is_staff())) with check ((select public.is_staff()));
drop policy if exists "Owner deletes items" on public.items;
create policy "Owner deletes items" on public.items for delete
  to authenticated using ((select public.is_owner()));

-- item_variants: staff manage sizes and stock, INCLUDING removing a size.
-- That is the one permanent delete a manager can make, deliberately:
-- editing sizes means dropping one the shop no longer carries, and every
-- order keeps the size it sold as text, so no history depends on the row.
drop policy if exists "Owner manages variants" on public.item_variants;
drop policy if exists "Staff manage variants" on public.item_variants;
create policy "Staff manage variants" on public.item_variants for all
  to authenticated using ((select public.is_staff())) with check ((select public.is_staff()));

-- games: staff read, create and edit (the draw edits); only the owner deletes.
drop policy if exists "Owner can read all games" on public.games;
drop policy if exists "Owner can insert games"   on public.games;
drop policy if exists "Owner can update games"   on public.games;
drop policy if exists "Owner can delete games"   on public.games;
drop policy if exists "Staff read all games" on public.games;
create policy "Staff read all games" on public.games for select
  to authenticated using ((select public.is_staff()));
drop policy if exists "Staff add games" on public.games;
create policy "Staff add games" on public.games for insert
  to authenticated with check ((select public.is_staff()));
drop policy if exists "Staff edit games" on public.games;
create policy "Staff edit games" on public.games for update
  to authenticated using ((select public.is_staff())) with check ((select public.is_staff()));
drop policy if exists "Owner deletes games" on public.games;
create policy "Owner deletes games" on public.games for delete
  to authenticated using ((select public.is_owner()));

-- game_spots: staff read (the ledger, the draw, the winner's details).
-- Only the owner writes directly; a manager's spots are laid out by
-- create_game, and sold by checkout with the service role.
drop policy if exists "Owner manages spots" on public.game_spots;
drop policy if exists "Staff read spots" on public.game_spots;
create policy "Staff read spots" on public.game_spots for select
  to authenticated using ((select public.is_staff()));
create policy "Owner manages spots" on public.game_spots for all
  to authenticated using ((select public.is_owner())) with check ((select public.is_owner()));

-- winners: staff may record a draw; only the owner changes or removes one.
drop policy if exists "Owner manages winners" on public.winners;
drop policy if exists "Staff record winners" on public.winners;
create policy "Staff record winners" on public.winners for insert
  to authenticated with check ((select public.is_staff()));
create policy "Owner manages winners" on public.winners for all
  to authenticated using ((select public.is_owner())) with check ((select public.is_owner()));

-- orders and their lines: staff read; only the owner writes.
drop policy if exists "Owner reads orders" on public.orders;
drop policy if exists "Staff read orders" on public.orders;
create policy "Staff read orders" on public.orders for select
  to authenticated using ((select public.is_staff()));
drop policy if exists "Owner manages orders" on public.orders;
create policy "Owner manages orders" on public.orders for all
  to authenticated using ((select public.is_owner())) with check ((select public.is_owner()));

drop policy if exists "Owner reads order items" on public.order_items;
drop policy if exists "Staff read order items" on public.order_items;
create policy "Staff read order items" on public.order_items for select
  to authenticated using ((select public.is_staff()));
drop policy if exists "Owner manages order items" on public.order_items;
create policy "Owner manages order items" on public.order_items for all
  to authenticated using ((select public.is_owner())) with check ((select public.is_owner()));

-- inquiries (including transfer requests): staff read and mark handled;
-- only the owner deletes.
drop policy if exists "Owner can read inquiries"   on public.inquiries;
drop policy if exists "Owner can insert inquiries" on public.inquiries;
drop policy if exists "Owner can update inquiries" on public.inquiries;
drop policy if exists "Owner can delete inquiries" on public.inquiries;
drop policy if exists "Staff read inquiries" on public.inquiries;
create policy "Staff read inquiries" on public.inquiries for select
  to authenticated using ((select public.is_staff()));
drop policy if exists "Staff add inquiries" on public.inquiries;
create policy "Staff add inquiries" on public.inquiries for insert
  to authenticated with check ((select public.is_staff()));
drop policy if exists "Staff update inquiries" on public.inquiries;
create policy "Staff update inquiries" on public.inquiries for update
  to authenticated using ((select public.is_staff())) with check ((select public.is_staff()));
drop policy if exists "Owner deletes inquiries" on public.inquiries;
create policy "Owner deletes inquiries" on public.inquiries for delete
  to authenticated using ((select public.is_owner()));

-- settings: staff read (the manager's screens show the current values);
-- only the owner writes. This is what keeps tax, shipping, the discount
-- offer, the game difficulty and the alert routing owner-only.
drop policy if exists "Owner can read settings"   on public.settings;
drop policy if exists "Owner can insert settings" on public.settings;
drop policy if exists "Owner can update settings" on public.settings;
drop policy if exists "Owner can delete settings" on public.settings;
drop policy if exists "Staff read settings" on public.settings;
create policy "Staff read settings" on public.settings for select
  to authenticated using ((select public.is_staff()));
drop policy if exists "Owner adds settings" on public.settings;
create policy "Owner adds settings" on public.settings for insert
  to authenticated with check ((select public.is_owner()));
drop policy if exists "Owner edits settings" on public.settings;
create policy "Owner edits settings" on public.settings for update
  to authenticated using ((select public.is_owner())) with check ((select public.is_owner()));
drop policy if exists "Owner deletes settings" on public.settings;
create policy "Owner deletes settings" on public.settings for delete
  to authenticated using ((select public.is_owner()));

-- activity log: every staff action is written; only the owner reads it.
drop policy if exists "Owner reads activity"  on public.admin_activity;
drop policy if exists "Owner writes activity" on public.admin_activity;
drop policy if exists "Owner reads activity" on public.admin_activity;
create policy "Owner reads activity" on public.admin_activity for select
  to authenticated using ((select public.is_owner()));
drop policy if exists "Staff write activity" on public.admin_activity;
create policy "Staff write activity" on public.admin_activity for insert
  to authenticated with check ((select public.is_staff()));

-- game events: staff read the arcade numbers.
drop policy if exists "Owner can read game events" on public.game_events;
drop policy if exists "Staff read game events" on public.game_events;
create policy "Staff read game events" on public.game_events for select
  to authenticated using ((select public.is_staff()));

-- ---------------------------------------------------------------------
-- 8. Product photographs
-- ---------------------------------------------------------------------
-- Staff upload and replace; only the owner deletes a file. A manager who
-- removes a photograph from an item takes it off the item and leaves the
-- file in the bucket, which is recoverable, where a delete is not.
drop policy if exists "Owner upload product images" on storage.objects;
drop policy if exists "Owner update product images" on storage.objects;
drop policy if exists "Owner delete product images" on storage.objects;

create policy "Owner upload product images"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'product-images' and (select public.is_staff()));

create policy "Owner update product images"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'product-images' and (select public.is_staff()))
  with check (bucket_id = 'product-images' and (select public.is_staff()));

create policy "Owner delete product images"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'product-images' and (select public.is_owner()));

-- ---------------------------------------------------------------------
-- 9. Anything left over from before, whatever it is called
-- ---------------------------------------------------------------------
-- The old policies are dropped by name above. A database that has been
-- edited by hand could carry one under another name, and ONE leftover
-- `to authenticated using (true)` would undo everything here, because a
-- request is allowed if ANY permissive policy allows it. So every policy
-- on these tables that applies to signed-in users only and does not ask
-- who they are is removed, and named as it goes.
do $$
declare
  p record;
begin
  for p in
    select schemaname, tablename, policyname
    from pg_policies
    where (
        (schemaname = 'public' and tablename in (
          'items', 'item_variants', 'games', 'game_spots', 'winners', 'orders',
          'order_items', 'inquiries', 'settings', 'admin_activity', 'game_events', 'staff'))
        or (schemaname = 'storage' and tablename = 'objects'
            and coalesce(qual, '') || coalesce(with_check, '') like '%product-images%')
      )
      and roles = '{authenticated}'
      and coalesce(qual, '') || coalesce(with_check, '') not like '%is_staff()%'
      and coalesce(qual, '') || coalesce(with_check, '') not like '%is_owner()%'
      and coalesce(qual, '') || coalesce(with_check, '') not like '%auth.uid()%'
  loop
    raise notice 'Removing leftover policy "%" on %.%', p.policyname, p.schemaname, p.tablename;
    execute format('drop policy %I on %I.%I', p.policyname, p.schemaname, p.tablename);
  end loop;
end $$;

-- ---------------------------------------------------------------------
-- 10. Prove it before committing
-- ---------------------------------------------------------------------
-- Refuses to finish, and so rolls the whole file back, if any policy on
-- these tables still lets a signed-in account write without asking its
-- role, or read a private table without asking. The only open policies
-- allowed are the public ones the site itself depends on.
do $$
declare
  bad text;
begin
  select string_agg(format('"%s" on %s.%s', policyname, schemaname, tablename), ', ')
  into bad
  from pg_policies
  where (
      (schemaname = 'public' and tablename in (
        'items', 'item_variants', 'games', 'game_spots', 'winners', 'orders',
        'order_items', 'inquiries', 'settings', 'admin_activity', 'game_events', 'staff'))
      or (schemaname = 'storage' and tablename = 'objects'
          and coalesce(qual, '') || coalesce(with_check, '') like '%product-images%')
    )
    and ('authenticated' = any(roles) or 'public' = any(roles))
    and coalesce(qual, '') || coalesce(with_check, '') not like '%is_staff()%'
    and coalesce(qual, '') || coalesce(with_check, '') not like '%is_owner()%'
    and coalesce(qual, '') || coalesce(with_check, '') not like '%auth.uid()%'
    -- The public site's own reads, and the arcade's event counter.
    and not (cmd = 'SELECT' and tablename in ('games', 'item_variants', 'winners'))
    and not (cmd = 'SELECT' and schemaname = 'storage')
    and not (tablename = 'game_events' and cmd = 'INSERT');
  if bad is not null then
    raise exception 'Roles not applied: these policies still let any signed-in account through: %', bad;
  end if;
end $$;

commit;
