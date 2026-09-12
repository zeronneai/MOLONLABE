// A refusal has to reach the owner's screen in words he can act on.
// The hazard here is the opposite of a crash: the dialog closes, nothing
// changes, and he is left guessing on the day he goes live on Instagram.
//
// Button labels are uppercased in CSS, so the accessible name is
// uppercase too — every name regex below is case-insensitive on purpose.

import { chromium } from "playwright";
import { APP, DOUBLE, CHROMIUM } from "../lib/config.mjs";


const GAME="55555555-5555-4555-8555-555555555555";
const ok=[],bad=[];
const check=(l,p,d="")=>(p?ok:bad).push(`${p?"PASS":"FAIL"} ${l}${d?` — ${d}`:""}`);

const hold=(n)=>fetch(`${DOUBLE}/rest/v1/game_spots?game_id=eq.${GAME}&spot_number=eq.${n}`,
  {method:"PATCH",headers:{"content-type":"application/json"},
   body:JSON.stringify({status:"held",order_id:null,sold_at:null})});

async function sell(n,orderId){
  return fetch(`${DOUBLE}/rest/v1/game_spots?game_id=eq.${GAME}&spot_number=eq.${n}`,
    {method:"PATCH",headers:{"content-type":"application/json"},
     body:JSON.stringify({status:"sold",order_id:orderId,first_name:"Dana",last_name:"Ruiz",
       email:"dana.ruiz@example.com",show_name:true,sold_at:new Date().toISOString()})});
}
async function anOrder(num){
  const r=await fetch(`${DOUBLE}/rest/v1/orders`,{method:"POST",
    headers:{"content-type":"application/json",prefer:"return=representation"},
    body:JSON.stringify({order_number:num,confirmation_token:"t"})});
  return (await r.json())[0].id;
}

const browser=await chromium.launch({executablePath: CHROMIUM, });
async function signedIn(){
  const c=await browser.newContext();
  await c.addInitScript(()=>localStorage.setItem("mlf_age_ok","1"));
  const p=await c.newPage();
  await p.goto(`${APP}/admin`,{waitUntil:"networkidle"});
  await p.fill('input[type="email"]',"owner@molonlabe.example");
  await p.fill('input[type="password"]',"x");
  await p.click('button[type="submit"]');
  await p.waitForTimeout(2000);
  return p;
}

// ------------- nothing sold, three spots stuck mid-checkout
{
  await fetch(`${DOUBLE}/__reset`);
  for(let n=1;n<=3;n++) await hold(n);
  const p=await signedIn();
  await p.goto(`${APP}/admin/games/${GAME}`,{waitUntil:"networkidle"});
  const btn=p.getByRole("button",{name:/no spots sold yet/i});
  check("with nothing sold the draw button is not offered",
    await btn.isDisabled().catch(()=>false));
  const body=await p.locator("body").innerText();
  // The disabled button alone says "no", not "why". The ledger has to
  // account for the three spots he knows people are buying.
  check("and the screen accounts for the spots that are mid-checkout",
    /mid-checkout/i.test(body) && /3/.test(body),
    (body.match(/[^\n]*mid-checkout[^\n]*/i)??["nothing about held spots"])[0].slice(0,120));
  await p.context().close();
}

// ------------- the refusal itself, on screen and in words
{
  await fetch(`${DOUBLE}/__reset`);
  const order=await anOrder("MLF-REF001");
  for(let n=1;n<=5;n++) await sell(n,order);
  const p=await signedIn();
  await p.goto(`${APP}/admin/games/${GAME}`,{waitUntil:"networkidle"});

  // The page rendered with five sold. Between the render and the click
  // the sale is reversed — a refund, a hand edit in Supabase, a release
  // that ran late. The button he is looking at is now stale, which is
  // exactly the case that used to close the dialog and say nothing.
  for(let n=1;n<=5;n++) await hold(n);

  await p.getByRole("button",{name:/draw without ceremony/i}).click();
  await p.waitForTimeout(400);
  await p.locator('[role="dialog"] button').first().click();
  await p.waitForTimeout(2500);

  // Scoped to the draw section: the ledger carries its own alert about
  // held spots, and an unscoped locator matches both.
  const alert=await p.locator('[role="alert"]')
    .filter({hasText:/did not run/i}).first().innerText().catch(()=>"");
  check("a refused draw puts an alert on screen", Boolean(alert),
    alert ? alert.replace(/\n/g," ").slice(0,150) : "NOTHING RENDERED");
  check("the alert says the draw did not run", /did not run/i.test(alert));
  check("and explains why in plain language, not a code",
    /held|mid-checkout|didn't finish|sold/i.test(alert) && !/error|null|undefined|PGRST/i.test(alert),
    alert.replace(/\n/g," ").slice(0,200));
  check("it tells him what to do next",
    /wait|refresh|minutes/i.test(alert));
  const d=await (await fetch(`${DOUBLE}/__dump`)).json();
  check("and nothing was written — no half-drawn game", d.winners.length===0,
    `${d.winners.length} winner rows`);
  await p.context().close();
}

// ------------- already drawn
{
  await fetch(`${DOUBLE}/__reset`);
  const order=await anOrder("MLF-REF002");
  for(let n=1;n<=5;n++) await sell(n,order);
  await fetch(`${DOUBLE}/rest/v1/games?id=eq.${GAME}`,{method:"PATCH",
    headers:{"content-type":"application/json"},body:JSON.stringify({status:"drawn"})});
  await fetch(`${DOUBLE}/rest/v1/winners`,{method:"POST",
    headers:{"content-type":"application/json"},
    body:JSON.stringify({game_id:GAME,spot_id:"bbbbbbbb-0000-4000-8000-000000000001",
      display_name:"Dana R.",ticket:1})});
  const p=await signedIn();
  await p.goto(`${APP}/admin/games/${GAME}`,{waitUntil:"networkidle"});
  const body=await p.locator("body").innerText();
  check("an already-drawn game shows the winner instead of a draw control",
    /winner drawn/i.test(body) && !/draw without ceremony/i.test(body),
    (body.match(/WINNER DRAWN[\s\S]{0,60}/i)??["not shown"])[0].replace(/\n/g," "));
  await p.context().close();
}

await browser.close();
for(const l of ok) console.log(l);
for(const l of bad) console.log(l);
console.log(`\n${ok.length} passed, ${bad.length} failed`);
process.exit(bad.length===0?0:1);
