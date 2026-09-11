# The double charge — what it was and what stops it now

Found 2026-09-11 in a real click-through, not by a test. Worth writing
down because the failure was invisible to every test we had, and because
the three layers below only work as a set.

## What actually happened

The first click **was not ignored**. It fired.

`CheckoutForm` wrapped the submit in React's `useTransition`:

```ts
start(() => { window.Accept.dispatchData(card, handler) })
```

`useTransition`'s `pending` flag is true only while the callback it was
given is running. That callback hands the card to Accept.js and returns
immediately — it does not wait for the callback Accept.js will invoke a
network round trip later. So `pending` went back to false within a
millisecond, the button re-enabled, and the label went back to "Pay
$—". Meanwhile tokenisation was still in flight, and the charge that
followed it was already on its way.

From the buyer's side: click, nothing happens, click again, two charges.
Exactly what was reported.

### Why no test caught it

Every automated checkout test stubbed `Accept.js` to call its handler
**synchronously**. With no gap between the click and the callback there
is no window to click into, so the bug could not occur. The reproduction
(`scratchpad/doubleclick.mjs`) stubs it with a 700ms delay instead —
that gap is the entire bug.

A second accident hid it further: a plain inventory item is protected by
the inventory claim, because the second attempt finds the item already
`reserved` and is refused. Only a **spot purchase** showed it, since a
five-spot game happily sells two more. Buying spots is what the owner
was doing.

## The three layers

Each one is defeatable on its own. That is why there are three.

### 1. The button — `components/checkout/CheckoutForm.tsx`

A `useRef` set synchronously at the top of the submit handler, before
any `await`, and a `useState` for the visible label:

```ts
if (submitting.current) return;   // before anything else
submitting.current = true;
setWorking(true);
```

The ref is what actually guards, because a ref updates immediately and
state does not. `unlock()` is called when tokenisation fails and when
the server returns a failure — but deliberately **not** on success,
because the page is navigating away and re-enabling the button there
would offer one last chance to pay twice.

Defeated by: a refresh, a second tab, a browser that re-posts.

### 2. The server action — `app/actions/checkout.ts`

Before any money moves, the action claims the key. `in_flight` is
refused with a message that tells the buyer to wait rather than
implying failure — "This payment is already going through. Give it a
few seconds — don't pay again."

Defeated by: nothing in the browser, but it depends on the key, so a
client that sends no key falls through to layers 1 and 3.

### 3. The database — `supabase/migrations/20260919100000_checkout_idempotency.sql`

`claim_checkout(key)` is a single `insert … on conflict do nothing`
followed by a check of whether the insert did anything. That check is
the whole thing:

```sql
insert into public.checkout_attempts (key) values (p_key)
  on conflict (key) do nothing;
if found then return 'claimed'; end if;
```

The obvious-looking alternative — insert, then `select` the row and
decide from that — passes a casual test and double-charges under load,
because every concurrent caller reads a row and none of them can tell
who wrote it. `scratchpad/keyrace.mjs` was run against that version to
confirm it catches it: 20 of 20 callers claimed.

Returns one of:

| Result | Meaning | What checkout does |
|---|---|---|
| `claimed` | this request owns the attempt | charge |
| `in_flight` | another request holds it right now | refuse, tell them to wait |
| `done:<order>` | an earlier attempt already completed | return that receipt, charge nothing |

An attempt older than **15 minutes** is re-claimable. Without that, a
server that died mid-charge would make the key permanently unusable and
the buyer could never retry.

`release_checkout` deletes the claim when the attempt failed in a way
that took no money — a declined card, a sold-out item. A second,
honest attempt from the same form must not be refused as a duplicate.
It will not release an attempt that has an order number, so a completed
sale cannot be reopened.

The key also lands on `orders.idempotency_key` behind a partial unique
index, so a support question can be answered from the order alone.

### And Authorize.net's own

`duplicateWindow: 120` was already set on the transaction request, so
the gateway rejects an identical charge within two minutes as a
duplicate. It is a backstop, not the mechanism: it keys on the card and
amount, so it would also reject a customer legitimately buying the same
thing twice in two minutes, and it is the gateway's judgement rather
than ours.

## The key's lifetime

Minted by the browser when the checkout form first renders, stored in
`sessionStorage` under `mlf_checkout_key`, and **cleared once the order
lands** so the next sale gets its own. A reload mid-payment reuses the
stored key, which is what makes the reload case safe.

## What is tested

`scratchpad/doubleclick.mjs` — a deliberate double click with a
realistic tokenisation delay, two simultaneous submissions of the same
cart, and a replay of a stored key after a reload. 14 checks.

`scratchpad/keyrace.mjs` — 20 connections claiming one key,
released together by a shared advisory lock, against real PostgreSQL.
Verified to fail against two plausible wrong implementations.
