# Handover

Molon Labe Firearms x SunCity Outdoors. Current as of the
`claude/intro-arcade-game-scaffold-5nh29e` branch.

---

## 1. What the site does

### Public pages

**Home.** Scrolling hero video, the current game, newly arrived stock, a
look into the case, past winners, the shop story, brands, and where to
find the shop. Everything on it links somewhere else.

**Shop.** Everything the shop sells online: apparel, accessories,
ammunition, optics. A visitor can browse, open any item, and add it to a
cart. Items with no price are hidden here.

**In the case.** Firearms on the shelf. A visitor can look and send an
enquiry. There is no price and no buy button, on purpose: firearms are
sold in person through the counter.

**Item page.** Photographs, description, specifications, and either an
add-to-cart control or an enquiry form depending on which surface the
item belongs to. Apparel shows a size picker and greys out sizes that are
out of stock. An item that is currently the featured piece in a running drop
shows "NOT FOR SALE" instead of either. Once its drop is drawn, the piece
leaves the website for good: no listing, no page, not in the sitemap,
refused by the cart. The draw sets it to hidden; "Prize claimed" on the
drop's admin page marks it sold. An unclaimed piece is sold in the shop.

**The featured drop.** The drop currently running: the featured piece,
what a guide costs, how many guides are left, and a control to get one
or more. Each guide comes with entry into the drawing. A sold-out drop
says so and says the draw is next. Past winners are listed underneath by
first name and last initial.

**Drops.** Every drop in three groups: open now, sold out and awaiting
the draw, and finished with the winner shown.

**Cart.** What the visitor has picked, split into things that ship and
things collected at the shop, with quantities adjustable and a running
total. Collection lines carry a notice that paying online does not
complete a firearm sale.

**Checkout.** Name, email, phone, a shipping address when anything ships,
and card details. The card goes straight from the browser to
Authorize.net and never touches the shop's server. Tax and shipping are
calculated by the site, not typed in. The visitor must tick the firearms
disclaimer, and a second box for the drop's terms when the cart holds
guides.

**Order confirmation.** What was bought, what was paid, the guide
numbers if any, the link to the guide, and the exact terms
that were accepted. Reachable later from the link in the confirmation
email, for one year.

**The guide.** A PDF about the featured piece, produced for each drop,
given to anyone who buys a guide. Linked from the confirmation page and the
confirmation email. Contains the piece's name, brand, specifications and
description, its photographs, and three sections the owner writes.

**Services.** What the shop does beyond selling: currently FFL transfers
only. Needs the real list of services from the client.

**FFL transfers.** How a transfer works, in steps, with a form to start
one.

**Visit.** Address, hours, phone, directions.

**Sweepstakes rules.** The full written rules. Three clauses are marked
as outstanding on the page itself and need answers from the shop. The
page is hidden from search engines until launch.

**Privacy policy.** Drafted, live, linked in the footer, hidden from
search engines, and not yet reviewed by the attorney. One gap left
deliberately: how long data is kept.

**Age gate.** A first-visit question on every page. Anyone saying they
are under 21 is turned away.

**Arcade game.** A short shooting game that runs before the site on every
visit, skippable with Escape or a button. Winning issues a discount code,
once per visitor, and only while the offer is switched on in the admin.
When the offer is off, nothing about the code reaches the visitor's
browser at all. Whether it is on today depends on the live setting.

### Admin screens

Reached by typing the address. There is no link to it anywhere on the
site, no way to sign up, and no password reset link.

**Sign in.** Email and password.

**Two roles.** Owner and manager, set per account in the database. The
owner can do everything. The manager can do the day-to-day work but
cannot delete anything permanently, change tax, shipping, the discount
code, the offer switch or the arcade, download the spot list, read the
activity log, or manage accounts. Those controls are shown to him
disabled with the line "Owner only. Ask the owner if this needs
changing." The database refuses them for him as well, not just the
screen. An account that can sign in but has no role sees "No access".
The header shows who is signed in and as what. Full table in
`docs/roles.md`.

