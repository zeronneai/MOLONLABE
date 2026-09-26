// No early draw, at the database.
//
// The manager runs the site alone for a month and must not be able to
// draw a drop that has not sold out. The admin shows no control for it
// and the server action refuses, but a manager holds a real session token
// and can write to the winners table directly, so the rule has to hold
// there. This writes the winner row directly, as the manager, as the
// owner, and as the service role, and expects each to be refused until
// the last guide is sold.
//
// Also here, because the same migration brings them:
//   - a drop's count and price cannot be changed once it exists
//   - guides held by an abandoned checkout count as available again after
//     fifteen minutes, so the last guides of a drop cannot get stuck

import { spawn } from "node:child_process";
import { suite } from "../lib/harness.mjs";
import { scratchDatabase } from "../lib/pg.mjs";
import { PG } from "../lib/config.mjs";

const { check, report } = suite();

const OWNER = "00000000-0000-4000-8000-00000000000a";
const MANAGER = "00000000-0000-4000-8000-00000000000b";
const GAME = "20000000-0000-4000-8000-000000000009";

const db = await scratchDatabase("noearlydraw");
const sql = db.sql;

/** Runs `text` as `user` over the authenticated role, in one transaction. */
const as = (user, text) =>
  new Promise((resolve) => {
    const p = spawn("psql", [
      "-h", PG.host, "-p", PG.port, "-U", PG.user, "-d", db.name,
      "-q", "-t", "-A", "-c",
      `set local role ${user === "service_role" ? "service_role" : "authenticated"};
       set local request.jwt.claims = '{"sub":"${user}","role":"authenticated"}';
       ${text}`,
    ]);
    let out = "", err = "";
    p.stdout.on("data", (d) => (out += d));
    p.stderr.on("data", (d) => (err += d));
    p.on("close", (code) => resolve({ code, out: out.trim(), err: err.trim() }));
  });

const one = async (text) => (await sql(text)).split("\n").pop();
const draw = (user) => as(user, `
  insert into public.winners (game_id, spot_id, display_name, seed, ticket, ticket_index, entry_total, drawn_early, unsold_spots)
    select '${GAME}', id, 'Ana L.', 'seed', spot_number, 0, 3, true, 2
    from public.game_spots where game_id = '${GAME}' and spot_number = 1;`);
const winners = () => one(`select count(*) from public.winners where game_id = '${GAME}'`);

try {
  await sql(`
    grant usage on schema public to anon, authenticated, service_role;
    grant all on all tables in schema public to anon, authenticated, service_role;
    grant all on all sequences in schema public to anon, authenticated, service_role;
    insert into auth.users (id, email) values
      ('${OWNER}', 'owner@example.com'), ('${MANAGER}', 'manager@example.com');
    insert into public.staff (user_id, role, display_name) values
      ('${OWNER}', 'owner', 'Rey Marquez'), ('${MANAGER}', 'manager', 'Luis Ortega');
    insert into public.games (id, title, total_spots, spot_price_cents, status)
      values ('${GAME}', 'Short Drop', 5, 1000, 'open');
    insert into public.game_spots (game_id, spot_number, status, first_name, last_name, email)
      select '${GAME}', n, case when n <= 3 then 'sold' else 'open' end, 'Ana', 'Lopez', 'ana@example.com'
      from generate_series(1, 5) n;
  `);

  // ------------------------------------------------------- 3 of 5 sold
  for (const who of [["MANAGER", MANAGER], ["OWNER", OWNER], ["SERVICE ROLE", "service_role"]]) {
    const r = await draw(who[1]);
    check(`${who[0]} writing a winner for a drop with 3 of 5 sold is refused`,
      r.code !== 0 && /3 of 5 guides sold/i.test(r.err), r.err.split("\n")[0] || "WAS NOT REFUSED");
  }
  check("and no winner row exists", (await winners()) === "0", await winners());

  // Two guides held by a checkout that died twenty minutes ago are still
  // not sold, so the drop still cannot be drawn...
  await sql(`
    update public.game_spots set status = 'held', held_at = now() - interval '20 minutes'
    where game_id = '${GAME}' and spot_number in (4, 5);
  `);
  const r = await draw(MANAGER);
  check("held is not sold: still refused with two stale holds", r.code !== 0, r.err.split("\n")[0]);

  // ...and the public count offers them again, so somebody can buy them.
  // This used to read zero, which made the drop look sold out while it
  // could never be drawn.
  check("stale holds count as available to buy",
    (await one(`select public.game_spots_remaining('${GAME}')`)) === "2",
    await one(`select public.game_spots_remaining('${GAME}')`));
  await sql(`update public.game_spots set held_at = now() - interval '2 minutes' where game_id = '${GAME}' and spot_number = 4`);
  check("a hold still inside its fifteen minutes does not",
    (await one(`select public.game_spots_remaining('${GAME}')`)) === "1",
    await one(`select public.game_spots_remaining('${GAME}')`));
  check("and the next claim takes the stale one",
    (await one(`select public.claim_game_spots('${GAME}', 1)`)) === "{5}",
    await one(`select public.claim_game_spots('${GAME}', 1)`));

  // --------------------------------------------------------- sold out
  await sql(`update public.game_spots set status = 'sold', held_at = null where game_id = '${GAME}'`);
  const ok = await draw(MANAGER);
  check("once every guide is sold, the manager can draw", ok.code === 0 && (await winners()) === "1",
    ok.err.split("\n")[0] || "drawn");
  check("and it is recorded as not early, whatever the writer claimed",
    (await one(`select drawn_early || ' ' || unsold_spots from public.winners where game_id = '${GAME}'`)) === "false 0",
    await one(`select drawn_early || ' ' || unsold_spots from public.winners where game_id = '${GAME}'`));

  // -------------------------------------------- the count and the price
  for (const [what, set] of [["number of guides", "total_spots = 50"], ["price", "spot_price_cents = 1"]]) {
    const u = await as(OWNER, `update public.games set ${set} where id = '${GAME}';`);
    check(`the ${what} of an existing drop cannot be changed, even by the owner`,
      u.code !== 0 && /fixed when it is created/i.test(u.err), u.err.split("\n")[0] || "CHANGED");
  }
  check("the drop still has its numbers",
    (await one(`select total_spots || ' ' || spot_price_cents from public.games where id = '${GAME}'`)) === "5 1000");
  const words = await as(MANAGER, `update public.games set title = 'Renamed' where id = '${GAME}' returning title;`);
  check("its words can still be edited", words.code === 0 && words.out.endsWith("Renamed"),
    words.err.split("\n")[0] || words.out);
} finally {
  await db.drop();
}

report();
