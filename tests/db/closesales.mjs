// Closing a drop's sales early, at the database.
//
// 30 October 2026: BOOM STICK was drawn for Halloween at 44 of 66. The
// site refused an early draw, so the drawing was run outside it and the
// manager recorded the 22 unsold guides as an in-store sale to himself to
// stop the drop selling. close_drop_sales is the honest version.
//
// What must hold, for the owner and the manager:
//   - closing needs an open drop with at least one guide sold
//   - after closing, no guide can be held or sold by any path
//   - a closed drop can be drawn from what sold, recorded as early
//   - a drop that is merely short, and not closed, still cannot be drawn
//   - voiding an in-store sale never reopens a closed drop

import { spawn } from "node:child_process";
import { suite } from "../lib/harness.mjs";
import { scratchDatabase } from "../lib/pg.mjs";
import { PG } from "../lib/config.mjs";

const { check, report } = suite();

const OWNER = "00000000-0000-4000-8000-00000000000a";
const MANAGER = "00000000-0000-4000-8000-00000000000b";
const STRANGER = "00000000-0000-4000-8000-00000000000c";
const GAME = "20000000-0000-4000-8000-000000000021";
const EMPTY = "20000000-0000-4000-8000-000000000022";
const SHORT = "20000000-0000-4000-8000-000000000023";

const db = await scratchDatabase("closesales");
const sql = db.sql;

const as = (user, text) =>
  new Promise((resolve) => {
    const p = spawn("psql", [
      "-h", PG.host, "-p", PG.port, "-U", PG.user, "-d", db.name,
      "-q", "-t", "-A", "-c",
      `set local role authenticated;
       set local request.jwt.claims = '{"sub":"${user}","role":"authenticated"}';
       ${text}`,
    ]);
    let out = "", err = "";
    p.stdout.on("data", (d) => (out += d));
    p.stderr.on("data", (d) => (err += d));
    p.on("close", (code) => resolve({ code, out: out.trim(), err: err.trim() }));
  });

const one = async (text) => (await sql(text)).split("\n").pop();
const close = (user, game = GAME) => as(user, `select public.close_drop_sales('${game}');`);
const draw = (user, game) => as(user, `
  insert into public.winners (game_id, spot_id, display_name, seed, ticket, ticket_index, entry_total, drawn_early, unsold_spots)
    select '${game}', id, 'Ana L.', 'seed', spot_number, 0, 3, false, 0
    from public.game_spots where game_id = '${game}' and spot_number = 1;`);

