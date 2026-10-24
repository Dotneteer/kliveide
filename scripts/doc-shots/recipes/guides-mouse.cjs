/**
 * Guides screenshot of the mouse capture button (`docs/content/en/guides/emulator/keyboard.mdx`,
 * "The mouse"):
 *
 * - `keyboard/mouse-capture.webp` — the EMU toolbar of a ZX Spectrum Next, the **Capture the
 *   mouse** button marked.
 *
 * Only a machine with a mouse shows the button, so the session starts on the Next (seeded through
 * `sessionSettings`, as a saved session would restore it). Nothing is typed and no other machine
 * is used. Capturing is seeded on (off, the default, disables the button), the other toolbar
 * toggles off, and the mouse is captured, so its button is the one lit button.
 */
const { park, waitFor, sleep } = require("../guides-helpers.cjs");

const MOUSE = 'button[data-icon="mouse-off"]';
const TOOLBAR = '[data-shot="emu-toolbar"]';

module.exports = {
  name: "guides-mouse",
  window: {
    width: 1100,
    height: 760,
    sessionSettings: { machineId: "zxnext", modelId: "standard" },
    // --- Capturing is off by default (DEFAULT_MOUSE_CAPTURE_ENABLED), which disables the button
    // --- Every other toggle off, so the captured mouse is the one lit button
    globalSettings: {
      emuOptions: { mouseCapture: true, stayOnTop: false, fastLoad: false },
      emuViewOptions: { showBeamPosition: false, showInstantScreen: false }
    }
  },

  async run(klive) {
    // --- A running Next, so the toolbar shows its live state (pause and stop enabled)
    await klive.cmd("em-start", 6000);
    const emu = await klive.emu({ width: 820, height: 700 });
    await waitFor(
      async () => (await emu.locator(MOUSE).count()) > 0,
      "the mouse capture button on the Next's toolbar",
      30000
    );
    await sleep(500);

    // --- The toolbar strip: the button's nearest ancestor spanning the window
    await emu.evaluate(
      ({ button, mark }) => {
        let el = document.querySelector(button);
        while (el && el.getBoundingClientRect().width < window.innerWidth * 0.9) el = el.parentElement;
        el.setAttribute("data-shot", mark);
      },
      { button: MOUSE, mark: "emu-toolbar" }
    );
    // --- Only the buttons: the strip's right part is empty
    const right = await emu.evaluate((sel) => {
      const bar = document.querySelector(sel);
      const left = bar.getBoundingClientRect().left;
      return Math.max(...[...bar.querySelectorAll("button")].map((b) => b.getBoundingClientRect().right)) - left;
    }, TOOLBAR);

    await park(emu);
    // --- Capture the mouse: a real click, as pointer lock needs the click's user activation
    await emu.locator(MOUSE).first().click();
    await waitFor(
      async () => (await emu.locator('button[data-icon="mouse"][aria-pressed="true"]').count()) > 0,
      "the mouse captured (the button lit)",
      10000
    );
    await sleep(400);
    await klive.shot(TOOLBAR, "en/guides/emulator/keyboard/mouse-capture.webp", {
      displayWidth: 640,
      page: emu,
      // --- No marker: in a strip this thin a badge covers the button it points at
      crop: { x: 0, y: 0, width: Math.ceil(right + 8) }
    });
  }
};
