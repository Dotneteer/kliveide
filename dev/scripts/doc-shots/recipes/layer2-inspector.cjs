/**
 * Screenshots for `docs/content/working-with-ide/layer2-inspector.mdx`, and the running-app check of
 * the Layer 2 Inspector (`.plans/LAYER2_INSPECTOR_PLAN.md` Phases 4-6).
 *
 * Like the Tilemap Inspector's recipe, it pokes a small program into a paused ZX Spectrum Next (no
 * NextZXOS needed): `layer2-demo.kz80.asm` beside this file, assembled by Klive's own assembler into
 * `PROGRAM` below. It draws a 320x256 colour ramp into banks 9-13 ($12) with a transparent band across
 * rows 96-127 (it sets $14 to $E3 itself), draws the first 16K of the shadow layer (bank 14, $13) green through the $123B window
 * with bit 3 set, scrolls by (40, 16) and parks in `jr $` with the window still mapping the shadow bank.
 *
 * It verifies before it photographs: the globals strip, the Banks strip, the inspector and canvas
 * pixels of all three sources are read back from the DOM, and the run throws if they are wrong.
 */
const os = require("os");
const path = require("path");
const { fixtureProjectFolder } = require("../harness.cjs");

/* --- layer2-demo.kz80.asm, assembled at $8000. Re-assemble it after changing the source. */
const PROGRAM = [
  0xf3, 0xed, 0x91, 0x07, 0x03, 0xed, 0x91, 0x70, 0x10, 0xed, 0x91, 0x14, 0xe3, 0xed, 0x91, 0x12,
  0x09, 0xed, 0x91, 0x13, 0x0e, 0xed, 0x91, 0x1c, 0x01, 0xed, 0x91, 0x18, 0x00, 0xed, 0x91, 0x18,
  0x9f, 0xed, 0x91, 0x18, 0x00, 0xed, 0x91, 0x18, 0xff, 0x1e, 0x00, 0x16, 0x12, 0x7a, 0xed, 0x92,
  0x56, 0x21, 0x00, 0xc0, 0x7c, 0xd6, 0xc0, 0x83, 0x47, 0x7d, 0xe6, 0xe0, 0xfe, 0x60, 0x78, 0x20,
  0x02, 0x3e, 0xe3, 0x77, 0x23, 0x7c, 0xfe, 0xe0, 0x20, 0xea, 0x7b, 0xc6, 0x20, 0x5f, 0x14, 0x7a,
  0xfe, 0x1c, 0x20, 0xd9, 0xed, 0x91, 0x56, 0x00, 0x01, 0x3b, 0x12, 0x3e, 0x0b, 0xed, 0x79, 0x21,
  0x00, 0x00, 0x36, 0x1c, 0x23, 0x7c, 0xfe, 0x40, 0x20, 0xf8, 0xed, 0x91, 0x16, 0x28, 0xed, 0x91,
  0x17, 0x10, 0x18, 0xfe,
];

const DOC = '[class*="_documentContainer_"]';
const hex = (v, d) => "$" + v.toString(16).toUpperCase().padStart(d, "0");

/** Reads the inspector's state and a few canvas pixels (RGBA) at image coordinates. */
const readState = (klive, points) =>
  klive.ide.evaluate((pts) => {
    const canvas = document.querySelector('canvas[aria-label="Layer 2 image"]');
    const ctx = canvas?.getContext("2d");
    return {
      layout: document.querySelector("[data-layout]")?.getAttribute("data-layout"),
      globals: document.querySelector('[aria-label="Layer 2 globals"]')?.textContent ?? "",
      banks: document.querySelector('[aria-label="Layer 2 banks"]')?.textContent ?? "",
      inspector: document.querySelector('[aria-label="Inspector"]')?.textContent ?? "",
      size: canvas ? [canvas.width, canvas.height] : [],
      pixels: pts.map(([x, y]) => (ctx ? Array.from(ctx.getImageData(x, y, 1, 1).data) : []))
    };
  }, points);

