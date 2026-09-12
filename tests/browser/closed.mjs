// A receipt read after the drawing has closed must not still announce a
// live-sounding running total.
import { chromium } from "playwright";
import { APP, DOUBLE, CHROMIUM } from "../lib/config.mjs";

const CAMPAIGN="55555555-5555-4555-8555-555555555555";
const has=(h,n)=>String(h).toLowerCase().includes(String(n).toLowerCase());
const d=await (await fetch(`${DOUBLE}/__dump`)).json();
const order=d.orders.find(o=>o.entries_awarded>0);
const link=`${APP}/checkout/confirmation?order=${order.order_number}&t=${order.confirmation_token}`;
// Un-expire the one the previous test aged out.
await fetch(`${DOUBLE}/rest/v1/orders?id=eq.${order.id}`,{method:"PATCH",
  headers:{"content-type":"application/json"},
  body:JSON.stringify({confirmation_expires_at:"2027-12-31T00:00:00Z"})});
const b=await chromium.launch({executablePath: CHROMIUM, });
const c=await b.newContext(); await c.addInitScript(()=>localStorage.setItem("mlf_age_ok","1"));
const p=await c.newPage();
await p.goto(link,{waitUntil:"networkidle"});
const live=await p.locator("body").innerText();
console.log(has(live,"You now have")?"PASS total shows while the drawing is open":"FAIL total missing while open");
// Close the campaign, then read the same receipt again.
await fetch(`${DOUBLE}/rest/v1/campaigns?id=eq.${CAMPAIGN}`,{method:"PATCH",
  headers:{"content-type":"application/json"},body:JSON.stringify({status:"closed"})});
await p.goto(link,{waitUntil:"networkidle"});
const closed=await p.locator("body").innerText();
console.log(!has(closed,"You now have")?"PASS total is withheld once the drawing closes":"FAIL still claiming a live total");
console.log(has(closed,"This order earned")?"PASS what the order earned is still shown":"FAIL earned line vanished too");
await b.close();
