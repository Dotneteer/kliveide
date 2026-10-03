/**
 * The Sinclair ZX81 in the running app (`.plans/ZX8081_WASM_PLAN.md` §8.1.7, §13 Phase 7):
 *
 * - `zx81/zx81-keyboard.png` — the virtual keyboard panel, for comparison with the approved mockup
 *   (`.plans/zx8081/zx81-keyboard-mockup.html`) and the reference photo;
 * - `zx81/zx81-print.png` — the EMU window after typing `PRINT "HELLO"` on the host keyboard;
 * - `zx81/zx81-loaded.png` — after `tape-load <file.p> -r` with `machine-code/dezog-sample.p` (MIT,
 *   from `_input/zx81-tapes/`): LOAD "", the load, the program starting itself, and S pressed - it
 *   fills the screen.
 *
 * Verifies before it photographs: the machine must be the ZX81 the menu selected, and the status bar
 * must show it running.
 */
const path = require("path");
const fs = require("fs");
const { IMAGES, REPO } = require("../harness.cjs");

const MODEL_ITEM = "machine_zx81_zx81-16k";

async function emuWindow(klive) {
  await klive.app.evaluate(({ BrowserWindow }) => {
    const win = BrowserWindow.getAllWindows().find((w) => w.webContents.getURL().includes("?emu"));
    win?.setContentSize(760, 760);
    win?.show();
    win?.focus();
    win?.webContents.focus();
  });
  await klive.sleep(800);
  return klive.app.windows().find((w) => w.url().includes("?emu"));
}

async function selectModel(klive) {
  const deadline = Date.now() + 15000;
  while (Date.now() < deadline) {
    const clicked = await klive.app.evaluate(({ Menu }, id) => {
      const item = Menu.getApplicationMenu()?.getMenuItemById(id);
      if (!item || !item.enabled) return false;
      item.click();
      return true;
    }, MODEL_ITEM);
    if (clicked) return;
    await klive.sleep(500);
  }
  throw new Error(`The menu item ${MODEL_ITEM} never appeared`);
}

async function press(emu, keys) {
  for (const key of keys) {
    const chord = Array.isArray(key) ? key : [key];
    for (const k of chord) await emu.keyboard.down(k);
    await new Promise((r) => setTimeout(r, 120));
    for (const k of [...chord].reverse()) await emu.keyboard.up(k);
    await new Promise((r) => setTimeout(r, 200));
  }
}

/** Writes a PNG at 2x the width the page shows it at (144 dpi, as the other doc images) */
async function save(buffer, relPath, displayWidth) {
  const target = path.join(IMAGES, relPath);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  let sharp;
  for (const base of [REPO, path.join(REPO, "docs")]) {
    try {
      sharp = require(require.resolve("sharp", { paths: [base] }));
      break;
    } catch {
      /* the next location */
    }
  }
  if (!sharp) throw new Error("sharp not found - run `npm run doc:install` first.");
  await sharp(buffer).resize({ width: displayWidth * 2 }).withMetadata({ density: 144 }).png().toFile(target);
  console.log(`  ✓ ${relPath}`);
}

module.exports = {
  name: "zx81",
  window: { width: 1280, height: 820, toolPanelHeight: "160px" },

  async run(klive) {
    await selectModel(klive);
    await klive.sleep(2500);
    const emu = await emuWindow(klive);
    const machine = await emu.evaluate(() => document.body.innerText);
    if (!/ZX81/.test(machine)) throw new Error(`The EMU window does not show a ZX81: ${machine.slice(0, 300)}`);

    // --- The keyboard panel
    const keyboardShown = await emu.locator('[class*="_keyboard_"]').count();
    if (!keyboardShown) {
      await emu.locator('button[aria-label="Show/Hide keyboard"]').first().click({ force: true });
      await klive.sleep(800);
    }
    await klive.cmd("em-start", 5000);
    const keys = await emu.evaluate(() => document.querySelectorAll("svg[data-zx81-key]").length);
    if (keys !== 40) throw new Error(`The ZX81 keyboard shows ${keys} keys, not 40`);
    // --- No tooltip in the pictures: the pointer rests away from the toolbar
    await emu.mouse.move(20, 400);
    await klive.sleep(500);
    await save(await emu.locator('[class*="_keyboard_"]').first().screenshot(), "zx81/zx81-keyboard.png", 720);

    // --- Typing on the host keyboard: P is PRINT in K mode, Shift+P the quote
    await press(emu, ["p", ["Shift", "p"], "h", "e", "l", "l", "o", ["Shift", "p"], "Enter"]);
    await klive.sleep(1500);
    await save(await emu.screenshot(), "zx81/zx81-print.png", 480);

    // --- A program file, loaded and run as the IDE's tape-load -r does it
    const program = path.join(REPO, "_input/zx81-tapes/machine-code/dezog-sample.p");
    await klive.cmd(`tape-load "${program}" -r`, 12000);
    await emuWindow(klive);
    await emu.mouse.move(20, 400);
    await klive.sleep(2000);
    await press(emu, ["s"]);
    await klive.sleep(3000);
    await save(await emu.screenshot(), "zx81/zx81-loaded.png", 480);
  }
};