const fail = (what, state) => {
  throw new Error(`${what}: ${JSON.stringify(state)}`);
};

module.exports = {
  name: "layer2-inspector",
  window: {
    width: 1560,
    height: 1000,
    sideBarWidth: "200px",
    toolPanelHeight: "90px",
    panelFontFamily: "iosevka",
    panelFontSize: 12,
    // --- A Next launch writes `~/Klive/ks2.cim`: keep it out of the real home
    userHome: path.join(os.tmpdir(), "klive-shots-layer2-inspector-home")
  },

  async run(klive) {
    const fixture = fixtureProjectFolder(process.env.DOC_SHOTS_PROJECT || "Layer2InspectorShots");
    try {
      await klive.cmd(`newp zxnext ${fixture.name} -p "${fixture.parent}" -o`, 12000);
      await klive.cmd("em-debug", 4000);
      await klive.cmd("em-pause", 1000);

      // --- Poke the program, four bytes a command
      for (let i = 0; i < PROGRAM.length; i += 4) {
        const chunk = PROGRAM.slice(i, i + 4);
        const value = chunk.reduce((v, b, k) => v + b * 2 ** (8 * k), 0);
        const bits = [8, 16, 24, 32][chunk.length - 1];
        await klive.cmd(`setmem ${hex(0x8000 + i, 4)} ${hex(value, chunk.length * 2)} -b${bits}`, 150);
      }
      await klive.cmd("setz80reg pc $8000", 400);
      await klive.cmd("em-debug", 2500);
      await klive.cmd("em-pause", 1200);

      // --- Displayed, whole layer: the ramp, the transparent band, bank 9's pixel (10, 0)
      await klive.cmd("show-layer2 displayed", 2500);
      await klive.ide.locator('canvas[aria-label="Layer 2 image"]').click({ position: { x: 21, y: 1 } });
      await klive.sleep(600);
      const shown = await readState(klive, [[10, 0], [10, 100], [200, 0]]);
      console.log("  displayed ·", JSON.stringify({ ...shown, globals: undefined, inspector: undefined, banks: undefined }));
      if (shown.layout !== "rail") fail("Expected the rail layout at 1560px", shown.layout);
      for (const text of ["320×256", "9 (banks 9-13)", "14 (banks 14-18)", "$0B: writes → bank 14 ($0000-$3FFF)", "write window maps the shadow bank", "40,16"]) {
        if (!shown.globals.includes(text)) fail(`The globals strip lacks ${text}`, shown.globals);
      }
      for (const text of ["bank 9 · pages 18–19", "bank 13 · pages 26–27"]) {
        if (!shown.banks.includes(text)) fail(`The Banks strip lacks ${text}`, shown.banks);
      }
      if (shown.size.join("x") !== "320x256") fail("The image canvas size is wrong", shown.size);
      // --- (10, 0): colour 10, opaque; (10, 100): the transparent band, cleared; (200, 0): colour 200
      const [p10, band, p200] = shown.pixels;
      if (p10[3] !== 255 || band[3] !== 0 || p200[3] !== 255 || p10.join() === p200.join()) fail("The image pixels are wrong", shown.pixels);
      if (!/Pixel \(10, 0\) · bank 9/.test(shown.inspector) || !shown.inspector.includes("9:$0A00") || !shown.inspector.includes("$0A")) {
        fail("The inspector does not decode pixel (10, 0)", shown.inspector);
      }
      await klive.ide.mouse.move(5, 5);
      await klive.shot(DOC, "working-with-ide/layer2-inspector.png", { displayWidth: 900 });

      // --- As displayed: scrolled by (40, 16), so display (0, 0) shows layer (40, 16), colour 40
      await klive.ide.locator('[aria-label="Geometry"] button', { hasText: "As displayed" }).click();
      await klive.sleep(600);
      await klive.ide.locator('canvas[aria-label="Layer 2 image"]').click({ position: { x: 1, y: 1 } });
      await klive.sleep(400);
      const scrolled = await readState(klive, [[0, 0]]);
      if (!/Pixel \(40, 16\)/.test(scrolled.inspector) || scrolled.pixels[0][3] !== 255) fail("As displayed is not scrolled by (40, 16)", scrolled);
      console.log("  as displayed · display (0, 0) is layer (40, 16)");
      await klive.ide.locator('[aria-label="Geometry"] button', { hasText: "Whole layer" }).click();

      // --- Shadow: bank 14 green, bank 15 untouched (index 0)
      await klive.ide.locator('[aria-label="Source"] button', { hasText: "Shadow" }).click();
      await klive.sleep(1500);
      const shadow = await readState(klive, [[10, 0], [70, 0]]);
      const [green, blank] = shadow.pixels;
      console.log("  shadow ·", JSON.stringify(shadow.pixels));
      if (!(green[1] > 150 && green[0] < 60 && green[2] < 60) || blank.join() === green.join()) fail("The shadow layer is not bank 14 green", shadow.pixels);
      if (!shadow.banks.includes("bank 14 · pages 28–29")) fail("The Banks strip does not show the shadow banks", shadow.banks);

      // --- Write window: $123B bit 3 maps the shadow set; bank 14 carries the write-window tag
      await klive.ide.locator('[aria-label="Source"] button', { hasText: "Write window" }).click();
      await klive.sleep(800);
      await klive.ide.locator('[aria-label="Layer 2 banks"] button', { hasText: "bank 14" }).click();
      await klive.sleep(500);
      const win = await readState(klive, [[10, 0]]);
      if (!/bank 14 · pages 28–29\s*shadow\s*write window/.test(win.banks)) fail("Bank 14 is not tagged shadow and write window", win.banks);
      if (!/write window \(\$123B\)/.test(win.inspector) || !win.inspector.includes("$078000-$07BFFF")) fail("The bank inspector is wrong", win.inspector);
      await klive.ide.mouse.move(5, 5);
      await klive.shot(DOC, "working-with-ide/layer2-inspector-window.png", { displayWidth: 900 });
      console.log("  write window · bank 14, shadow and write window");

      // --- Narrow: the inspector is a band under the image; palette and zoom move into the ⋯ menu,
      // --- and every pane scrolls through the IDE's ScrollViewer, never natively
      await klive.app.evaluate(({ BrowserWindow }) => {
        const ide = BrowserWindow.getAllWindows().find((x) => x.webContents.getURL().includes("?ide"));
        ide.setContentSize(860, 1000);
      });
      await klive.sleep(1200);
      const narrow = await klive.ide.evaluate(() => ({
        layout: document.querySelector("[data-layout]")?.getAttribute("data-layout"),
        palette: !!document.querySelector('[aria-label="Layer 2 palette"]'),
        inspector: !!document.querySelector('[aria-label="Inspector"]'),
        imageScroller: !!document.querySelector('canvas[aria-label="Layer 2 image"]')?.closest("[data-overlayscrollbars-viewport]"),
        nativeScrollers: [...document.querySelectorAll('[data-layout="band"] *')].filter((e) => {
          const o = getComputedStyle(e);
          return /auto|scroll/.test(o.overflowX + o.overflowY) && !e.hasAttribute("data-overlayscrollbars-viewport");
        }).length
      }));
      if (narrow.layout !== "band" || narrow.palette || !narrow.inspector) fail("Expected the band layout at 860px", narrow);
      if (!narrow.imageScroller || narrow.nativeScrollers) fail("A pane scrolls natively", narrow);
      await klive.ide.mouse.move(5, 5);
      await klive.shot(DOC, "working-with-ide/layer2-inspector-narrow.png", { displayWidth: 680 });
      console.log("  narrow · band layout, ScrollViewer panes");
    } finally {
      fixture.cleanup();
    }
  }
};
