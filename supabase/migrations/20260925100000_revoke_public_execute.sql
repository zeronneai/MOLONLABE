-- Close the privileged functions to the public key.
--
-- WHAT WAS WRONG
--
-- Six migrations carefully revoked EXECUTE on the money and inventory
-- functions:
--
--   revoke execute on function public.claim_game_spots(uuid, int)
--     from anon, authenticated;
--
-- None of it did anything. PostgreSQL grants EXECUTE on a new function
-- to PUBLIC by default, and revoking from a named role does not remove a
-- grant held by PUBLIC. `has_function_privilege('anon', …, 'EXECUTE')`
-- stayed true for every one of them, and the revoke lines read like the
-- hole was closed.
--
-- These are all SECURITY DEFINER, so they run as the owner and do not
-- see row level security at all. That is correct — claiming a spot has
-- to be able to write a table the buyer may not touch — and it is
-- exactly why the grant matters.
--
-- Demonstrated rather than inferred, as the anon role on a database
-- built from the chain:
--
--   set role anon;
--   select claim_game_spots('…', 3);   -> {1,2,3}
--   select sell_game_spots('…', array[1,2,3], null, 'Mallory', …);
--   -- three spots now 'sold'. No order, no payment, no card.
--
-- The anon key ships in the browser bundle by design, so this was
-- reachable by anyone who opened devtools: take a game's spots out of
-- circulation, or mark them sold to a name of your choosing.
--
-- THE FIX
--
-- Default-deny. EXECUTE is revoked from PUBLIC — which is the grant that
-- was actually there — and then granted back explicitly to nobody except
-- the one function the public pages genuinely call.
--
-- The role-specific revokes are kept alongside, not because they do the
-- work but because a reader looking for "is anon allowed this?" should
-- find the answer stated rather than have to know about PUBLIC.

-- ---------------------------------------------------------------------
-- Spots
-- ---------------------------------------------------------------------
revoke execute on function public.claim_game_spots(uuid, int) from public, anon, authenticated;
revoke execute on function public.release_game_spots(uuid, int[]) from public, anon, authenticated;
revoke execute on function public.sell_game_spots(uuid, int[], uuid, text, text, text, text)
  from public, anon, authenticated;

-- ---------------------------------------------------------------------
-- Stock
-- ---------------------------------------------------------------------
revoke execute on function public.claim_variant_stock(uuid, int) from public, anon, authenticated;
revoke execute on function public.release_variant_stock(uuid, int) from public, anon, authenticated;

-- ---------------------------------------------------------------------
-- Checkout idempotency
-- ---------------------------------------------------------------------
-- Less obviously dangerous and still not the browser's business: these
-- decide whether a second attempt at a card is a duplicate or an honest
-- retry, and a caller who can release another person's key can make one
-- look like the other.
revoke execute on function public.claim_checkout(text) from public, anon, authenticated;
revoke execute on function public.finish_checkout(text, text, text) from public, anon, authenticated;
revoke execute on function public.release_checkout(text) from public, anon, authenticated;

-- ---------------------------------------------------------------------
-- The one that IS public, on purpose
-- ---------------------------------------------------------------------
-- `game_spots_remaining` is how the public game page and the cart pricer
-- get the count, with the anonymous key, on every render. It reads and
-- returns a single integer and can change nothing.
--
-- Stated as an explicit grant rather than left to the PUBLIC default, so
-- that the one function anon may call is the one function anon is
-- granted — and the list is readable rather than inferred from absence.
revoke execute on function public.game_spots_remaining(uuid) from public;
grant execute on function public.game_spots_remaining(uuid) to anon, authenticated;

-- ---------------------------------------------------------------------
-- Trigger helpers
-- ---------------------------------------------------------------------
-- Not usefully callable over RPC — a trigger function invoked directly
-- errors on the missing trigger context — but they are in the exposed
-- schema and there is no reason for them to be offered.
revoke execute on function public.set_updated_at() from public, anon, authenticated;
revoke execute on function public.stamp_authorship() from public, anon, authenticated;
revoke execute on function public.stamp_authorship_updated_only() from public, anon, authenticated;
