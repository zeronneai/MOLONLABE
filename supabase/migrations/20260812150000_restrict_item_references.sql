-- Make the item references explicitly RESTRICT.
--
-- Both inquiries.item_id and campaigns.item_id were declared with a bare
-- `references public.items(id)` and no ON DELETE clause, so they default
-- to NO ACTION. In practice that already refuses a delete that would
-- orphan rows — it neither cascades nor nulls — but NO ACTION is only
-- checked at the end of the statement and can be deferred. RESTRICT is
-- checked immediately and says what we mean: a delete that would take
-- inquiry or campaign history with it is always an error.

alter table public.inquiries drop constraint if exists inquiries_item_id_fkey;
alter table public.inquiries
  add constraint inquiries_item_id_fkey
  foreign key (item_id) references public.items(id) on delete restrict;

alter table public.campaigns drop constraint if exists campaigns_item_id_fkey;
alter table public.campaigns
  add constraint campaigns_item_id_fkey
  foreign key (item_id) references public.items(id) on delete restrict;
