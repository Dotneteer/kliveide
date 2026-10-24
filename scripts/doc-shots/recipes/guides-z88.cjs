/**
 * Guides screenshot of the Cambridge Z88 (`docs/content/en/guides/machines/cambridge-z88.mdx`):
 *
 * - `machines/cambridge-z88/z88-index.webp` — the EMU window of a Cambridge Z88 (OZ v5.0B Int.)
 *   booted to OZ's Index: the toolbar, the LCD, and the status bar with the model.
 *
 * The session starts on the Z88 (seeded through `sessionSettings`, with the model id the machine
 * has: `OZ50`); nothing is typed. OZ takes several seconds to boot to the Index
 * (`scripts/z88-app-pass.cjs` waits 12 s).
 */
const { ROOT, park, waitFor, sleep } = require("../guides-helpers.cjs");

async function machineName(emu) {
  return (await emu.locator('[class*="_statusBar_"] button[class*="_chip_"]').first().innerText().catch(() => "")).trim();
}

module.exports = {
  name: "guides-z88",
  window: {
    width: 1100,
    height: 760,
    sessionSettings: { machineId: "z88", modelId: "OZ50" }
  },

  async run(klive) {
    await klive.cmd("em-start", 12000);
    const emu = await klive.emu({ width: 1000, height: 330 });
    await waitFor(async () => /Z88/.test(await machineName(emu)), "the Z88 in the status bar");
    await sleep(1500);
    await park(emu);
    await klive.shot(ROOT, "en/guides/machines/cambridge-z88/z88-index.webp", {
      displayWidth: 760,
      page: emu
    });
  }
};
