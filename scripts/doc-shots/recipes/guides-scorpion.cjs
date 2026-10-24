/**
 * Guides screenshot of the Scorpion ZS-256 (`docs/content/en/guides/machines/timex-scorpion.mdx`):
 *
 * - `machines/timex-scorpion/scorpion.webp` — the EMU window of a Scorpion ZS-256: the status bar
 *   names the model, the media strip has its TR-DOS drives.
 *
 * Klive cannot ship the Scorpion's ROM, so the machine boots the ZX Spectrum 128K's ROMs, as the
 * page says it does until you name one. The session starts on the Scorpion (`sessionSettings`,
 * model `zs256`); nothing is typed.
 */
const { ROOT, park, waitFor, sleep } = require("../guides-helpers.cjs");

async function machineName(emu) {
  return (await emu.locator('[class*="_statusBar_"] button[class*="_chip_"]').first().innerText().catch(() => "")).trim();
}

module.exports = {
  name: "guides-scorpion",
  window: {
    width: 1100,
    height: 760,
    globalSettings: { emuViewOptions: { showMediaInfo: true, showKeyboard: false } },
    sessionSettings: { machineId: "scorpion", modelId: "zs256" }
  },

  async run(klive) {
    await klive.cmd("em-start", 5000);
    const emu = await klive.emu({ width: 820, height: 700 });
    await waitFor(async () => /Scorpion/.test(await machineName(emu)), "the Scorpion in the status bar");
    await sleep(1500);
    await park(emu);
    await klive.shot(ROOT, "en/guides/machines/timex-scorpion/scorpion.webp", { displayWidth: 640, page: emu });
    await klive.cmd("em-stop", 1500);
  }
};
