/*
 * Checks floating document windows in the running IDE (`dev/plans/FLOATING_DOCUMENT_WINDOWS_PLAN.md`,
 * Phase 3): Pop Out to Window from the tab menu, the floating window's header, the document showing
 * there and gone from the IDE, opening it again from the IDE focusing its window, Dock putting it back,
 * and Close destroying the window.
 *
 * Run after `npx electron-vite build --config build/electron.vite.config.ts`:
 *   node dev/scripts/floating-windows-ide-check.cjs
 * `FLOAT_IDE_SHOTS=<dir>` writes screenshots of the steps.
 */
const fs = require("fs");
const os = require("os");
const path = require("path");
const { launchKlive } = require("./doc-shots/harness.cjs");

const PROGRAM = ["Start:", "    ld a,1", "    ld b,2", "    ret", ""].join("\n");

(async () => {
  const work = fs.mkdtempSync(path.join(os.tmpdir(), "float-ide-"));
  const shots = process.env.FLOAT_IDE_SHOTS;
  const failures = [];
  const check = (ok, what) => {
    console.log(`${ok ? "ok  " : "FAIL"} ${what}`);
    if (!ok) failures.push(what);
  };

  const klive = await launchKlive({ home: path.join(work, "home"), height: 820, userHome: path.join(work, "user") });
  const { app, ide, cmd, sleep } = klive;
  const floatWindow = () => app.windows().find((w) => w.url().includes("?float="));
  const waitFor = async (predicate, timeout = 15000) => {
    const start = Date.now();
    while (Date.now() - start < timeout) {
      const value = await predicate();
      if (value) return value;
      await sleep(250);
    }
    return undefined;
  };
  const tabNames = () =>
    ide.evaluate(() =>
      [...document.querySelectorAll('[class*="_documentTab_"] [class*="_titleText_"]')].map((e) =>
        e.textContent.trim()
      )
    );
  const shot = async (page, name) => shots && (await page.screenshot({ path: path.join(shots, `float-${name}.png`) }));
  const popOut = async (name) => {
    const tab = ide.locator('[class*="_documentTab_"]', { hasText: name }).first();
    await tab.click({ button: "right" });
    await sleep(400);
    await ide.getByText("Pop Out to Window", { exact: true }).click();
  };
  const focusedWindowUrl = () =>
    app.evaluate(({ BrowserWindow }) => BrowserWindow.getFocusedWindow()?.webContents.getURL() ?? "");

  try {
    const projects = path.join(work, "projects");
    fs.mkdirSync(projects, { recursive: true });
    await cmd(`newp sp48 floatcheck -p "${projects}"`, 5000);
    const folder = path.join(projects, "floatcheck");
    fs.writeFileSync(path.join(folder, "code", "code.kz80.asm"), PROGRAM);
    await cmd(`open "${folder}"`, 8000);
    await cmd("nav code/code.kz80.asm 3", 3000);
    check((await tabNames()).includes("code.kz80.asm"), "the document is open in the IDE");

    // --- Pop out
    await popOut("code.kz80.asm");
    const float = await waitFor(() => floatWindow());
    check(!!float, "Pop Out to Window opens a floating window");
    if (!float) throw new Error("no floating window");
    await float.waitForLoadState("domcontentloaded");
    const ready = await waitFor(() =>
      float.evaluate(() => document.querySelector('[data-app-ready="true"] .monaco-editor') !== null)
    );
    check(!!ready, "the floating window shows the document in an editor");
    const header = await float.evaluate(() => document.querySelector('[data-testid="float-header"]')?.textContent ?? "");
    check(/code\.kz80\.asm/.test(header) && /Dock/.test(header) && /Close/.test(header), `the header names the document and has Dock and Close (${JSON.stringify(header)})`);
    const frameless = await app.evaluate(({ BrowserWindow }) => {
      const w = BrowserWindow.getAllWindows().find((b) => b.webContents.getURL().includes("?float="));
      return w ? !w.isMenuBarVisible() || process.platform === "darwin" : false;
    });
    check(frameless, "the floating window has no frame of its own");
    await sleep(500);
    check(!(await tabNames()).includes("code.kz80.asm"), "the tab left the IDE");
    await shot(float, "popped-out");

    // --- An edit made in the floating window
    await float.click(".monaco-editor .view-lines");
    await float.keyboard.press(process.platform === "darwin" ? "Meta+End" : "Control+End");
    await float.keyboard.type("; floated");
    await sleep(300);

    // --- Opening it from the IDE focuses its window
    await cmd("nav code/code.kz80.asm 4", 2500);
    const focused = await waitFor(async () => (await focusedWindowUrl()).includes("?float="), 5000);
    check(!!focused, "nav to a floating document focuses its window");
    check(!(await tabNames()).includes("code.kz80.asm"), "no second copy opened in the IDE");

    // --- Dock
    await float.click('[data-testid="float-dock"]');
    const gone = await waitFor(async () => !floatWindow());
    check(!!gone, "Dock destroys the floating window");
    const back = await waitFor(async () => (await tabNames()).includes("code.kz80.asm"));
    check(!!back, "Dock puts the document back into the IDE");
    await shot(ide, "docked");
    const readIdeText = () =>
      ide.evaluate(() => (document.querySelector(".monaco-editor .view-lines")?.textContent ?? "").replace(/\u00a0/g, " "));
    const docked = await waitFor(async () => (await readIdeText()).includes("; floated"), 5000);
    check(!!docked, `the edit made in the floating window comes back with Dock${docked ? "" : ` (${JSON.stringify(await readIdeText())})`}`);
    const onDisk = fs.readFileSync(path.join(folder, "code", "code.kz80.asm"), "utf8");
    check(onDisk.includes("; floated"), "the edit is saved to the file");

    // --- Close
    await popOut("code.kz80.asm");
    const again = await waitFor(() => floatWindow());
    check(!!again, "the document pops out again");
    if (again) {
      await waitFor(() => again.evaluate(() => document.querySelector('[data-app-ready="true"]') !== null));
      await again.click('[data-testid="float-close"]');
      const closed = await waitFor(async () => !floatWindow());
      check(!!closed, "Close destroys the floating window");
      await sleep(500);
      check(!(await tabNames()).includes("code.kz80.asm"), "Close does not put the document back");
    }
  } catch (err) {
    failures.push(String(err));
    console.log(`FAIL ${err}`);
  } finally {
    // --- The quit itself is checked too: it must not stall on the floating windows' save fan-out
    const quitStart = Date.now();
    const closed = await Promise.race([
      app.close().then(() => true),
      sleep(90000).then(() => false)
    ]);
    check(closed, `the app quits (${Math.round((Date.now() - quitStart) / 1000)} s)`);
    if (!closed) {
      try {
        console.log(
          "windows left:",
          await app.evaluate(({ BrowserWindow }) =>
            BrowserWindow.getAllWindows().map((w) => `${w.webContents.getURL().split("?")[1]} visible=${w.isVisible()}`)
          )
        );
      } catch (err) {
        console.log("cannot inspect the app:", String(err));
      }
      app.process().kill("SIGKILL");
    }
  }
  if (failures.length > 0) {
    console.log(`\n${failures.length} failure(s)`);
    process.exit(1);
  }
  console.log("\nAll floating window IDE checks passed.");
})();
