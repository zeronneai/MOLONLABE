# The guide

## What it is

The customer buys a written guide to the piece. Everything else follows
from that sentence, so it is worth being exact about which parts of the
document are which.

**Assembled, from the catalogue.** The item's name, brand, category,
short description, long description, specifications and photographs. The
owner types none of it twice; it is already on the item.

**Written, by the owner, per game.** Three sections, and they are the
whole difference between a guide and the product page with a border round
it:

| Column | The question | Heading in the PDF |
|---|---|---|
| `guide_why` | Why he chose this piece | WHY THIS ONE |
| `guide_care` | Maintenance and handling | LOOKING AFTER IT |
| `guide_pairs` | What he would pair with it | WHAT WE WOULD PAIR WITH IT |

**Deliberately absent.** Anything about the drawing, what a spot is, or
what the purchase entitles anybody to. That wording is the attorney's.
A document free to describe the arrangement in its own words would be a
fourth version of it, able to contradict the terms, the receipt and the
email. The guide is about the piece; the receipt and the confirmation
email say what was bought.

---

## The storage bucket — what to create

One bucket, created once, by hand in the Supabase dashboard (Storage →
New bucket) or by applying
`supabase/migrations/20260926100000_game_guides.sql`, which does the same
thing idempotently.

| Setting | Value |
|---|---|
| Name | `game-guides` |
| Public bucket | **OFF** |
| Allowed MIME types | `application/pdf` |
| File size limit | 10 MB |
| Policies | **none at all** |

### Why no policies

This is the part that matters, and it is not an omission.

The bucket is reached **only** by the server holding the service role
key, which bypasses storage row level security entirely. There are two
doors into a guide and the app guards both:

- `/guide/<order>.pdf?t=<token>` checks the order number and the
  confirmation token — the same credential the receipt page checks, with
  the same expiry — and then streams the bytes.
- `/admin/games/<id>/guide.pdf` checks the owner's session.

Adding a `select` policy for `anon` or `authenticated` would undo both at
once. A public bucket would be worse still: guides are named by game id,
so a public bucket makes every guide readable to anyone who can guess
one, and the guide is the thing people are paying for.

A signed storage URL was the other option and it is worse for the same
reason it looks convenient. It is a second credential with its own
lifetime, handed out beside the one the buyer already has, and it goes on
working after the receipt link it came from has expired. Streaming
through the app means one door, one expiry, and one thing to reason
about.

### It is not in the baseline

`supabase/repair/baseline.sql` is generated from the `public` schema and
carries no buckets — the same is true of `product-images`. Repairing a
database does not recreate the bucket. If you have rebuilt a project from
the baseline, create the bucket again.

---

## When it is built

Lazily, on the first purchase into a game, and again whenever anything it
is made of changes.

`guide_fingerprint` is a hash over every single thing that appears on the
page: the three owner sections, the item's name, brand, copy,
specifications and photograph URLs, and `GUIDE_VERSION` in
`lib/guides/build.ts`. If any of them moves, the hash moves, and the next
read rebuilds. Nothing has to remember to invalidate anything, which is
the only version of this that stays true.

Two consequences worth knowing:

**Change the document and you must bump `GUIDE_VERSION`.** It is part of
the fingerprint. Without a bump, a redesign applies only to games created
afterwards and the shop hands out two different documents.

**A photograph replaced at the same URL will not be noticed.** The hash
covers image URLs, not image bytes — hashing the bytes would mean
downloading four photographs to answer "does this need rebuilding?" on
every request. Cloudinary and the product-images bucket both mint a new
URL per upload, so this is theoretical rather than likely.

Where it is built from:

- `app/actions/checkout.ts`, after the spots are sold, so the first
  buyer's link is already warm. It can never fail the order — the card
  has been charged, and a PDF that will not render is not a reason to
  tell somebody their payment went wrong. The owner is notified instead.
- `app/guide/[order]/route.ts` and the admin preview, both of which build
  on demand. That is what makes the link self-healing: a build that
  failed during checkout, or an owner who fixed a typo an hour ago,
  resolves itself the next time anybody follows it.

---

## Why a game cannot be published without one

`saveGame` refuses to create a game, **and refuses to save one
afterwards**, with any of the three sections empty or shorter than 40
characters. `lib/guides/fields.ts` holds the one definition the form, the
action, the PDF and the test all read.

Creating a game lays out its spots and opens it for sale in the same
breath — there is no draft state — so creation *is* publication, and the
refusal has to happen there. Refusing on edit as well is what stops the
rule being decorative: a game that could be emptied out afterwards is not
a rule, it is a formality at the door.

Forty characters is a floor under "n/a" rather than a style rule. It is
one plain sentence, which is the least that can honestly answer any of
the three questions. The form counts as the owner types, so nobody meets
it by accident or misses it by one.

