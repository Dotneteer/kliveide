/**
 * The project README's screenshot: the IDE with Z80 assembly on the left, the emulator running it
 * on the right, composed into one image, `readme/klive-ide.webp`.
 *
 * The IDE and the emulator are two windows, so the recipe photographs each and puts them side by
 * side with sharp. The program is `readme-demo.kz80.asm` (moving colour bands and a greeting
 * printed through the 48K ROM), run with the IDE's `run` command.
 *
 *   node scripts/doc-shots/run.cjs readme                  # stages to .doc-shots/readme/
 *   DOC_SHOTS_OUT=docs/public/images node scripts/doc-shots/run.cjs readme
 */
const path = require("path");
const fs = require("fs");
const { fixtureProjectFolder, IMAGES, REPO } = require("../harness.cjs");

const IDE = "#themeRoot";
const GAP = 32; // device pixels between the two windows

function loadSharp() {
  for (const base of [REPO, path.join(REPO, "docs")]) {
    try {
      return require(require.resolve("sharp", { paths: [base] }));
    } catch {
      /* try the next */
    }
  }
  throw new Error("sharp not found: run `npm run doc:install`");
}

async function park(page) {
  await page.mouse.move(5, 300);
  await new Promise((r) => setTimeout(r, 400));
}

async function focusIde(klive) {
  await klive.app.evaluate(({ app, BrowserWindow }) => {
    app.focus({ steal: true });
    const win = BrowserWindow.getAllWindows().find((w) => w.webContents.getURL().includes("?ide"));
    win?.show();
    win?.focus();
    win?.webContents.focus();
  });
  await klive.sleep(600);
}

module.exports = {
  name: "readme",
  window: {
    width: 1120,
    height: 780,
    sideBarWidth: "220px",
    toolPanelHeight: "130px"
  },

  async run(klive) {
    const fx = fixtureProjectFolder(process.env.DOC_SHOTS_PROJECT || "Rainbow");
    try {
      // --- A 48K project whose code file is the demo; reopen it so the editor shows the demo
      await klive.cmd(`newp sp48 ${fx.name} -p "${fx.parent}"`, 6000);
      fs.copyFileSync(
        path.join(__dirname, "readme-demo.kz80.asm"),
        path.join(fx.project, "code", "code.kz80.asm")
      );
      await klive.cmd(`open "${fx.project}"`, 6000);
      await klive.cmd("nav code/code.kz80.asm", 2500);
      await klive.cmd("cls", 600);

      await klive.cmd("run", 6000);
      const emu = await klive.emu({ width: 720, height: 600 });
      await klive.sleep(2500);
      await park(emu);
      const emuFile = await klive.shot(IDE, "readme/_emu.png", { page: emu });

      await focusIde(klive);
      await park(klive.ide);
      const ideFile = await klive.shot(IDE, "readme/_ide.png");

      // --- Compose: the emulator scaled to the IDE's height, beside it
      const sharp = loadSharp();
      const ideMeta = await sharp(ideFile).metadata();
      const emuBuf = await sharp(emuFile).resize({ height: ideMeta.height }).toBuffer();
      const emuMeta = await sharp(emuBuf).metadata();
      const target = path.join(IMAGES, "readme", "klive-ide.webp");
      await sharp({
        create: {
          width: ideMeta.width + GAP + emuMeta.width,
          height: ideMeta.height,
          channels: 4,
          background: { r: 0, g: 0, b: 0, alpha: 0 }
        }
      })
        .composite([
          { input: ideFile, left: 0, top: 0 },
          { input: emuBuf, left: ideMeta.width + GAP, top: 0 }
        ])
        .withMetadata({ density: 144 })
        .webp({ nearLossless: true, quality: 90 })
        .toFile(target);
      fs.rmSync(ideFile);
      fs.rmSync(emuFile);
      const meta = await sharp(target).metadata();
      console.log(`  ✓ readme/klive-ide.webp  ${meta.width}x${meta.height}`);
    } finally {
      fx.cleanup();
    }
  }
};
