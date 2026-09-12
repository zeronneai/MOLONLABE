// Which functions the anonymous key may call.
//
// WHY THIS EXISTS
//
// Six migrations revoked EXECUTE on the money and inventory functions
// from `anon, authenticated`. None of it did anything. PostgreSQL grants
// EXECUTE on a new function to PUBLIC, and revoking from a named role
// does not remove a grant held by PUBLIC — so every one of them stayed
// callable with the anonymous key that ships in the browser bundle.
//
// They are SECURITY DEFINER, so they run as the owner and never see row
// level security. Demonstrated on a chain-built database before the fix:
//
//   set role anon;
//   select claim_game_spots('…', 3);  -> {1,2,3}
//   select sell_game_spots('…', array[1,2,3], null, 'Mallory', …);
//   -- three spots 'sold'. No order, no payment, no card.
//
// The revoke lines READ correct, which is why nothing noticed. So this
// asserts the privilege as the database actually computes it, and then
// proves it by trying the call.

import { suite } from "../lib/harness.mjs";
import { scratchDatabase } from "../lib/pg.mjs";

const { check, note, report } = suite();
const scratch = await scratchDatabase("rpcgrants");
const { sql, trySql } = scratch;

// The only function the public pages call. It returns one integer and
// changes nothing.
const PUBLIC_OK = ["game_spots_remaining"];

try {
  const rows = (await sql(`
    select p.proname || '|' || has_function_privilege('anon', p.oid, 'EXECUTE')
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.prokind = 'f'
    order by p.proname
  `)).split("\n").filter(Boolean).map((l) => l.split("|"));

  check("functions were found", rows.length > 5, `${rows.length}`);

  const wrong = rows.filter(([name, can]) =>
    PUBLIC_OK.includes(name) ? can !== "true" : can === "true");

  check("anon may execute ONLY the count function",
    wrong.length === 0,
    wrong.map(([n, c]) => `${n}=${c}`).join(", ") || `${rows.length} checked`);

  note(`anon may call: ${rows.filter(([, c]) => c === "true").map(([n]) => n).join(", ") || "nothing"}`);

  // The privilege table is the claim; this is the proof. A catalogue
  // that says "denied" and a call that succeeds is the exact gap that
  // made the original revokes look like they worked.
  await sql(`
    insert into public.games (id, title, total_spots, spot_price_cents, status)
    values ('22220000-0000-4000-8000-000000000001', 'grant probe', 4, 500, 'open');
    insert into public.game_spots (game_id, spot_number, status)
    select '22220000-0000-4000-8000-000000000001', g, 'open'
    from generate_series(1, 4) g;
  `);

  const claim = await trySql(
    `set role anon; select public.claim_game_spots('22220000-0000-4000-8000-000000000001', 2);`,
  );
  check("anon calling claim_game_spots is REFUSED",
    claim.code !== 0 && /permission denied/i.test(claim.err),
    claim.code === 0 ? `IT SUCCEEDED: ${claim.out}` : claim.err.split("\n")[0]);

  const sell = await trySql(
    `set role anon; select public.sell_game_spots(
       '22220000-0000-4000-8000-000000000001', array[1,2], null,
       'Mallory', 'Attacker', 'mallory@example.com', null);`,
  );
  check("anon calling sell_game_spots is REFUSED",
    sell.code !== 0 && /permission denied/i.test(sell.err),
    sell.code === 0 ? "IT SUCCEEDED — spots sold with no payment" : sell.err.split("\n")[0]);

  const stillOpen = await sql(
    `select count(*) from public.game_spots
     where game_id = '22220000-0000-4000-8000-000000000001' and status = 'open'`,
  );
  check("and nothing moved as a result", stillOpen === "4", `${stillOpen} of 4 still open`);

  // The page has to keep working, or this is a lockout rather than a fix.
  const remaining = await trySql(
    `set role anon; select public.game_spots_remaining('22220000-0000-4000-8000-000000000001');`,
  );
  check("anon CAN still read the remaining count, which the page needs",
    remaining.code === 0, remaining.err.split("\n")[0] || remaining.out);
} finally {
  await scratch.drop();
}

report();
