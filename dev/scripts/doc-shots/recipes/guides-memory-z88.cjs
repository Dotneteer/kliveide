/**
 * Guides screenshots of the Memory and Disassembly views on a Cambridge Z88
 * (`docs/content/en/guides/debugging/{memory,disassembly}.mdx`, `dev/plans/MEMORY_DISASSEMBLY_VIEWS_PLAN.md` §9):
 *
 * - `debugging/memory/bank-map-z88.webp` — the Bank map: four card slots of 64 banks, a 128K RAM
 *   card in slot 1 (its mirrors below it) and slots 2 and 3 empty, filtered to "mirror";
 * - `debugging/disassembly/origin.webp` — OZ bank `$00` disassembled on its own, at its Origin.
 *
 * The session starts on the Z88 with the card seeded in its configuration (`sessionSettings`); OZ
 * boots for several seconds before the machine is paused.
 */
const { park, sleep } = require("../guides-helpers.cjs");

module.exports = {
  name: "guides-memory-z88",
  window: {
    width: 1640,
    height: 860,
    sideBarWidth: "260px",
    toolPanelHeight: "160px",
    panelFontFamily: "iosevka",
    panelFontSize: 12,
    sessionSettings: { machineId: "z88", modelId: "OZ50", config: { slot1: { cardType: "RAM128", size: 128 } } }
  },

  async run(klive) {
    const { ide } = klive;
    const DOCUMENT = '[class*="_documentArea_"], [class*="_documentsContainer_"]';
    await klive.cmd("em-start", 12000);
    await klive.cmd("em-pause", 1500);

    await klive.cmd("show-memory", 3000);
    await klive.cmd("cls", 400);
    await ide.getByRole("button", { name: /Bank map/ }).first().click();
    await sleep(800);
    await ide.getByPlaceholder(/screen/).first().fill("mirror");
    await sleep(600);
    await park(ide);
    await klive.shot('[role="dialog"][aria-label="Bank map"]', "en/guides/debugging/memory/bank-map-z88.webp", {
      displayWidth: 760
    });
    await ide.keyboard.press("Escape");

    await klive.cmd("show-disass 00:$0000", 3000);
    await klive.cmd("cls", 400);
    await ide.locator('[data-testid^="disassembly-row-"]').nth(3).click();
    await sleep(600);
    await park(ide);
    await klive.shot(DOCUMENT, "en/guides/debugging/disassembly/origin.webp", {
      displayWidth: 760,
      crop: { x: 0, y: 0, height: 520 }
    });
    await klive.cmd("em-stop", 1500);
  }
};
