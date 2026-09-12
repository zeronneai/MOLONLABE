import { chromium } from "playwright";
import { APP, CHROMIUM } from "../lib/config.mjs";
const EMAIL="owner@molonlabe.example";
const b=await chromium.launch({executablePath: CHROMIUM, });
const c=await b.newContext(); const p=await c.newPage();
await p.goto(`${APP}/admin`,{waitUntil:"networkidle"});
await p.fill('input[type="email"]',EMAIL); await p.fill('input[type="password"]',"x");
await p.click('button[type="submit"]'); await p.waitForTimeout(2500);
for (const path of ["/admin/inventory","/admin/activity","/admin/commerce","/admin/game"]) {
  await p.goto(`${APP}${path}`,{waitUntil:"networkidle"});
  const html = await p.content();
  const i = html.indexOf(EMAIL);
  console.log(path, i === -1 ? "clean" : "LEAK @"+i);
  if (i>-1) console.log("   ..."+html.slice(Math.max(0,i-260), i+90).replace(/\s+/g," "));
}
// And the server response itself, not the hydrated DOM:
const cookies = (await c.cookies()).map(k=>`${k.name}=${k.value}`).join("; ");
const r = await fetch(`${APP}/admin/activity`, { headers: { cookie: cookies } });
const body = await r.text();
console.log("server HTML:", body.includes(EMAIL) ? "LEAK" : "clean");
await b.close();
