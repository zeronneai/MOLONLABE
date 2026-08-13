# Pre-launch manual test script

I cannot run this myself. The build sandbox has no route to Supabase
(`supabase.co` is unreachable through the proxy) and no credentials —
the keys live in Vercel, not here. Every automated suite in this build
ran against a hand-written stand-in, which exercises the app's code but
only *approximates* the RLS policies. This script covers what the mock
could not: the real database, the real policies, the real storage bucket.

Do it on the deployed preview, on your phone, in one sitting. It takes
about 25 minutes. **Steps 1–6 are the ones that would embarrass us if
they failed.**

Note where it says "expect" — if what you see differs, send me the step
number and what happened instead.

---

## Before you start

- Have the Vercel logs open in a second tab (Deployments → your build →
  Runtime Logs). Several steps ask you to check them.
- Use a **private/incognito window** so `localStorage` starts clean.
- Have a second browser or device ready for the "logged out" checks.

---

## 1. First visit, clean slate

1. Open the preview root in a private window.
2. **Expect:** the intro game loads (a brief "Loading" bar, then the shop
   interior with a pistol bottom-right). Not a black screen, not the site.
3. Play or tap SKIP.
4. **Expect:** the round resolves into a scope view, the result card sits
   on it, and when you continue the card fades off an image that does not
   change. No flash of a loading screen, no white flash, no wipe.
5. **Expect immediately after:** the age gate — "ARE YOU 21 OR OLDER?"
6. Tap **No**. **Expect:** "COME BACK WHEN YOU'RE 21", and you cannot get
   past it. Tap "I mistapped", then **Yes**.
7. **Expect:** the gate disappears and the page scrolls normally.
8. Reload the page. **Expect:** neither the game nor the gate returns.

> If the game does not appear at all, check the Vercel logs for a
> Cloudinary error — the game skips itself on purpose when its art fails
> to load, rather than blocking the site.

## 2. The hero — the highest-risk part of the build

1. On the home page, scroll slowly from the top.
2. **Expect:** the image scrubs frame by frame as you scroll, the three
   copy lines appear one at a time, then the headline and CTAs at the
   bottom.
3. **Expect:** no stutter, no blank frames, no jump back to the first
   frame.
4. Scroll to the very bottom of the hero and wait five seconds.
5. **Expect:** the looping video takes over with no visible seam, and
   keeps looping without a jump when it restarts.
6. **Check the Vercel logs** for `[hero]`. You should see **nothing**. If
   you see `could not measure`, Cloudinary's `fl_getinfo` is not
   available on this account — tell me, it means the scrub is running on
   the fallback 5-second constant rather than a measured value.
7. Repeat 1–5 on your phone, in **portrait**. **Expect:** the mobile clip,
   not a letterboxed desktop one, and the shorter middle copy line.

## 3. Inventory, from the real database

1. Go to `/inventory`.
2. **Expect:** the four seeded items in editorial rows — not cards, not a
   grid — with real photographs.
3. Hover one row on desktop. **Expect:** it brightens and shifts right;
   the others dim.
4. Tap each category filter. **Expect:** rows animate out and in; the
   active filter is acid with an underline.
5. Open an item. **Expect:** a sticky gallery on the left at full height,
   specs on the right, a status chip, and a green `INQUIRE ABOUT THIS`
   with a steel `CALL` beside it. **There should be no WhatsApp button.**
6. Tap **CALL**. **Expect:** your phone offers to dial **(915) 497-0541**.
7. Visit a URL that does not exist, e.g. `/inventory/not-a-real-thing`.
   **Expect:** the 404 screen ("NOT IN THE CASE"). Note: it returns HTTP
   200 by design — see the punch list.

## 4. Forms write to the real database

1. On an item, tap `INQUIRE ABOUT THIS`, fill it in, submit.
2. **Expect:** a success message naming what happens next.
3. **In Supabase** → Table Editor → `inquiries`: a new row, with
   `item_id` populated and `type = 'item'`.
4. **If `GOOGLE_SCRIPT_URL` is set:** check the owner's inbox and sheet.
   If it is not set, submissions still save — that is expected.
5. Go to `/transfers`, submit that form.
6. **Expect** a row with `type = 'transfer'` and `item_id` null.

> This is the step that proves the revoke-anon-inserts migration and the
> service-role key are both correct. If it fails with a permission error,
> `SUPABASE_SERVICE_ROLE_KEY` is missing or wrong in Vercel.

