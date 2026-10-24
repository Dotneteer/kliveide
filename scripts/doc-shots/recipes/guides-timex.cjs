/**
 * Guides screenshots of the Timex machines (`docs/content/en/guides/machines/timex-scorpion.mdx`):
 *
 * - `machines/timex-scorpion/timex-ts2068.webp` — the EMU window of a Timex Sinclair 2068 listing a
 *   two-line program: the status bar names the model, the media strip has the cartridge slot;
 * - `machines/timex-scorpion/timex-rom-setting.webp` — Settings › Machine while the TS2068 runs,
 *   with its **Timex ROM** row.
 *
 * Klive cannot ship Timex's ROMs, so the machine boots the Sinclair 48K ROM, as the page says it
 * does until you name one. The session starts on the TS2068 (`sessionSettings`, with the model id
 * the machine has).
 */
const { ROOT, park, press, waitFor, sleep, focusIde, hideEmu } = require("../guides-helpers.cjs");

async function machineName(emu) {
  return (await emu.locator('[class*="_statusBar_"] button[class*="_chip_"]').first().innerText().catch(() => "")).trim();
}

module.exports = {
  name: "guides-timex",
  window: {
    width: 1100,
    height: 760,
    globalSettings: { emuViewOptions: { showMediaInfo: true, showKeyboard: false } },
    sessionSettings: { machineId: "timex", modelId: "ts2068" }
  },

  async run(klive) {
    await klive.cmd("em-start", 5000);
    const emu = await klive.emu({ width: 820, height: 700 });
    await waitFor(async () => /2068/.test(await machineName(emu)), "the TS2068 in the status bar");
    await sleep(1500);
    // --- A two-line program typed on the TS2068 and LISTed, so the screen shows a working
    // --- machine: keywords are single keys in K mode (E is REM, B is BORDER, P is PRINT, K is
    // --- LIST); Symbol Shift is the right Alt, Caps Shift is Shift.
    const SS = (k) => ["AltRight", k];
    const text = (t) => [...t].map((c) => (c === " " ? "Space" : /[A-Z]/.test(c) ? ["ShiftLeft", c.toLowerCase()] : c));
    await emu.locator("canvas").first().click();
    await press(emu, ["Enter"]);
    await sleep(600);
    for (const line of [
      ["1", "0", "e", ...text("Timex Sinclair 2068"), "Enter"],
      ["2", "0", "b", "1", SS("z"), "p", SS("p"), ...text("Hello"), SS("1"), SS("p"), "Enter"]
    ]) {
      await press(emu, line);
      await sleep(400);
    }
    await press(emu, ["k", "Enter"]);
    await sleep(1200);
    await park(emu);
    await klive.shot(ROOT, "en/guides/machines/timex-scorpion/timex-ts2068.webp", { displayWidth: 640, page: emu });

    // --- The IDE's prompt needs the IDE in front: the EMU window took focus for its shot
    await hideEmu(klive);
    await focusIde(klive);
    await klive.cmd("settings machine", 1800);
    await klive.shot('[role="dialog"]', "en/guides/machines/timex-scorpion/timex-rom-setting.webp", {
      displayWidth: 720
    });
    await klive.ide.keyboard.press("Escape");
    await klive.cmd("em-stop", 1500);
  }
};
