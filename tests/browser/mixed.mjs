// A mixed order — a firearm collected in store plus a sized shirt that
// ships — captured to disk for eyeballing.
//
// An inspection script, not a suite: it prints sizes and leaves the
// rendered email where a person can open it. The assertions about that
// email live in emaildesign.mjs, which now places its own order rather
// than reading what this wrote.

import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { placeMixedOrder } from "../lib/mixedOrder.mjs";
import { artifacts } from "../lib/harness.mjs";

const { html, text, notifications } = await placeMixedOrder();
const dir = artifacts();
writeFileSync(join(dir, "email.html"), html);
writeFileSync(join(dir, "email.txt"), text);
writeFileSync(join(dir, "notify.json"), JSON.stringify(notifications, null, 2));

console.log(`html ${Buffer.byteLength(html)} bytes, text ${Buffer.byteLength(text)} bytes`);
console.log(`written to ${dir}`);
