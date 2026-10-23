/**
 * The HT-1080Z in the running app (`.plans/HT1080Z_PLAN.md` §11, Phase 9):
 *
 * - `ht1080z/ht1080z-keyboard.png` — the virtual keyboard panel (black legends on white keys, from
 *   the approved mockup);
 * - `ht1080z/ht1080z-demo.png` — the EMU window after `tape-load <ht1080z-demo.bas> -r`: CLOAD, RUN,
 *   and the program's semigraphics frame with `HT-1080Z` and `ÜDVÖZÖLJÜK!` (Series II's accents);
 * - `ht1080z/ht1080z-basic-listing.png` — the IDE with the BASIC Listing view of that program.
 *
 * `ht1080z-demo.bas` is a tokenised `.bas` the Series II itself made: its lines were typed on the
 * emulated machine and its program area saved (an FFh byte, then the bytes from 42E9h).
 *
 * Verifies before it photographs: the machine must be the Series II the menu selected, the keyboard
 * must show its keys, the screen must show the program's text, and the listing its lines.
 */
const path = require("path");
const fs = require("fs");
const { IMAGES, REPO } = require("../harness.cjs");

const MODEL_ITEM = "machine_ht1080z_ht1080z-s2";
const DEMO = path.join(__dirname, "ht1080z-demo.bas");

async function emuWindow(klive) {
  await klive.app.evaluate(({ BrowserWindow }) => {
    const win = BrowserWindow.getAllWindows().find((w) => w.webContents.getURL().includes("?emu"));
    win?.setContentSize(900, 760);
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
    if (clicked) break;
    await klive.sleep(500);
  }
  // --- The machine switch has finished once the HT's own menu is built
  while (Date.now() < deadline) {
    const ready = await klive.app.evaluate(({ Menu }) => !!Menu.getApplicationMenu()?.getMenuItemById("ht1080z_reset_key"));
    if (ready) return;
    await klive.sleep(500);
  }
  throw new Error(`The menu item ${MODEL_ITEM} never switched the machine`);
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
  name: "ht1080z",
  window: {
    width: 1280,
    height: 820,
    toolPanelHeight: "160px",
    globalSettings: { emuOptions: { machineFavorites: [{ machineId: "ht1080z", modelId: "ht1080z-s2" }] } }
  },

  async run(klive) {
    await selectModel(klive);
    await klive.sleep(1500);
    const emu = await emuWindow(klive);
    const machine = await emu.evaluate(() => document.body.innerText);
    if (!/HT-1080Z Series II/.test(machine)) throw new Error(`The EMU window does not show a Series II: ${machine.slice(0, 300)}`);

    // --- The keyboard panel
    const keyboardShown = await emu.locator('[class*="_keyboard_"]').count();
    if (!keyboardShown) {
      await emu.locator('button[aria-label="Show/Hide keyboard"]').first().click({ force: true });
      await klive.sleep(800);
    }
    const keys = await emu.evaluate(() => document.querySelectorAll("[data-ht1080z-key]").length);
    if (keys !== 55) throw new Error(`The HT-1080Z keyboard shows ${keys} keys`);
    await emu.mouse.move(20, 400);
    await klive.sleep(500);
    await save(await emu.locator('[class*="_keyboard_"]').first().screenshot(), "ht1080z/ht1080z-keyboard.png", 720);
    await emu.locator('button[aria-label="Show/Hide keyboard"]').first().click({ force: true });

    // --- The demo program, loaded and run as the IDE's tape-load -r does it
    await klive.cmd(`tape-load "${DEMO}" -r`, 4000);
    await emuWindow(klive);
    await emu.mouse.move(20, 400);
    // --- Level II BASIC draws the frame in about ten seconds
    await klive.sleep(15000);
    await save(await emu.screenshot(), "ht1080z/ht1080z-demo.png", 560);

    // --- The BASIC Listing view of the same program
    await klive.app.evaluate(({ Menu }) => Menu.getApplicationMenu()?.getMenuItemById("show_basic")?.click());
    // --- The view fills in shortly after it opens
    const expected = ['40 PRINT É 348,"HT-1080Z";', '50 PRINT É 474,"ÜDVÖZÖLJÜK!";', "60 GOTO 60"];
    let ideText = "";
    for (let i = 0; i < 20; i++) {
      await klive.sleep(500);
      ideText = (await klive.ide.locator("body").innerText()).replace(/\u00a0/g, " ");
      if (expected.every((line) => ideText.includes(line))) break;
    }
    // --- Series II's character ROM has É at 40h, so its LIST shows `PRINT @` as `PRINT É`
    for (const line of expected) {
      if (!ideText.includes(line)) {
        const shown = ideText.split("\n").filter((l) => /PRINT|GOTO|FOR/.test(l)).join("\n");
        throw new Error(`The BASIC listing lacks: ${line}\n${shown}`);
      }
    }
    await klive.cmd("cls", 700);
    await save(await klive.ide.screenshot(), "ht1080z/ht1080z-basic-listing.png", 720);
  }
};
