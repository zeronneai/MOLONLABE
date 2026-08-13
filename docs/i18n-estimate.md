# Bilingual (EN/ES) — estimate, not a plan yet

Nothing here is built. This is the number to decide against.

## The count

370 user-visible strings across 66 files, counted by scanning JSX text
nodes and copy-bearing attributes (`placeholder`, `aria-label`, `alt`,
label and body props). Deliberately excludes class names, ids and
non-prose literals.

| Area | Strings | Notes |
| --- | ---: | --- |
| Public site | 215 | The client-facing promise. Includes the rules page (27) and the featured/entry flow (32). |
| Admin | 145 | One owner, who speaks English. Almost certainly out of scope — see below. |
| Intro game | 10 | READY/GO, result cards, the offer copy. |

Heaviest files: `sweepstakes-rules` (27), `featured` (22),
`admin/ItemForm` (19), `admin/actions` (16), `admin/GameOfferControls`
(14), `transfers` (13).

Three caveats on that number:

- It counts strings, not words. The rules page is 27 strings but the
  longest prose on the site, and it is also the one page where a
  mistranslation has legal consequences.
- ~40 of the public strings are single words on controls ("Call",
  "Home", "Retry"). Cheap.
- It does not count copy that lives in the database — item names,
  descriptions and specs. That is a **separate and larger question**, see
  below.

## The real scope question: database copy

Every item name, short description, long description and spec key is
English text the owner types into the admin. Translating the chrome
around an item while its description stays in English is a half-finished
site, and this is the part most likely to be what the client actually
meant by "bilingual copy on every page".

Two options:

1. **Chrome only.** UI, labels and static page copy translated; item
   content stays as the owner typed it. Honest, cheap, and visibly
   incomplete on exactly the pages that matter most.
2. **Content too.** Add `name_es`, `short_desc_es`, `long_desc_es` to
   `items` and equivalent fields on `campaigns`, plus a second set of
   inputs in the admin. Doubles the owner's data entry forever, which he
   will stop doing by week three unless someone owns it.

**This needs a decision from the client before I build anything.** I'd
recommend option 1 for launch with the fields added but optional, so
option 2 can be turned on later without a migration scramble.

## Approach I'd take

**Routing: `/es` prefix, not a cookie or a client-side toggle.**
`app/[lang]/…` with `en` as the default and no prefix, `es` prefixed.
Reasons: each language gets a real indexable URL, `hreflang` works,
sharing a Spanish link keeps it Spanish, and Next's middleware can pick a
default from `Accept-Language` on first visit without trapping anyone.
A cookie-based switch is less work and produces one URL serving two
languages, which is bad for SEO and worse for sharing.

**Dictionary: one file per language, typed against English.**

```ts
// content/en.ts — the source of truth
export const en = { nav: { inventory: "Inventory" /* … */ } } as const;
// content/es.ts — must satisfy the same shape or it fails to compile
export const es: typeof en = { nav: { inventory: "Inventario" /* … */ } };
```

Typing `es` as `typeof en` means a missing Spanish string is a build
error, not a blank on the page. That is the single highest-value decision
here.

**Server components read the dictionary directly** from the `lang` param;
only the handful of client components need it passed as props. No
provider, no hook, no runtime lookup cost.

**Language switch** in the header, next to Visit: two text labels, the
active one acid, matching the inventory filter treatment.

## Effort

Assuming option 1 (chrome only), and that translation comes back as a
filled spreadsheet rather than something I invent:

| Task | Estimate |
| --- | --- |
| Route restructure to `app/[lang]/…`, middleware, `hreflang`, sitemap entries | 1 day |
| Extract 215 public strings into the typed dictionary | 1.5 days |
| Language switcher, plus per-language metadata and OG | 0.5 day |
| Wire the Spanish file in, QA both languages on every route and both breakpoints | 1 day |
| **Total** | **~4 days** |

Add **1.5 days** for the admin's 145 strings if the owner wants it, which
I would push back on.
Add **2–3 days** for option 2 (database content), including the migration,
the admin's second input set, and the fallback logic when a Spanish field
is empty.

Not included: the translation itself. The rules page must be translated
by the attorney or a legal translator, not by me and not by a general
translator — it is the one page where a wrong word is a liability.

## What I would not do

- Machine translation at runtime. It reads like machine translation, and
  on a firearms compliance page that is a real risk.
- A client-side toggle that swaps strings without changing the URL.
- Translating the intro game's arcade copy (READY, GO, NICE TRY). It is
  deliberately arcade-cabinet English; translating it costs the joke and
  gains nothing. Worth confirming with the client, but that is my
  recommendation.
