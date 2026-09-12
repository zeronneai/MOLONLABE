# What has only ever been tested programmatically

Every item below works in an automated test. None of them has been done by
a person, on a real device, against a real service. That gap is where the
last three production bugs came from — the double charge, the draw
refusing silently, and "Entry 16 of 12" on the filmed screen were all
found in a click-through, not by a suite.

The suite is not the problem. It is that a test written against a stand-in
can only be as honest as the stand-in, and ours agreed with the code by
construction until it was made to stop. See `docs/schema-drift.md`.

**How to use this:** tick an item when a person has done it on real
infrastructure and it behaved correctly. Move it to "Covered" with a date
and a one-line note on what actually happened. An item that was tried and
behaved *badly* stays open with the finding written next to it — that is
more valuable than a tick.

Status key: `☐` not covered · `◐` partly · `✅` covered

---

## 1. Checkout — highest risk

Money moves here, and every path below is stubbed in the suite.

### ☐ A genuinely declined card — **do this first**

The suite only ever exercises approval. The decline path is where
`release_checkout` matters: a declined card took no money, so the
idempotency key must be released or the buyer's honest second attempt is
refused as a duplicate.

- Sandbox card `4000 0000 0000 0002` forces a decline.
- Expect: a plain message, no order row, no charge, and **a second
  attempt with a good card succeeds**. That second part is the actual
  test; the first part is easy.
- Also check the spots come back — buy spots, decline, then confirm the
  board shows them open again rather than stuck held.

### ☐ Accept.js failing to load, or loading slowly

If the script never loads, `acceptReady` stays false and the pay button
stays disabled forever. Nobody has seen what that looks like to a
customer — whether it explains itself or just sits there dead.

Block `js.authorize.net` in devtools and load `/checkout`.

### ☐ A real gateway timeout mid-charge

The three-layer idempotency protection assumes the request either
completes or fails. A request that hangs and *then* completes on the
gateway side, after our request timed out, is the case that produces a
charge with no order. Throttle to offline after submitting.

### ☐ 3-D Secure or AVS mismatch

The sandbox can return both. Neither has ever been seen. An AVS
mismatch may come back as a decline we render as a generic failure, when
it should tell the buyer to check their billing ZIP.

### ☐ The confirmation email actually arriving

The *payload* is asserted in detail (`mail`, `emaildesign`). Whether the
Apps Script delivers it to a real inbox is not. Remember `sent: true`
means "the script accepted it", not "Gmail delivered it".

### ☐ Mobile Safari, private browsing

The idempotency key lives in `sessionStorage`. In iOS private mode that
can throw or come back empty, in which case a reload mints a new key and
the database layer is the only thing left standing between a refresh and
a second charge. Worth knowing whether that layer is doing the work
unassisted.

### ☐ Email rendering in a real client

Checked programmatically against Gmail's 102KB clip threshold, dark
mode, blocked images and the proportional-font plain-text part — all in
a headless browser. Never opened in real Gmail, real Outlook, or Apple
Mail.

---

## 2. The draw

### ✅ A draw racing another draw — *covered 2026-09-11*

Ten simultaneous draws against real PostgreSQL, released together by a
shared advisory lock. Exactly one winner row; the other nine refused by
`winners_one_per_game_idx`. The application's read-then-write check is no
longer the only thing standing there.

### ✅ Drawing a game that already has a winner — *covered 2026-09-11*

Replays the recorded result — same row id, same seed, same spot, across
three replays. The admin does not offer the control once a winner exists;
the presentation says it will replay before you press anything. Compared
by **row identity**, not by name, because a second draw that happened to
pick the same spot would look identical on screen.

### ✅ The winning spot number on screen — *covered 2026-09-12*

Both surfaces, with a fixture where the spot number exceeds the pool.
This is how "Entry 16 of 12" was found on the filmed screen.

### ◐ `/draw/[id]` after a reload

The replay test reloads the page and replays three times, so the load
path is exercised. What is not: a reload *mid-animation*, and recovery
after the phone locks and wakes — the case presentation mode was built
for.

### ☐ Presentation mode on a real phone at 60fps

Frame-budget numbers exist; a recording does not. The thing that matters
is whether it holds 60fps on the owner's actual phone at the actual pool
size, while screen-recording, which is itself a load.

### ☐ The CSV export in real Excel

Generated and asserted as text. Never opened in Excel, where a leading
`+` or `=` in a name is a formula and a long number becomes scientific
notation.

---

## 3. Infrastructure and tooling

### ☐ The repair scripts against Supabase itself

`baseline.sql` and `check-schema.sql` are verified against **stock
PostgreSQL 16** — empty, correct-and-run-twice, and damaged, all
identical to a chain-built database, with every row preserved. Supabase
is not stock PostgreSQL. Untested there:

