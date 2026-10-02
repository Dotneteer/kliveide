/**
 * Screenshots for `docs/content/getting-started/tapes.mdx`: the `.tap`/`.tzx` viewer
 * (`.plans/TAPE_VIEWER_PLAN.md`).
 *
 * - `getting-started/tape-viewer.png` — the viewer with its summary, timeline strip and block
 *   browser, a BASIC program block selected so its listing shows.
 * - `getting-started/tape-viewer-commands.png` — the tape's tab with its three load buttons.
 * - `getting-started/tape-viewer-loaded.png` — the emulator after "Load and run" on that tape: the
 *   48K typed `LOAD ""`, loaded the program, and the program loaded and ran its code block.
 *
 * The tape is the repository's own test fixture, `test/testfiles/floatspy.tap` (RAMSOFT's freely
 * distributed floating-bus test).
 */
const path = require("path");
const fs = require("fs");
const { fixtureProjectFolder, IMAGES, REPO } = require("../harness.cjs");

const VIEWER = '[class*="_viewer_"]';

module.exports = {
  name: "tapes",
  window: { width: 1280, height: 820, toolPanelHeight: "120px" },

  async run(klive) {
    const fixture = fixtureProjectFolder(process.env.DOC_SHOTS_PROJECT || "TapeShots");
    const { name, parent, project } = fixture;
    try {
      await klive.cmd(`newp sp48 ${name} -p "${parent}" -o`, 9000);
      const tape = path.join(project, "floatspy.tap");
      fs.copyFileSync(path.join(REPO, "test/testfiles/floatspy.tap"), tape);
      await klive.sleep(2500);

      await klive.cmd("nav floatspy.tap", 3000);
      await klive.ide.locator('[role="option"][data-key="1"]').first().click();
      await klive.sleep(800);

      // --- Verify before photographing: the browser lists the four blocks, and the BASIC
      // --- preview decoded the program
      const state = await klive.ide.evaluate(() => ({
        rows: document.querySelectorAll('[aria-label="Block list"] [role="option"]').length,
        basic: document.querySelector('[data-testid="tape-basic-preview"]')?.textContent ?? "",
        segments: document.querySelectorAll('[data-testid="tape-timeline"] [data-first]').length
      }));
      console.log(`  rows ${state.rows}, timeline segments ${state.segments}`);
      if (state.rows !== 4 || !state.basic.includes("BORDER") || state.segments !== 4) {
        throw new Error(`The tape viewer did not render as expected: ${JSON.stringify(state)}`);
      }
      await klive.shot(VIEWER, "getting-started/tape-viewer.png", { displayWidth: 900 });
      await klive.shot('[class*="_documentsHeader_"]', "getting-started/tape-viewer-commands.png", {
        displayWidth: 900
      });

      // --- Load and run, through the same command the viewer's play button runs
      await klive.cmd(`tape-load "${tape}" -r`, 15000);
      const emu = klive.app.windows().find((w) => w.url().includes("?emu"));
      await klive.app.evaluate(({ BrowserWindow }) => {
        const win = BrowserWindow.getAllWindows().find((w) =>
          w.webContents.getURL().includes("?emu")
        );
        win?.show();
      });
      await klive.sleep(1500);
      const target = path.join(IMAGES, "getting-started/tape-viewer-loaded.png");
      fs.mkdirSync(path.dirname(target), { recursive: true });
      await emu.screenshot({ path: target });
      console.log(`  ✓ getting-started/tape-viewer-loaded.png`);
    } finally {
      fixture.cleanup();
    }
  }
};
