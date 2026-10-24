/**
 * The Interface 1 and its Microdrives in the running IDE (`.plans/MICRODRIVE_PLAN.md` Phase 3), on a
 * ZX Spectrum 128K: Machine › Interfaces connects the interface and puts a cartridge into
 * Microdrive 1, the media strip shows it (with the motor running during CAT), and a SAVE * from 128
 * BASIC reaches the `.mdr` file on disk.
 *
 * Verifies before it photographs. The cartridge lives in the throwaway home folder, never in a
 * real project; the native file dialog is stubbed to answer with it.
 */
const fs = require("fs");
const path = require("path");
const { REPO } = require("../harness.cjs");

const SLOT = 543;
/** The cartridge: in the staging folder, never in a real project; written before the app starts */
const CARTRIDGE = path.join(REPO, ".doc-shots", "fixtures", "games.mdr");
fs.mkdirSync(path.dirname(CARTRIDGE), { recursive: true });

/** The byte sum mod 255 of a Microdrive block */
function checksum(bytes) {
  let sum = 0;
  for (const b of bytes) sum = (sum + b) % 255;
  return sum;
}

/** A cartridge formatted as the tools make one: slot i holds sector 254 - i, every sector free */
function formattedMdr(label) {
  const mdr = new Uint8Array(254 * SLOT + 1);
  const name = [...label.padEnd(10, " ")].map((c) => c.charCodeAt(0));
  for (let i = 0; i < 254; i++) {
    const base = i * SLOT;
    const header = [0x01, 254 - i, 0, 0, ...name];
    mdr.set(header, base);
    mdr[base + 14] = checksum(header);
    const descriptor = [0, 0, 0, 0, ...Array(10).fill(0x20)];
    mdr.set(descriptor, base + 15);
    mdr[base + 29] = checksum(descriptor);
    mdr[base + 542] = checksum(mdr.subarray(base + 30, base + 542));
  }
  return mdr;
}

async function menu(klive, id, wait = 800, { emu = false } = {}) {
  const deadline = Date.now() + 40000;
  while (Date.now() < deadline) {
    await klive.app.evaluate(({ app, BrowserWindow }, wantEmu) => {
      const win = BrowserWindow.getAllWindows().find((w) => w.webContents.getURL().includes("?emu") === wantEmu);
      if (win && !win.isFocused()) {
        app.focus({ steal: true });
        win.show();
        win.focus();
      }
    }, emu);
    const clicked = await klive.app.evaluate(({ Menu }, itemId) => {
      const item = Menu.getApplicationMenu()?.getMenuItemById(itemId);
      if (!item || !item.enabled) return false;
      item.click();
      return true;
    }, id);
    if (clicked) {
      await klive.sleep(wait);
      return;
    }
    await klive.sleep(400);
  }
  throw new Error(`The menu item ${id} never appeared`);
}

async function waitFor(check, what, timeout = 30000) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    if (await check()) return;
    await new Promise((r) => setTimeout(r, 300));
  }
  throw new Error(`${what} never happened`);
}

/**
 * Types into the emulator as a user does, a key at a time held for a few frames. A `+` joins a
 * chord: Symbol Shift is the right Alt key (`SpectrumKeyMappings.ts`), so `AltRight+p` is a quote.
 */
async function type(emu, keys) {
  for (const key of keys) {
    const chord = key.length > 1 && key.includes("+") ? key.split("+") : [key];
    for (const k of chord) await emu.keyboard.down(k);
    await new Promise((r) => setTimeout(r, 80));
    for (const k of [...chord].reverse()) await emu.keyboard.up(k);
    await new Promise((r) => setTimeout(r, 80));
  }
}

fs.writeFileSync(CARTRIDGE, formattedMdr("GAMES"));

module.exports = {
  name: "microdrives",
  // --- Scripted instances get an empty application menu in some environments, so the session is
  // --- seeded instead: a 128K with the Interface 1 and a cartridge in Microdrive 1, as a saved session
  // --- restores them (`src/main/index.ts`)
  window: {
    width: 1280,
    height: 860,
    globalSettings: { emuViewOptions: { showMediaInfo: true } },
    sessionSettings: {
      machineId: "sp128",
      modelId: "sp128",
      config: { interface1: true },
      media: { microdrive1: { diskFile: CARTRIDGE, writeProtected: false } }
    }
  },

  async run(klive) {
    const cartridge = CARTRIDGE;
    const out = path.join(REPO, ".doc-shots");
    fs.mkdirSync(out, { recursive: true });

    // --- 2. The media strip shows the Microdrives
    const emu = await klive.emu({ width: 760, height: 760 });
    const strip = emu.locator('[class*="_mediaTools_"]');
    await waitFor(async () => (await strip.innerText().catch(() => "")).includes("games.mdr"), "the cartridge on the strip");
    const stripText = await strip.innerText();
    if (!stripText.includes("(no cartridge)")) throw new Error(`Microdrive 2's card is missing: ${stripText}`);
    await strip.screenshot({ path: path.join(out, "microdrives-strip.png") });

    // --- 3. 128 BASIC: CAT 1 runs the motor
    await klive.ide.bringToFront();
    await klive.cmd("em-start", 6000);
    await klive.emu({ width: 760, height: 760 });
    await type(emu, ["ArrowDown", "Enter"]);
    await klive.sleep(1500);
    await type(emu, ["c", "a", "t", " ", "1", "Enter"]);
    await klive.sleep(1500);
    await strip.screenshot({ path: path.join(out, "microdrives-strip-running.png") });
    await waitFor(async () => (await emu.locator("#themeRoot").innerText().catch(() => "")).length > 0, "the emulator");
    await klive.sleep(10000);
    await emu.locator("#themeRoot").screenshot({ path: path.join(out, "microdrives-cat.png") });

    // --- 4. SAVE * from 128 BASIC reaches the file
    await type(emu, ["Enter"]);
    await klive.sleep(800);
    // --- save *"m";1;"hi": * is Symbol Shift + B, " is + P, ; is + O
    const q = "AltRight+p";
    const semi = "AltRight+o";
    await type(emu, ["s", "a", "v", "e", " ", "AltRight+b", q, "m", q, semi, "1", semi, q, "h", "i", q, "Enter"]);
    await waitFor(
      () => Buffer.from(fs.readFileSync(cartridge)).includes(Buffer.from("hi        ")),
      "the saved file in games.mdr",
      40000
    );
    await emu.locator("#themeRoot").screenshot({ path: path.join(out, "microdrives-saved.png") });
    console.log("  the SAVE * reached", cartridge);
  }
};
