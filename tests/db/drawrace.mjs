// Two draws at the same instant must not produce two winners.
//
// commitDraw checks for an existing winner and then writes one, which is
// a read followed by a write — two simultaneous draws can both pass the
// read. The application check is worth having, but the database has to
// be the backstop, and that is a unique index on winners.game_id. This
// is the test of the backstop, so it goes straight at the table.

import { suite } from "../lib/harness.mjs";
import { scratchDatabase, simultaneously } from "../lib/pg.mjs";

const GAME = "88888888-8888-4888-8888-888888888888";
const { check, report } = suite();

// Its own database, created and dropped here. These tests used to share
// one, and this test left winner rows that the spot-claim test then
// tripped over — so the suite's result depended on the order it ran in.
const db = await scratchDatabase("drawrace");
try {
  await db.sql(`
    insert into public.games (id, title, status, total_spots, spot_price_cents)
    values ('${GAME}', 'Race Game', 'full', 3, 3000)
  `);

  const results = await simultaneously(
    db.name,
    10,
    `insert into public.winners
       (game_id, display_name, seed, ticket, ticket_index, entry_total, pool)
     values ('${GAME}', 'Racer.', 'seed', 1, 1, 3, '[]'::jsonb);`,
    555001,
  );

  const wrote = results.filter((r) => !r.err).length;
  const refused = results.filter((r) => /unique|duplicate/i.test(r.err)).length;

  check("only one of ten simultaneous draws wrote a winner", wrote === 1,
    `${wrote} wrote, ${refused} refused by the index`);
  check("the other nine were refused by the database, not by luck",
    refused === 9, String(refused));
  check("the game holds exactly one winner row",
    (await db.sql(`select count(*) from public.winners where game_id = '${GAME}'`)) === "1");
} finally {
  await db.drop();
}

report();