- Whether PostgREST's schema cache picks up new columns without a reload.
  If the check reports clean but the app still 404s a column, that is
  this. `notify pgrst, 'reload schema';` forces it.
- Ownership and role grants: objects created through the SQL editor may
  end up owned differently than migrations create them.
- Whether policies behave identically when `auth.uid()` is real rather
  than the stub.

This is the largest untested claim in the repo, and it sits under the
advice to run one script against production.

### ✅ `check-schema.mjs` via PostgREST/OpenAPI — *covered 2026-09-12*

Its documented primary path had only ever run through `psql`. Now
exercised both ways: reports clean against a matching schema, and
correctly names a column the code declares that the database lacks.

### ✅ The test suite is in the repository — *covered 2026-09-12*

`tests/`, with `npm test`. Paths and ports are all configurable and all
have working defaults; nothing points at a sandbox any more. See
`tests/README.md`.

Moving it found four things that had been broken without anyone noticing,
which is its own argument for the move:

- `form.mjs` tested `/formcheck`, a route that no longer exists. Deleted.
- `mailfail.mjs` asserted on `entrants`, the table the fixed-pool rebuild
  dropped — a fourth remnant of that rebuild, throwing since it landed.
- The same suite had stopped pointing the app at a refusing mail endpoint,
  so it asserted a transport failure while the transport succeeded. Four
  assertions were failing against the send working. The double now has a
  refusal toggle the test flips itself.
- `emaildesign` read files another suite had written; it places its own
  order now.

### ☐ Cloudinary

Unreachable from the sandbox — every proxied host 403s at CONNECT. All
game art and product images are served by route interception in tests.
The real assets have never been loaded by the real site. The hero video
duration probe (`fl_getinfo`) fails here and falls back to a configured
5s; if that is wrong on the real asset the tail frames 404 and the scrub
goes static.

---

## Noted while checking, not yet acted on

Both items previously listed here are done, and both were larger than
they looked:

- **Names carrying `campaign`** — not one but **nine**: six constraints
  (including `games_pkey`, which was still `campaigns_pkey`), two indexes,
  and four policy names visible in the Supabase dashboard.
  `20260921100000_rename_campaign_constraints.sql` renames them all,
  guarded so it is a no-op where they are already right.
- **Order-dependent concurrency tests** — each db suite now creates its
  own database from a template and drops it. The runner also sweeps
  scratch databases a crashed suite left behind, and rebuilds the template
  when the migrations change, because a template that silently predates a
  new migration is the same failure wearing different clothes.

---

## Recently closed

| Item | Closed | What it took |
|---|---|---|
| Draw racing another draw | 2026-09-11 | 10 simultaneous draws, real PostgreSQL, unique index as backstop |
| Second draw on a drawn game | 2026-09-11 | replay verified by row identity, three times |
| Winning spot number on screen | 2026-09-12 | found "Entry 16 of 12" on the filmed screen |
| `check-schema.mjs` OpenAPI path | 2026-09-12 | both clean and drift cases |
| Test suite committed | 2026-09-12 | `npm test`; found four suites broken in place |
| Stale `campaign` names | 2026-09-12 | nine objects, not one |
| Order-dependent db tests | 2026-09-12 | a database per suite, plus a template fingerprint |

---

## Added by the three-surface restructure (2026-09-12)

### ☐ The surface split, seen by a person

`tests/browser/surfaces.mjs` asserts the rules — a firearm never reaches
the Shop even carrying a price, an unpriced t-shirt never reaches the
case, a game's prize leaves the case. What no test can tell you is
whether a visitor understands the three grounds as three contexts. That
needs eyes, on a phone, scrolling.

### ☐ The early-draw guard, used for real

Covered by `tests/browser/earlydraw.mjs` in both routes, including that
it is recorded and shown publicly. What is untested: whether the owner,
on the day, reads the shortfall or taps through it. The second dialog is
deliberately amber rather than red and names a number rather than asking
"are you sure" — that is a judgement about how people read dialogs under
time pressure, and it is a guess until watched.

**The terms do not yet permit an early draw at all.** See
`docs/content-needed.md` §10. Until the attorney adds it, this is a
capability the shop has without permission to use.

### ☐ The per-item postage override, against a real order

The arithmetic is covered. What is not: an actual order where a
tier-priced item and an override-priced item sit in the same basket and
somebody checks the postage against what the Post Office charged.

### ☐ Nothing checks where an order may lawfully be sent

Not "untested" — **absent**. The cart takes a shipping address and ships
anything that is not a firearm. Several states cap magazine capacity and
restrict ammunition, and no rule in the codebase consults the
destination for either.

It is on this list because a green suite should not be read as saying
the shipping rules are covered. They are not implemented, so there is
nothing to cover. `docs/content-needed.md` §12.

### ☐ The demo game, removed before launch

It is marked `[DEMO]` in the title, badged on every public card, and has
a one-click removal. The failure it guards against is nobody removing it.
That is a calendar problem, not a code one.

