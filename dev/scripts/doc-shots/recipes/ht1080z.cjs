/**
 * The HT-1080Z in the running app (`.plans/HT1080Z_PLAN.md` §11, Phase 9):
 *
 * - `ht1080z/ht1080z-keyboard.png` — the virtual keyboard panel (black legends on white keys, from
 *   the approved mockup);
 * - `ht1080z/ht1080z-demo.png` — the EMU window after `tape-load <ht1080z-demo.bas> -r`: CLOAD, RUN,
 *   and the program's semigraphics frame with `HT-1080Z` and `ÜDVÖZÖLJÜK!` (Series II's accents);
 * - `ht1080z/ht1080z-basic-listing.png` — the IDE with the BASIC Listing view of that program;
 * - `ht1080z/ht1080z-debug.png` — a project from the `default` template paused at a source
 *   breakpoint (`.plans/HT1080Z_CODE_INJECTION_PLAN.md` Phase 5);
 * - `ht1080z/ht1080z-tape-viewer-cas.png` and `ht1080z-tape-viewer-cmd.png` — the tape file viewer
 *   (`.plans/HT1080Z_TAPE_VIEWERS_PLAN.md` Phase 4) on the demo program as a CLOAD tape, and on a
 *   load module that copies "HELLO" to the screen.
 *
 * `ht1080z-demo.bas` is a tokenised `.bas` the Series II itself made: its lines were typed on the
 * emulated machine and its program area saved (an FFh byte, then the bytes from 42E9h).
 *
 * Verifies before it photographs: the machine must be the Series II the menu selected, the keyboard
 * must show its keys, the screen must show the program's text, and the listing its lines.
 */
const path = require("path");
const fs = require("fs");
const os = require("os");
const { IMAGES, REPO } = require("../harness.cjs");

const MODEL_ITEM = "machine_ht1080z_ht1080z-s2";
const DEMO = path.join(__dirname, "ht1080z-demo.bas");

/** A CLOAD tape of the demo program: the leader, the sync byte, D3 D3 D3 "D" and the program */
function demoCas() {
  const program = fs.readFileSync(DEMO).subarray(1);
  return Buffer.concat([Buffer.alloc(255), Buffer.from([0xa5, 0xd3, 0xd3, 0xd3, 0x44]), program]);
}

/** A load module: `LD HL,MSG / LD DE,$3C00 / LD BC,5 / LDIR / RET / MSG: "HELLO"` at $7000 */
function helloCmd() {
  const code = [0x21, 0x0c, 0x70, 0x11, 0x00, 0x3c, 0x01, 0x05, 0x00, 0xed, 0xb0, 0xc9, ...Buffer.from("HELLO")];
  return Buffer.from([0x05, 5, ...Buffer.from("HELLO"), 0x01, code.length + 2, 0x00, 0x70, ...code, 0x02, 0x02, 0x00, 0x70]);
}

/**
 * The viewer as it is on screen: the document runs on under the tool panel, so the shot is clipped
 * to the part of it its scroll viewport shows
 */
async function viewerShot(klive) {
  await klive.ide.mouse.move(5, 5);
  await klive.sleep(300);
  const clip = await klive.ide.evaluate(() => {
    const viewer = document.querySelector("[aria-label='File summary']").parentElement;
    const port = viewer.closest("[data-overlayscrollbars-viewport]") ?? viewer.parentElement;
    const a = viewer.getBoundingClientRect();
    const b = port.getBoundingClientRect();
    const top = Math.max(a.top, b.top);
    const left = Math.max(a.left, b.left);
    return { x: left, y: top, width: Math.min(a.right, b.right) - left, height: Math.min(a.bottom, b.bottom) - top };
  });
  return klive.ide.screenshot({ clip });
}

/** Opens a file in the tape viewer and waits until it shows what `ready` looks for */
async function openViewer(klive, file, ready) {
  await klive.cmd(`nav "${file.replace(/\\/g, "/")}"`, 2500);
  for (let i = 0; i < 20; i++) {
    const text = await klive.ide.evaluate(() => document.querySelector("[aria-label='File summary']")?.closest("[class*='_viewer_']")?.textContent ?? "");
    if (ready.every((r) => text.includes(r))) return;
    await klive.sleep(500);
  }
  throw new Error(`The tape viewer of ${path.basename(file)} does not show: ${ready.join(", ")}`);
}

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

    // --- The default template in the debugger, stopped at a source breakpoint
    const projects = fs.mkdtempSync(path.join(os.tmpdir(), "klive-shots-ht-"));
    try {
      await klive.cmd(`newp ht1080z hello -p "${projects}" -o`, 8000);
      await klive.cmd("bp-set [code/code.kz80.asm]:15", 1500);
      await klive.cmd("debug", 12000);
      const paused = /Paused \(PC: \$7003\)/.test(await emu.evaluate(() => document.body.innerText));
      if (!paused) throw new Error("Debug did not stop at the breakpoint on line 15 ($7003)");
      const marked = await klive.ide.evaluate(() => !!document.querySelector('[class*="activeBreakpointLine"]'));
      if (!marked) throw new Error("The editor does not mark the line the machine stopped at");
      await klive.cmd("cls", 700);
      await save(await klive.ide.screenshot(), "ht1080z/ht1080z-debug.png", 720);

      // --- The tape file viewer: a CLOAD tape with its program selected, and a load module
      await klive.cmd("em-stop", 2000);
      const folder = path.join(projects, "hello", "code");
      fs.writeFileSync(path.join(folder, "demo.cas"), demoCas());
      fs.writeFileSync(path.join(folder, "hello.cmd"), helloCmd());
      await klive.sleep(2500);
      await openViewer(klive, path.join(folder, "demo.cas"), [
        "CAS · BASIC program tape",
        "6 lines · 10–60",
        "PRINT É 348,\"HT-1080Z\";"
      ]);
      await save(await viewerShot(klive), "ht1080z/ht1080z-tape-viewer-cas.png", 720);
      await openViewer(klive, path.join(folder, "hello.cmd"), ["CMD · load module", "$7000–$7010", "Every model"]);
      await save(await viewerShot(klive), "ht1080z/ht1080z-tape-viewer-cmd.png", 720);
    } finally {
      fs.rmSync(projects, { recursive: true, force: true });
    }
  }
};
