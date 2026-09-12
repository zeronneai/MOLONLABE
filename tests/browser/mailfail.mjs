// A transport that refuses must not cost the customer their order.
import { chromium } from "playwright";
import { APP, DOUBLE, CHROMIUM } from "../lib/config.mjs";

const PATCH="44444444-4444-4444-8444-444444444444";
const ok=[],bad=[];
const check=(l,p,d="")=>(p?ok:bad).push(`${p?"PASS":"FAIL"} ${l}${d?` — ${d}`:""}`);
const has=(h,n)=>String(h).toLowerCase().includes(String(n).toLowerCase());
await fetch(`${DOUBLE}/__reset`);
// Make the transport refuse. Without this the test asserted a send
// failure while the send quietly succeeded, and had been doing so since
// it stopped being pointed at a refusing endpoint.
await fetch(`${DOUBLE}/__failmail`);
const b=await chromium.launch({executablePath: CHROMIUM, });
const c=await b.newContext();
await c.addInitScript(()=>{window.Accept={dispatchData:(d,h)=>h({messages:{resultCode:"Ok",message:[]},opaqueData:{dataDescriptor:"COMMON.ACCEPT.INAPP.PAYMENT",dataValue:"NONCE-OK"}})};localStorage.setItem("mlf_age_ok","1");});
const p=await c.newPage();
p.on("pageerror",e=>bad.push(`PAGE ERROR ${e.message}`));
await p.goto(`${APP}/shop`,{waitUntil:"domcontentloaded"});
await p.evaluate(id=>localStorage.setItem("mlf_cart",JSON.stringify([{itemId:id,quantity:1}])),PATCH);
await p.goto(`${APP}/checkout`,{waitUntil:"networkidle"});
for (const [k,v] of [["#firstName","Dana"],["#lastName","Ruiz"],["#email","dana.ruiz@example.com"],
  ["#shipLine1","1200 Texas Ave"],["#shipCity","El Paso"],["#shipRegion","TX"],["#shipPostalCode","79901"],
  ["#cardNumber","4111111111111111"],["#cardMonth","12"],["#cardYear","2029"],["#cardCode","123"],["#cardZip","79901"]])
  await p.fill(k,v);
await p.getByRole("checkbox").check();
await p.getByRole("button",{name:/Pay \$/}).click();
await p.waitForURL(/confirmation/,{timeout:25000});
await p.waitForTimeout(900);
const d=await (await fetch(`${DOUBLE}/__dump`)).json();
const order=d.orders[0];
check("the order still completed",Boolean(order),order?.order_number);
check("the card was still charged",Boolean(order?.gateway_transaction_id));
check("the line items were still written",d.order_items.length===1);
// The assertion that used to sit here checked `d.entrants`, a table the
// fixed-pool rebuild dropped. It had been throwing since that rebuild and
// nobody saw it, because this suite was not in the set anyone ran by
// habit. Ordinary merchandise earns nothing now, so the thing worth
// asserting is that the receipt says nothing about entries at all.
check("a merchandise order says nothing about entries",
  !d.order_items.some((l) => /entr/i.test(JSON.stringify(l))));
check("the disclaimer acceptance was still recorded",Boolean(order?.disclaimer_accepted_at));
check("but the send is recorded as NOT done",order?.confirmation_sent_at==null,
  String(order?.confirmation_sent_at));
check("nothing was pushed into the mail store",d.emails.length===0,String(d.emails.length));
const txt=await p.locator("body").innerText();
check("the buyer is told the copy did not go",has(txt,"couldn't send"));
check("the buyer still gets their receipt",has(txt,"Skull Patch")&&has(txt,"THANKS"));
const note=d.notifications.find(n=>n.kind==="order");
check("the owner is told the copy did not go",note?.confirmation_emailed===false,
  String(note?.confirmation_emailed));
await b.close();
for(const l of ok) console.log(l); for(const l of bad) console.log(l);
console.log(`\n${ok.length} passed, ${bad.length} failed`);
process.exit(bad.length===0?0:1);
