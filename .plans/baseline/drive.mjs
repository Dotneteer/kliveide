import { writeFileSync } from "node:fs";
const [,, which, expr, outFile, waitMs] = process.argv;
const list = await (await fetch("http://localhost:9222/json/list")).json();
const p = list.find(t => t.type === "page" && t.url.includes("?" + which));
if (!p) { console.error("no target for " + which); process.exit(1); }

const ws = new WebSocket(p.webSocketDebuggerUrl);
let id = 0; const pending = new Map();
const send = (method, params={}) => new Promise((res, rej) => {
  const mid = ++id; pending.set(mid, {res, rej});
  ws.send(JSON.stringify({id: mid, method, params}));
});
ws.onmessage = ev => { const m = JSON.parse(ev.data);
  if (m.id && pending.has(m.id)) { const {res,rej}=pending.get(m.id); pending.delete(m.id);
    m.error ? rej(new Error(JSON.stringify(m.error))) : res(m.result); } };
await new Promise(r => ws.onopen = r);

if (expr && expr !== "-") {
  const r = await send("Runtime.evaluate", { expression: expr, returnByValue: true, awaitPromise: true });
  console.log("eval:", JSON.stringify(r.result?.value ?? r.result?.description ?? null));
}
if (waitMs) await new Promise(r => setTimeout(r, Number(waitMs)));
if (outFile && outFile !== "-") {
  const shot = await send("Page.captureScreenshot", { format: "png" });
  writeFileSync(outFile, Buffer.from(shot.data, "base64"));
  console.log("wrote", outFile);
}
ws.close();

process.exit(0);
