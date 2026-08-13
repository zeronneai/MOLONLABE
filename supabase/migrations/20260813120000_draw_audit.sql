-- Makes the draw auditable and the winners table privacy-safe.
--
-- Before this, the winner was picked with Math.random() and nothing about
-- the pick was recorded, so "we drew it fairly" was a claim with no
-- evidence behind it. The draw now runs a seeded, deterministic algorithm
-- (lib/draw/select.ts) and stores everything a third party needs to
-- recompute it: the seed, the winning ticket, and the pot size at the
-- moment of the draw. See docs/draw-verification.md.

alter table public.winners
  add column if not exists seed        text,
  add column if not exists ticket      int,
  add column if not exists entry_total int;

comment on column public.winners.seed is
  'Random seed handed to the deterministic selector. With the entrant ids, this reproduces the result.';
comment on column public.winners.ticket is
  '1-based winning ticket within the weighted pot.';
comment on column public.winners.entry_total is
  'Total weighted entries at the moment of the draw. Frozen, unlike a live count.';

-- display_name is broadcast: it appears on the public featured page and
-- on the draw presentation screen. It holds first name plus last initial
-- and nothing more. Any row written before this rule existed gets
-- redacted here. The expression is idempotent, so re-running the
-- migration on already-redacted rows is a no-op.
update public.winners
set display_name =
  split_part(display_name, ' ', 1)
  || ' '
  || left(
       split_part(
         display_name,
         ' ',
         array_length(string_to_array(display_name, ' '), 1)
       ),
       1
     )
  || '.'
where display_name like '% %';
