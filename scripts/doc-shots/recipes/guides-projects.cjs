/**
 * Guides screenshots of a Klive project (`docs/content/en/guides/projects/creating-projects`):
 *
 * - `explorer-build-root.webp` — the Project Explorer of a new 48K project, its build root marked,
 *   with the context menu of a second code file open on Promote to Build Root;
 * - `build-bar.webp` — the build buttons at the right of the document tab bar, tightly cropped.
 */
const path = require("path");
const fs = require("fs");
const { fixtureProjectFolder } = require("../harness.cjs");
const h = require("../guides-helpers.cjs");
const { step, reportFailures, tag } = require("../guides-helpers-shot.cjs");

module.exports = {
  name: "guides-projects",
  window: { width: 1280, height: 820, sideBarWidth: "300px", toolPanelHeight: "160px" },

  async run(klive) {
    const { ide } = klive;
    const fixture = fixtureProjectFolder(process.env.DOC_SHOTS_PROJECT || "MyGame");
    try {
      await klive.cmd(`newp sp48 ${fixture.name} -p "${fixture.parent}" -o`, 8000);
      fs.writeFileSync(path.join(fixture.project, "code", "sprites.kz80.asm"), "; Sprite data\n    .defb 0\n");
      await klive.sleep(2500);
      await h.activity(klive, "Explorer");
      await klive.cmd("cls", 400);

      await step(klive, "explorer", async () => {
        const item = ide.locator('[class*="_sideBarPanel_"]').getByText("sprites.kz80.asm", { exact: true }).first();
        await item.click({ button: "right" });
        await klive.sleep(900);
        const menu = ide.locator('[class*="_contextMenu_"]').first();
        await menu.getByText("Promote to Build Root").first().hover();
        await klive.sleep(500);
        const side = await ide.locator('[class*="_sideBar_"]').first().boundingBox();
        const mbox = await menu.boundingBox();
        const right = Math.max(side.x + side.width, mbox.x + mbox.width + 12);
        const bottom = Math.max(mbox.y + mbox.height + 12, side.y + 360);
        await klive.shot(h.ROOT, "en/guides/projects/creating-projects/explorer-build-root.webp", {
          displayWidth: 420,
          crop: { x: 0, y: 0, width: Math.ceil(right), height: Math.ceil(bottom) },
          markers: {
            // --- The build-root badge right of the file name (the `combine` icon)
            buildroot: { selector: '[class*="_sideBarPanel_"] [class*="_iconRight_"]' },
            promote: { selector: '[class*="_contextMenu_"] >> text="Promote to Build Root"' }
          }
        });
        await ide.keyboard.press("Escape");
        await klive.sleep(500);
      });

      await step(klive, "build-bar", async () => {
        await klive.cmd("nav code/code.kz80.asm", 2000);
        await h.park(ide);
        // --- A narrow window, so the tab bar is about 520px wide: the tab and the build buttons,
        // --- photographed at their own size rather than enlarged
        await klive.app.evaluate(({ BrowserWindow }) =>
          BrowserWindow.getAllWindows().find((w) => w.webContents.getURL().includes("?ide"))?.setContentSize(872, 820)
        );
        await klive.sleep(1200);
        const sel = '[class*="_documentsHeader_"]';
        await klive.shot(sel, "en/guides/projects/creating-projects/build-bar.webp", {
          displayWidth: 520,
          markers: {
            run: { selector: '[class*="_documentsHeader_"] button[data-icon="play"]' },
            debug: { selector: '[class*="_documentsHeader_"] button[data-icon="debug"]' }
          }
        });
      });
      reportFailures();
    } finally {
      fixture.cleanup();
    }
  }
};