**Existing games predate the columns.** A game created before this will
refuse to save until its three sections are filled in, and its guide
cannot be built until then — the owner gets the reason, not a status
code, on the preview link and in the notification.

---

## Typography

`lib/guides/theme.ts` is the design system transcribed a third time —
`lib/email/theme.ts` does the same job for mail. There is no CSS and no
cascade in `@react-pdf/renderer`, so the site's classes cannot be reused.

Two conversions to know about:

- **Points, not pixels.** A PDF point is 1/72 inch, a CSS pixel 1/96, so
  every size is the site's figure times 0.75. Using the px numbers
  directly produces a document a third too big.
- **Letter-spacing is absolute.** The site tracks display type at
  `-0.035em` and labels at `0.28em`, both relative to the font size.
  `letterSpacing` in react-pdf is a flat number of points, so each size
  carries its own figure, computed rather than typed in.

### The fonts are checked in

Three TTFs in `lib/guides/fonts/`, with `OFL.txt`. `next/font/google`
gives the site WOFF2, and fontkit — which is what react-pdf parses fonts
with — does not read WOFF2, so the site's copies are useless here.
Fetching them at render time was the alternative and it is worse: it puts
a network call on the critical path of something a customer has already
paid for, and it fails at exactly the moment nobody is looking.

They are read from disk at render time, so `next.config.ts` names them in
`outputFileTracingIncludes` — file tracing cannot see a `readFileSync` of
a path built at runtime, and a standalone build would otherwise ship
without them. If they cannot be read the guide is still produced, in
Helvetica, and says so loudly on the console. That is the wrong typeface
and a great deal better than a paid-for download that 500s.

### The guide is dark

Like the site and like the email. It is delivered as a link and read on a
phone, which is where a dark page looks like the brand and a white one
looks like an invoice. The cost is printing: somebody who sends this to a
printer gets a page of ink. If that turns out to matter, `GUIDE_COLORS`
in `lib/guides/theme.ts` is the only thing that has to change — swap
`ink` and `bone`, darken `muted`, and every page follows.

---

## The deployment bug, and the check that exists because of it

The first deployment of the guide failed on a live purchase:

```
Error: Cannot find module '/var/task/node_modules/pdfkit/js/standard-fonts/Helvetica.cjs'
code: MODULE_NOT_FOUND
```

### Why nothing saw it coming

`@react-pdf/renderer` carries pdfkit, and pdfkit reaches its standard
fonts like this:

```js
const require$1 = module.createRequire(pathToFileURL(__filename));
registerStdFontLoaders({
  Helvetica: () => require$1('#standard-fonts/Helvetica'),
  …
});
```

A require built at runtime, of a `#`-prefixed subpath resolved through
pdfkit's own `package.json` `imports` map. There is no import statement to
follow and no literal path to see, so Next's file tracer does not ship the
files. The build succeeds, the bundle is short, and it fails deployed.

`serverExternalPackages: ["@react-pdf/renderer"]` was already set and did
not help. It stops the package being bundled; it does not make the tracer
find files nothing points at. The fix is `outputFileTracingIncludes`.

### The part that made it dangerous

react-pdf loads those fonts **eagerly, when the module is imported**:

```
$ node -e "import('@react-pdf/renderer')"
import resolved
UNHANDLED REJECTION: MODULE_NOT_FOUND … pdfkit/js/standard-fonts/Helvetica.cjs
UNHANDLED REJECTION: MODULE_NOT_FOUND …
UNHANDLED REJECTION: MODULE_NOT_FOUND …
UNHANDLED REJECTION: MODULE_NOT_FOUND …
```

Four rejections attached to no promise. No `try`/`catch` downstream can
reach them; the import itself resolves cleanly. Next's dev and standalone
servers install a handler and log `⨯ unhandledRejection`, which is why
this is invisible locally. A serverless runtime is entitled to kill the
invocation instead.

So the danger was never in the call — it was in **which module graph the
import sat in**. `app/actions/checkout.ts` imported it, so the one action
that charges cards could be taken down by a font file.

### What changed

The guide is no longer built during the transaction. `checkout.ts`:

- imports `lib/guides/availability.ts`, which reads the row and renders
  nothing, to decide whether to promise a guide in the email;
- builds the guide in `after()`, **behind a dynamic import**, once the
  response has gone and after `finish_checkout` has settled the
  idempotency key;
- wraps that in a `try`/`catch`, and treats failure as a notification
  rather than an error.

If all of that fails, nothing is lost: `/guide` builds on demand, so the
customer's link produces the document the first time they follow it. The
warm-up is a convenience, not the delivery.

`tests/browser/guide.mjs` asserts from the source that checkout has no
static import of the renderer, that it reaches it dynamically, and that it
does so inside `afterResponse` — and points the same search at
`app/guide/[order]/route.ts`, where the import must be found, so a clean
result cannot come from a broken regex.

