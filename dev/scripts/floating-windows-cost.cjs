/*
 * Measures what floating document windows cost (`dev/plans/FLOATING_DOCUMENT_WINDOWS_PLAN.md`, Phase 4):
 * pops out 8 documents one after the other, records how long each window takes to show its document
 * and the memory of every renderer process, and checks that a ninth cannot pop out.
 *
 * Run after `npx electron-vite build --config build/electron.vite.config.ts`:
 *   node dev/scripts/floating-windows-cost.cjs
 */
const fs = require("fs");
const os = require("os");
const path = require("path");
const { launchKlive } = require("./doc-shots/harness.cjs");

const COUNT = 8;

// --- Enough code that the language service has something to index
const program = (n) =>
  [
    `; File ${n}`,
    ...Array.from({ length: 200 }, (_, i) => `Label${n}_${i}:\n    ld a,${i % 256}\n    call Label${n}_${(i + 1) % 200}\n    ret`),
    ""
  ].join("\n");

(async () => {
  const work = fs.mkdtempSync(path.join(os.tmpdir(), "float-cost-"));
  const klive = await launchKlive({ home: path.join(work, "home"), height: 820, userHome: path.join(work, "user") });
  const { app, ide, cmd, sleep } = klive;
  let failed = false;
  const memory = async () => {
    const metrics = await app.evaluate(({ app: electronApp, BrowserWindow }) => {
      const byPid = new Map(
        BrowserWindow.getAllWindows().map((w) => [w.webContents.getOSProcessId(), w.webContents.getURL().split("?")[1]?.split("&")[0]])
      );
      return electronApp.getAppMetrics().map((m) => ({
        type: m.type,
        window: byPid.get(m.pid),
        // --- KB
        workingSet: m.memory.workingSetSize,
        privateBytes: m.memory.privateBytes
      }));
    });
    const mb = (kb) => Math.round((kb ?? 0) / 1024);
    const floats = metrics.filter((m) => m.window?.startsWith("float="));
    const ideProcess = metrics.find((m) => m.window === "ide");
    const total = metrics.reduce((sum, m) => sum + (m.workingSet ?? 0), 0);
    return {
      totalMb: mb(total),
      ideMb: mb(ideProcess?.workingSet),
      floatMb: floats.map((m) => mb(m.workingSet))
    };
  };

  try {
    const projects = path.join(work, "projects");
    fs.mkdirSync(projects, { recursive: true });
    await cmd(`newp sp48 floatcost -p "${projects}"`, 5000);
    const folder = path.join(projects, "floatcost");
    for (let n = 1; n <= COUNT + 1; n++) {
      fs.writeFileSync(path.join(folder, "code", `f${n}.kz80.asm`), program(n));
    }
    await cmd(`open "${folder}"`, 8000);

    const before = await memory();
    console.log(`before: total ${before.totalMb} MB, IDE renderer ${before.ideMb} MB`);

    for (let n = 1; n <= COUNT; n++) {
      const name = `f${n}.kz80.asm`;
      await cmd(`nav code/${name} 1`, 1500);
      const start = Date.now();
      await ide.locator('[class*="_documentTab_"]', { hasText: name }).first().click({ button: "right" });
      await sleep(300);
      await ide.getByText("Pop Out to Window", { exact: true }).click();
      let ready = false;
      while (Date.now() - start < 30000 && !ready) {
        const page = app.windows().find((w) => w.url().includes(`?float=${n}`));
        ready = !!page && (await page.evaluate(() => !!document.querySelector('[data-app-ready="true"] .monaco-editor')).catch(() => false));
        if (!ready) await sleep(100);
      }
      console.log(`window ${n}: ${ready ? `document shown after ${Date.now() - start} ms` : "NOT READY after 30 s"}`);
      if (!ready) failed = true;
    }
    await sleep(3000);
    const after = await memory();
    console.log(`after ${COUNT}: total ${after.totalMb} MB (+${after.totalMb - before.totalMb} MB), IDE renderer ${after.ideMb} MB`);
    console.log(`floating renderers: ${after.floatMb.join(", ")} MB (mean ${Math.round(after.floatMb.reduce((a, b) => a + b, 0) / Math.max(1, after.floatMb.length))} MB)`);

    // --- A ninth cannot pop out: the item is disabled and says why
    const ninth = `f${COUNT + 1}.kz80.asm`;
    await cmd(`nav code/${ninth} 1`, 1500);
    await ide.locator('[class*="_documentTab_"]', { hasText: ninth }).first().click({ button: "right" });
    await sleep(300);
    const limitShown = await ide.getByText("8 windows open").count();
    console.log(`${limitShown > 0 ? "ok  " : "FAIL"} a ninth document cannot pop out ("8 windows open")`);
    if (!limitShown) failed = true;
    await ide.keyboard.press("Escape");
  } catch (err) {
    failed = true;
    console.log(`FAIL ${err}`);
  } finally {
    const closed = await Promise.race([app.close().then(() => true), sleep(90000).then(() => false)]);
    if (!closed) {
      failed = true;
      console.log("FAIL the app did not quit");
      app.process().kill("SIGKILL");
    }
  }
  process.exit(failed ? 1 : 0);
})();
