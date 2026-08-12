# Analytics — GA4

## Setup

Set `NEXT_PUBLIC_GA_MEASUREMENT_ID` to the property's `G-XXXXXXXXXX` in
Vercel (all environments you want measured — leave it unset on previews if
you'd rather they stayed out of the data).

When the variable is unset or malformed, `components/analytics/Analytics.tsx`
renders nothing: no script, no requests, no traffic to the client's
property. There is no separate "disabled" switch to forget.

Analytics ships from `app/(site)/layout.tsx` only. The admin route group
renders without it, so the owner working the shop never appears in the
client's traffic.

## Events

Every event is declared in `lib/analytics.ts`. The `track()` wrapper is
typed against that map, so an event name or parameter that isn't declared
is a compile error rather than a silent no-op. Add events there or they
don't exist.

| Event | Fires when | Where |
| --- | --- | --- |
| `view_item` | An item detail page is viewed | `components/analytics/TrackView.tsx` |
| `inquiry_submit` | An item or general inquiry succeeds | `components/forms/InquiryForm.tsx` |
| `transfer_submit` | A transfer request succeeds | `components/forms/InquiryForm.tsx` |
| `click_to_call` | A `tel:` link is tapped | `components/inventory/ItemCtas.tsx` |
| `whatsapp_click` | A WhatsApp CTA is tapped | `ItemCtas.tsx` — dormant while `WHATSAPP_ENABLED` is false |
| `entry_start` | First interaction with the free entry form | `components/entry/FreeEntry.tsx` |
| `entry_submit` | An entry is recorded (`method` says free or purchase) | `components/entry/FreeEntry.tsx` |
| `video_play` | An item video is played | `components/inventory/VideoBlock.tsx` |
| `intro_completed` | The intro game round is cleared | `components/intro/IntroGame.tsx` |
| `intro_skipped` | The intro game is skipped | `components/intro/IntroGame.tsx` |

`page_view` is sent manually on route changes. The App Router does not
reload between routes, so gtag's automatic page_view would only ever fire
once per session; the initial one comes from the `config` call and every
subsequent one from `trackPageView`.

## Key events

**This has to be done in the GA4 UI — nothing we ship can set it.**
Admin → Events → toggle "Mark as key event" on each of:

- `inquiry_submit`
- `click_to_call`
- `entry_submit`
- `transfer_submit`

These are the four that represent a business outcome rather than
browsing. The same list is exported as `KEY_EVENTS` in `lib/analytics.ts`
so the code and the property can be checked against each other.

An event has to have been received at least once before GA4 will list it,
so submit one of each on the live site before going looking for them.

## What is deliberately not tracked

- Anything in `/admin`.
- Any personally identifying value. Events carry slugs, categories,
  sources and counts — never names, emails or phone numbers.

## Related environment variables

`NEXT_PUBLIC_SITE_URL` is the canonical origin (no trailing slash). It
feeds `lib/brand.ts`'s `SITE_URL`, which every canonical link, the
sitemap, robots.txt, the JSON-LD `@id`s and the absolute OG image URLs
are built from.

It is read at **build** time for the statically generated routes —
`robots.txt` and `sitemap.xml` among them — so it must be set in Vercel
before the build, not added afterwards. Unset, everything falls back to
`https://molonlabefirearms.com`, which is right for production and wrong
for a preview.