### The check runs in the build, not on anybody's memory

```json
"build": "next build && node scripts/check-bundle.mjs"
```

The browser suite runs against the repository, where every file is present
whether or not the build traced it, so it is structurally blind to this.
The check is therefore part of the build itself. A missing file exits
non-zero, `npm run build` fails, and **the deployment does not happen** —
which is the only version of this that survives a busy week. There is no
CI in this repository and no `vercel.json`; the build command is the hook,
and it is the one every deployment goes through.

```
$ npm run build
…
PASS the build has entry points carrying the PDF renderer — 3 of 38
PASS every entry carrying the renderer also carries node_modules/pdfkit/js/standard-fonts/chunks/
PASS all fourteen standard fonts travel, not just the one we name — 14 in each
PASS the renderer works from (site)/checkout/page's files alone — RESULT: rendered 3498 bytes, no rejections
PASS the renderer works from admin/games/[id]/guide.pdf/route's files alone — …

bundle check: 9 passed, 0 failed
```

It costs **about 1.7 seconds** on a 40-second build. That number is the
point: a check that noticeably slowed the build is a check somebody
eventually takes out of it.

`npm run check:bundle` runs the same thing against an existing build,
without rebuilding, for when you are iterating on the trace list.

#### How it works, and why not `output: "standalone"`

`.next/server/**/*.nft.json` is the list of files the build decided each
entry point needs — and it is the same list a serverless platform
assembles that function from, one function at a time. The check reads
those lists, asserts what must be in them, then **materialises one entry's
files into a temporary directory and renders a page from inside it**, with
the working directory set to that directory so `process.cwd()` resolves as
it does in `/var/task` and the repository's `node_modules` is off the
resolution path.

Per entry, from the trace, rather than one `output: "standalone"` build of
everything: it is closer to what actually gets deployed, it needs no
second build, and it can tell one entry from another. It did, immediately
— removing the Archivo line from `outputFileTracingIncludes` fails the
checkout entry and **passes** the guide route, because the tracer's static
analysis can follow `join(process.cwd(), "lib", "guides", "fonts")` in a
directly imported module but not through the dynamic import checkout uses.
A whole-bundle check would have called that fine.

Nothing here is keyed on a list of route names. "The entries that carry
the renderer" is derived from what each trace contains, because a
hand-kept list of routes goes stale in silence — the same disease as the
bug it is guarding. There is one assertion whose only job is to fail if
that derivation ever finds nothing, so the check cannot quietly stop
checking.

#### Why reading the trace is not enough on its own

The probe is the assertion that matters. The first fix shipped all
fourteen standard fonts and still failed on the deployment, because each
of them requires a shared chunk from a `chunks/` subdirectory beside it
and the glob only went one level deep. Counting traced files said
everything was present. Running the code said otherwise.

Both failure modes are verified by putting the bug back:

| Sabotage | What the build says |
|---|---|
| glob back to one level | `FAIL … carries standard-fonts/chunks/` and `RESULT: threw — Cannot find module './chunks/standardGlyphNames-…'` |
| Archivo line removed | `FAIL … carries Archivo-Regular.ttf — missing from (site)/checkout/page` and `RESULT: threw — ENOENT … Archivo-Regular.ttf` |

Both exit 1.

## Two traps found the hard way

**A `render` prop plus a `lineHeight` produces nothing.** `render` makes
text dynamic, and react-pdf re-measures dynamic text from a forced height
of zero. With an explicit line height it measures to nothing and the text
silently does not appear — no error, no warning, just a missing page
number. Found by bisecting the label style; every other property in the
scale is fine.

**`Font.register` needs a string, not a Buffer.** It tests `src` for a
data: prefix before anything else, so a Buffer fails with
`dataUrl.substring is not a function`. An absolute path is what to pass;
checking the file exists first is what turns a missing font into the
Helvetica fallback rather than into that message.

---

## Reading a guide back in a test

`tests/lib/pdf.mjs`, no external tool. The obvious approach — inflate the
content stream and pull the strings out — returns nonsense, because the
fonts are subset and the text is written as glyph ids that mean something
different in each of the three weights. The decoder follows each font's
`/ToUnicode` CMap and tracks which font was selected when each string was
drawn.

One trap in there too: pdfkit writes its CMap in the **array** form of
`bfrange`,

```
<0000> <001d> [<0000> <004d> <004f> <004c> ...]
```

and reading that as the counting form — which is what a
three-angle-bracket regex does — turns every heading in the document into
a substitution cipher. It still looks like text, which is why it is worth
knowing.

Use `pdfFlatText` for anything longer than a word. A PDF has no idea what
a line is; react-pdf emits a separate text object per styled run, so a
specification value like "5.56 NATO" can legitimately come back split
across two of them.
