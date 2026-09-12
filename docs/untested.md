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

### ☐ The test suite is not in the repository

About 4,000 lines across ~30 files — the double, the concurrency tests,
the checkout and draw suites — live only in an ephemeral sandbox, with
hardcoded paths to it. Everything this document calls "covered" is
covered by code that does not survive the session.

The cost is not theoretical. Re-verifying the concurrency claims above,
in order to write this file honestly, meant rebuilding a PostgreSQL
cluster and replaying all fourteen migrations first, because the previous
one had been reclaimed. A claim that expensive to re-check is a claim
that will stop being re-checked.

This is the same class of problem as the drift: the evidence has to
outlive the person holding it. Committing it means parameterising the
paths and adding a runner — an afternoon, not a day. **Ask when you want
it done; it is not a decision to make silently.**

### ☐ Cloudinary

Unreachable from the sandbox — every proxied host 403s at CONNECT. All
game art and product images are served by route interception in tests.
The real assets have never been loaded by the real site. The hero video
duration probe (`fl_getinfo`) fails here and falls back to a configured
5s; if that is wrong on the real asset the tail frames 404 and the scrub
goes static.

---

## Noted while checking, not yet acted on

- **Constraint names still say `campaign`.** `winners_campaign_id_fkey`
  survives on the renamed column, because renaming a column does not
  rename its constraint. Purely cosmetic — it enforces the right thing —
  but it will confuse whoever reads an error message naming it. Worth a
  line in a future migration; not worth one of its own.
- **Two concurrency tests share one database** and the first leaves rows
  the second trips over. A fixture problem, not a product one, but it
  means the suite's result depends on the order it is run in. Fix when
  the suite is committed.

---

## Recently closed

| Item | Closed | What it took |
|---|---|---|
| Draw racing another draw | 2026-09-11 | 10 simultaneous draws, real PostgreSQL, unique index as backstop |
| Second draw on a drawn game | 2026-09-11 | replay verified by row identity, three times |
| Winning spot number on screen | 2026-09-12 | found "Entry 16 of 12" on the filmed screen |
| `check-schema.mjs` OpenAPI path | 2026-09-12 | both clean and drift cases |

## Still carried in the top three

1. **A genuinely declined card.** In progress.
2. **The repair scripts against Supabase**, not stock PostgreSQL.
3. **The suite committed to the repository**, so "covered" means
   something after this session ends.
