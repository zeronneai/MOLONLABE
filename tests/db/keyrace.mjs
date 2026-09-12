// Twenty requests, one idempotency key, released together.
//
// Layers one and two of the double-charge protection — the disabled
// button and the in-flight guard — are both best-effort: a refresh, a
// flaky network or two tabs can defeat either. This is the layer that has
// to be right, so it is tested against real PostgreSQL.
//
// The barrier is a SHARED advisory lock, which is the whole test. With
// the exclusive form the workers queue and it passes against almost any
// implementation, including the broken one this was written to catch:
// `insert ... on conflict do nothing` followed by a read, without
// checking whether the insert did anything, tells all twenty callers
// they may charge.

import { suite } from "../lib/harness.mjs";
import { scratchDatabase, simultaneously } from "../lib/pg.mjs";

const { check, report } = suite();
const WORKERS = 20;
const KEY = "race-key-0000000001";

const db = await scratchDatabase("keyrace");
try {
  await db.sql("delete from public.checkout_attempts");

  const results = await simultaneously(
    db.name, WORKERS, `select public.claim_checkout('${KEY}');`, 918273,
  );
  const claimed = results.filter((r) => r.value === "claimed").length;
  const inFlight = results.filter((r) => r.value === "in_flight").length;

  check("exactly one of twenty simultaneous requests may charge",
    claimed === 1, `${claimed} claimed, ${inFlight} refused as in-flight`);
  check("every other request was refused, none fell through",
    claimed + inFlight === WORKERS,
    `${claimed + inFlight} of ${WORKERS}: ${[...new Set(results.map((r) => r.value))].join(", ")}`);
  check("and only one row exists for the key",
    (await db.sql(`select count(*) from public.checkout_attempts where key = '${KEY}'`)) === "1");

  // Once it completes, every later replay gets the receipt, not a charge.
  await db.sql(`select public.finish_checkout('${KEY}', 'MLF-RACE01', 'ok')`);
  const replays = await Promise.all(
    Array.from({ length: 10 }, () => db.sql(`select public.claim_checkout('${KEY}')`)),
  );
  check("every replay after completion returns the original order",
    replays.every((r) => r === "done:MLF-RACE01"),
    [...new Set(replays)].join(", "));

  // A released key is claimable exactly once more, not by everyone.
  const K2 = "race-key-0000000002";
  await db.sql(`select public.claim_checkout('${K2}')`);
  await db.sql(`select public.release_checkout('${K2}')`);
  const second = await simultaneously(
    db.name, 10, `select public.claim_checkout('${K2}');`, 918274,
  );
  check("after a failed charge releases the key, a retry is allowed exactly once",
    second.filter((r) => r.value === "claimed").length === 1,
    `${second.filter((r) => r.value === "claimed").length} claimed of 10`);
} finally {
  await db.drop();
}

report();
