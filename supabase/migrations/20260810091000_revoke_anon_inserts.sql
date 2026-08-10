-- Tighten public-form writes: the anon key can no longer insert into
-- inquiries or entrants directly. Server actions insert with the
-- service-role key instead.
--
-- ⚠ APPLY ONLY AFTER SUPABASE_SERVICE_ROLE_KEY is set in the deployment
-- environment — without it, the public inquiry/transfer/entry forms will
-- stop saving.

drop policy if exists "Anyone can submit an inquiry" on public.inquiries;
drop policy if exists "Anyone can submit an entry" on public.entrants;

-- The owner (and future in-store tooling) can still insert directly.
create policy "Owner can insert inquiries"
  on public.inquiries for insert
  to authenticated
  with check (true);

create policy "Owner can insert entrants"
  on public.entrants for insert
  to authenticated
  with check (true);
