/**
 * The screen file viewers (`dev/plans/SCREEN_FILE_VIEWERS_PLAN.md`) in the running IDE: every sample
 * of `dev/plans/screen-file-viewers/samples/` opened in its viewer, one shot each, staged under
 * `.local/doc-shots/dev/screen-files/` for review (not published). A check of the viewers in the
 * real app, wide and narrow, rather than a docs page.
 *
 *   node dev/scripts/doc-shots/run.cjs screen-file-viewers
 *   SCREEN_FILES_THEME=light node dev/scripts/doc-shots/run.cjs screen-file-viewers
 *
 * It also checks the two actions that leave the app: Copy picture (the system clipboard holds the
 * PNG) and Save as PNG (the save dialog is answered with a path in the fixture, and the file there
 * must be a 256x192 PNG).
 */
const path = require("path");
const fs = require("fs");
const { fixtureProjectFolder, REPO } = require("../harness.cjs");
const { park, projectWithSource } = require("../guides-helpers.cjs");

const SAMPLES = path.join(REPO, "dev", "plans", "screen-file-viewers", "samples");
const DOCS = '[class*="_documentArea_"], [class*="_documentsContainer_"]';
const THEME = process.env.SCREEN_FILES_THEME === "light" ? "light" : "dark";
const SHOTS = THEME === "light" ? "dev/screen-files/light" : "dev/screen-files";

/** A PNG's size, from its IHDR chunk */
function pngSize(bytes) {
  if (bytes.length < 24 || bytes.toString("latin1", 1, 4) !== "PNG") return undefined;
  return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
}

module.exports = {
  name: "screen-file-viewers",
  window: { width: 1360, height: 860, toolPanelHeight: "120px", sideBarWidth: "220px", theme: THEME },

  async run(klive) {
    const fixture = fixtureProjectFolder(process.env.DOC_SHOTS_PROJECT || "ScreenFileShots");
    const names = fs.readdirSync(SAMPLES).filter((n) => /\.(scr|sl2|nxi|slr|shc|shr)$/i.test(n));
    const extraFiles = Object.fromEntries(names.map((n) => [`screens/${n}`, fs.readFileSync(path.join(SAMPLES, n))]));
    try {
      await projectWithSource(klive, fixture, {
        machine: "sp48",
        template: "zx-basic",
        file: "code/main.zxbas",
        source: '10 PRINT "screens"\n',
        extraFiles
      });
      for (const name of names) {
        await klive.cmd(`nav screens/${name}`, 2500);
        await klive.cmd("cls", 300);
        await park(klive.ide);
        await klive.shot(DOCS, `${SHOTS}/${name.toLowerCase()}.webp`);
      }

      // --- Copy picture puts a PNG of the picture, at 1x, on the system clipboard (D12)
      await klive.cmd("nav screens/SCREEN.SCR", 2500);
      await klive.app.evaluate(({ clipboard }) => clipboard.clear());
      await klive.ide.locator('button[aria-label="Copy picture"]').first().click();
      await klive.sleep(1500);
      // --- Electron 45's main-process clipboard has no readImage: `read` gives ClipboardItems
      const copied = await klive.app.evaluate(async ({ clipboard, nativeImage }) => {
        if (!(await clipboard.has("image/png"))) return { empty: true, size: { width: 0, height: 0 } };
        const [item] = await clipboard.read("image/png");
        const blob = await item.getType("image/png");
        const image = nativeImage.createFromBuffer(Buffer.from(await blob.arrayBuffer()));
        return { empty: image.isEmpty(), size: image.getSize(), types: item.types.length };
      });
      const strip = await klive.ide.locator('[aria-live="off"]').first().textContent();
      console.log("  copy picture ·", JSON.stringify(copied), "·", strip);
      if (copied.empty || copied.size.width !== 256 || copied.size.height !== 192) {
        throw new Error(`Copy picture did not put a 256x192 image on the clipboard: ${JSON.stringify(copied)}`);
      }

      // --- Save as PNG writes the picture, at 1x, where the save dialog says (D12)
      const pngPath = path.join(fixture.project, "saved-screen.png");
      await klive.app.evaluate(({ dialog }, target) => {
        dialog.showSaveDialog = async () => ({ canceled: false, filePath: target });
      }, pngPath);
      await klive.ide.locator('button[aria-label="Save as PNG…"]').first().click();
      await klive.sleep(2000);
      const saved = fs.existsSync(pngPath) ? pngSize(fs.readFileSync(pngPath)) : undefined;
      console.log("  save as png ·", JSON.stringify(saved ?? "no file"));
      if (!saved || saved.width !== 256 || saved.height !== 192) {
        throw new Error(`Save as PNG did not write a 256x192 PNG: ${JSON.stringify(saved)}`);
      }

      // --- Narrow: the document lays itself out by its own width (D10)
      await klive.cmd("nav screens/SCREEN.SCR", 2500);
      await klive.cmd("cls", 300);
      await klive.ide.evaluate(() => {
        // --- The viewer's root is the size container its layouts query (D10)
        const root = document.querySelector('[role="toolbar"][aria-label="ZX Spectrum screen"]')?.parentElement;
        if (root) Object.assign(root.style, { width: "560px" });
      });
      await park(klive.ide);
      await klive.shot(DOCS, `${SHOTS}/narrow-screen.scr.webp`);
    } finally {
      fixture.cleanup();
    }
  }
};
