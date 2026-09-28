-- The drop on the home page, chosen by the owner.
--
-- Until now the home page, the /featured address and every "Get your
-- guide" button showed whichever running drop was created last. With two
-- drops open that meant one of them could not be reached from the site
-- at all, and a buyer who clicked it was shown the other. Each drop now
-- has its own page (/games/<id>) and every link names its drop; this is
-- the one remaining choice: which drop the home page features.
--
-- WHAT CHANGES
--
-- games gains featured_on_home, false on every existing row, so nothing
-- is featured until the owner picks one. At most one drop can be
-- featured (a unique index), and only the owner can change it (a
-- trigger, because the manager may edit drops for other reasons).
--
-- set_home_drop(p_game) moves the choice in one transaction: it clears
-- whichever drop had it and sets the new one. Null clears it. A drop that
-- has been drawn cannot be chosen; one that is drawn later simply stops
-- being shown, and the home page lists the running drops instead.
--
-- No existing value is changed and nothing has to be re-entered.

begin;

alter table public.games
  add column if not exists featured_on_home boolean not null default false;

create unique index if not exists games_one_on_home
  on public.games ((featured_on_home)) where featured_on_home;

create or replace function public.refuse_home_choice()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  -- No signed-in user is the SQL editor or the server's own key; a
  -- signed-in user must be the owner.
  if new.featured_on_home is distinct from old.featured_on_home
     and auth.uid() is not null and not public.is_owner() then
    raise exception 'Only the owner chooses the drop on the home page.'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

revoke all on function public.refuse_home_choice() from public;

drop trigger if exists games_refuse_home_choice on public.games;
create trigger games_refuse_home_choice
  before update of featured_on_home on public.games
  for each row execute function public.refuse_home_choice();

create or replace function public.set_home_drop(p_game uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_status text;
begin
  if not public.is_owner() then
    raise exception 'Only the owner chooses the drop on the home page.'
      using errcode = '42501';
  end if;
  if p_game is not null then
    select status into v_status from public.games where id = p_game;
    if v_status is null then
      raise exception 'That drop does not exist.' using errcode = 'P0002';
    end if;
    if v_status = 'drawn' then
      raise exception 'That drop has been drawn. Choose a drop that is still running.'
        using errcode = 'P0001';
    end if;
  end if;
  update public.games set featured_on_home = false
    where featured_on_home and id is distinct from p_game;
  if p_game is not null then
    update public.games set featured_on_home = true
      where id = p_game and not featured_on_home;
  end if;
end;
$$;

revoke all on function public.set_home_drop(uuid) from public;
grant execute on function public.set_home_drop(uuid) to authenticated;

commit;
