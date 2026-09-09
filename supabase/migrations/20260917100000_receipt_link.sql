-- A receipt the buyer can get back to, and a link that does not live
-- forever.
--
-- The confirmation token has been the only way to read an order without
-- an account, and it had no expiry at all. That was wrong in both
-- directions: unreachable for the person who wanted it, because nothing
-- linked back to it, and permanently live for anyone who later found the
-- link. This gives it a year — long enough to be genuinely useful across
-- a season of buying, short enough that a forwarded email stops being a
-- standing key.

alter table public.orders
  add column if not exists confirmation_expires_at timestamptz;

-- Existing orders get a year from when they were placed, not from now, so
-- backfilling does not silently extend links that are already old.
update public.orders
set confirmation_expires_at = created_at + interval '1 year'
where confirmation_expires_at is null;

alter table public.orders
  alter column confirmation_expires_at set default (now() + interval '1 year');

alter table public.orders
  alter column confirmation_expires_at set not null;

-- The receipt page looks up on (order_number, token) and then checks the
-- expiry. Indexed together because that is how it is read.
create index if not exists orders_confirmation_idx
  on public.orders (order_number, confirmation_token);

comment on column public.orders.confirmation_expires_at is
  'When the receipt link stops working. The token is the credential; this
   bounds it. Extending an individual order means moving this date, not
   minting a new token, so an old email keeps working if someone chooses
   to let it.';