try {
  await sql(`
    grant usage on schema public to anon, authenticated, service_role;
    grant all on all tables in schema public to anon, authenticated, service_role;
    grant all on all sequences in schema public to anon, authenticated, service_role;
    insert into auth.users (id, email) values
      ('${OWNER}', 'owner@example.com'), ('${MANAGER}', 'manager@example.com'),
      ('${STRANGER}', 'stranger@example.com');
    insert into public.staff (user_id, role, display_name, must_change_password) values
      ('${OWNER}', 'owner', 'Rey Marquez', false), ('${MANAGER}', 'manager', 'Luis Ortega', false);
    insert into public.games (id, title, total_spots, spot_price_cents, status) values
      ('${GAME}', 'Halloween Drop', 6, 1000, 'open'),
      ('${EMPTY}', 'Nothing Sold', 4, 1000, 'open'),
      ('${SHORT}', 'Short Drop', 4, 1000, 'open');
    insert into public.game_spots (game_id, spot_number, status, first_name, last_name, email)
      select '${GAME}', n, case when n <= 3 then 'sold' else 'open' end,
             case when n <= 3 then 'Ana' end, case when n <= 3 then 'Lopez' end,
             case when n <= 3 then 'ana@example.com' end
      from generate_series(1, 6) n;
    insert into public.game_spots (game_id, spot_number, status)
      select '${EMPTY}', n, 'open' from generate_series(1, 4) n;
    insert into public.game_spots (game_id, spot_number, status, first_name, last_name, email)
      select '${SHORT}', n, case when n <= 2 then 'sold' else 'open' end, 'Bo', 'Diaz', 'bo@example.com'
      from generate_series(1, 4) n;
  `);

  // --------------------------------------------------------- who may close
  const stranger = await close(STRANGER);
  check("an account with no staff role cannot close sales",
    stranger.code !== 0 && /Only staff/i.test(stranger.err), stranger.err.split("\n")[0] || "CLOSED");
  const empty = await close(MANAGER, EMPTY);
  check("a drop with nothing sold cannot be closed",
    empty.code !== 0 && /No guides have sold/i.test(empty.err), empty.err.split("\n")[0] || "CLOSED");

  // ---------------------------------------------------- the short drop
  const short = await draw(OWNER, SHORT);
  check("a drop that is short and NOT closed still cannot be drawn",
    short.code !== 0 && /2 of 4 guides sold/i.test(short.err), short.err.split("\n")[0] || "DRAWN");

  // A counter sale before closing, to void afterwards.
  const counter = await as(MANAGER, `select public.record_in_store_sale('${GAME}', 1, 'Cy', 'Ruiz', null, '915', 'The buyer was shown the rules and agreed.', 'MLF-S-CLOSE1', 'tokclose1');`);
  check("a counter sale is recorded before closing", counter.code === 0, counter.err.split("\n")[0] || "recorded");

  // --------------------------------------------- the manager closes it
  const closed = await close(MANAGER);
  check("the manager closes sales and is told how many sold",
    closed.code === 0 && closed.out.endsWith("4"), closed.err.split("\n")[0] || closed.out);
  check("the drop is now full, stamped with when and who",
    (await one(`select status || ' ' || (sales_closed_at is not null) || ' ' || sales_closed_by_name from public.games where id = '${GAME}'`))
      === "full true Luis Ortega",
    await one(`select status || ' ' || (sales_closed_at is not null) || ' ' || coalesce(sales_closed_by_name,'') from public.games where id = '${GAME}'`));
  const twice = await close(OWNER);
  check("closing twice is refused", twice.code !== 0 && /already closed/i.test(twice.err),
    twice.err.split("\n")[0] || "CLOSED AGAIN");

  // ------------------------------------------------ nothing can be bought
  const claim = await sql(`select public.claim_game_spots('${GAME}', 1)`).then(
    (o) => ({ code: 0, out: o }), (e) => ({ code: 1, err: String(e.stderr ?? e) }));
  check("an online claim on a closed drop is refused",
    claim.code !== 0 && /closed/i.test(claim.err), claim.err?.split("\n")[0] || claim.out);
  const direct = await sql(`update public.game_spots set status = 'sold' where game_id = '${GAME}' and spot_number = 6`).then(
    () => ({ code: 0 }), (e) => ({ code: 1, err: String(e.stderr ?? e) }));
  check("not even a direct write can sell a guide of a closed drop",
    direct.code !== 0 && /closed/i.test(direct.err), direct.err?.split("\n")[0] || "SOLD");
  check("it still has exactly four guides sold",
    (await one(`select count(*) from public.game_spots where game_id = '${GAME}' and status = 'sold'`)) === "4");

  // ------------------------------------------------- void does not reopen
  const voided = await as(OWNER, `select public.void_in_store_sale((select id from public.orders where order_number = 'MLF-S-CLOSE1'));`);
  check("the owner can still void a counter sale on a closed drop", voided.code === 0,
    voided.err.split("\n")[0] || "voided");
  check("and the drop stays closed: voiding never reopens it",
    (await one(`select status from public.games where id = '${GAME}'`)) === "full",
    await one(`select status from public.games where id = '${GAME}'`));
  check("the voided guide is back to open but still cannot be bought",
    (await one(`select public.game_spots_remaining('${GAME}')`)) === "3" &&
      (await sql(`select public.claim_game_spots('${GAME}', 1)`).then(() => "claimed", () => "refused")) === "refused");

  // ---------------------------------------------------------- the draw
  const sold = await one(`select count(*) from public.game_spots where game_id = '${GAME}' and status = 'sold'`);
  const ok = await draw(MANAGER, GAME);
  check("a closed drop can be drawn from what sold", ok.code === 0, ok.err.split("\n")[0] || "drawn");
  check("and the winner row records it as early, with the unsold count",
    (await one(`select drawn_early || ' ' || unsold_spots from public.winners where game_id = '${GAME}'`))
      === `true ${6 - Number(sold)}`,
    await one(`select drawn_early || ' ' || unsold_spots from public.winners where game_id = '${GAME}'`));
} finally {
  await db.drop();
}

report();
