// Local stand-ins for Supabase (a PostgREST subset) and Authorize.net.
// TEST FIXTURE — not shipped code. Everything under test is the app's own.

import http from "node:http";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

// ---------------------------------------------------------------------
// The double knows the schema
// ---------------------------------------------------------------------
// It used to store whatever object it was handed, which meant a write to
// a column that does not exist was, to this fixture, a perfectly normal
// write. That is how the draw came to insert seed, ticket and entry_total
// into a winners table that no longer had them while every suite stayed
// green: the tests agreed with the code because nothing here disagreed.
//
// So the column list is read from lib/database.types.ts — the same file
// every query in the app is typed against — and a write naming a column
// that is not declared there is rejected the way PostgREST would reject
// it, with PGRST204. That closes the code-to-types half of the loop.
// scripts/check-schema.mjs closes the types-to-database half.
const SCHEMA = (() => {
  const src = readFileSync(join(ROOT, "lib/database.types.ts"), "utf8");
  const tablesAt = src.indexOf("Tables: {");
  const tables = new Map();
  const re = /^ {6}(\w+): \{$/gm;
  let m;
  while ((m = re.exec(src))) {
    if (m.index < tablesAt) continue;
    const rowAt = src.indexOf("Row: {", m.index);
    if (rowAt < 0) continue;
    const cols = new Set();
    for (const line of src.slice(rowAt, src.indexOf("};", rowAt)).split("\n")) {
      const c = line.match(/^\s*(\w+)\??:\s*.+;\s*$/);
      if (c && c[1] !== "Row") cols.add(c[1]);
    }
    if (cols.size) tables.set(m[1], cols);
  }
  return tables;
})();

/** Columns in `body` that the declared schema does not have. */
function undeclared(table, body) {
  const cols = SCHEMA.get(table);
  // Views and fixture-only tables are not in the types file; they are
  // not the thing this is guarding.
  if (!cols) return [];
  const rows = Array.isArray(body) ? body : [body];
  const bad = new Set();
  for (const row of rows) {
    for (const k of Object.keys(row ?? {})) if (!cols.has(k)) bad.add(k);
  }
  return [...bad];
}

const PORT = Number(process.argv[2] || 4010);

const RIFLE = "11111111-1111-4111-8111-111111111111";
const OPTIC = "22222222-2222-4222-8222-222222222222";
const SHIRT = "33333333-3333-4333-8333-333333333333";
const PATCH = "44444444-4444-4444-8444-444444444444";
const GAME = "55555555-5555-4555-8555-555555555555";
const V_S = "aaaaaaaa-0000-4000-8000-000000000001";
const V_M = "aaaaaaaa-0000-4000-8000-000000000002";
const V_L = "aaaaaaaa-0000-4000-8000-000000000003";

const item = (o) => ({
  brand: null, short_desc: null, long_desc: null, specs: {},
  price_display: null, price_cents: null, fulfillment_type: "pickup",
  shipping_tier: "standard", has_variants: false, status: "available", is_featured: false,
  created_by: null, created_by_name: null, updated_by: null, updated_by_name: null,
  sort_order: 0, images: [], video_url: null,
  created_at: "2026-08-01T00:00:00Z", updated_at: "2026-08-01T00:00:00Z", ...o,
});

const seed = () => ({
  items: [
    item({ id: RIFLE, slug: "sig-mpx-carbon", name: "SIG MPX Carbon", category: "pcc",
      price_display: "$2,199", price_cents: 219900, fulfillment_type: "pickup", sort_order: 1 }),
    item({ id: OPTIC, slug: "holosun-507c", name: "Holosun 507C", category: "optic",
      price_display: "$329", price_cents: 32960, fulfillment_type: "ship", sort_order: 2 }),
    item({ id: SHIRT, slug: "molon-labe-tee", name: "Molon Labe Tee", category: "apparel",
      brand: "MLF", price_display: "$32", price_cents: 3200,
      fulfillment_type: "ship", has_variants: true, sort_order: 3 }),
    item({ id: PATCH, slug: "skull-patch", name: "Skull Patch", category: "accessory",
      price_display: "$12", price_cents: 1200, fulfillment_type: "ship", sort_order: 4 }),
  ],
  item_variants: [
    { id: V_S, item_id: SHIRT, size: "Small", stock: 4, sort_order: 0, created_at: "2026-08-01T00:00:00Z" },
    { id: V_M, item_id: SHIRT, size: "Medium", stock: 1, sort_order: 1, created_at: "2026-08-01T00:00:00Z" },
    { id: V_L, item_id: SHIRT, size: "Large", stock: 0, sort_order: 2, created_at: "2026-08-01T00:00:00Z" },
  ],
  games: [{
    id: GAME, title: "September Rifle Game", item_id: RIFLE, description: null,
    status: "open", winner_note: null, total_spots: 5, spot_price_cents: 3000,
    created_by: null, created_by_name: null, updated_by: null, updated_by_name: null,
    created_at: "2026-08-01T00:00:00Z",
  }],
  game_spots: Array.from({ length: 5 }, (_, i) => ({
    id: `bbbbbbbb-0000-4000-8000-${String(i + 1).padStart(12, "0")}`,
    game_id: GAME, spot_number: i + 1, status: "open",
    order_id: null, first_name: null, last_name: null, email: null, phone: null,
    held_at: null, sold_at: null,
  })),
  settings: [
    { key: "commerce", value: {
        tax_rate_bps: 825, shipping_standard_cents: 1000, shipping_oversize_cents: 2000,
      }, updated_at: null, updated_by: null, updated_by_name: null },
    // Easy round so a test can actually win one by clicking.
    { key: "game_difficulty", value: {
        desktop: { roundMs: 20000, targetCount: 3, popMs: 1900, magSize: 12 },
        mobile:  { roundMs: 20000, targetCount: 3, popMs: 1900, magSize: 12 },
      }, updated_at: null },
    { key: "game_offer", value: {
        enabled: true, code: "MOLON10", value: "10% off your next accessory",
        expires: null, note: "Accessories and apparel only. Not valid on firearms.",
      }, updated_at: null },
  ],
  orders: [], order_items: [], inquiries: [], winners: [],
  emails: [], notifications: [], charges: [], checkout_attempts: [],
  admin_activity: [],
});

let db = seed();
let failTable = null;
let mailRefuses = false;

function test(row, key, value) {
  const negated = value.startsWith("not.");
  const v = negated ? value.slice(4) : value;
  let result;
  if (v.startsWith("eq.")) result = String(row[key]) === v.slice(3);
  else if (v.startsWith("neq.")) result = String(row[key]) !== v.slice(4);
  else if (v.startsWith("gte.")) result = Number(row[key]) >= Number(v.slice(4));
  else if (v.startsWith("in.")) {
    const list = v.slice(3).replace(/^\(|\)$/g, "").split(",").map((x) => x.replace(/^"|"$/g, ""));
    result = list.includes(String(row[key]));
  } else if (v.startsWith("ilike.")) {
    result = String(row[key] ?? "").toLowerCase().includes(v.slice(6).replace(/%/g, "").toLowerCase());
  } else if (v.startsWith("is.")) {
    result = v.slice(3) === "null" ? row[key] == null : row[key] != null;
  } else result = true;
  return negated ? !result : result;
}

const matches = (row, params) =>
  params.every(([k, val]) =>
    ["select", "order", "limit", "offset", "apikey"].includes(k) ? true : test(row, k, String(val)));

function orderLimit(rows, params) {
  for (const clause of params.getAll("order")) {
    const [col, dir] = clause.split(".");
    rows = [...rows].sort((a, b) => (a[col] === b[col] ? 0 : (a[col] > b[col] ? 1 : -1) * (dir === "desc" ? -1 : 1)));
  }
  const limit = params.get("limit");
  return limit ? rows.slice(0, Number(limit)) : rows;
}

const singular = (req) => (req.headers.accept ?? "").includes("vnd.pgrst.object");

function send(res, status, payload, headers = {}) {
  res.writeHead(status, { "content-type": "application/json", "access-control-allow-origin": "*",
    "access-control-allow-headers": "*", "access-control-allow-methods": "*", ...headers });
  res.end(payload === undefined ? "" : JSON.stringify(payload));
}

const readBody = (req) => new Promise((resolve) => {
  let d = ""; req.on("data", (c) => (d += c));
  req.on("end", () => { try { resolve(d ? JSON.parse(d) : null); } catch { resolve(null); } });
});

// Real gateway behaviour the client has to survive: a BOM before the JSON.
function authorizeNet(body) {
  const tx = body?.createTransactionRequest?.transactionRequest;
  const auth = body?.createTransactionRequest?.merchantAuthentication;
  if (!auth?.name || !auth?.transactionKey) {
    return { messages: { resultCode: "Error", message: [{ code: "E00007", text: "User authentication failed." }] } };
  }
  if ((tx?.payment?.opaqueData?.dataValue ?? "").includes("DECLINE")) {
    return {
      transactionResponse: { responseCode: "2", authCode: "", transId: "0",
        accountNumber: "XXXX0002", accountType: "Visa",
        errors: [{ errorCode: "2", errorText: "This transaction has been declined." }] },
      messages: { resultCode: "Ok", message: [{ code: "I00001", text: "Successful." }] },
    };
  }
  return {
    transactionResponse: { responseCode: "1", authCode: "8H2K4L",
      transId: String(60000000000 + Math.floor(Math.random() * 999999)),
      accountNumber: "XXXX1111", accountType: "Visa",
      messages: [{ code: "1", description: "This transaction has been approved." }] },
    messages: { resultCode: "Ok", message: [{ code: "I00001", text: "Successful." }] },
  };
}


const FAKE_USER_ID = "9f1c0d2e-4b6a-4c8d-9e10-2f3a4b5c6d7e";
const b64u = (o) =>
  Buffer.from(JSON.stringify(o)).toString("base64url");
/** JWT-shaped, never verified — the double is the issuer and the audience. */
function fakeJwt() {
  const now = Math.floor(Date.now() / 1000);
  return [
    b64u({ alg: "HS256", typ: "JWT" }),
    b64u({ sub: FAKE_USER_ID, aud: "authenticated", role: "authenticated",
           email: "owner@molonlabe.example", iat: now, exp: now + 3600,
           user_metadata: { full_name: "Rey Marquez" } }),
    "not-a-real-signature",
  ].join(".");
}

http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://127.0.0.1:${PORT}`);
  const path = url.pathname;
  const params = [...url.searchParams.entries()];
  if (req.method === "OPTIONS") return send(res, 204);
  if (path === "/__reset") { db = seed(); mailRefuses = false; return send(res, 200, { ok: true }); }
  if (path === "/__dump") return send(res, 200, db);
  // Make one table's writes fail, to exercise the paths where the money
  // moved and the database did not keep up.
  if (path === "/__fail") {
    failTable = url.searchParams.get("table") || null;
    return send(res, 200, { failing: failTable });
  }

  // A script that accepts the request and then reports it could not
  // send — the shape a real one uses when Gmail's daily cap is hit.
  if (path === "/appsscript-refuse") {
    await readBody(req);
    return send(res, 200, { ok: false, error: "Service invoked too many times for one day: email." });
  }
  // A script that is broken or not deployed.
  if (path === "/appsscript-500") {
    await readBody(req);
    return send(res, 500, { error: "script error" });
  }

  // Stands in for the Google Apps Script web app. Splits what it
  // receives the way the real script will: the customer confirmation is
  // an email, everything else is an owner notification.
  // Makes the mail transport refuse until the next __reset.
  //
  // There are dedicated /appsscript-refuse and /appsscript-500 routes,
  // but using them means pointing the APP at a different URL, which means
  // a second app instance with different env — and the test that needed
  // this had quietly stopped doing that, so it was asserting a transport
  // failure while the transport happily succeeded. Four assertions were
  // failing at the transport's success. A toggle the test can flip keeps
  // the whole thing in one process.
  if (path === "/__failmail") {
    mailRefuses = url.searchParams.get("off") !== "1";
    return send(res, 200, { refusing: mailRefuses });
  }

  if (path === "/appsscript") {
    const body = await readBody(req);
    // Only the CUSTOMER's copy is refused, not the owner notification.
    // Refusing both would be a different scenario — the whole transport
    // down — and would make "the owner is told the copy did not go"
    // impossible by construction, since that message travels the same
    // way. What is modelled here is the send that fails on its own:
    // a bad recipient address, a quota, a rejected attachment.
    if (mailRefuses && body?.kind === "order_confirmation") {
      // Apps Script answers 200 even when the script itself failed; the
      // failure is in the body. That is the shape the app has to handle,
      // so it is the shape refused here.
      return send(res, 200, { ok: false, error: "Script refused the send." });
    }
    if (body?.kind === "order_confirmation") db.emails.push(body);
    else db.notifications.push(body);
    // Apps Script answers 200 with whatever the script returns. A script
    // that wants to report failure answers {ok:false}; this one succeeds.
    return send(res, 200, { ok: true });
  }

  // Stands in for Resend, so the confirmation email can be read back
  // exactly as the app rendered and sent it.
  if (path === "/emails") {
    const body = await readBody(req);
    db.emails.push({ ...body, at: new Date().toISOString() });
    return send(res, 200, { id: randomUUID() });
  }
  if (path === "/authorizenet") {
    const body = await readBody(req);
    const tx = body?.createTransactionRequest?.transactionRequest;
    db.charges.push({
      at: new Date().toISOString(),
      amount: tx?.amount,
      invoice: tx?.order?.invoiceNumber ?? null,
      nonce: tx?.payment?.opaqueData?.dataValue ?? null,
    });
    const payload = authorizeNet(body);
    res.writeHead(200, { "content-type": "application/json" });
    return res.end("﻿" + JSON.stringify(payload));
  }
  // A signed-in owner, so the admin can be exercised. The name lives in
  // user_metadata exactly as Supabase carries it; the email is present
  // and deliberately different from the name, so a test can prove the
  // admin renders the name and never the mailbox.
  if (path === "/auth/v1/user" || path === "/auth/v1/token") {
    const auth = req.headers.authorization ?? "";
    if (!auth.includes(".") && path === "/auth/v1/user") {
      return send(res, 401, { message: "no session" });
    }
    const user = {
      id: FAKE_USER_ID,
      aud: "authenticated",
      role: "authenticated",
      email: "owner@molonlabe.example",
      email_confirmed_at: "2026-01-01T00:00:00Z",
      phone: "",
      created_at: "2026-01-01T00:00:00Z",
      updated_at: "2026-01-01T00:00:00Z",
      app_metadata: { provider: "email", providers: ["email"] },
      user_metadata: { full_name: "Rey Marquez" },
      identities: [],
    };
    if (path === "/auth/v1/user") return send(res, 200, user);
    return send(res, 200, {
      access_token: fakeJwt(), token_type: "bearer", expires_in: 3600,
      expires_at: Math.floor(Date.now() / 1000) + 3600,
      refresh_token: "fake-refresh", user,
    });
  }
  if (path.startsWith("/auth/v1/")) return send(res, 401, { message: "no session" });

  if (path.startsWith("/rest/v1/rpc/")) {
    const fn = path.replace("/rest/v1/rpc/", "");
    const a = (await readBody(req)) ?? {};
    if (fn === "claim_checkout") {
      const k = a.p_key;
      if (!k || k.length < 8) return send(res, 200, "claimed");
      const found = db.checkout_attempts.find((x) => x.key === k);
      if (!found) {
        db.checkout_attempts.push({ key: k, started_at: new Date().toISOString(),
          order_number: null, finished_at: null, outcome: null });
        return send(res, 200, "claimed");
      }
      if (found.order_number) return send(res, 200, `done:${found.order_number}`);
      if (Date.parse(found.started_at) < Date.now() - 15 * 60 * 1000) {
        found.started_at = new Date().toISOString();
        return send(res, 200, "claimed");
      }
      return send(res, 200, "in_flight");
    }
    if (fn === "finish_checkout") {
      const found = db.checkout_attempts.find((x) => x.key === a.p_key);
      if (found) Object.assign(found, { order_number: a.p_order ?? found.order_number,
        outcome: a.p_outcome ?? found.outcome, finished_at: new Date().toISOString() });
      return send(res, 200, null);
    }
    if (fn === "release_checkout") {
      db.checkout_attempts = db.checkout_attempts.filter(
        (x) => !(x.key === a.p_key && !x.order_number));
      return send(res, 200, null);
    }
    if (fn === "claim_game_spots") {
      // NOTE: this double is single-threaded, so it cannot exercise the
      // race the real function guards against. race.mjs does that against
      // real PostgreSQL. What this proves is the app's use of it.
      const open = db.game_spots
        .filter((sp) => sp.game_id === a.p_game && sp.status === "open")
        .sort((x, y) => x.spot_number - y.spot_number);
      if (a.p_qty <= 0 || open.length < a.p_qty) return send(res, 200, null);
      const taken = open.slice(0, a.p_qty);
      for (const sp of taken) { sp.status = "held"; sp.held_at = new Date().toISOString(); }
      return send(res, 200, taken.map((sp) => sp.spot_number));
    }
    if (fn === "release_game_spots") {
      for (const sp of db.game_spots) {
        if (sp.game_id === a.p_game && sp.status === "held" && a.p_spots.includes(sp.spot_number)) {
          sp.status = "open"; sp.held_at = null;
        }
      }
      return send(res, 200, null);
    }
    if (fn === "sell_game_spots") {
      for (const sp of db.game_spots) {
        if (sp.game_id === a.p_game && sp.status === "held" && a.p_spots.includes(sp.spot_number)) {
          Object.assign(sp, {
            status: "sold", sold_at: new Date().toISOString(), order_id: a.p_order,
            first_name: a.p_first_name, last_name: a.p_last_name,
            email: a.p_email, phone: a.p_phone,
          });
        }
      }
      const g = db.games.find((x) => x.id === a.p_game);
      if (g && g.status === "open" &&
          !db.game_spots.some((sp) => sp.game_id === a.p_game && sp.status !== "sold")) {
        g.status = "full";
      }
      return send(res, 200, null);
    }
    if (fn === "game_spots_remaining") {
      return send(res, 200, db.game_spots.filter(
        (sp) => sp.game_id === a.p_game && sp.status === "open").length);
    }
    if (fn === "claim_variant_stock") {
      const v = db.item_variants.find((x) => x.id === a.p_variant);
      if (!v || a.p_qty <= 0 || v.stock < a.p_qty) return send(res, 200, false);
      v.stock -= a.p_qty;
      return send(res, 200, true);
    }
    if (fn === "release_variant_stock") {
      const v = db.item_variants.find((x) => x.id === a.p_variant);
      if (v && a.p_qty > 0) v.stock += a.p_qty;
      return send(res, 200, null);
    }
    if (fn === "add_purchase_entries") {
      const found = db.entrants.find((e) => e.campaign_id === a.p_campaign &&
        String(e.email).toLowerCase() === String(a.p_email).toLowerCase());
      if (found) {
        found.entry_count += a.p_entries;
        found.entry_method = found.entry_method === "purchase" ? "purchase" : "mixed";
        return send(res, 200, found.entry_count);
      }
      db.entrants.push({ id: randomUUID(), campaign_id: a.p_campaign, first_name: a.p_first_name,
        last_name: a.p_last_name, email: a.p_email, phone: a.p_phone, entry_count: a.p_entries,
        entry_method: "purchase", source: "online", created_at: new Date().toISOString() });
      return send(res, 200, a.p_entries);
    }
    if (fn === "entry_count") {
      return send(res, 200, db.entrants.filter((e) => e.campaign_id === a.campaign)
        .reduce((s, e) => s + e.entry_count, 0));
    }
    if (fn === "entrant_count") {
      return send(res, 200, db.entrants.filter((e) => e.campaign_id === a.campaign).length);
    }
    return send(res, 404, { message: `no function ${fn}` });
  }

  // PostgREST serves an OpenAPI document at the API root describing every
  // table it can see. scripts/check-schema.mjs reads it — that is its
  // PRIMARY path, the one the agency uses, and it had never been
  // exercised because this double had no root route. Shaped from the
  // same SCHEMA map, so the check is tested against something with the
  // same structure PostgREST returns.
  if (path === "/rest/v1/" || path === "/rest/v1") {
    const definitions = {};
    for (const [t, cols] of SCHEMA) {
      definitions[t] = {
        properties: Object.fromEntries([...cols].map((c) => [c, { type: "string" }])),
      };
    }
    return send(res, 200, { swagger: "2.0", definitions });
  }

  if (!path.startsWith("/rest/v1/")) return send(res, 404, { message: "no route" });
  const table = path.replace("/rest/v1/", "");
  // Also a view. The freeze is the point of it: a drawn game reports
  // what was true at the draw, from the winners row, not a recount.
  if (table === "game_scoreboard") {
    db.game_scoreboard = db.games.map((g) => {
      const soldNow = db.game_spots.filter(
        (sp) => sp.game_id === g.id && sp.status === "sold",
      ).length;
      const w = db.winners.find((x) => x.game_id === g.id);
      const frozen = w?.entry_total != null;
      return {
        game_id: g.id,
        total_spots: g.total_spots,
        sold: frozen ? w.entry_total : soldNow,
        frozen,
        sold_now: soldNow,
      };
    });
  }
  if (!db[table]) db[table] = [];

  // `head: true` in supabase-js is a real HEAD request: the caller wants
  // the count and nothing else. The double used to fall through to the
  // 404 at the bottom, so every count read came back null.
  if (req.method === "HEAD" || req.method === "GET") {
    const matched = db[table].filter((r) => matches(r, params));
    const rows = orderLimit(matched, url.searchParams);
    // PostgREST returns a count in Content-Range when asked, and returns
    // no body at all for a HEAD-style `head: true` request. Without this
    // the client's `count` comes back null, and any branch that reads it
    // silently takes the wrong path — which is exactly what hid the
    // held-spots message in the draw refusal.
    const wantsCount = /count=(exact|planned|estimated)/.test(
      req.headers.prefer ?? "",
    );
    if (wantsCount || req.method === "HEAD") {
      const range = matched.length
        ? `0-${Math.max(rows.length - 1, 0)}/${matched.length}`
        : `*/0`;
      return send(
        res,
        200,
        req.method === "HEAD" ? undefined : rows,
        { "content-range": range },
      );
    }
    if (singular(req)) {
      if (rows.length === 0) {
        return send(res, 406, { code: "PGRST116", message: "JSON object requested, multiple (or no) rows returned" });
      }
      return send(res, 200, rows[0]);
    }
    return send(res, 200, rows);
  }
  if (req.method === "POST") {
    const body = await readBody(req);
    // Column defaults the real schema applies. Without these the fixture
    // hands the app rows the database could never produce — winners with
    // no drawn_at, for instance, which crashed a page that is correct.
    const DEFAULTS = {
      winners: () => ({ drawn_at: new Date().toISOString() }),
      orders: () => ({ created_at: new Date().toISOString() }),
      admin_activity: () => ({ at: new Date().toISOString() }),
    };
    if (DEFAULTS[table] && body) {
      const withDefaults = (r) => ({ ...DEFAULTS[table](), ...r });
      if (Array.isArray(body)) body.forEach((r, i) => (body[i] = withDefaults(r)));
      else Object.assign(body, withDefaults(body));
    }
    if (failTable === table) {
      return send(res, 500, { code: "XX000", message: `injected failure on ${table}` });
    }
    const stray = undeclared(table, body);
    if (stray.length) {
      // What PostgREST says when a write names a column the table does
      // not have. The app must handle this, not be shielded from it.
      console.log(`SCHEMA REJECT ${req.method} ${table}: ${stray.join(", ")}`);
      return send(res, 400, {
        code: "PGRST204",
        message: `Could not find the '${stray[0]}' column of '${table}' in the schema cache`,
      });
    }
    // Upsert, as PostgREST does it: `on_conflict=<col>` plus the
    // merge-duplicates preference. Postgres would merge onto the unique
    // key; without this the double silently grows a second row and the
    // app looks broken when it isn't.
    const conflict = url.searchParams.get("on_conflict");
    const merging =
      conflict && (req.headers.prefer ?? "").includes("merge-duplicates");
    const created = (Array.isArray(body) ? body : [body]).map((row) => {
      if (merging) {
        const existing = db[table].find(
          (r) => String(r[conflict]) === String(row[conflict]),
        );
        if (existing) return Object.assign(existing, row);
      }
      const full = {
        id: row.id ?? randomUUID(),
        created_at: row.created_at ?? new Date().toISOString(),
        // Columns Postgres would default for us.
        ...(table === "admin_activity" ? { at: new Date().toISOString() } : {}),
        ...(table === "orders"
          ? {
              confirmation_expires_at: new Date(
                Date.now() + 365 * 24 * 3600 * 1000,
              ).toISOString(),
            }
          : {}),
        ...row,
      };
      db[table].push(full);
      return full;
    });
    if (!(req.headers.prefer ?? "").includes("return=representation")) return send(res, 201, null);
    return send(res, 201, singular(req) ? created[0] : created);
  }
  if (req.method === "PATCH") {
    const body = await readBody(req);
    const stray = undeclared(table, body);
    if (stray.length) {
      // What PostgREST says when a write names a column the table does
      // not have. The app must handle this, not be shielded from it.
      console.log(`SCHEMA REJECT ${req.method} ${table}: ${stray.join(", ")}`);
      return send(res, 400, {
        code: "PGRST204",
        message: `Could not find the '${stray[0]}' column of '${table}' in the schema cache`,
      });
    }
    const hit = db[table].filter((r) => matches(r, params));
    for (const row of hit) Object.assign(row, body);
    if (!(req.headers.prefer ?? "").includes("return=representation")) return send(res, 204);
    if (singular(req)) return hit.length ? send(res, 200, hit[0]) : send(res, 406, { code: "PGRST116" });
    return send(res, 200, hit);
  }
  if (req.method === "DELETE") {
    db[table] = db[table].filter((r) => !matches(r, params));
    return send(res, 204);
  }
  return send(res, 405, { message: "method not allowed" });
}).listen(PORT, "127.0.0.1", () => {
  console.log(`double on ${PORT} — shirt ${SHIRT} S:4 M:1 L:0`);
});