**What you sell.** Four sections: things for sale, games, items currently
used as prizes, and firearms in the case. The owner can search, filter by
status, add an item, edit one, reorder them, mark one available, reserved
or sold, duplicate one, and archive one.

**Add or edit an item.** Name, category, brand, descriptions,
specifications, price, how it is fulfilled, sizes and stock for apparel,
photographs, and a video link. The form shows only the price field that
applies to the category.

**Drops.** Every drop with how many guides have sold.

**New drop.** Pick the featured piece, set how many guides and what a
guide costs, and write the three guide sections. The two numbers are
permanent once the drop exists. The screen shows what the drop takes if
it sells out against what the prize is worth. **The drop cannot be created until all
three guide sections are written**, because that is what the customer is
paying for.

**Edit a drop.** The title, description, the three guide sections and the
note shown after the draw. The number of guides and the price cannot be changed. A
button opens the guide exactly as a customer sees it, and another rebuilds
it. If the last guide came out with fewer photographs than the item has,
the screen says so in red.

**Guides sold.** Who holds which guide number, with an export to a spreadsheet.
The export is owner only.

**Draw a winner.** Two ways: a full-screen presentation at a separate
address for filming, or a plain button. The presentation plays what rules
clause 14 promises. First a roster of every buyer (first name and last
initial, with their guide count and the total against guides sold), paged,
with nothing left off; the Spin button does not exist until every page has
been on screen. Then a wheel with one wedge per buyer, sized by the guides
they hold, which stops on the winner. The draw is recorded when Spin is
pressed, before the wheel turns, and is refused if any guide sold after the
roster was shown. Drawing twice returns the same
winner rather than picking a second one. There is no early draw: until
every guide is sold the drop page offers only a rehearsal of the
presentation, the server refuses a draw, and the database refuses to
record a winner, for the owner and the manager alike. Buyers who have not
agreed at checkout to be named on the broadcast (everyone who paid before
26 September) are on the roster and the wheel by guide number, and the
drop page says how many there are before filming. After the draw the
drop's page shows the winner's name, email, phone, guide number and order number,
so whoever ran the draw can contact them.

**Orders.** Every order with what was bought, what was paid, and the card
details the gateway returned.

**Inquiries.** Everything sent through the site's forms.

**Arcade & offer.** Turn the discount code on or off, set the code and
what it is worth, and tune how hard the game is on desktop and mobile.

**Tax & shipping.** The sales tax rate and the two shipping prices. The
shipping figures are marked on screen as not yet decided by the client.

**Activity.** A log of what was changed in the admin, by whom and when,
filterable by person. Every change is logged, including plain
description edits, photographs, sizes and stock, inquiry status and guide
rebuilds. The name on each line comes from the staff table and is
stamped by the database, so nobody can sign a line as somebody else.
Owner only.

**Team & alerts.** Who has access and as what, and who receives each of
the two kinds of alert: problems with an order, and everything else. A
button sends a test through the real Apps Script and reports who it
reached. Owner only.

---

## 2. What has to happen before launch

### Purple Roots

1. Apply migration `20260927100000_guide_image_count.sql` to the live
   database. It was missing; the admin's photograph count depends on it.
   Then apply `20260928100000_staff_roles.sql`. Steps and checks are in
   `docs/roles.md`. Every account that exists when it runs becomes an
   owner. Then apply `20260929100000_no_early_draw.sql`, the newest of
   23: it is what stops a winner being recorded before a drop sells out,
   for anyone, and without it the manager could still do that by calling
   the database directly. It changes no data. `npm run check:schema`
   checks columns only and will not notice if it is missing.
2. **Before 15 October**, create the manager's account and give it the
   manager role, in that order and after step 1. `docs/roles.md`,
   "Creating the manager's account". Then sign in as him once and check
   that Tax & Shipping is greyed out.
3. Replace the Apps Script with `docs/apps-script/Code.gs`, set its
   `DEFAULT_TO`, run `setupCheck()` once in the editor, and redeploy the
   existing deployment as a new version. Until then the recipient
   lists in Team & alerts do nothing. Then put the manager's address in
   the problems list and press Send a test for both lists.
