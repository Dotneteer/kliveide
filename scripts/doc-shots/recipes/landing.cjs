/**
 * Screenshots for the landing page's hero carousel and feature sections (`docs/landing/`), in
 * English. Shots go to `images/landing/`.
 *
 * Everything shows one program running: ScrollNutter.nex, the annotated ZX Spectrum Next demo in
 * `_experiments/testprojects/disann/` (its `.nex.dis` holds labels, synopses and comments). The
 * recipe runs it with `nex-run`, then photographs:
 *
 * - `emulator-scrollnutter.webp` - the emulator running the demo;
 * - `disassembly-scrollnutter.webp` - the annotated disassembly at DmaCopy and its zxnDMA program
 *   (`show-disass $905C`);
 * - `sprite-inspector.webp` - the live Sprite Inspector;
 * - `copper-list.webp` - the Copper list;
 * - `sprite-editor.webp` - the demo's pattern RAM, exported with `export-patterns -o`, in the
 *   sprite editor.
 *
 * Panels are opened with commands (`show-disass`, `show-sprites`, `show-copper`), never through
 * the application menu, which a scripted run cannot rely on (see get-started.cjs, focusIde).
 */
const path = require("path");
const fs = require("fs");
const os = require("os");
const { fixtureProjectFolder, REPO } = require("../harness.cjs");

const DEMO = path.join(REPO, "_experiments", "testprojects", "disann");
const USER_HOME = path.join(os.tmpdir(), "klive-landing-home");
const IDE = "#themeRoot";

/** The Next boots NextZXOS from `~/Klive/ks2.cim`: give the run a throwaway copy of the base image. */
function seedUserHome() {
  const sd = path.join(USER_HOME, "Klive", "ks2.cim");
  fs.mkdirSync(path.dirname(sd), { recursive: true });
  fs.copyFileSync(path.join(REPO, "src", "public", "mmc", "ks2-base.cim"), sd);
}

async function park(page) {
  await page.mouse.move(5, 300);
  await new Promise((r) => setTimeout(r, 400));
}

async function focusIde(klive) {
  await klive.app.evaluate(({ BrowserWindow }) => {
    const win = BrowserWindow.getAllWindows().find((w) => w.webContents.getURL().includes("?ide"));
    win?.show();
    win?.focus();
    win?.webContents.focus();
  });
  await klive.sleep(600);
}

module.exports = {
  name: "landing",
  window: {
    width: 1440,
    height: 900,
    sideBarWidth: "240px",
    toolPanelHeight: "110px",
    userHome: USER_HOME
  },

  async run(klive) {
    seedUserHome();
    const fx = fixtureProjectFolder(process.env.DOC_SHOTS_PROJECT || "LandingShots");
    try {
      // --- A Next project, so the machine is the Next; the demo and its annotations beside it
      await klive.cmd(`newp zxnext ${fx.name} -p "${fx.parent}" -o`, 12000);
      const nex = path.join(fx.project, "ScrollNutter.nex");
      fs.copyFileSync(path.join(DEMO, "ScrollNutter.nex"), nex);
      fs.copyFileSync(path.join(DEMO, "ScrollNutter.nex.dis"), `${nex}.dis`);
      await klive.cmd("cls", 500);

      await klive.cmd(`nex-run "${nex}"`, 30000);
      const emu = await klive.emu({ width: 900, height: 740 });
      await klive.sleep(6000);
      await park(emu);
      await klive.shot("#themeRoot", "landing/emulator-scrollnutter.webp", { displayWidth: 720, page: emu });

      // --- Pause in the middle of the demo; everything after shows this moment
      await focusIde(klive);
      await klive.cmd("em-pause", 1500);
      await klive.cmd("cls", 500);

      await klive.cmd("show-disass $905C", 3500);
      await klive.cmd("cls", 500);
      await park(klive.ide);
      await klive.shot(IDE, "landing/disassembly-scrollnutter.webp", { displayWidth: 1100 });

      await klive.cmd("show-sprites", 3500);
      await klive.cmd("cls", 500);
      await park(klive.ide);
      await klive.shot(IDE, "landing/sprite-inspector.webp", { displayWidth: 1100 });

      await klive.cmd("show-copper", 3500);
      await klive.cmd("cls", 500);
      await park(klive.ide);
      await klive.shot(IDE, "landing/copper-list.webp", { displayWidth: 1100 });

      await klive.cmd("export-patterns scrollnutter.spr -f -o", 4000);
      await klive.cmd("cls", 500);
      await park(klive.ide);
      await klive.shot(IDE, "landing/sprite-editor.webp", { displayWidth: 1100 });

      await klive.cmd("em-stop", 2000);
    } finally {
      fx.cleanup();
    }
  }
};
