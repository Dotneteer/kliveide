import { writeFileSync } from "node:fs";

const [,, outDir, suffix] = process.argv;
const list = await (await fetch("http://localhost:9222/json/list")).json();
const pages = list.filter(t => t.type === "page");

function cdp(wsUrl) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(wsUrl);
    let id = 0; const pending = new Map();
    ws.onopen = () => resolve({
      send(method, params = {}) {
        return new Promise((res, rej) => {
          const mid = ++id; pending.set(mid, { res, rej });
          ws.send(JSON.stringify({ id: mid, method, params }));
        });
      },
      close: () => ws.close()
    });
    ws.onerror = e => reject(new Error("ws error " + (e.message || "")));
    ws.onmessage = ev => {
      const m = JSON.parse(ev.data);
      if (m.id && pending.has(m.id)) {
        const { res, rej } = pending.get(m.id); pending.delete(m.id);
        m.error ? rej(new Error(JSON.stringify(m.error))) : res(m.result);
      }
    };
  });
}

for (const p of pages) {
  const which = p.url.includes("?ide") ? "ide" : p.url.includes("?emu") ? "emu" : "other";
  if (which === "other") continue;
  const c = await cdp(p.webSocketDebuggerUrl);
  const metrics = await c.send("Page.getLayoutMetrics");
  const shot = await c.send("Page.captureScreenshot", { format: "png", captureBeyondViewport: false });
  const file = `${outDir}/${which}-${suffix}.png`;
  writeFileSync(file, Buffer.from(shot.data, "base64"));
  const cs = metrics.cssContentSize || metrics.contentSize;
  console.log(`${file}  ${cs.width}x${cs.height}  (${p.title})`);
  c.close();
}

process.exit(0);
