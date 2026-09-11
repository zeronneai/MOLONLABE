# Schema drift — the check, and why it exists

## What happened

The `winners` table was missing `seed`, `ticket` and `entry_total`. The
draw writes all three, so every draw failed on insert. The columns are
the entire audit trail: without the recorded seed nobody can re-run a
draw and confirm the same winner, which is the property the client has
been told protects him from an accusation of rigging.

The migration chain was not the cause. Applying all fourteen migrations
to an empty database leaves the three columns present — verified. The
live database had diverged from the chain some other way, most likely a
migration applied out of order or not at all.

## Why nothing caught it

Three checks were running, and all three are structurally incapable of
seeing this:

| Check | What it compares | Blind to |
|---|---|---|
| Browser and unit suites | code against a local test double | the double stored whatever it was handed, so a write to a column that does not exist looked like a normal write |
| Migration chain test | the chain against an empty database | the chain was correct; the shop's database was not built only from the chain |
| `tsc` | code against `lib/database.types.ts` | the types file is hand-maintained and had also drifted |

Every one of them confirms the code agrees with itself. None of them
looks at the database the shop actually runs on. That is the gap, and it
is a gap no amount of additional test coverage of the same kind would
close.

## The two checks that close it

There are three artifacts that must agree — the code, the declared types,
and the real database — so there are two joins to verify.

**Code ↔ types.** The test double now reads its column list from
`lib/database.types.ts` and rejects a write naming an undeclared column
with `PGRST204`, exactly as PostgREST would. Previously the double was
schemaless, which is the specific reason the suites stayed green.

**Types ↔ database.** `npm run check:schema` asks the live database what
columns it has and compares. It needs no new dependency and no new
credential — it uses the Supabase URL and service-role key already in
`.env.local`, through PostgREST's OpenAPI document. A direct connection
works too (`DATABASE_URL=… npm run check:schema`, needs `psql`).

```
$ npm run check:schema

COLUMNS THE CODE USES THAT THE DATABASE DOES NOT HAVE

  winners.seed          (code expects string | null)
  winners.ticket        (code expects number | null)
  winners.entry_total   (code expects number | null)

Every query touching these fails at runtime. A migration is missing,
or one was applied out of order.

Re-run with --sql for suggested ALTER statements.
```

Exit codes: `0` clean, `1` drift, `2` could not check. A column in the
database that the code no longer declares is listed but does not fail the
run — it is harmless, and failing on it would make the check annoying
enough to be switched off, which is how checks die.

## When to run it

**After applying any migration**, and before going live with anything
that matters. It takes a second and it is the only check that can see
this class of problem.

## What it found beyond the winners table

Run against the database in its broken state, it reported five columns,
not three — the two new audit columns as well. It then found two more
pieces of drift left by the fixed-pool rebuild, in the other direction:

- `orders.entries_per_dollar` and `orders.entries_awarded` were dropped by
  the rebuild but still declared in `lib/database.types.ts`, and the admin
  orders page still rendered them. It read as `undefined > 0`, so the line
  silently never appeared rather than crashing. Both removed.
- `winners.Update` still declared `entrant_id`, renamed to `spot_id` by
  the rebuild. Corrected.

A third remnant turned up separately: two assertions in the email design
suite still checked for an entry count on a merchandise receipt, which
the fixed-pool model removed. They passed because that suite reads
artifacts written by another script, and the files on disk predated the
rebuild. The suite now refuses to run against artifacts older than the
build rather than reporting a green run.
