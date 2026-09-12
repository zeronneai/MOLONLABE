# The test suite

```bash
npm test                    # everything that has assertions
npm test -- spots draw      # only suites whose name matches
npm test -- --db            # only the PostgreSQL suites
npm test -- --list          # what exists, without running it
npm test -- mixed           # an inspection script, by name
```

The runner starts what the tests need and stops what it started. Anything
already listening on the configured ports is reused and left running, so
an app you are already debugging is not killed underneath you.

## What runs against what, and why

**`tests/browser/`** — Playwright against the real app, with
`tests/fixtures/double.mjs` standing in for Supabase and Authorize.net.
This is most of the suite: pricing, tax, the cart, checkout, the admin,
the draw, the emails.

**`tests/db/`** — real PostgreSQL, for the things the double cannot
honestly test. The double is single-threaded JavaScript: it serialises
every request, so a concurrency test against it would pass whether or not
the SQL is correct. A test that cannot fail proves nothing.

Each db suite gets **its own database**, cloned from a template built once
from the migration chain and dropped when the suite ends. Cloning takes
about a second; replaying fourteen migrations takes about a minute, and a
check that costs a minute per test is a check that stops being run.

## Why it runs sequentially

Every browser suite calls `__reset` on the double and then asserts
against its state, so two running at once would clear each other's
fixtures. The full run therefore takes minutes rather than seconds.

Parallelism would mean one double per worker, and the honest version of
that is more moving parts than this build needs. If the wait becomes the
reason nobody runs it, that is the moment to reconsider — a suite too
slow to run is worth the same as no suite. Until then, `npm test -- <name>`
runs one in seconds.

## Rules this suite has learned the hard way

Each of these is here because breaking it shipped a bug.

**No suite may depend on another having run.** `emaildesign` used to read
files `mixed` had written. Two of its assertions passed for months
against an email the app had stopped producing, because the files on disk
predated the rebuild. It now places its own order. The db suites used to
share one database, where the first left rows the second tripped over, so
the result depended on run order. They now each own a database.

**The double knows the schema.** It reads its column list from
`lib/database.types.ts` and rejects a write naming an undeclared column
with `PGRST204`, the way PostgREST would. It used to store whatever it
was handed, which is exactly why every suite stayed green while the draw
wrote three columns the database did not have. See `docs/schema-drift.md`.

**The double applies column defaults.** Without them it handed the app
rows the database could never produce — winners with no `drawn_at` — and
that crashed a page that was correct.

**A passing assertion prints what it saw.** `check()` shows its detail on
success as well as failure, because that is how you notice a test passing
for the wrong reason. `winnernumber` prints the winning spot number and
the selector's index side by side, and asserts they differ — if they ever
coincide, that test has stopped being able to tell them apart and says so
rather than passing quietly.

**Stubs must have the shape of the real thing.** The Accept.js stub takes
a delay, because tokenisation is a network round trip. Every checkout
test used to stub it synchronously, which left no window to click into —
so the double-charge bug was structurally impossible to reproduce.

**Assert the property, not the schedule.** `race` used to assert that
exactly two of ten simultaneous buyers won a pair from five spots. It
passed for weeks and then produced one winner — correctly, because
`claim_game_spots` uses `FOR UPDATE SKIP LOCKED` and a buyer who cannot
find two *unlocked* rows refuses outright rather than risk selling one
twice. It now asserts what actually holds however the scheduler behaves:
every winner got a full pair, and every spot is either claimed or open.
A timing-dependent assertion is the same disease as an order-dependent
one — it eventually calls correct behaviour a failure, and the next
person "fixes" working code to satisfy it.

## Configuration

Everything has a working default; override by environment variable.

| Variable | Default | For |
|---|---|---|
| `TEST_APP` | `http://localhost:3500` | point at a deployed preview |
| `TEST_DOUBLE` | `http://127.0.0.1:4010` | the stand-in |
| `TEST_CHROMIUM` | Playwright's own | a browser Playwright will not find |
| `TEST_ARTIFACTS` | `$TMPDIR/mlf-test-artifacts` | where inspection scripts write |
| `TEST_PGHOST` / `TEST_PGPORT` / `TEST_PGUSER` | `/tmp` / `5433` / `postgres` | PostgreSQL |
| `TEST_PGTEMPLATE` | `mlf_template` | the database db suites clone |

The app needs a `.env.local` pointing at the double. See
`docs/pre-launch-test.md`.

## Inspection scripts

`mixed`, `leak`, `inbox`, `friction`, `closed` and `urgent` print findings
rather than assertions — a rendered email, a leak sweep, a slow-network
profile. The runner skips them unless named, because it cannot judge
output that has no pass or fail.

## What this suite does not cover

`docs/untested.md` — the live ledger of everything only ever exercised
against a stand-in, and what has since been done for real. **Read it
before trusting a green run.** A declined card, a real gateway timeout,
Supabase's own behaviour as opposed to stock PostgreSQL, and anything
touching Cloudinary are all still open.
