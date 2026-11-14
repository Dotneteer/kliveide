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

const MEMORY_TAB = "Machine Memory";
const PROGRAM = ["Start:", "    ld a,1", "    ld b,2", "    ret", ""].join("\n");

(async () => {
  const work = fs.mkdtempSync(path.join(os.tmpdir(), "float-ide-"));
  const shots = process.env.FLOAT_IDE_SHOTS;
  const failures = [];
  const check = (ok, what) => {
    console.log(`${ok ? "ok  " : "FAIL"} ${what}`);
    if (!ok) failures.push(what);
  };

  const klive = await launchKlive({
    home: path.join(work, "home"),
    height: 820,
    userHome: path.join(work, "user"),
    // --- The Machine type menu lists only favourites
    globalSettings: { emuOptions: { machineFavorites: [{ machineId: "sp128", modelId: "sp128" }] } }
  });
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

  try {
    const projects = path.join(work, "projects");
    fs.mkdirSync(projects, { recursive: true });
    await cmd(`newp sp48 floatcheck -p "${projects}"`, 5000);
    const folder = path.join(projects, "floatcheck");
    fs.writeFileSync(path.join(folder, "code", "code.kz80.asm"), PROGRAM);
    fs.writeFileSync(path.join(folder, "code", "other.kz80.asm"), PROGRAM);
    // --- A tape: a document type with its own command bar (Load/Run buttons)
    const tapHeader = Buffer.alloc(19);
    tapHeader[0] = 0x00; // tapHeader block
    tapHeader[1] = 0x03; // CODE
    Buffer.from("floatcheck").copy(tapHeader, 2);
    tapHeader.writeUInt16LE(4, 12);
    tapHeader.writeUInt16LE(0x8000, 14);
    tapHeader.writeUInt16LE(0x8000, 16);
    tapHeader[18] = tapHeader.subarray(0, 18).reduce((x, b) => x ^ b, 0);
    const data = Buffer.from([0xff, 0x3e, 0x01, 0xc9, 0x00]);
    data[4] = data.subarray(0, 4).reduce((x, b) => x ^ b, 0);
    const block = (b) => Buffer.concat([Buffer.from([b.length & 0xff, b.length >> 8]), b]);
    fs.writeFileSync(path.join(folder, "game.tap"), Buffer.concat([block(tapHeader), block(data)]));
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

    // --- The document's command bar (here the build root's) is in the header, and runs in the IDE
    const commandButtons = await float.evaluate(
      () => document.querySelectorAll('[data-testid="float-commands"] button').length
    );
    check(commandButtons >= 4, `the header shows the build root's command buttons (${commandButtons})`);
    await float.locator('[data-testid="float-commands"] button').first().click();
    const compiled = await waitFor(
      async () => !(await ide.evaluate(() => document.body.innerText)).includes("Not compiled yet"),
      20000
    );
    check(!!compiled, "Compile in the floating header builds the project in the IDE");
    // --- Compile shows the Build output in the IDE, as it does from the tab strip: back to Commands
    await ide.getByText(/^commands$/i).first().click();
    await sleep(500);

    // --- An edit made in the floating window
    await float.click(".monaco-editor .view-lines");
    await float.keyboard.press(process.platform === "darwin" ? "Meta+End" : "Control+End");
    await float.keyboard.type("; floated");
    await sleep(300);

    // --- Opening it from the IDE focuses its window; the jump goes into the one shared history.
    // --- OS focus is unreliable under automation, so the check counts main's focus requests on the
    // --- floating window instead.
    await app.evaluate(({ BrowserWindow }) => {
      const w = BrowserWindow.getAllWindows().find((b) => b.webContents.getURL().includes("?float="));
      const focus = w.focus.bind(w);
      globalThis.__floatFocusCount = 0;
      w.focus = () => {
        globalThis.__floatFocusCount++;
        focus();
      };
    });
    const floatFocusCount = () => app.evaluate(() => globalThis.__floatFocusCount ?? 0);
    const activeIdeTab = () =>
      ide.evaluate(
        () =>
          document
            .querySelector('[class*="_documentTab_"][class*="_active_"] [class*="_titleText_"]')
            ?.textContent.trim() ?? ""
      );
    await cmd("nav code/other.kz80.asm 1", 2000);
    await cmd("nav code/code.kz80.asm 4 -r definition", 2500);
    check((await floatFocusCount()) === 1, "nav to a floating document focuses its window");
    check(!(await tabNames()).includes("code.kz80.asm"), "no second copy opened in the IDE");

    // --- Go Back returns to the IDE's document; Go Forward to the floating window
    // --- Pressed in the floating window: the shortcut goes through the IDE's history from there
    await float.click(".monaco-editor .view-lines");
    await float.keyboard.press(process.platform === "darwin" ? "Control+Minus" : "Alt+ArrowLeft");
    await sleep(2000);
    check(
      (await floatFocusCount()) === 1 && (await activeIdeTab()) === "other.kz80.asm",
      "Go Back from the floating document returns to the IDE"
    );
    await cmd("nav-forward", 2000);
    check((await floatFocusCount()) === 2, "Go Forward brings the floating window back");
    check(!(await tabNames()).includes("code.kz80.asm"), "Go Forward does not open a second copy in the IDE");

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

    // --- A document type's own command bar (a tape's launch buttons) comes along too
    await cmd("nav game.tap", 2500);
    await popOut("game.tap");
    const tape = await waitFor(() => floatWindow());
    if (tape) {
      await waitFor(() => tape.evaluate(() => document.querySelector('[data-app-ready="true"]') !== null));
      const tapeButtons = await waitFor(() =>
        tape.evaluate(() => document.querySelectorAll('[data-testid="float-commands"] button').length)
      );
      check(!!tapeButtons, `a tape's launch buttons are in the floating header (${tapeButtons ?? 0})`);
      await shot(tape, "tape");
      await tape.click('[data-testid="float-close"]');
      await waitFor(async () => !floatWindow());
    } else {
      check(false, "the tape pops out");
    }

    // --- A machine document floats too, and keeps working across a machine change (plan §2.3):
    // --- Klive has no rule closing documents on a machine change; each panel follows the machine
    await cmd("show-memory", 2500);
    await popOut(MEMORY_TAB);
    const memory = await waitFor(() => floatWindow());
    check(!!memory, "the Memory view pops out");
    if (memory) {
      await waitFor(() => memory.evaluate(() => document.querySelector('[data-app-ready="true"]') !== null));
      // --- The menu (and its accelerators) is complete while a floating window has the focus
      // --- The menu exists only for a focused window, and the app launched here never becomes the
      // --- frontmost one: main is told the floating window has the focus, then a state change
      // --- rebuilds the menu through the same path a real focus takes
      await app.evaluate(({ BrowserWindow }) => {
        const w = BrowserWindow.getAllWindows().find((b) => b.webContents.getURL().includes("?float="));
        if (w) w.isFocused = () => true;
        BrowserWindow.getFocusedWindow = () => w ?? null;
      });
      await cmd("nav code/other.kz80.asm 2", 1500);
      const menuReady = await waitFor(() =>
        app.evaluate(({ Menu, BrowserWindow }) => {
          const focused = BrowserWindow.getFocusedWindow();
          const menu = process.platform === "darwin" ? Menu.getApplicationMenu() : focused?.getMenu?.();
          return !!focused?.webContents.getURL().includes("?float=") && !!menu?.getMenuItemById("machine_types");
        }),
        8000
      );
      check(!!menuReady, "the menu is complete while a floating window has the focus");
      const switched = await waitFor(() =>
        app.evaluate(({ Menu }) => {
          const item = Menu.getApplicationMenu()?.getMenuItemById("machine_sp128_sp128");
          if (!item?.enabled) return false;
          item.click();
          return true;
        })
      );
      check(switched, "the machine switches to the ZX Spectrum 128");
      await sleep(6000);
      const stillThere = !!floatWindow();
      const text = stillThere ? await memory.evaluate(() => document.body.innerText) : "";
      check(
        stillThere && /[0-9A-F]{4}/.test(text) && !/cannot be opened/i.test(text),
        "the floating Memory view keeps showing memory after the machine change"
      );
      check(!(await tabNames()).includes(MEMORY_TAB), "the Memory view stays out of the IDE");
      await memory.click('[data-testid="float-close"]');
      check(!!(await waitFor(async () => !floatWindow())), "the Memory view's window closes");
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
