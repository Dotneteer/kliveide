/**
 * The running-app check of the reverse-engineering tools (`.plans/REVERSE_ENGINEERING_TOOLS_PLAN.md`
 * G7.3-G7.6), with staged shots for the four docs pages: detecting code and data, the graphics
 * finder, SkoolKit, and exporting source.
 *
 * On the 48K it runs the template project with coverage on, pauses, and verifies before it
 * photographs:
 *
 * - `gfx $3D00 -w 1 -h 8 -layout cells` shows the ROM's character set: the space blank, "!" drawn
 *   where the ROM's bytes say (§8 G7.4, the IDE check);
 * - `ann-detect -reach` proposes, and `-apply` writes to the project's annotations;
 * - `export-asm` of the program's range ($7C00, bank 5) verifies as byte-identical;
 * - `skool-export` writes a skool file, and `skool-import` reads it back.
 */
const path = require("path");
const fs = require("fs");
const { fixtureProjectFolder, IMAGES } = require("../harness.cjs");

/**
 * An element's screenshot through a page clip of its bounding box: on a display with a fractional
 * device pixel ratio, an element screenshot came out shifted.
 */
async function shotOf(page, locator, file) {
  const box = await locator.boundingBox();
  if (!box) throw new Error(`Nothing to capture for ${file}`);
  await page.screenshot({ path: file, clip: box });
}

const fail = (what, state) => {
  throw new Error(`${what}: ${JSON.stringify(state)}`);
};

const outputText = (ide) =>
  ide.evaluate(() => document.querySelector('[class*="_commandPanel_"]')?.textContent ?? "");

/** The Graphics canvas's pixel at image coordinates, as `ink`, `paper` or `none`. */
const pixelsOf = (ide, points) =>
  ide.evaluate((pts) => {
    const canvas = document.querySelector('canvas[aria-label="Graphics"]');
    if (!canvas) return undefined;
    const context = canvas.getContext("2d");
    return pts.map(([x, y]) => {
      const [r, g, b, a] = context.getImageData(x, y, 1, 1).data;
      if (a === 0) return "none";
      return r + g + b < 100 ? "ink" : "paper";
    });
  }, points);

