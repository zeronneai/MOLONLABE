-- The Supabase platform objects the migrations assume already exist.
--
-- The chain is written for a Supabase project, where `auth` and
-- `storage` are provided. Against stock PostgreSQL they are not, so two
-- migrations abort — and without this, the template database would be
-- missing everything after them.
--
-- Deliberately minimal. It exists so the migration chain can APPLY, and
-- so a test can act as a particular signed-in user.
--
-- auth.uid() reads the JWT claim exactly the way Supabase's own does:
-- PostgREST puts the verified token's claims in `request.jwt.claims`
-- (and, on older versions, `request.jwt.claim.sub`), and auth.uid() is
-- the `sub`. So a test that runs
--
--   set role authenticated;
--   select set_config('request.jwt.claims', '{"sub":"<uuid>"}', true);
--
-- is seen by every policy as that user, which is the only honest way to
-- test that a manager is refused. It used to return null unconditionally,
-- which made every role-dependent policy untestable. With no claim set it
-- still returns null, so nothing that ran before behaves differently.
--
-- This is still not Supabase. See "the repair scripts against Supabase
-- itself" in docs/untested.md.

create schema if not exists auth;
create schema if not exists storage;

create table if not exists auth.users (
  id uuid primary key default gen_random_uuid(),
  email text,
  -- Supabase's own column name. The roles migration reads names from it.
  raw_user_meta_data jsonb
);
alter table auth.users add column if not exists raw_user_meta_data jsonb;

create table if not exists storage.buckets (
  id text primary key, name text, public boolean,
  file_size_limit bigint, allowed_mime_types text[]
);

create table if not exists storage.objects (
  id uuid primary key default gen_random_uuid(),
  bucket_id text, name text, owner uuid
);
alter table storage.objects enable row level security;

create or replace function auth.uid() returns uuid
  language sql stable as $$
    select nullif(
      coalesce(
        nullif(current_setting('request.jwt.claim.sub', true), ''),
        nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub'
      ),
      ''
    )::uuid
  $$;
create or replace function auth.role() returns text
  language sql stable as $$ select 'authenticated'::text $$;

do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated; end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then create role service_role; end if;
end $$;

-- Two facts about the Supabase roles that policies depend on. Without the
-- first, every trigger that calls auth.uid() fails for a signed-in user
-- with "permission denied for schema auth", which a test of a refusal
-- would read as the refusal. Without the second, the service role is
-- subject to row level security here and not on Supabase, so checkout's
-- writes would match nothing.
grant usage on schema auth to anon, authenticated, service_role;
alter role service_role with bypassrls;
