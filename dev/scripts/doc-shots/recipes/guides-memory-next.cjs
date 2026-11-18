/**
 * Guides screenshots of the Memory view on a ZX Spectrum Next
 * (`docs/content/en/guides/debugging/memory.mdx`, `dev/plans/MEMORY_DISASSEMBLY_VIEWS_PLAN.md` §9):
 *
 * - `debugging/memory/bank-map-next.webp` — the Bank map: the ROMs, the DivMMC and the RAM pages,
 *   with paged-in badges and the role bars of the screens, Layer 2 and the tilemap;
 * - `debugging/memory/partition-view.webp` — RAM page `0A` (the ULA screen) shown on its own.
 *
 * A Next project is created in a fixture folder and the machine started in debug mode, then paused.
 */
const { fixtureProjectFolder } = require("../harness.cjs");
const { park, sleep } = require("../guides-helpers.cjs");

module.exports = {
  name: "guides-memory-next",
  window: {
    width: 1640,
    height: 860,
    sideBarWidth: "260px",
    toolPanelHeight: "160px",
    panelFontFamily: "iosevka",
    panelFontSize: 12
  },

  async run(klive) {
    const { ide } = klive;
    const DOCUMENT = '[class*="_documentArea_"], [class*="_documentsContainer_"]';
    const fixture = fixtureProjectFolder(process.env.DOC_SHOTS_PROJECT || "MemoryNextShots");
    try {
      await klive.cmd(`newp zxnext ${fixture.name} -p "${fixture.parent}" -o`, 12000);
      await klive.cmd("em-debug", 8000);
      await klive.cmd("em-pause", 1500);

      await klive.cmd("show-memory", 3000);
      await klive.cmd("cls", 400);
      await ide.getByRole("button", { name: /Bank map/ }).first().click();
      await sleep(800);
      await park(ide);
      await klive.shot('[role="dialog"][aria-label="Bank map"]', "en/guides/debugging/memory/bank-map-next.webp", {
        displayWidth: 760
      });
      await ide.keyboard.press("Escape");

      await klive.cmd("show-memory 0A:$0000", 3000);
      await klive.cmd("cls", 400);
      await park(ide);
      await klive.shot(DOCUMENT, "en/guides/debugging/memory/partition-view.webp", {
        displayWidth: 760,
        crop: { x: 0, y: 0, height: 440 }
      });
      await klive.cmd("em-stop", 1500);
    } finally {
      fixture.cleanup();
    }
  }
};
