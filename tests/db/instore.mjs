// Sales at the shop counter, at the database.
//
// record_in_store_sale and void_in_store_sale are the whole of the rule.
// The admin screens call them and say what they said, but a manager holds
// a real session token and could call the database directly, and two
// people can sell the last guides of a drop at the same moment, one at
// the counter and one online. So this goes straight at the functions, as
// the manager and as the owner, and races them against online checkout's
// own claim on real PostgreSQL.

import { spawn } from "node:child_process";
import { suite } from "../lib/harness.mjs";
import { scratchDatabase, trySql } from "../lib/pg.mjs";
import { PG } from "../lib/config.mjs";

const { check, report } = suite();

const OWNER = "00000000-0000-4000-8000-00000000000a";
const MANAGER = "00000000-0000-4000-8000-00000000000b";
const STRANGER = "00000000-0000-4000-8000-00000000000c";
const GAME = "20000000-0000-4000-8000-0000000000a1";
const RACE = "20000000-0000-4000-8000-0000000000a2";
const ACK = "The buyer was shown the rules and agreed, including that their first name and last initial appear in the drawing broadcast.";

const db = await scratchDatabase("instore");
const sql = db.sql;
const one = async (t) => (await sql(t)).split("\n").pop();

/** Runs `text` as `user` over the authenticated role, in one transaction. */
const as = (user, text) =>
  new Promise((resolve) => {
    const p = spawn("psql", [
      "-h", PG.host, "-p", PG.port, "-U", PG.user, "-d", db.name, "-q", "-t", "-A", "-c",
      `set local role authenticated;
       set local request.jwt.claims = '{"sub":"${user}","role":"authenticated"}';
       ${text}`,
    ]);
    let out = "", err = "";
    p.stdout.on("data", (d) => (out += d));
    p.stderr.on("data", (d) => (err += d));
    p.on("close", (code) => resolve({ code, out: out.trim(), err: err.trim() }));
  });

let n = 0;
const sale = (user, game, qty, { email = "null", first = "Ana", last = "Lopez", phone = "'9155550100'", ack = `'${ACK}'` } = {}) => {
  n += 1;
  return as(user, `select public.record_in_store_sale('${game}', ${qty}, '${first}', '${last}', ${email}, ${phone}, ${ack}, 'MLF-S-T${n}', 'tok${n}');`);
};
const numbersOf = (r) => JSON.parse(r.out.split("\n").pop() || "{}").numbers ?? null;
const status = (game, num) => one(`select status || ' ' || coalesce(order_id::text, '-') from public.game_spots where game_id = '${game}' and spot_number = ${num}`);
const snapshot = () => sql(`select json_agg(json_build_object('n', spot_number, 's', status, 'o', order_id) order by spot_number)::text
  || (select count(*)::text from public.orders) from public.game_spots where game_id = '${GAME}'`);

