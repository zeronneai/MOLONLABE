-- GO-LIVE 2 of 3: CLEANUP. Removes every sandbox order and returns the
-- guides they held. One transaction: it either all happens or none of it.
--
-- Run 1-preview.sql first. Then fill in the two values marked FILL IN
-- below, with the same cutoff you used there and the number it showed on
-- the "orders to delete" row, and run this whole file.
--
-- WHAT IT DOES
--   - every ONLINE order placed before the cutoff is deleted, with its
--     lines. In-store sales are real sales and are never touched.
--   - every guide those orders held goes back to available, with the
--     buyer's name, email and phone cleared from it
--   - a guide marked sold with no order at all, or held by a checkout
--     abandoned more than fifteen minutes ago, also goes back to
--     available, in any drop that has not been drawn (checkout is the
--     only way a guide is sold, and it always records the order)
--   - a drop that had filled up because of test purchases goes back to
--     open, since it now has guides to sell
--
-- WHAT IT DOES NOT TOUCH
--   - items, sizes or stock. Stock taken by test orders is listed in the
--     preview and is not put back; adjust it by hand in the admin if
--     wanted.
--   - any drop's title, description, featured piece, number of guides,
--     price or guide text. Only a drop's status can change, and only from
--     full back to open.
--   - settings, staff, inquiries, the activity log, or real orders.
--
-- IT REFUSES TO RUN, AND CHANGES NOTHING, IF
--   - either value below is left blank
--   - the number of orders before the cutoff is not the number you saw
--   - any test guide is in a drop that has already been drawn. That would
--     mean a winner was picked from test purchases; stop and look at it.

-- The report is a temporary table that outlives the transaction, so it
-- can be shown after COMMIT: the SQL editor shows the last result only.
drop table if exists pg_temp._cleanup_report;
create temp table _cleanup_report (sort int, what text, n int);

begin;

do $$
declare
  v_cutoff   timestamptz := null;   -- FILL IN: the cutoff, e.g. '2026-09-27 14:05:00-06'
  v_expected integer     := null;   -- FILL IN: the "orders to delete" number from the preview
  v_orders   integer;
  v_drawn    text;
  v_n        integer;
begin
  if v_cutoff is null or v_expected is null then
    raise exception 'Fill in the cutoff and the expected number of orders first. Nothing has changed.';
  end if;

  -- Online orders only: an in-store sale is real whenever it happened.
  create temp table _sandbox_orders on commit drop as
    select id from public.orders where created_at < v_cutoff and source = 'online';
  select count(*) into v_orders from _sandbox_orders;
  if v_orders <> v_expected then
    raise exception 'There are % orders before the cutoff, not the % you expected. Nothing has changed. Run the preview again.',
      v_orders, v_expected;
  end if;

  select string_agg(distinct g.title, ', ') into v_drawn
  from public.game_spots s
  join public.games g on g.id = s.game_id
  where s.order_id in (select id from _sandbox_orders)
    and exists (select 1 from public.winners w where w.game_id = s.game_id);
  if v_drawn is not null then
    raise exception 'These drops were drawn with test guides in them: %. Nothing has changed.', v_drawn;
  end if;

  -- Guides the test orders bought. Before the orders go: deleting an
  -- order only blanks the guide's order link and would leave it sold.
  update public.game_spots
     set status = 'open', order_id = null, first_name = null, last_name = null,
         email = null, phone = null, held_at = null, sold_at = null
   where order_id in (select id from _sandbox_orders);
  get diagnostics v_n = row_count;
  insert into _cleanup_report values (2, 'guides returned from test orders', v_n);

  -- Sold with no order, or held by an abandoned checkout, in a drop not
  -- yet drawn.
  update public.game_spots s
     set status = 'open', order_id = null, first_name = null, last_name = null,
         email = null, phone = null, held_at = null, sold_at = null
   where s.order_id is null
     and (s.status = 'sold'
          or (s.status = 'held' and (s.held_at is null or s.held_at < now() - interval '15 minutes')))
     and not exists (select 1 from public.winners w where w.game_id = s.game_id);
  get diagnostics v_n = row_count;
  insert into _cleanup_report values (3, 'guides returned that had no order', v_n);

  delete from public.orders where id in (select id from _sandbox_orders);
  get diagnostics v_n = row_count;
  insert into _cleanup_report values (1, 'sandbox orders deleted, with their lines', v_n);

  -- A drop that filled up on test purchases has guides to sell again.
  update public.games g
     set status = 'open'
   where g.status = 'full'
     and exists (select 1 from public.game_spots s where s.game_id = g.id and s.status <> 'sold')
     and not exists (select 1 from public.winners w where w.game_id = g.id);
  get diagnostics v_n = row_count;
  insert into _cleanup_report values (4, 'drops reopened (were full of test guides)', v_n);
end $$;

commit;

select what, n from _cleanup_report order by sort;
