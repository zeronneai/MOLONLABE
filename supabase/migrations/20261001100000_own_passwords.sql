-- Everyone sets their own password.
--
-- Until now the agency created every account and set its password, so it
-- knew everyone's, the owner's and the manager's included. From here:
--
--   staff.must_change_password   true until the person has set a password
--                                of their own. While it is true they can
--                                sign in and do exactly one thing: change
--                                it. The admin shows nothing else, and
--                                the database treats them as not staff,
--                                so a direct call gets nothing either.
--
-- It DEFAULTS TO TRUE. Every existing row gets it when this runs, which
-- is how the owner and the manager are asked to choose their own
-- password at their next sign-in, and every account added later gets it
-- without anybody having to remember to set it.
--
-- WHY THE FLAG CANNOT JUST BE CLEARED
--
-- record_password_change() clears the flag, and anybody signed in can
-- call it. If it only trusted the call, someone could clear the flag and
-- keep the temporary password everyone knows. So when an account is
-- flagged, a fingerprint of its current password hash is kept
-- (staff_password_marks), and the flag only clears once the hash has
-- changed: once Supabase has actually stored a new password. The
-- fingerprint is an md5 of the bcrypt hash, kept in a table with no
-- policies, so no session can read it, and it could not be turned back
-- into a password if one did.
--
-- Changes no data except setting the new flag on the existing staff rows.

begin;

alter table public.staff
  add column if not exists must_change_password boolean not null default true;

comment on column public.staff.must_change_password is
  'True until the person sets their own password. Defaults to true, so every new account must. Set it again to force a change.';

create table if not exists public.staff_password_marks (
  user_id     uuid primary key references public.staff(user_id) on delete cascade,
  fingerprint text,
  marked_at   timestamptz not null default now()
);
alter table public.staff_password_marks enable row level security;
-- Deliberately no policies: nothing but the functions below reads it.
revoke all on public.staff_password_marks from anon, authenticated;

comment on table public.staff_password_marks is
  'A fingerprint of each flagged account''s password hash at the moment it was flagged. Read only by record_password_change().';

-- The current password hash of an account, fingerprinted. Null if it
-- cannot be read, in which case the change is trusted rather than
-- locking the person out for a reason they cannot fix.
create or replace function public.password_fingerprint(p_user uuid)
returns text
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v text;
begin
  begin
    execute 'select md5(coalesce(encrypted_password, '''')) from auth.users where id = $1'
      into v using p_user;
  exception when others then
    v := null;
  end;
  return v;
end;
$$;

revoke execute on function public.password_fingerprint(uuid) from public, anon, authenticated;

-- Whenever an account is flagged, remember what its password was then.
create or replace function public.mark_password_for_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.must_change_password
     and (tg_op = 'INSERT' or not coalesce(old.must_change_password, false)) then
    insert into public.staff_password_marks (user_id, fingerprint, marked_at)
    values (new.user_id, public.password_fingerprint(new.user_id), now())
    on conflict (user_id) do update
      set fingerprint = excluded.fingerprint, marked_at = excluded.marked_at;
  end if;
  return new;
end;
$$;

revoke execute on function public.mark_password_for_change() from public, anon, authenticated;

drop trigger if exists staff_mark_password_for_change on public.staff;
create trigger staff_mark_password_for_change
  after insert or update of must_change_password on public.staff
  for each row execute function public.mark_password_for_change();

-- The accounts that exist now: flagged by the column default above, and
-- remembered here. Only rows not already remembered, so running this
-- again does not move the mark.
insert into public.staff_password_marks (user_id, fingerprint)
select s.user_id, public.password_fingerprint(s.user_id)
from public.staff s
where s.must_change_password
on conflict (user_id) do nothing;

-- ------------------------------------------------ what policies ask
-- A flagged account is not staff for any purpose but changing its own
-- password. Every admin policy asks one of these two.

create or replace function public.is_staff()
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.staff s
    where s.user_id = auth.uid() and not s.must_change_password
  )
$$;

create or replace function public.is_owner()
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.staff s
    where s.user_id = auth.uid() and s.role = 'owner' and not s.must_change_password
  )
$$;

create or replace function public.staff_role()
returns text
language sql stable security definer
set search_path = ''
as $$
  select s.role from public.staff s
  where s.user_id = auth.uid() and not s.must_change_password
$$;

-- ------------------------------------------- after a password change
-- Called by the admin once Supabase has stored the new password. Clears
-- the flag if it was set, but only if the password really did change,
-- and writes the activity log line. The password is never passed in,
-- never read, and never written anywhere.
create or replace function public.record_password_change()
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid   uuid := auth.uid();
  v_staff public.staff%rowtype;
  v_mark  text;
  v_now   text;
  v_forced boolean;
begin
  if v_uid is null then
    raise exception 'Not signed in.' using errcode = '42501';
  end if;
  select * into v_staff from public.staff where user_id = v_uid;
  if not found then
    raise exception 'This account has no access to the admin.' using errcode = '42501';
  end if;

  v_forced := v_staff.must_change_password;
  if v_forced then
    select fingerprint into v_mark from public.staff_password_marks where user_id = v_uid;
    v_now := public.password_fingerprint(v_uid);
    if v_mark is not null and v_now is not null and v_mark = v_now then
      raise exception 'Your password has not been changed yet. Set a new one first.'
        using errcode = 'P0001';
    end if;
    update public.staff set must_change_password = false where user_id = v_uid;
    delete from public.staff_password_marks where user_id = v_uid;
  end if;

  insert into public.admin_activity (actor_id, actor_name, action, entity, entity_id, entity_label, field)
  values (v_uid, v_staff.display_name, 'password', 'staff', v_uid, v_staff.display_name,
          case when v_forced then 'first password' else 'password' end);

  return v_forced;
end;
$$;

revoke execute on function public.record_password_change() from public, anon, authenticated;
grant execute on function public.record_password_change() to authenticated;

commit;