try {
  await sql(`
    grant usage on schema public to anon, authenticated, service_role;
    grant all on all tables in schema public to anon, authenticated, service_role;
    grant all on all sequences in schema public to anon, authenticated, service_role;
    insert into auth.users (id, email) values
      ('${OWNER}', 'owner@example.com'), ('${MANAGER}', 'manager@example.com'), ('${STRANGER}', 'x@example.com');
    -- Both have set their own passwords (must_change_password defaults to true).
    insert into public.staff (user_id, role, display_name, must_change_password) values
      ('${OWNER}', 'owner', 'Rey Marquez', false), ('${MANAGER}', 'manager', 'Luis Ortega', false);
    insert into public.games (id, title, total_spots, spot_price_cents, status)
      values ('${GAME}', 'Halloween Drop', 10, 2500, 'open');
    insert into public.game_spots (game_id, spot_number) select '${GAME}', n from generate_series(1, 10) n;
  `);

  // ------------------------------------------------------ recording
  const r1 = await sale(MANAGER, GAME, 3, { email: "'ana@example.com'" });
  check("MANAGER records 3 guides: the lowest three, 1 to 3", JSON.stringify(numbersOf(r1)) === "[1,2,3]",
    r1.out || r1.err.split("\n")[0]);
  const order1 = await one(`select json_build_object('source', source, 'by', recorded_by_name, 'terms', game_terms_text,
    'gateway', gateway, 'email', email, 'total', total_cents, 'at', game_terms_accepted_at is not null)::text
    from public.orders where order_number = 'MLF-S-T1'`);
  const o1 = JSON.parse(order1 || "{}");
  check("recorded as an in-store order, by the manager's name, with what the buyer agreed to",
    o1.source === "in_store" && o1.by === "Luis Ortega" && o1.terms === ACK && o1.at === true, order1);
  check("no card, no gateway: the money was taken at the register",
    o1.gateway === "in_store" && o1.total === 7500, order1);
  check("the guides are sold to that order, with the buyer on them",
    (await one(`select count(*) from public.game_spots s join public.orders o on o.id = s.order_id
      where o.order_number = 'MLF-S-T1' and s.status = 'sold' and s.first_name = 'Ana' and s.email = 'ana@example.com'`)) === "3");
  check("and the order line says which numbers",
    (await one(`select spot_numbers::text from public.order_items i join public.orders o on o.id = i.order_id where o.order_number = 'MLF-S-T1'`)) === "{1,2,3}");

  // Next available, lowest first, around an online sale and a live hold.
  await sql(`
    update public.game_spots set status = 'held', held_at = now() where game_id = '${GAME}' and spot_number = 4;
    update public.game_spots set status = 'held', held_at = now() - interval '20 minutes' where game_id = '${GAME}' and spot_number = 5;`);
  const r2 = await sale(MANAGER, GAME, 2);
  check("the next sale skips a live online checkout and takes an abandoned one: 5 and 6",
    JSON.stringify(numbersOf(r2)) === "[5,6]", r2.out || r2.err.split("\n")[0]);
  check("with no email given, the sale is still recorded",
    (await one(`select coalesce(email, 'none') from public.orders where order_number = 'MLF-S-T2'`)) === "none");

  // ------------------------------------------------------ refusals
  const before = await snapshot();
  const tooMany = await sale(MANAGER, GAME, 5);
  check("5 requested with 4 available and 1 in a checkout: refused, and says so",
    tooMany.code !== 0 && /5 guides were requested, but only 4 are available \(1 more in an online checkout right now\)/.test(tooMany.err),
    tooMany.err.split("\n")[0]);
  check("and nothing was recorded", (await snapshot()) === before);
  for (const [label, opts] of [
    ["no agreement", { ack: "''" }], ["no phone", { phone: "''" }], ["no last name", { last: "" }],
  ]) {
    const r = await sale(MANAGER, GAME, 1, opts);
    check(`refused with ${label}`, r.code !== 0, r.err.split("\n")[0]);
  }
  const stranger = await sale(STRANGER, GAME, 1);
  check("a signed-in account that is not staff is refused", stranger.code !== 0 && /Only staff/.test(stranger.err),
    stranger.err.split("\n")[0]);
  const anon = await trySql(db.name, `set local role anon; select public.record_in_store_sale('${GAME}', 1, 'A', 'B', null, '1', 'x', 'MLF-S-X', 'x');`);
  check("the anonymous key cannot call it at all", anon.code !== 0 && /permission denied/i.test(anon.err), anon.err.split("\n")[0]);
  check("and none of those recorded anything", (await snapshot()) === before);
  const online = await trySql(db.name, `insert into public.orders (order_number, first_name, last_name, subtotal_cents, total_cents, confirmation_token, disclaimer_accepted_at, disclaimer_text, refund_policy_text)
    values ('MLF-NOEMAIL', 'A', 'B', 1, 1, 't', now(), 'x', 'x');`);
  check("an ONLINE order still cannot be saved without an email", online.code !== 0 && /orders_online_complete/.test(online.err),
    online.err.split("\n")[0]);

  // ------------------------------------------------------ voiding
  const t2 = await one(`select id from public.orders where order_number = 'MLF-S-T2'`);
  const mv = await as(MANAGER, `select public.void_in_store_sale('${t2}');`);
  check("MANAGER cannot void, even calling the database directly", mv.code !== 0 && /Only the owner/.test(mv.err),
    mv.err.split("\n")[0]);
  check("and the sale stands", (await status(GAME, 5)).startsWith("sold"));
  const ov = await as(OWNER, `select public.void_in_store_sale('${t2}');`);
  check("OWNER voids it: its two guides are returned", ov.code === 0 && ov.out.split("\n").pop() === "2", ov.out || ov.err);
  check("they are available again, with no buyer on them",
    (await one(`select count(*) from public.game_spots where game_id = '${GAME}' and spot_number in (5, 6)
      and status = 'open' and order_id is null and first_name is null and phone is null`)) === "2");
  check("the order is kept, marked voided by the owner",
    (await one(`select status || ' ' || voided_by_name || ' ' || (voided_at is not null) from public.orders where id = '${t2}'`)) === "cancelled Rey Marquez true");
  const again = await as(OWNER, `select public.void_in_store_sale('${t2}');`);
  check("voiding twice is refused", again.code !== 0 && /already voided/.test(again.err), again.err.split("\n")[0]);
  const onlineOrder = (await sql(`insert into public.orders (order_number, email, first_name, last_name, subtotal_cents, total_cents, confirmation_token, disclaimer_accepted_at, disclaimer_text, refund_policy_text, game_id)
    values ('MLF-ONLINE', 'o@example.com', 'O', 'N', 1, 1, 't', now(), 'x', 'x', '${GAME}') returning id`)).split("\n")[0];
  const ovo = await as(OWNER, `select public.void_in_store_sale('${onlineOrder}');`);
  check("an online order cannot be voided this way", ovo.code !== 0 && /Only an in-store sale/.test(ovo.err), ovo.err.split("\n")[0]);

  // Sell the rest (the live hold on 4 releases after its time), then draw.
  await sql(`update public.game_spots set status = 'open', held_at = null where game_id = '${GAME}' and spot_number = 4`);
  const rest = await sale(MANAGER, GAME, 7);
  check("selling the last 7 fills the drop", rest.code === 0 &&
    (await one(`select status from public.games where id = '${GAME}'`)) === "full", rest.err.split("\n")[0]);
  const full = await sale(MANAGER, GAME, 1);
  check("a sale on a sold-out drop is refused", full.code !== 0 && /sold out/.test(full.err), full.err.split("\n")[0]);
  await sql(`insert into public.winners (game_id, spot_id, display_name, seed, ticket, ticket_index, entry_total)
    select '${GAME}', id, 'Ana L.', 's', 1, 0, 10 from public.game_spots where game_id = '${GAME}' and spot_number = 1`);
  const t1 = await one(`select id from public.orders where order_number = 'MLF-S-T1'`);
  const drawn = await as(OWNER, `select public.void_in_store_sale('${t1}');`);
  check("once the drop is drawn, even the owner cannot void", drawn.code !== 0 && /has been drawn/.test(drawn.err),
    drawn.err.split("\n")[0]);
  check("and the winner's guides stay sold", (await status(GAME, 1)).startsWith("sold"));

  // ------------------------------------------------ the race
  // Eight guides left. Sixteen buyers at the same instant, half at the
  // counter and half online, one guide each. Released together by a
  // shared advisory lock that a gate process holds, so they really do
  // contend (see simultaneously() in tests/lib/pg.mjs).
  await sql(`
    insert into public.games (id, title, total_spots, spot_price_cents, status)
      values ('${RACE}', 'Race Drop', 8, 1000, 'open');
    insert into public.game_spots (game_id, spot_number) select '${RACE}', n from generate_series(1, 8) n;`);
  const LOCK = 424242;
  const gate = spawn("psql", ["-h", PG.host, "-p", PG.port, "-U", PG.user, "-d", db.name, "-c",
    `select pg_advisory_lock(${LOCK}); select pg_sleep(4);`]);
  await new Promise((r) => setTimeout(r, 700));
  const workers = Array.from({ length: 16 }, (_, i) => trySql(db.name, i % 2 === 0
    ? `set local request.jwt.claims = '{"sub":"${MANAGER}","role":"authenticated"}';
       select pg_advisory_lock_shared(${LOCK});
       select 'store:' || (public.record_in_store_sale('${RACE}', 1, 'C${i}', 'Buyer', null, '915', '${ACK}', 'MLF-S-R${i}', 'r${i}') ->> 'numbers');`
    : `select pg_advisory_lock_shared(${LOCK});
       select 'online:' || coalesce(public.claim_game_spots('${RACE}', 1)::text, 'none');`));
  const results = await Promise.all(workers);
  gate.kill();
  const got = results.map((r) => (r.out.split("\n").map((s) => s.trim()).filter(Boolean).pop() ?? `error:${r.err.split("\n")[0]}`));
  const numbers = got.flatMap((g) => (g.match(/\d+/g) ?? []).map(Number).filter((x) => x >= 1 && x <= 8 && !/none|error/.test(g)));
  const store = got.filter((g) => g.startsWith("store:")).length;
  const onlineWon = got.filter((g) => g.startsWith("online:") && !g.endsWith("none")).length;
  check("the race: every one of the 8 guides went to exactly one buyer",
    numbers.length === 8 && new Set(numbers).size === 8, `${got.join(" ")}`);
  check("to a mix of counter and online buyers, and the other 8 were refused",
    store > 0 && onlineWon > 0 && store + onlineWon === 8, `${store} at the counter, ${onlineWon} online`);
  check("the database agrees: 8 guides taken, none twice, none both sold and held",
    (await one(`select count(*) || ' ' || count(distinct spot_number) from public.game_spots where game_id = '${RACE}' and status in ('sold', 'held')`)) === "8 8");
  check("every counter sale in the race has its own in-store order",
    (await one(`select count(*) from public.game_spots s join public.orders o on o.id = s.order_id
      where s.game_id = '${RACE}' and s.status = 'sold' and o.source = 'in_store'`)) === String(store));
} finally {
  await db.drop();
}

report();
