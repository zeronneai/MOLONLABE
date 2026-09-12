-- The Supabase platform objects the migrations assume already exist.
--
-- The chain is written for a Supabase project, where `auth` and
-- `storage` are provided. Against stock PostgreSQL they are not, so two
-- migrations abort — and without this, the template database would be
-- missing everything after them.
--
-- Deliberately minimal. It exists so the migration chain can APPLY, not
-- so policies behave identically: auth.uid() returns null here, which is
-- exactly why "the repair scripts against Supabase itself" is still an
-- open item in docs/untested.md.

create schema if not exists auth;
create schema if not exists storage;

create table if not exists auth.users (
  id uuid primary key default gen_random_uuid(),
  email text
);

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
  language sql stable as $$ select null::uuid $$;
create or replace function auth.role() returns text
  language sql stable as $$ select 'authenticated'::text $$;

do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated; end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then create role service_role; end if;
end $$;
