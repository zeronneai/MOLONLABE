-- The guide.
--
-- WHAT IS BEING SOLD
--
-- The attorney settled this: the customer buys a written guide to the
-- piece, and entry into the drawing comes with it. So the guide has to be
-- a real thing with real content in it, produced per game, delivered on
-- purchase. Most of it can be assembled from the item that is already in
-- the catalogue — name, brand, specs, description, photographs — and that
-- part needs no new columns.
--
-- The part that cannot be assembled is the part that makes it a guide
-- rather than a product page with a border round it. Three things only
-- the owner knows:
--
--   guide_why    why he picked this particular piece
--   guide_care   what it needs in the way of maintenance and handling
--   guide_pairs  what he would put on it or carry with it
--
-- These are NOT optional. `saveGame` refuses to create or save a game
-- with any of them empty or trivially short, and the admin says why. A
-- game whose three fields are blank is selling a PDF of the product page,
-- which is the thing the approved structure exists to avoid. The check is
-- in the server action rather than in a CHECK constraint here, because
-- the useful version of it is a length-and-substance judgement with a
-- readable message attached, and because existing rows predate the
-- columns and must not be made unwritable by a migration.
--
-- WHEN IT IS BUILT
--
-- Lazily, on the first purchase, and again whenever its inputs change.
-- `guide_fingerprint` is a hash over everything that appears in the PDF —
-- the three fields, the item's own copy, and the renderer's own version
-- number. A generated guide whose fingerprint still matches is served as
-- it is; one whose fingerprint has moved is rebuilt. That is what makes
-- "regenerated when the fields change" a fact about the data rather than
-- a promise about remembering to.
--
-- WHERE IT LIVES
--
-- A private bucket. NOT public, unlike product-images: a guide is
-- something a customer paid for, and a public bucket makes every guide
-- readable to anyone who can guess a game id. Nothing reads or writes it
-- except the server with the service role, which bypasses storage RLS —
-- so this bucket deliberately has NO policies at all. Buyers reach their
-- copy through /guide, which checks the same confirmation token the
-- receipt page checks; the owner reaches it through the admin, which
-- checks his session.
--
-- Adding a `select` policy for anon or authenticated here would quietly
-- undo that. Don't.

alter table public.games
  add column if not exists guide_why   text,
  add column if not exists guide_care  text,
  add column if not exists guide_pairs text;

comment on column public.games.guide_why is
  'Owner: why this particular piece was chosen. Printed in the guide.';
comment on column public.games.guide_care is
  'Owner: maintenance and handling notes. Printed in the guide.';
comment on column public.games.guide_pairs is
  'Owner: what he would pair with it. Printed in the guide.';

-- Where the built PDF is, what it was built from, and when.
--
-- `guide_path` is an object path inside the bucket below, never a URL —
-- a stored URL would bake in the project host and the signing scheme,
-- both of which are the storage layer's business and not this table's.
alter table public.games
  add column if not exists guide_path         text,
  add column if not exists guide_fingerprint  text,
  add column if not exists guide_generated_at timestamptz;

comment on column public.games.guide_fingerprint is
  'Hash of everything the PDF is rendered from. Mismatch = rebuild.';

-- ---------------------------------------------------------------------
-- The bucket
-- ---------------------------------------------------------------------
-- Idempotent, and written so it converges whether it was created here or
-- by hand in the dashboard first. `public` is forced to false on conflict
-- on purpose: if somebody ticks the public box later, re-running this
-- puts it back.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'game-guides',
  'game-guides',
  false,
  10485760, -- 10MB. A guide with four photographs in it runs about 1MB.
  array['application/pdf']
)
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- No policies. See the note at the top — that is the design, not an
-- omission.