module.exports = {
  name: "reverse-engineering",
  window: {
    // --- Detection reads coverage, an advanced debugging feature
    userSettings: { features: { advancedDebugging: "1" } },
    width: 1280,
    height: 860,
    sideBarWidth: "200px",
    toolPanelHeight: "220px",
    panelFontFamily: "iosevka",
    panelFontSize: 12
  },

  async run(klive) {
    const fixture = fixtureProjectFolder(process.env.DOC_SHOTS_PROJECT || "ReverseShots");
    try {
      await klive.cmd(`newp sp48 ${fixture.name} -p "${fixture.parent}" -o`, 8000);
      await klive.cmd("coverage on", 1000);
      await klive.cmd("run", 9000);
      await klive.cmd("em-pause", 1500);

      // --- The graphics finder on the ROM's font
      await klive.cmd("gfx $3d00 -w 1 -h 8 -layout cells", 3000);
      // --- The first four characters of the ROM's font, drawn top-left: every pixel must match
      // --- the ROM's own bytes (space, "!", the quote, "#")
      const rom = fs.readFileSync(path.join(__dirname, "..", "..", "..", "src", "public", "roms", "sp48.rom"));
      const points = [];
      const expected = [];
      for (let ch = 0; ch < 4; ch++) {
        for (let row = 0; row < 8; row++) {
          const value = rom[0x3d00 + ch * 8 + row];
          for (let bit = 0; bit < 8; bit++) {
            points.push([ch * 9 + bit, row]);
            expected.push(value & (0x80 >> bit) ? "ink" : "paper");
          }
        }
      }
      let pixels;
      let mismatches = -1;
      for (let i = 0; i < 20; i++) {
        pixels = await pixelsOf(klive.ide, points);
        mismatches = pixels ? pixels.filter((p, j) => p !== expected[j]).length : -1;
        if (mismatches === 0) break;
        await klive.sleep(500);
      }
      console.log("  graphics · mismatched pixels:", mismatches);
      if (mismatches !== 0) fail("The ROM font is not drawn at the top left", { mismatches });
      const graphicsShot = path.join(IMAGES, "working-with-ide", "graphics-finder.png");
      fs.mkdirSync(path.dirname(graphicsShot), { recursive: true });
      await shotOf(klive.ide, klive.ide.locator('[class*="_graphicsView_"]').first().locator("xpath=.."), graphicsShot);
      console.log(`  ✓ ${path.relative(process.cwd(), graphicsShot)}`);

      // --- Detection: propose, then apply to the project's annotations
      await klive.cmd("cls", 500);
      await klive.cmd("ann-detect -reach", 4000);
      let out = await outputText(klive.ide);
      console.log("  detect ·", out.replace(/\s+/g, " ").slice(0, 300));
      if (!/bank \d+: code \d+/.test(out)) fail("ann-detect printed no proposal", out);
      // --- The dialog, from the Debug menu as a user opens it (`display-dialog` is not interactive)
      let clicked = false;
      for (let i = 0; i < 30 && !clicked; i++) {
        // --- The app rebuilds its menu after state changes: poll for the item
        clicked = await klive.app.evaluate(({ Menu }) => {
          const item = Menu.getApplicationMenu()?.getMenuItemById("detect_code_data");
          if (!item || !item.enabled) return false;
          item.click();
          return true;
        });
        if (!clicked) await klive.sleep(500);
      }
      if (!clicked) {
        const ids = await klive.app.evaluate(({ Menu }) => {
          const all = [];
          const walk = (menu) => menu?.items.forEach((i) => { all.push(i.id || i.label); walk(i.submenu); });
          walk(Menu.getApplicationMenu());
          return all;
        });
        fail("No Detect Code and Data item in the Debug menu", ids);
      }
      await klive.sleep(4000);
      const dialogShot = path.join(IMAGES, "working-with-ide", "detect-code-data.png");
      await shotOf(klive.ide, klive.ide.locator('[role="dialog"]').first(), dialogShot);
      console.log(`  ✓ ${path.relative(process.cwd(), dialogShot)}`);
      await klive.ide.keyboard.press("Escape");
      await klive.sleep(800);
      await klive.cmd("cls", 500);
      await klive.cmd("ann-detect -reach -apply", 4000);
      out = await outputText(klive.ide);
      if (!/Applied to/.test(out)) fail("ann-detect -apply wrote nothing", out);

      // --- Export as source, verified by assembling it
      await klive.cmd("cls", 500);
      const asmPath = path.join(fixture.project, "export.kz80.asm");
      await klive.cmd(`export-asm "${asmPath}" $7c00 $7cff`, 4000);
      out = await outputText(klive.ide);
      console.log("  export ·", out.replace(/\s+/g, " ").slice(0, 300));
      if (!/Byte-identical: yes/.test(out)) fail("The export is not byte-identical", out);
      if (!fs.existsSync(asmPath)) fail("export-asm wrote no file", asmPath);
      const exportShot = path.join(IMAGES, "working-with-ide", "export-source.png");
      await shotOf(klive.ide, klive.ide.locator('[class*="_commandPanel_"]').first(), exportShot);
      console.log(`  ✓ ${path.relative(process.cwd(), exportShot)}`);

      // --- SkoolKit: export, then import it back
      await klive.cmd("cls", 500);
      const skoolPath = path.join(fixture.project, "export.skool");
      await klive.cmd(`skool-export "${skoolPath}" $7c00 $7cff`, 4000);
      const skool = fs.existsSync(skoolPath) ? fs.readFileSync(skoolPath, "utf8") : "";
      if (!/^@org=31744/m.test(skool) || !/^[cbtwi]31744 /m.test(skool)) fail("skool-export wrote no entries", skool.slice(0, 300));
      await klive.cmd(`skool-import "${skoolPath}"`, 2000);
      // --- Each instruction is assembled and checked against the bytes: give it time
      for (let i = 0; i < 60; i++) {
        out = await outputText(klive.ide);
        if (/bank \d+:|Nothing was written|error/i.test(out.split("skool-import").pop())) break;
        await klive.sleep(500);
      }
      console.log("  skool ·", out.replace(/\s+/g, " ").slice(0, 300));
      if (!/bank 5:/.test(out)) fail("skool-import proposed nothing for bank 5", out);
      const skoolShot = path.join(IMAGES, "working-with-ide", "skoolkit.png");
      await shotOf(klive.ide, klive.ide.locator('[class*="_commandPanel_"]').first(), skoolShot);
      console.log(`  ✓ ${path.relative(process.cwd(), skoolShot)}`);

      await klive.cmd("coverage off", 500);
      await klive.cmd("em-stop", 1500);
    } finally {
      fixture.cleanup();
    }
  }
};
