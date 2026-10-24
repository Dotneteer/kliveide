/**
 * Guides screenshots of the EMU window (`docs/content/en/guides/emulator/`):
 *
 * - `emulator-window/window.webp` — the whole window: toolbar, a 48K listing a short BASIC program, the
 *   status bar with the machine name and the media strip;
 * - `keyboard/sp48-keyboard.webp` / `sp128-keyboard.webp` — the virtual keyboard under the screen.
 *
 * The media strip is a global emulator view option, seeded on.
 */
const { ROOT, menu, park, press, waitFor, sleep } = require("../guides-helpers.cjs");

const KEYBOARD_BUTTON = 'button[aria-label="Show/Hide keyboard"]';

async function machineName(emu) {
  return (
    await emu
      .locator('[class*="_statusBar_"] button[class*="_chip_"]')
      .first()
      .innerText()
      .catch(() => "")
  ).trim();
}

module.exports = {
  name: "guides-emulator",
  window: {
    width: 1100,
    height: 760,
    globalSettings: {
      emuViewOptions: { showMediaInfo: true, showKeyboard: false },
      emuOptions: { keyboardPanelHeight: "330px" }
    }
  },

  async run(klive) {
    await klive.cmd("em-start", 4000);
    let emu = await klive.emu({ width: 820, height: 700 });
    await sleep(2500);
    // --- A short program typed in and LISTed, so the screen shows a working machine. The 48K
    // --- takes keywords as single keys in K mode (E is REM, F is FOR, P is PRINT, N is NEXT,
    // --- K is LIST); Symbol Shift is the right Alt, Caps Shift is Shift.
    const SS = (k) => ["AltRight", k];
    const CAPS = (k) => ["ShiftLeft", k];
    const text = (s) =>
      [...s].map((c) => (c === " " ? "Space" : /[A-Z]/.test(c) ? CAPS(c.toLowerCase()) : c));
    await emu.locator("canvas").first().click();
    await press(emu, ["Enter"]);
    await sleep(600);
    const lines = [
      ["1", "0", "e", ...text("Klive IDE demo"), "Enter"],
      ["2", "0", "f", "n", SS("l"), "1", SS("f"), "8", "Enter"],
      [
        "3",
        "0",
        "p",
        SS("i"),
        "n",
        SS("n"),
        "n",
        SS("b"),
        "2",
        SS("o"),
        SS("p"),
        ...text("Hello"),
        SS("1"),
        SS("p"),
        "Enter"
      ],
      ["4", "0", "n", "n", "Enter"]
    ];
    for (const line of lines) {
      await press(emu, line);
      await sleep(400);
    }
    await press(emu, ["k", "Enter"]);
    await sleep(1200);
    await park(emu);
    await klive.shot(ROOT, "en/guides/emulator/emulator-window/window.webp", {
      displayWidth: 760,
      page: emu,
      markers: {
        toolbar: { selector: '[class*="_primaryButton_"]' },
        screen: { selector: "canvas", x: 0.5, y: 0.45 },
        media: { selector: '[class*="_mediaTools_"]', x: 0.15, y: 0.5 },
        machine: { selector: '[class*="_statusBar_"] button[class*="_chip_"]' }
      }
    });

    // --- The keyboard: a taller window, so the screen and the keys both fit
    emu = await klive.emu({ width: 820, height: 980 });
    await emu.locator(KEYBOARD_BUTTON).first().click({ force: true });
    await sleep(1500);
    await park(emu);
    await klive.shot(ROOT, "en/guides/emulator/keyboard/sp48-keyboard.webp", {
      displayWidth: 760,
      page: emu
    });

    // --- The 128K, through the Machine menu
    await menu(klive, "machine_sp128_sp128", { emu: true, wait: 2500 });
    emu = await klive.emu({ width: 820, height: 980 });
    await waitFor(async () => /128/.test(await machineName(emu)), "the 128K in the status bar");
    await klive.cmd("em-start", 4000);
    emu = await klive.emu({ width: 820, height: 980 });
    await sleep(2000);
    await park(emu);
    await klive.shot(ROOT, "en/guides/emulator/keyboard/sp128-keyboard.webp", {
      displayWidth: 760,
      page: emu
    });
    await klive.cmd("em-stop", 1500);
  }
};
