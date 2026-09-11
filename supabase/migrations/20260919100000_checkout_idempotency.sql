-- Stop a double-click becoming a double charge.
--
-- The browser generates one key per rendered checkout form and sends it
-- with every attempt. This table is the arbiter: claiming the key is a
-- single insert that either succeeds or conflicts, and only the request
-- that wins the insert is allowed to reach the card gateway.
--
-- It is deliberately its own table rather than a column on `orders`. The
-- key has to be reserved BEFORE the charge, and an order cannot exist
-- before the charge — it has a dozen not-null columns that are only known
-- afterwards. Reserving in one table and recording in another is what
-- lets the claim happen first.

create table if not exists public.checkout_attempts (
  /* The key the browser minted. One per rendered form. */
  key           text primary key,
  started_at    timestamptz not null default now(),

  /* Set once the attempt reaches a conclusion. */
  order_number  text,
  finished_at   timestamptz,
  /* Why it ended, when it ended badly. Never shown to a buyer. */
  outcome       text
);

create index if not exists checkout_attempts_started_idx
  on public.checkout_attempts (started_at desc);

alter table public.checkout_attempts enable row level security;

-- No policy for anon or authenticated at all. Only the service role,
-- which bypasses RLS, ever touches this — it is written from the checkout
-- action and read by nothing else. A browser must not be able to
-- enumerate keys, because knowing one would let it read back somebody
-- else's order number.

/*
 * Claims a key, or reports who already has it.
 *
 * Returns:
 *   'claimed'   — this caller owns the attempt and may charge
 *   'done:<n>'  — an earlier attempt with this key already completed as
 *                 order <n>; return that order rather than charging
 *   'in_flight' — another request holds the key right now
 *
 * An attempt older than fifteen minutes is treated as abandoned and
 * re-claimable. Without that, a server that died mid-charge would make
 * that key permanently unusable and the buyer could never retry.
 */
create or replace function public.claim_checkout(p_key text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  existing public.checkout_attempts;
begin
  if p_key is null or length(p_key) < 8 then
    return 'claimed';  -- no usable key; fall back to the other two layers
  end if;

  insert into public.checkout_attempts (key)
  values (p_key)
  on conflict (key) do nothing;

  -- Row-count tells us whether this call created it.
  if found then
    return 'claimed';
  end if;

  select * into existing from public.checkout_attempts where key = p_key;

  if existing.order_number is not null then
    return 'done:' || existing.order_number;
  end if;

  if existing.started_at < now() - interval '15 minutes' then
    update public.checkout_attempts
    set started_at = now(), outcome = null
    where key = p_key;
    return 'claimed';
  end if;

  return 'in_flight';
end;
$$;

create or replace function public.finish_checkout(
  p_key     text,
  p_order   text,
  p_outcome text
)
returns void
language sql
security definer
set search_path = public
as $$
  update public.checkout_attempts
  set order_number = coalesce(p_order, order_number),
      outcome = coalesce(p_outcome, outcome),
      finished_at = now()
  where key = p_key;
$$;

/*
 * Releases a key so the buyer can try again.
 *
 * Used when the attempt failed in a way that took no money — a declined
 * card, a sold-out item. Holding the key after those would mean a second,
 * legitimate attempt from the same form was refused as a duplicate.
 */
create or replace function public.release_checkout(p_key text)
returns void
language sql
security definer
set search_path = public
as $$
  delete from public.checkout_attempts
  where key = p_key and order_number is null;
$$;

revoke execute on function public.claim_checkout(text) from anon, authenticated;
revoke execute on function public.finish_checkout(text, text, text) from anon, authenticated;
revoke execute on function public.release_checkout(text) from anon, authenticated;

-- The key on the order too, so a support question can be answered from
-- the order alone without joining to the attempts table.
alter table public.orders
  add column if not exists idempotency_key text;

create unique index if not exists orders_idempotency_key_idx
  on public.orders (idempotency_key)
  where idempotency_key is not null;

-- ---------------------------------------------------------------------
-- Tidy: a policy left behind by the campaigns rename
-- ---------------------------------------------------------------------
-- "Public can read live campaigns" carried over with `using (status =
-- 'live')`, and no game is ever 'live' now — the states are open, full
-- and drawn. It is harmless because the newer policy grants the read
-- anyway, but a policy whose condition can never be true is a trap for
-- whoever reads this next.
drop policy if exists "Public can read live campaigns" on public.games;
