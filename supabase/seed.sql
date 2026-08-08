-- Seed catalog — PROJECT_BRIEF.md section 8. Idempotent: safe to re-run.
-- The campaign and the MPX video URL are placeholders so the featured
-- section and the detail-page video block render; the owner replaces
-- them from the admin portal.

insert into public.items
  (slug, name, category, brand, short_desc, long_desc, specs, price_display, status, sort_order, images, video_url)
values
  (
    'nighthawk-custom-revolver',
    'Nighthawk Custom Revolver',
    'revolver',
    'Nighthawk Custom',
    'Ported barrel, hand-fitted action, walnut target grips.',
    'Built on the Korth platform and finished by hand. The action breaks like glass, the porting keeps the muzzle flat, and the walnut grips are fitted to the frame, not to a jig.',
    '{"Caliber": ".357 Magnum", "Barrel": "4 in, ported", "Capacity": "6", "Trigger": "Hand-fitted DA/SA", "Grips": "Walnut target", "Finish": "Polished blue"}'::jsonb,
    'Call for price',
    'available',
    0,
    '["https://res.cloudinary.com/dsprn0ew4/image/upload/v1786043151/Revolver_on_black_velvet_2K_202608061301_boa0qr.jpg"]'::jsonb,
    null
  ),
  (
    'competition-pistol-red-dot',
    'Competition Pistol, Red Dot Equipped',
    'pistol',
    null,
    'Optic-ready slide with a mounted red dot and extended magwell.',
    'Set up for match day out of the case: enclosed-emitter red dot, flared magwell, and a flat-faced trigger. Bring ammunition and a belt.',
    '{"Caliber": "9mm", "Optic": "Enclosed emitter red dot", "Magwell": "Extended, flared", "Trigger": "Flat-faced", "Capacity": "17+1"}'::jsonb,
    'Call for price',
    'available',
    1,
    '["https://res.cloudinary.com/dsprn0ew4/image/upload/v1786043151/Pistol_with_red_dot_optic_202608061301_ggybgq.jpg"]'::jsonb,
    null
  ),
  (
    'taran-tactical-glock',
    'Taran Tactical Glock',
    'pistol',
    'Taran Tactical',
    'TTI slide work, stippled frame, extended base pad.',
    'Full TTI treatment: lightened slide with window cuts, laser stippling in the TTI pattern, and an extended base pad. The one everybody asks to hold.',
    '{"Caliber": "9mm", "Slide": "TTI window cuts", "Frame": "TTI laser stipple", "Base pad": "TTI +5", "Sights": "Fiber optic front"}'::jsonb,
    'Call for price',
    'available',
    2,
    '["https://res.cloudinary.com/dsprn0ew4/image/upload/v1786043151/Pistol_on_black_granite_2K_202608061302_zzzmjb.jpg"]'::jsonb,
    null
  ),
  (
    'sig-mpx-carbon',
    'SIG MPX, Carbon Handguard',
    'pcc',
    'SIG Sauer',
    'Folding brace, carbon fiber handguard, enclosed red dot.',
    'The 9mm MPX with the weight where you want it: carbon fiber handguard up front, folding brace in back, and an enclosed red dot that shrugs off rain and holster lint alike.',
    '{"Caliber": "9mm", "Handguard": "Carbon fiber M-LOK", "Brace": "Folding", "Optic": "Enclosed red dot", "Muzzle": "Threaded 13.5x1 LH"}'::jsonb,
    'Call for price',
    'available',
    3,
    '["https://res.cloudinary.com/dsprn0ew4/image/upload/v1786043151/Firearm_on_textured_surface_2K_202608061302_ln1qnw.jpg"]'::jsonb,
    'https://res.cloudinary.com/demo/video/upload/dog.mp4'
  )
on conflict (slug) do nothing;

-- One live campaign so the featured slot has something to show.
insert into public.campaigns (title, item_id, description, opens_at, closes_at, status)
select
  'SIG MPX Carbon — Current Feature',
  id,
  'Folding brace, carbon fiber handguard, enclosed red dot. One will go home with somebody.',
  now(),
  now() + interval '30 days',
  'live'
from public.items
where slug = 'sig-mpx-carbon'
  and not exists (select 1 from public.campaigns where status = 'live');
