-- How many photographs the last guide actually got.
--
-- THE FAILURE THIS EXISTS TO MAKE VISIBLE
--
-- The renderer reads JPEG and PNG. The catalogue is WebP — the admin
-- compresses client side before uploading to Supabase Storage, so every
-- product photograph the shop has ever uploaded is a .webp. The first
-- deployed guide therefore came out with no pictures in it, and it came
-- out looking perfect: correct type, correct sections, correct legal
-- text, and blank where four photographs should have been. Nothing failed
-- loudly. There was one line per image on a server log nobody reads.
--
-- A guide that renders beautifully and silently omits what the customer
-- paid to look at is the worst outcome this system can produce, so the
-- shortfall is now DATA rather than a log line:
--
--   guide_images_wanted  how many the item had when the guide was built
--   guide_images_used    how many made it onto the page
--
-- Unequal means the admin says so against that game, and the owner is
-- told once when a rebuild comes out short. See docs/guides.md.
--
-- NOT A CHECK CONSTRAINT, AND NOT A REFUSAL. A prize with no photographs
-- at all is legitimate — the three written sections are what is being
-- sold, and an owner who has not uploaded a picture yet should still get
-- a guide. Refusing to generate would trade "a guide with no pictures"
-- for "no guide", which is worse for somebody who has already paid.

alter table public.games
  add column if not exists guide_images_wanted integer,
  add column if not exists guide_images_used   integer;

comment on column public.games.guide_images_wanted is
  'Photographs the item had when the guide was last built.';
comment on column public.games.guide_images_used is
  'Photographs that actually reached the page. Fewer than wanted = say so.';
