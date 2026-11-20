/*
 * Guides screenshots of the SAM Coupé (`docs/content/en/guides/machines/sam-coupe.mdx`):
 *
 * - `machines/sam-coupe/sam-keyboard.webp` — the EMU window in SAM BASIC with a line typed, and the
 *   on-screen keyboard under it.
 *
 * The machine boots through the ROM's memory test to the copyright screen; the first key only leaves it
 * (`dev/ai/sam-coupe.md`), then the recipe types a line.
 */
const h = require("../guides-helpers.cjs");
const { step, reportFailures } = require("../guides-helpers-shot.cjs");

const KEYBOARD_BUTTON = 'button[aria-label="Show/Hide keyboard"]';

/** A line of text as host key codes (letters, digits and spaces only), then ENTER */
function keysOf(line) {
  const keys = [];
  for (const ch of line) {
    if (ch === " ") keys.push("Space");
    else if (/[0-9]/.test(ch)) keys.push(`Digit${ch}`);
    else if (/[A-Z]/.test(ch)) keys.push(`Key${ch}`);
    else throw new Error(`The recipe cannot type "${ch}"`);
  }
  keys.push("Enter");
  return keys;
}

module.exports = {
  name: "guides-samcoupe",
  window: {
    width: 1280,
    height: 820,
    sideBarWidth: "320px",
    globalSettings: {
      emuViewOptions: { showMediaInfo: true, showKeyboard: false },
      emuOptions: { keyboardPanelHeight: "330px" }
    },
    sessionSettings: { machineId: "sam", modelId: "sam512" }
  },

  async run(klive) {
    let emu = await klive.emu({ width: 820, height: 980 });

    await step(klive, "boot", async () => {
      await klive.cmd("em-start", 2000);
      // --- The memory test (about 190 frames), then the copyright screen waits for a key
      await h.sleep(6000);
      emu = await klive.emu({ width: 820, height: 980 });
      await h.press(emu, ["Space"]);
      await h.sleep(2000);
      await h.press(emu, keysOf("10 PRINT 42"));
      await h.sleep(1000);
    });

    await step(klive, "keyboard", async () => {
      emu = await klive.emu({ width: 820, height: 980 });
      await emu.locator(KEYBOARD_BUTTON).first().click({ force: true });
      await h.sleep(1500);
      await h.park(emu);
      await klive.shot(h.ROOT, "en/guides/machines/sam-coupe/sam-keyboard.webp", { displayWidth: 760, page: emu });
      await emu.locator(KEYBOARD_BUTTON).first().click({ force: true });
      await h.sleep(800);
    });

    reportFailures();
  }
};