## Added by the "0 / 5 spots sold" bug (2026-09-12)

Every completed game on the home page read zero sold while spots were
selling. The cause was the games list counting from `game_spots` with the
**anonymous** key: that table is authenticated-only, and row level
security answers an unauthorised select with an empty set rather than an
error. The query succeeded and returned nothing.

It was found by looking at the page. Twenty-one browser suites and three
database suites did not see it, and this is the useful part — there were
two independent reasons, not one.

### ✅ What the anonymous role can actually read — *covered 2026-09-12*

`tests/db/anonreach.mjs`, against real PostgreSQL with the real policies.
It asserts the mechanism (anon sees 0 of 3 sold spots, silently), the
view that replaces it, the freeze, and then does the part that
generalises: it walks every file that uses the anonymous client and fails
if any of them reads a relation anon cannot see. Reverting the fix makes
it fail with `lib/games/queries.ts reads game_spots`.

### ☐ The double implements no row level security at all

**This is the structural gap, and it is still open.** Under the test
double the anonymous key reads everything, so an RLS mistake is invisible
to all twenty-two browser suites by construction — not overlooked,
*unrepresentable*. Confirmed rather than assumed: with the bug
reinstated, the browser suites still pass and only `anonreach` fails.

Two ways to close it, neither done:

- Teach the double a permissions model. Honest, and a lot of surface to
  keep in step with the policies — a stand-in that drifts is worse than
  one that openly does less.
- Run some browser suites against real PostgreSQL through PostgREST.
  Slower, but the stand-in stops being the thing under test.

Until one of them exists, **an RLS question is not answered by `npm
test`.** `anonreach` covers the reads that exist today; it cannot cover a
page that renders correctly but leaks, or a write path RLS should refuse.

### ☐ Whether the live database has the grants this assumes

`anonreach` grants `select` on all public tables to anon before testing,
because the migration chain does not — Supabase does it. So the suite
proves the *policies* are right given Supabase's grants. It does not
prove the live project's grants are what Supabase's defaults say. One
query in the SQL editor settles it, and nobody has run it:

```sql
select c.relname, has_table_privilege('anon', c.oid, 'select') as anon_select
from pg_class c join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relkind in ('r','v') order by 1;
```

### ☐ Counts on the deployed site, by eye

The fix is asserted against the double and against stock PostgreSQL.
Nobody has loaded the real home page since. `test` should read 5 of 5 and
`PRUEBA` 12 of 100.

## An intermittent hydration mismatch, seen only under load (2026-09-12)

**Open. Not diagnosed. Pre-existing — not caused by any change this
round, and worth someone's time before launch.**

On a full `npm test` run, exactly one browser suite fails with:

```
PAGE ERROR Minified React error #418
```

React 418 is a hydration mismatch: the HTML the server sent did not match
what the client produced on hydration, so React throws the server markup
away and re-renders. In production that is a visible flash, and on a slow
phone a real delay on a page that had already painted.

What is known, from three full runs:

- It lands on a **different suite each time** — `tax`, then `intro`, then
  `receipt`. Never the same one twice.
- Every affected suite passes **3/3 in isolation**. It only appears when
  twenty-odd suites are competing for the CPU.
- It is almost certainly present in more suites than it is reported in.
  Only eight register a `pageerror` handler, so the others could hit the
  same thing silently. That the failure moves between exactly those eight
  is the strongest evidence it is one shared cause, not three.

What has been ruled out:

- `components/home/Countdown.tsx` — correct (renders `--` on the server,
  starts ticking after hydration) and **completely unused**; no call
  sites. A dead component, worth deleting on its own merits.
- `components/admin/AdminLogin.tsx` — seeds state from `Date.now()`, but
  only compares it against a lock that starts at zero, so the first
  render matches on both sides.

Where to look next: something in the shared layout, since the error moves
across unrelated pages. A `Date`-dependent or `localStorage`-dependent
render that is normally fast enough to hydrate before it matters would
fit every observation.

**Why it was invisible until now.** Eight suites report an uncaught
browser exception by pushing `PAGE ERROR …` onto the same list as their
assertions, so it counted toward the failure total — but the runner only
printed lines starting with `FAIL `. The tally said something broke and
the output said nothing did. Fixed in `40ec7cc`; this is the first
finding it surfaced.

## Still carried in the top three

1. **A genuinely declined card.** In progress.
2. **The repair scripts against Supabase**, not stock PostgreSQL. Now the
   largest untested claim in the repo by a distance.
3. **The double has no row level security**, so no browser suite can see
   an RLS mistake. New, and it has already cost one production bug.

Close behind: the intermittent hydration mismatch above. It is not a
launch blocker on its own, but it is a real defect that shipped without
anyone noticing, and it is the kind that gets worse on the cheap phones
this shop's customers actually use.