## 5. The entry program and the free route

1. Go to `/featured`.
2. **Expect:** the prize hero with a live entry counter, a stats strip
   (entries / time remaining / entrants), how-it-works, entry packs shown
   as **"OPENS SOON" and not clickable**, then the free entry box.
3. Fill in the free entry form and submit.
4. **Expect:** "ENTRY RECEIVED".
5. **In Supabase** → `entrants`: a new row with `entry_method = 'free'`
   and `entry_count = 1`.
6. Submit the same email again. **Expect:** it tells you you're already
   entered, and **no second row appears**.
7. **Expect** the counter on the page to have gone up by one.
8. Open `/sweepstakes-rules`. **Expect:** the amber placeholder box
   saying it is not legal copy.

## 6. Security — do these logged out, in a second browser

1. Open `/admin` while logged out. **Expect:** the login screen only. No
   nav, no data.
2. Try `/admin/inventory` directly. **Expect:** the same — never a flash
   of the panel.
3. Enter a wrong password. **Expect:** one generic "Incorrect email or
   password". It must never say which field was wrong.
4. Get it wrong five times. **Expect:** it locks you out briefly.
5. **In Supabase** → SQL Editor, run as the anon role:
   ```sql
   select * from settings where key = 'game_offer';
   ```
   With the offer **on** you should see the row. Turn the offer off in
   the admin, run it again, and **expect zero rows** — the discount code
   must be unreadable, not merely hidden.
6. With the offer off, view the public site's page source (Ctrl+U) and
   search for the code. **Expect: not present anywhere.**

## 7. Admin, one-handed on your phone

This is the constraint the whole panel was designed around. Do it
standing up, with one thumb.

1. Log in. **Expect:** five tabs — Inventory, Featured, Inquiries,
   Entrants, Game & Offer.
2. **Inventory:** toggle an item's status from the list without opening
   it. Toggle the star. **Expect** both to stick after a reload.
3. Tap **Archive** on an item. **Expect:** it vanishes from the list and
   an "Archived. Undo" toast appears. Tap **Undo**. **Expect:** it
   returns with its original status, not "available".
4. Archive it again, then use the **Archived** filter. **Expect:** it is
   there, offering **Restore**.
5. Open an item, scroll to the bottom. **Expect:** "Delete permanently",
   **disabled**, explaining that inquiries reference it and pointing to
   archive. (True for any item you sent an inquiry about in step 4.)
6. Create a throwaway item, upload a photo, save. **Expect:** the photo
   appears, and shows on the public site.
7. Delete that throwaway. **Expect:** a confirmation **naming the item**,
   then it is gone. **In Supabase** → Storage → `product-images`: the
   uploaded file should be gone too.
8. **Featured:** set a campaign live. **Expect** any other live campaign
   drops to closed — only one can be live.
9. **Game & Offer:** the reward switch must be the first thing on the
   screen and reachable in two taps from the admin home.
10. **Inquiries:** the inquiry from step 4 should be there, marked new
    and visually distinct. Toggle it to contacted.

## 8. Analytics

1. In GA4 → Reports → Realtime, with the preview open in another tab.
2. Do: view an item, tap call, submit an inquiry, submit a free entry.
3. **Expect** `view_item`, `click_to_call`, `inquiry_submit`,
   `entry_submit` to appear within a minute or two.
4. Then mark these four as key events: `inquiry_submit`, `click_to_call`,
   `entry_submit`, `transfer_submit`. See `docs/analytics.md` — nothing we
   ship can set that flag.
5. Load `/admin`. **Expect no analytics traffic at all** — the admin is
   deliberately excluded.

## 9. The empty states

Worth seeing once, because day one may look like this. Either use a
second empty Supabase project, or temporarily archive everything.

1. Archive all items → `/inventory` should say "THE CASE IS EMPTY", not
   "No results found".
2. Close the live campaign → `/featured` should say "NOTHING ON THE
   BLOCK" and point at Instagram.
3. Restore everything afterwards.

## 10. Last looks

1. `/robots.txt` — disallows `/admin`, points at the sitemap.
2. `/sitemap.xml` — lists the static routes and every visible item,
   **and no archived ones**.
3. Paste the home URL and an item URL into a WhatsApp or Slack message.
   **Expect** a dark preview card; the item one should carry the item name
   and a coloured status chip.
4. Run Lighthouse — see `docs/lighthouse.md` for how, and which failures
   are expected rather than defects.