4. Turn off "Allow new users to sign up" in Supabase Authentication.
5. Run `npm run check:schema` against the live database and apply
   anything else it reports, in filename order.
6. Drop the `items.surface` column that was added by hand. No code reads
   it.
7. Create the `game-guides` storage bucket in Supabase: not public,
   `application/pdf` only, 10 MB limit, and no policies at all.
8. Set `NEXT_PUBLIC_AUTHORIZENET_ENV=production` and put the live
   Authorize.net API Login ID, Transaction Key and Public Client Key in
   the deployment's environment.
9. Set `NEXT_PUBLIC_SITE_URL` to the live domain before the build runs,
   not after. The domain is molonlabeguns.com. Production already builds
   with `https://molonlabeguns.com`, but Vercel redirects that address to
   `https://www.molonlabeguns.com`, so every canonical link and every
   sitemap entry points at a redirect. Either make the bare domain the
   primary one in Vercel, or set this to the `www` address and rebuild.
10. Set `GOOGLE_SCRIPT_URL` to the deployed Apps Script, and confirm a
   test order produces both the customer email and the owner
   notification.
11. Set `NEXT_PUBLIC_GA_MEASUREMENT_ID`, or leave it unset deliberately.
12. Put the agency's real phone number in `AGENCY_CONTACT`. It currently
   reads "(number to be supplied)" and is printed in the alert the owner
   gets if a card is charged and the order fails to save.
13. Buy one real guide on the live site with a real card, confirm the
    order, the email, the guide numbers and the guide, then refund it.
14. Run one declined card (`4000 0000 0000 0002` in sandbox) and confirm
    a second attempt with a good card succeeds.
15. Run `npm run audit:cloudinary -- --check` and re-upload anything it
    reports as dead.
16. Delete any demo game. A game whose title starts with `[DEMO]` still
    appears on the public site, carrying an amber DEMO badge. It is
    labelled, not hidden.
17. Delete `components/home/Countdown.tsx`. It is correct and nothing
    uses it.
18. Take the `noindex` off the rules and privacy pages once the attorney
    has approved them.
19. Run Lighthouse against the live site and record the numbers.

### The client

1. Confirm the two shipping prices. They are currently $10 standard and
   $20 oversize, both invented.
2. Confirm the sales tax rate of 8.25%.
3. Confirm the seven rules clauses drafted on 26 September (03, 07, 08,
   09, 12, 13 and 22). They are published marked "Wording to be
   confirmed"; `docs/wording.md` has the text. Clause 14, how the winner
   is picked, was decided on 25 September.
4. Supply the final wording for the refund line. It currently reads "All
   sales are final. No refunds or exchanges." and that is our wording,
   not theirs.
5. Supply the real list of services. The page currently claims FFL
   transfers and nothing else.
6. Read the shop story, the hero lines and the empty states, and correct
   anything that does not sound like the shop.
7. Supply a photograph of the actual storefront to replace the
   atmospheric stand-in, and confirm or correct its alt text.
8. Confirm whether the shop's phone line has WhatsApp. Every WhatsApp
   button is switched off until it does.
9. Decide whether the arcade discount code is on at launch, and what the
   code and the reward are.
10. Replace the four seeded catalogue items with real stock.
11. Write the three guide sections for every game before it goes on sale.
    The admin will not let a game be created without them.
12. Supply the Authorize.net production credentials.
13. Give us the manager's name as it should appear in the log, and the
    email address his account should use, before 15 October.

### The client's attorney

**Buyers' names on a public broadcast.** Rules clause 14 puts buyers'
first names and last initials on screen in a video posted to Instagram.
Since 26 September checkout asks every buyer to acknowledge it, in the
client's words, with its own required box, and the acknowledgement is
stored on the order with the other terms. The privacy policy says the
same. Buyers who paid before then did not agree, and appear on the
roster and wheel by guide number instead of by name. The attorney should
review the acknowledgement and the privacy policy section.

1. Review and approve the sweepstakes rules, after the client has
   answered the three questions above.
2. Review and approve the privacy policy, and set the data retention
   period, which is deliberately left blank.
