-- Constraint and index names left behind by the campaigns → games rename.
--
-- Renaming a table renames neither its constraints nor its indexes, so
-- `games` still carried `campaigns_pkey`, `winners` still carried
-- `winners_campaign_id_fkey`, and so on. They enforce exactly the right
-- thing — this is cosmetic — but the names surface in error messages, and
-- an error naming a table that no longer exists sends whoever is reading
-- it looking for a problem that is not there. It cost us a few minutes
-- once already.
--
-- ALTER ... RENAME has no IF EXISTS form for constraints, so each rename
-- is guarded by a lookup. That makes the whole file re-runnable, and
-- makes it a no-op on a database where the names are already correct.

do $$
declare
  r record;
begin
  -- Constraints: anything on a public table whose name still says
  -- campaign or entrant, renamed to match the table it is actually on.
  for r in
    select c.conname as old,
           replace(replace(c.conname, 'campaigns_', 'games_'), 'campaign_', 'game_') as new,
           c.conrelid::regclass::text as tbl
    from pg_constraint c
    join pg_namespace n on n.oid = c.connamespace
    where n.nspname = 'public'
      and c.conname like '%campaign%'
  loop
    if r.new <> r.old
       and not exists (
         select 1 from pg_constraint c2
         join pg_namespace n2 on n2.oid = c2.connamespace
         where n2.nspname = 'public' and c2.conname = r.new
       )
    then
      execute format('alter table %s rename constraint %I to %I', r.tbl, r.old, r.new);
      raise notice 'renamed constraint % to % on %', r.old, r.new, r.tbl;
    end if;
  end loop;

  -- Indexes that are not owned by a constraint. A constraint's backing
  -- index follows the constraint rename above; renaming it separately
  -- would fail.
  for r in
    select i.relname as old,
           replace(replace(i.relname, 'campaigns_', 'games_'), 'campaign_', 'game_') as new
    from pg_class i
    join pg_namespace n on n.oid = i.relnamespace
    where n.nspname = 'public'
      and i.relkind = 'i'
      and i.relname like '%campaign%'
      and not exists (
        select 1 from pg_constraint c where c.conindid = i.oid
      )
  loop
    if r.new <> r.old
       and not exists (
         select 1 from pg_class c2
         join pg_namespace n2 on n2.oid = c2.relnamespace
         where n2.nspname = 'public' and c2.relname = r.new
       )
    then
      execute format('alter index public.%I rename to %I', r.old, r.new);
      raise notice 'renamed index % to %', r.old, r.new;
    end if;
  end loop;

  -- Policy names. These are the ones a person actually reads: they show
  -- up in the Supabase dashboard next to the table, so "Owner can delete
  -- campaigns" sitting on `games` is the most visible of the three.
  for r in
    select p.policyname as old,
           replace(replace(p.policyname, 'campaigns', 'games'), 'campaign', 'game') as new,
           p.tablename as tbl
    from pg_policies p
    where p.schemaname = 'public'
      and p.policyname like '%campaign%'
  loop
    if r.new <> r.old
       and not exists (
         select 1 from pg_policies p2
         where p2.schemaname = 'public' and p2.tablename = r.tbl and p2.policyname = r.new
       )
    then
      execute format('alter policy %I on public.%I rename to %I', r.old, r.tbl, r.new);
      raise notice 'renamed policy % to % on %', r.old, r.new, r.tbl;
    end if;
  end loop;
end $$;
