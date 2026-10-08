/**
 * Debug recordings in the running IDE (`.plans/DEBUG_SESSION_RECORDING_PLAN.md` Phase 3): on the
 * ZX Spectrum 48K, a debug session is saved with `drsave` and opened again with `drload`, through the
 * IDE's command prompt, as a user would. Checks the output of both, Debug › Save Debug Recording...
 * following the timeline, the status bar naming the recording, and Step Back working on the opened
 * timeline. Exits 1 on failure.
 *
 *   npx electron-vite build --config build/electron.vite.config.ts   # out/ must be current
 *   node scripts/debug-recording-ide-check.cjs
 *
 * The app runs with its own home under the system's temporary folder, so it never touches the real
 * `~/Klive`.
 */
const fs = require("fs");
const os = require("os");
const path = require("path");
const { launchKlive } = require("./doc-shots/harness.cjs");

async function main() {
  const work = fs.mkdtempSync(path.join(os.tmpdir(), "klive-recording-check-"));
  const userHome = path.join(work, "home");
  fs.mkdirSync(userHome, { recursive: true });
  const file = path.join(work, "bug.klr");
  const failures = [];
  const check = (ok, what, detail = "") => {
    console.log(`${ok ? "ok  " : "FAIL"} ${what}${detail ? `: ${detail}` : ""}`);
    if (!ok) failures.push(what);
  };

  const { app, ide, cmd, sleep, close } = await launchKlive({ home: path.join(work, "settings"), userHome });
  try {
    const text = async () => (await ide.evaluate(() => document.body.innerText)).replace(/\s+/g, " ");
    const statusBar = () => ide.evaluate(() => document.querySelector('[class*="_ideStatusBar_"]')?.innerText ?? "");
    const menuItem = (id) =>
      app.evaluate(({ Menu }, itemId) => {
        const item = Menu.getApplicationMenu()?.getMenuItemById(itemId);
        return item ? { enabled: item.enabled, label: item.label } : undefined;
      }, id);
    const waitFor = async (probe, ms = 15000) => {
      const deadline = Date.now() + ms;
      for (;;) {
        const value = await probe();
        if (value || Date.now() > deadline) return value;
        await sleep(250);
      }
    };

    // --- The ZX Spectrum 48K
    await app.evaluate(({ Menu }) => {
      const find = (items) => {
        for (const item of items ?? []) {
          if (item.id === "machine_sp48" || item.id?.startsWith("machine_sp48_")) return item;
          const inner = find(item.submenu?.items);
          if (inner) return inner;
        }
        return undefined;
      };
      find(Menu.getApplicationMenu()?.items)?.click();
    });
    await sleep(3000);
    check(!(await menuItem("save_debug_recording"))?.enabled, "Save Debug Recording... is disabled without a debug session");

    // --- A debug session, paused after a few seconds
    await cmd("em-debug", 4000);
    await cmd("em-pause", 1500);
    const saveItem = await waitFor(async () => ((await menuItem("save_debug_recording"))?.enabled ? true : undefined));
    check(!!saveItem, "Save Debug Recording... is enabled in a debug session");

    await cmd(`drsave "${file}" -note Saved in the running IDE`, 4000);
    const saved = await text();
    check(/Debug recording .*bug\.klr saved \(ZX Spectrum 48K\)/.test(saved), "drsave saves", saved.match(/Debug recording[^.]*\./)?.[0]);
    check(fs.existsSync(file) && fs.statSync(file).size > 1000, "the file is written", fs.existsSync(file) ? `${fs.statSync(file).size} bytes` : "missing");

    // --- Stopped, then opened again
    await cmd("em-stop", 2000);
    await cmd("cls", 500);
    await cmd(`drload "${file}"`, 5000);
    const opened = await text();
    check(/Debug recording .*bug\.klr opened: .* paused at its end/.test(opened), "drload opens it at its end", opened.match(/Debug recording[^)]*\)/)?.[0]);
    const label = await waitFor(async () => ((await statusBar()).includes("Recording: bug.klr") ? "yes" : undefined));
    check(!!label, "the status bar names the recording", await statusBar());

    // --- Step Back works on the opened timeline, and the status bar says where
    for (let i = 0; i < 3; i++) await cmd("stb", 800);
    const past = await waitFor(async () => (/⟲ −.*· bug\.klr/.test(await statusBar()) ? await statusBar() : undefined));
    check(!!past, "Step Back moves into the recording's past", (await statusBar()).replace(/\s+/g, " "));
    await cmd("hpres", 1500);
    check((await statusBar()).includes("Recording: bug.klr"), "Return to Present is back at its end");
  } finally {
    await close();
  }
  if (failures.length) {
    console.log(`\n${failures.length} check(s) failed`);
    process.exit(1);
  }
  console.log("\nAll checks passed");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