3. Approve or rewrite the refund line.
4. Approve or rewrite the pickup notice, which says that paying online
   does not complete a firearm sale. That wording is ours.
5. Review the rules as the client edited them on 25 and 26 September,
   and the seven drafts marked "Wording to be confirmed".
   `docs/wording.md` lists what changed and what is open.
6. Confirm the checkout terms (`2026-09-agency-4`): the early-draw
   sentence is gone and the broadcast acknowledgement is new. They are
   stored on every order.

---

## 3. Open questions

1. Five places where "guide" reads worse, listed in `docs/wording.md`:
   buying several copies of one guide, "your guide" twice in the email,
   "five guides, five chances", "guide" meaning both the document and
   the purchase in the admin, and held guide numbers in the alerts.
2. Answered 25 September: the winner has one week from being contacted;
   an unclaimed prize is sold in store only and never listed online
   again; there is no state limit beyond the eligibility paragraph.
3. Answered 26 September: there is no early draw anywhere, and clause
   02 is cut because the eligibility paragraph covers it.
4. The privacy policy said no address or payment details were collected
   and that only the owner could see submissions. Neither was still
   true; both were corrected on 26 September. The attorney should read
   the whole page again rather than only the new section.
5. Should the guide mention the drawing at all, or stay purely about the
   piece? It currently says nothing about it, deliberately, because that
   wording is unsettled.
6. Spanish: build it or not? 370 strings are counted and costed in
   `docs/i18n-estimate.md`. Nothing is built.
7. Does the shop want the arcade discount code live at launch, or held
   back?
8. Should the guide be a dark document or a light one? It is dark now,
   matching the site, which is right on a phone and heavy on a printer.
   Changing it is one edit.
9. Does the owner want to be emailed when a guide comes out short of
   photographs, or is the red warning in the admin enough? Both happen
   today.
10. Is a fifteen-minute hold on an unpaid spot the right length?
11. Should archived items keep their slugs? An archived item still blocks
    its slug, so re-adding a product under the same name fails until the
    old one is renamed.

---

## 4. Known risks

### Not verified on a real deployment

- **The guide's photographs.** The path has failed three times in
  production and been fixed three times. What is verified locally: a real
  WebP is converted, embedded as JPEG, and drawn at a visible size inside
  the page, in the document a customer is actually handed. What is not
  verified: any of that on the live site. **Buy one spot and open the
  guide before trusting it.**
- **Cloudinary photographs.** The older catalogue entries still point at
  Cloudinary, and every outbound host is blocked from the environment
  this was built in, so no guide produced during development has ever
  contained one. `npm run audit:cloudinary -- --check` lists them and
  fetches each one.
- **The storage bucket.** Nothing in the test suite has ever talked to
  Supabase Storage. The stand-in models the shape of the API, not its
  permissions. Confirm that an anonymous request for a guide by URL gets
  nothing.
- **The repair scripts against Supabase.** `baseline.sql` and
  `check-schema.sql` are verified against stock PostgreSQL 16, not
  against Supabase. PostgREST's schema cache, object ownership through
  the SQL editor, and policy behaviour with a real `auth.uid()` are all
  untested. This sits under the advice to run one script against
  production.
- **Roles on Supabase itself.** The policies are proven against stock
  PostgreSQL 16, acting as each role through the same JWT claim Supabase
  uses. Not against a Supabase project. Once applied, sign in as the
  manager and try one owner-only thing.
- **Alert routing.** The site sends the recipient list; the Apps Script
  decides. Until the script is updated, every alert still goes to its
  usual address and the lists do nothing. The Send a test button says
  which is happening.
- **A declined card.** Only approval has ever been exercised. The path
  that matters is that a declined card releases the idempotency key so an
  honest second attempt is not refused as a duplicate.
- **The confirmation email arriving.** The payload is asserted in detail.
  Whether Apps Script delivers it to a real inbox is not. A success there
  means the script accepted it, not that Gmail delivered it.
- **Email in a real client.** Checked in a headless browser against
  Gmail's clipping threshold, dark mode and blocked images. Never opened
  in real Gmail, Outlook or Apple Mail.
