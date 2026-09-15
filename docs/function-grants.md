# Adding a database function

**Read this before you write `create function`. It takes a minute and the
failure it prevents is not one you will notice.**

## The rule

Every function you add gets a matching revoke, in the same migration:

```sql
create or replace function public.my_function(...) ...;

revoke execute on function public.my_function(...) from public, anon, authenticated;
```

`from public` is the part that does the work. Leaving it out looks
identical and does nothing.

If the function genuinely needs to be called from a public page, grant it
explicitly and add it to the allow-list in `tests/db/rpcgrants.mjs`:

```sql
revoke execute on function public.my_function(...) from public;
grant  execute on function public.my_function(...) to anon, authenticated;
```

That is the whole rule. The rest of this page is why.

---

## Why `from anon` is not enough

`CREATE FUNCTION` grants `EXECUTE` to **PUBLIC**. PUBLIC is not a role you
can name in a role list — it is a pseudo-role meaning everyone, and every
role inherits from it.

So this:

```sql
revoke execute on function public.claim_game_spots(uuid, int)
  from anon, authenticated;
```

removes a grant that `anon` never individually held, leaves the PUBLIC
grant untouched, reports success, and changes nothing.
`has_function_privilege('anon', …, 'EXECUTE')` stays `true`.

That is not hypothetical. Six migrations in this repo carried lines
exactly like the one above, and all twelve functions stayed callable with
the anonymous key — the key that ships in the browser bundle on every
page load. Our functions are `SECURITY DEFINER`, so they run as the owner
and never see row level security. Demonstrated as `anon` on a database
built from our own chain:

```sql
set role anon;
select claim_game_spots('…', 3);   -- {1,2,3}
select sell_game_spots('…', array[1,2,3], null, 'Mallory', …);
-- three spots now 'sold'. No order, no payment, no card.
```

Anyone could have filled a game and been in the draw for free.

---

## Three things that are not what they look like

Measured on PostgreSQL 16, not assumed — each of these contradicted a
comment somebody had already written in this repo.

**`CREATE OR REPLACE` preserves privileges.** Replacing a function body
does not re-open it. A previously revoked function stays revoked.

**`DROP` then `CREATE` resets them to the default, so back to PUBLIC.**
Changing a function's *argument list* requires a drop — Postgres treats a
different signature as a different function — so **any migration that
changes an argument list silently re-opens that function**, even if it
had been locked down for months. This is the one that will catch you.

**`ALTER DEFAULT PRIVILEGES` cannot fix this globally.** The obvious
instinct is to set a default once and stop thinking about it:

```sql
alter default privileges in schema public revoke execute on functions from public;
```

It runs without error, records nothing in `pg_default_acl`, and the next
function you create is still executable by `anon`. `ALTER DEFAULT
PRIVILEGES` can only withdraw defaults previously granted *through it* —
it has no power over the built-in grant. Verified on a clean database.

There is no switch. It has to be the explicit revoke, every time, which
is why it has to be a test rather than a convention.

---

## What enforces it

`tests/db/rpcgrants.mjs`, in `npm run test:db`.

It enumerates **every** function in the `public` schema and requires that
exactly one — `game_spots_remaining` — is executable by `anon`. Add a
function without a revoke and the suite fails naming it. Nothing has to
be remembered, and nobody has to know any of the above.

It then goes further and *attempts the calls* as `anon`, because the
catalogue saying "denied" next to a call that succeeds is precisely the
gap that let the original mistake look fixed for months. With the fix
removed it fails with:

```
FAIL anon calling sell_game_spots is REFUSED
     — IT SUCCEEDED — spots sold with no payment
```

**If you add a genuinely public function**, add its name to `PUBLIC_OK`
at the top of that file, with a comment saying why. That list is meant to
be short and to require an argument.

`scripts/gen-baseline.mjs` emits `revoke execute … from public` for every
function too. Without that, `supabase/repair/baseline.sql` would rebuild
the hole on any database it repaired — after the migration that fixed it.

---

## Which function is public, and why

| function | anon | why |
| --- | --- | --- |
| `game_spots_remaining` | **yes** | Takes a game id, returns one integer, writes nothing. The game page and the cart pricer call it on every render with the anon key. |
| everything else | no | Called only from server actions, which use the **service role**. None of them ever needed a public grant. |

That asymmetry is the point: the functions that move money, stock or
spots are reached through code we control on the server, never from the
browser. If a new function needs to be callable from a page, that is
worth a moment's thought rather than a grant.

---

## Checking a live database

```sql
select p.proname, has_function_privilege('anon', p.oid, 'EXECUTE') as anon_can
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.prokind = 'f'
order by 1;
```

Only `game_spots_remaining` should be `true`.

The fix, if anything else is: `supabase/migrations/20260925100000_revoke_public_execute.sql`.
