/**
 * The ZX81 `.P` viewer in the running app (`src/renderer/appIde/DocumentPanels/PFile/`):
 *
 * - `zx81/p-file-viewer.png` — the viewer on `basic/Characters.P` (MIT, from `_input/zx81-tapes/`)
 *   with its display file selected: the summary, the parts and the screen drawn with the ROM's
 *   characters;
 * - `zx81/p-file-listing.png` — the program popped out as a ZX81 BASIC listing.
 *
 * Verifies before it photographs: the parts list, the BASIC summary, the picture (it must have both
 * ink and paper, read off the canvas) and the popped-out listing's lines.
 *
 * The project is a 48K one: there is no ZX81 project template, and the viewer does not depend on the
 * machine.
 */
const path = require("path");
const fs = require("fs");
const { fixtureProjectFolder, REPO } = require("../harness.cjs");

const VIEWER = '[class*="_viewer_"]';
const TAPES = path.join(REPO, "_input/zx81-tapes");

module.exports = {
  name: "p-files",
  window: { width: 1280, height: 820, toolPanelHeight: "120px" },

  async run(klive) {
    const fixture = fixtureProjectFolder(process.env.DOC_SHOTS_PROJECT || "PFileShots");
    const { name, parent, project } = fixture;
    try {
      await klive.cmd(`newp sp48 ${name} -p "${parent}" -o`, 9000);
      fs.copyFileSync(path.join(TAPES, "basic/Characters.P"), path.join(project, "Characters.P"));
      fs.copyFileSync(path.join(TAPES, "basic/DEC-TO-FP-2.p"), path.join(project, "DEC-TO-FP-2.p"));
      await klive.sleep(2500);

      await klive.cmd("nav Characters.P", 3000);
      const state = await klive.ide.evaluate(() => ({
        rows: document.querySelectorAll('[aria-label="Part list"] [role="option"]').length,
        basic: document.querySelector('[data-testid="p-file-basic-summary"]')?.textContent ?? "",
        summary: document.querySelector('[aria-label="Program summary"]')?.textContent ?? ""
      }));
      console.log(`  rows ${state.rows}, basic "${state.basic}", summary "${state.summary}"`);
      if (state.rows !== 4 || state.basic !== "6 lines" || !/16K RAM/.test(state.summary)) {
        throw new Error(`The .P viewer did not render as expected: ${JSON.stringify(state)}`);
      }

      // --- The display file, drawn with the ROM's glyphs: the canvas must hold ink and paper
      await klive.ide.locator('[role="option"][data-key="display"]').first().click();
      await klive.sleep(1200);
      const picture = await klive.ide.evaluate(() => {
        const canvas = document.querySelector('[aria-label="$40F3 details"] canvas');
        if (!canvas) return { found: false };
        const { data } = canvas.getContext("2d").getImageData(0, 0, canvas.width, canvas.height);
        let ink = 0;
        let paper = 0;
        for (let i = 0; i < data.length; i += 4) {
          if (data[i] < 64) ink++;
          else if (data[i] > 192) paper++;
        }
        return { found: true, width: canvas.width, height: canvas.height, ink, paper };
      });
      console.log(`  screen ${JSON.stringify(picture)}`);
      if (!picture.found || picture.width !== 256 || picture.ink < 1000 || picture.paper < 1000) {
        throw new Error(`The display file was not drawn: ${JSON.stringify(picture)}`);
      }
      await klive.shot(VIEWER, "zx81/p-file-viewer.png", { displayWidth: 900 });
      // --- `VIEWER` also matches an outer wrapper that takes in the tool area: the document area instead
      await klive.shot('[class*="_documentArea_"], [class*="_documentsContainer_"]', "en/guides/machines/zx81-zx80/p-file-viewer.webp", {
        displayWidth: 760,
        crop: { x: 0, y: 0, height: 480 }
      });

      // --- The program as a ZX81 listing, through the details' button
      await klive.ide.locator('[role="option"][data-key="program"]').first().click();
      await klive.sleep(500);
      await klive.ide.getByRole("button", { name: "Pop out the listing" }).click();
      await klive.sleep(1500);
      const listing = await klive.ide.evaluate(() =>
        Array.from(document.querySelectorAll('[class*="_item_"]'), (e) => e.textContent ?? "").filter(
          (t) => /^\s*\d+\s/.test(t)
        )
      );
      console.log(`  listing ${listing.length} lines: ${listing[0]}`);
      if (listing.length !== 6 || !/^\s*10\s/.test(listing[0])) {
        throw new Error(`The listing did not render as expected: ${JSON.stringify(listing)}`);
      }
      await klive.shot('[class*="_documentArea_"], [class*="_documentsContainer_"]', "zx81/p-file-listing.png", {
        displayWidth: 900
      });
      await klive.shot('[class*="_documentArea_"], [class*="_documentsContainer_"]', "en/guides/machines/zx81-zx80/p-file-listing.webp", {
        displayWidth: 760,
        crop: { x: 0, y: 0, height: 240 }
      });

      // --- A self-starting program names its line in the summary
      await klive.cmd("nav DEC-TO-FP-2.p", 3000);
      const runs = await klive.ide.evaluate(
        () => document.querySelector('[aria-label="Program summary"]')?.textContent ?? ""
      );
      if (!/LINE 5/.test(runs)) throw new Error(`The autorun line is missing: ${runs}`);
      console.log("  DEC-TO-FP-2.p runs from LINE 5");
    } finally {
      fixture.cleanup();
    }
  }
};
