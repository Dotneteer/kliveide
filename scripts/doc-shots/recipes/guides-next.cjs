/**
 * Guides screenshots of the ZX Spectrum Next tools (`docs/content/en/guides/next/`):
 *
 * - `copper/copper-view.webp` — the Copper view with a Copper list and its raster ruler;
 * - `next-registers/nextreg-panel.webp` and `next-registers/memory-mapping.webp` — the Next
 *   Registers and Next Memory Mapping side-bar panels;
 * - `nex-files/nex-viewer.webp` — a `.nex` file in the NEX viewer, its banks listed.
 *
 * Like the layer recipes it pokes a program into a paused Next (no NextZXOS needed): the program
 * is `layers-demo.kz80.asm`'s, whose bytes are read from `layers.cjs` so the two cannot drift; it
 * runs a Copper list that splits the screen at line 96. The `.nex` is a zxbc-built test fixture
 * with four banks (`test/boriel/fixtures/banked-next/program.nex`). The viewer flags its entry bank
 * ($00, not in the file) as a problem; a NEX exported from the template project by `expc -f nex`
 * fares worse (two problems, one bank), so the fixture is the better picture. The Next writes its SD card image under the
 * user's home, so the run gets a throwaway one.
 */
const fs = require("fs");
const os = require("os");
const path = require("path");
const { fixtureProjectFolder, REPO } = require("../harness.cjs");
const h = require("../guides-helpers.cjs");
const { step, reportFailures, panelShot } = require("../guides-helpers-shot.cjs");

const PROGRAM = JSON.parse(
  fs.readFileSync(path.join(__dirname, "layers.cjs"), "utf8").match(/const PROGRAM = (\[[\s\S]*?\]);/)[1]
);
const NEX = path.join(REPO, "test", "boriel", "fixtures", "banked-next", "program.nex");
const hex = (v, d) => "$" + v.toString(16).toUpperCase().padStart(d, "0");
const DOCS = '[class*="_documentArea_"], [class*="_documentsContainer_"]';

async function setIdeSize(klive, width, height) {
  await klive.app.evaluate(({ BrowserWindow }, size) =>
    BrowserWindow.getAllWindows().find((w) => w.webContents.getURL().includes("?ide"))?.setContentSize(size.width, size.height),
    { width, height }
  );
  await klive.sleep(1200);
}

module.exports = {
  name: "guides-next",
  window: {
    width: 1280,
    height: 900,
    sideBarWidth: "380px",
    toolPanelHeight: "120px",
    panelFontFamily: "iosevka",
    panelFontSize: 12,
    userHome: path.join(os.tmpdir(), "klive-shots-guides-next-home")
  },

  async run(klive) {
    const { ide } = klive;
    const fixture = fixtureProjectFolder(process.env.DOC_SHOTS_PROJECT || "NextShots");
    try {
      await klive.cmd(`newp zxnext ${fixture.name} -p "${fixture.parent}" -o`, 12000);
      fs.copyFileSync(NEX, path.join(fixture.project, "banked.nex"));
      await klive.cmd("em-debug", 4000);
      await klive.cmd("em-pause", 1000);
      for (let i = 0; i < PROGRAM.length; i += 4) {
        const chunk = PROGRAM.slice(i, i + 4);
        const value = chunk.reduce((v, b, k) => v + b * 2 ** (8 * k), 0);
        const bits = [8, 16, 24, 32][chunk.length - 1];
        await klive.cmd(`setmem ${hex(0x8000 + i, 4)} ${hex(value, chunk.length * 2)} -b${bits}`, 150);
      }
      await klive.cmd("setz80reg pc $8000", 400);
      await klive.emu({ width: 820, height: 700 });
      await klive.cmd("em-debug", 2500);
      await klive.cmd("em-pause", 1200);
      await h.hideEmu(klive);
      await h.focusIde(klive);
      await klive.cmd("cls", 400);

      await step(klive, "copper", async () => {
        await klive.cmd("show-copper", 3000);
        await klive.cmd("cls", 400);
        // --- A lower window: the list is four rows, and the ruler follows the view's height
        await setIdeSize(klive, 1280, 560);
        await h.park(ide);
        await klive.shot(DOCS, "en/guides/next/copper/copper-view.webp", {
          displayWidth: 760,
          markers: {
            wait: { selector: '[class*="_documentArea_"] >> text="WAIT"' },
            ruler: { selector: DOCS, x: 0.975, y: 0.5 }
          }
        });
        await setIdeSize(klive, 1280, 900);
      });

      await h.activity(klive, "Debug");
      await step(klive, "nextreg", async () => {
        await h.sections(ide, ["Next Registers"]);
        await h.park(ide);
        await panelShot(klive, "Next Registers", "en/guides/next/next-registers/nextreg-panel.webp", {
          displayWidth: 320,
          maxHeight: 620
        });
      });
      await step(klive, "memory-mapping", async () => {
        await h.sections(ide, ["Next Memory Mapping"]);
        await h.park(ide);
        await panelShot(klive, "Next Memory Mapping", "en/guides/next/next-registers/memory-mapping.webp", {
          displayWidth: 320,
          maxHeight: 620
        });
      });

      await klive.cmd("em-stop", 2000);
      await step(klive, "nex", async () => {
        const nex = "banked.nex";
        for (let i = 0; i < 5; i++) {
          await klive.cmd(`nav ${nex}`, 2500);
          if (await ide.locator('[class*="_documentsHeader_"]').getByText(nex, { exact: true }).count()) break;
        }
        await ide.locator('[class*="_documentsHeader_"]').getByText(nex, { exact: true }).first().click();
        await klive.sleep(1500);
        await klive.cmd("cls", 400);
        await h.park(ide);
        await klive.shot(DOCS, "en/guides/next/nex-files/nex-viewer.webp", { displayWidth: 760 });
      });
      reportFailures();
    } finally {
      fixture.cleanup();
    }
  }
};