- **A guide opened on a phone.** It is sent as a link and will be read
  almost entirely on handsets. Nobody has opened one on a real phone.
- **Presentation-mode draw on a real phone.** Frame budget numbers exist;
  a recording does not.
- **The CSV export in Excel.** Generated and asserted as text, never
  opened in Excel, where a leading `+` or `=` in a name is a formula.

### Working today but fragile

- **A missing migration is invisible.** The app does not check the live
  schema and does not say which migration is missing. A missing column
  has so far produced a blank space in a PDF, a save that failed with
  "try again", and a count that never rendered. None pointed at the
  cause. There is a manual `npm run check:schema`; nothing runs
  automatically.
- **Files loaded by a path at runtime.** The PDF renderer reaches its
  fonts, and sharp reaches its native binary, by paths built at run time
  that the build cannot see. This has broken a live checkout once.
  `npm run build` now assembles the deployed file set and renders from
  inside it, and fails the build if anything is missing. That guard only
  covers entries carrying the PDF renderer; a future dependency that
  opens files elsewhere is not covered.
- **The guide is cached by fingerprint.** A guide rebuilds only when its
  inputs or the renderer change. That fingerprint failed to cover the
  renderer once, and every guide silently kept serving a stale blank PDF
  through two deployments. It is derived automatically now, but the
  mechanism is still a cache and still capable of serving something old.
- **An intermittent hydration mismatch.** React error 418 appears on a
  different test suite roughly one full run in four, never in isolation,
  and has not been diagnosed. It is pre-existing, not caused by any
  recent change, and it is the kind of fault that gets worse on cheap
  phones.
- **Spot holds release themselves after fifteen minutes.** If a card is
  charged and the order fails to save, the held spots go back on sale
  while the unrecorded order sits there. The owner is emailed, and that
  email is the only thing standing between that state and somebody else
  buying the same spots.
- **The owner's own words are not checked.** The build refuses the old
  words in the site's copy, but a drop title or description the owner
  types is shown as written. "September Rifle Game" is a title, not ours
  to change.
- **Orders placed before the rename keep their wording.** Order lines
  stored as "…, 3 spots" and the terms text those buyers accepted are
  records of what they saw, and show on their receipts and in Orders as
  stored.
- **A manager can read what he cannot export.** He sees every buyer's
  name and email on a game's spot list, because he needs them to run
  the draw. Only the spreadsheet download is refused. Anything he can
  read, he can copy by hand.
- **Photographs removed by the manager stay in storage.** Deleting a file
  is owner only, so taking a photo off an item as manager leaves the file
  in the bucket. Harmless, and recoverable.
- **Photographs removed by the owner are deleted at once.** The file is
  deleted the moment the owner presses the cross, before the item is
  saved. Leaving the form without saving leaves the item pointing at a
  file that no longer exists. This predates roles and is not fixed.
- **`/api/health` reports secrets by shape, not value.** It is safe to
  leave deployed, but it is unauthenticated and describes the
  environment.

### Depends on the client acting

- **Three rules clauses are visibly unfinished** on a public page. It is
  hidden from search engines, but anyone with the link can read it.
- **The refund line is ours, not the attorney's,** and it is stored on
  every order as the wording the buyer accepted.
- **The shipping prices are invented.** Every order taken before they are
  confirmed charges a number nobody agreed to.

### My own uncertainty

- I could not deploy. Everything described as verified was verified in a
  sandbox with no outbound network, against a stand-in for Supabase and
  Authorize.net, and against a build assembled locally to resemble the
  deployed one. Three separate fixes passed that bar and failed in
  production.
- The test suite runs against the repository, where every file exists
  whether or not the build ships it. It is structurally unable to see a
  bundling failure, and one shipped behind a green run.
- The stand-in for Supabase has no row level security at all, so no
  browser test can catch an RLS mistake. One production bug has already
  come from that gap. The roles policies are tested separately against
  real PostgreSQL, and the browser tests prove the server refuses a
  manager on its own, but nothing tests the two together in one request.
- I have not seen the live database. Everything in section 2 about it is
  inferred from what the code expects.
