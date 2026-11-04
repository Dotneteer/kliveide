/**
 * Screenshots for `docs/content/working-with-ide/tilemap-inspector.mdx`, and the running-app check of
 * the Tilemap Inspector (`.plans/TILEMAP_INSPECTOR_PLAN.md` Phases 5-7).
 *
 * Like the Sprite Inspector's recipe, it pokes a small program into a paused ZX Spectrum Next (no
 * NextZXOS needed): `tilemap-demo.kz80.asm` beside this file, assembled by Klive's own assembler into
 * `PROGRAM` below. It writes nine tiles at $6000 and a 40x32 map at $6800 - row 10 shows one
 * asymmetric tile in all eight orientations - then sets the bases, a scroll of (12, 8) and a clip
 * window, enables the tilemap and parks in `jr $`.
 *
 * It verifies before it photographs: the globals strip, the decoded cells, the canvas pixels and the
 * layouts are read back from the DOM, and the run throws if they are wrong.
 */
const os = require("os");
const path = require("path");
const { fixtureProjectFolder } = require("../harness.cjs");

/* --- tilemap-demo.kz80.asm, assembled at $8000. Re-assemble it after changing the source. */
const PROGRAM = [
  0xf3, 0x21, 0x00, 0x60, 0x06, 0x20, 0x36, 0x00, 0x23, 0x10, 0xfb, 0x0e, 0x01, 0x1e, 0x00, 0x7b,
  0xe6, 0x1c, 0x28, 0x23, 0xfe, 0x1c, 0x28, 0x1f, 0x7b, 0xe6, 0x03, 0x28, 0x0c, 0xfe, 0x03, 0x28,
  0x0d, 0x79, 0x07, 0x07, 0x07, 0x07, 0xb1, 0x18, 0x10, 0x3e, 0xf0, 0xb1, 0x18, 0x0b, 0x79, 0x07,
  0x07, 0x07, 0x07, 0xf6, 0x0f, 0x18, 0x02, 0x3e, 0xff, 0x77, 0x23, 0x1c, 0x7b, 0xfe, 0x20, 0x20,
  0xce, 0x0c, 0x79, 0xfe, 0x08, 0x20, 0xc6, 0x1e, 0x00, 0x7b, 0xe6, 0x1c, 0x3e, 0xdd, 0x28, 0x08,
  0x7b, 0xe6, 0x02, 0x3e, 0xee, 0x28, 0x01, 0xaf, 0x77, 0x23, 0x1c, 0x7b, 0xfe, 0x20, 0x20, 0xe9,
  0x21, 0x00, 0x68, 0x16, 0x00, 0x1e, 0x00, 0x7a, 0xfe, 0x0a, 0x20, 0x0c, 0x36, 0x08, 0x23, 0x7b,
  0xe6, 0x07, 0x87, 0xf6, 0x20, 0x77, 0x18, 0x1b, 0x7a, 0x0f, 0x0f, 0xe6, 0x3f, 0x47, 0x7b, 0x0f,
  0x0f, 0xe6, 0x3f, 0x80, 0xe6, 0x07, 0x77, 0x23, 0x7b, 0x0f, 0x0f, 0x0f, 0xe6, 0x03, 0x07, 0x07,
  0x07, 0x07, 0x77, 0x23, 0x1c, 0x7b, 0xfe, 0x28, 0x20, 0xcd, 0x14, 0x7a, 0xfe, 0x20, 0x20, 0xc5,
  0xed, 0x91, 0x6e, 0x28, 0xed, 0x91, 0x6f, 0x20, 0xed, 0x91, 0x6c, 0x00, 0xed, 0x91, 0x4c, 0x00,
  0xed, 0x91, 0x2f, 0x00, 0xed, 0x91, 0x30, 0x0c, 0xed, 0x91, 0x31, 0x08, 0xed, 0x91, 0x1c, 0x08,
  0xed, 0x91, 0x1b, 0x08, 0xed, 0x91, 0x1b, 0x97, 0xed, 0x91, 0x1b, 0x08, 0xed, 0x91, 0x1b, 0xf7,
  0xed, 0x91, 0x6b, 0x80, 0x18, 0xfe,
];

const DOC = '[class*="_documentContainer_"]';
const hex = (v, d) => "$" + v.toString(16).toUpperCase().padStart(d, "0");

module.exports = {
  name: "tilemap-inspector",
  window: {
    width: 1560,
    height: 1000,
    sideBarWidth: "200px",
    toolPanelHeight: "90px",
    panelFontFamily: "iosevka",
    panelFontSize: 12,
    // --- A Next launch writes `~/Klive/ks2.cim`: keep it out of the real home
    userHome: path.join(os.tmpdir(), "klive-shots-tilemap-inspector-home")
  },

  async run(klive) {
    const fixture = fixtureProjectFolder(process.env.DOC_SHOTS_PROJECT || "TilemapInspectorShots");
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
      await klive.cmd("em-debug", 1500);
      await klive.cmd("em-pause", 1200);

      const resize = (width) =>
        klive.app.evaluate(({ BrowserWindow }, w) => {
          const ide = BrowserWindow.getAllWindows().find((x) => x.webContents.getURL().includes("?ide"));
          ide.setContentSize(w, 1000);
        }, width);

      // --- Wide: Map and Tiles side by side, the rail; cell (3, 10) selected
      await resize(1560);
      await klive.sleep(800);
      await klive.cmd("show-tilemap 3 10", 2500);
      const wide = await klive.ide.evaluate(() => {
        const globals = document.querySelector('[aria-label="Tilemap globals"]')?.textContent ?? "";
        const layout = document.querySelector("[data-layout]")?.getAttribute("data-layout");
        const inspector = document.querySelector('[aria-label="Inspector"]')?.textContent ?? "";
        const map = document.querySelector('canvas[aria-label="Tilemap"]');
        const tiles = !!document.querySelector('canvas[aria-label="Tile definitions"]');
        // --- Whole map, unscrolled: cell (0, 0) is tile 0 (transparent), cell (4, 0) tile 1
        const ctx = map?.getContext("2d");
        const alpha = (x, y) => ctx?.getImageData(x, y, 1, 1).data[3];
        return {
          globals,
          layout,
          inspector,
          tiles,
          size: map ? [map.width, map.height] : [],
          blank: alpha(3, 3),
          frame: alpha(32, 0),
          inside: alpha(35, 3)
        };
      });
      console.log("  wide ·", JSON.stringify({ ...wide, globals: undefined, inspector: undefined }));
      if (wide.layout !== "wide") throw new Error(`Expected the wide layout at 1560px; got ${wide.layout}`);
      for (const text of ["40×32", "2-byte", "5:$2800", "5:$2000", "12,8", "8,151,8,247"]) {
        if (!wide.globals.includes(text)) throw new Error(`The globals strip lacks ${text}: ${wide.globals}`);
      }
      if (/overlaps|wraps/.test(wide.globals)) throw new Error(`Unexpected diagnostic: ${wide.globals}`);
      if (!/Cell \(3, 10\) · tile 8/.test(wide.inspector) || !/rotate, Y mirror/.test(wide.inspector)) {
        throw new Error(`The inspector does not decode cell (3, 10): ${wide.inspector}`);
      }
      if (!wide.inspector.includes("$6B26")) throw new Error(`Cell (3, 10)'s entry is not at Z80 $6B26: ${wide.inspector}`);
      if (!wide.tiles) throw new Error("The Tiles view is not shown beside the map");
      if (wide.size.join("x") !== "320x256") throw new Error(`The map canvas is ${wide.size.join("x")}`);
      if (wide.blank !== 0 || wide.frame !== 255 || wide.inside !== 255) {
        throw new Error(`The map pixels are wrong: ${JSON.stringify(wide)}`);
      }
      await klive.ide.mouse.move(5, 5);
      await klive.shot(DOC, "working-with-ide/tilemap-inspector.png", { displayWidth: 900 });

      // --- Cell (3, 10)'s tile popped out into the read-only tile viewer, as the cell shows it
      await klive.ide.locator('[aria-label="Inspector"] button', { hasText: "Open tile snapshot" }).click();
      await klive.sleep(1500);
      const tileShot = await klive.ide.evaluate(() => {
        const fills = () => [...document.querySelectorAll('[aria-label="Tile snapshot"] [data-role="pixels"] rect')].map((r) => r.getAttribute("fill"));
        const shown = fills();
        const bar = document.querySelector('[aria-label="Tile snapshot"] [aria-label="Read-only snapshot"]')?.textContent ?? "";
        return { bar, pixels: shown.length, shown };
      });
      await klive.ide.mouse.move(5, 5);
      await klive.shot(DOC, "working-with-ide/tile-snapshot.png", { displayWidth: 900 });
      await klive.ide.locator('[aria-label="Tile snapshot"] button', { hasText: "As stored" }).click();
      await klive.sleep(300);
      const stored = await klive.ide.evaluate(() =>
        [...document.querySelectorAll('[aria-label="Tile snapshot"] [data-role="pixels"] rect')].map((r) => r.getAttribute("fill"))
      );
      console.log("  tile snapshot ·", tileShot.bar.replace(/\s+/g, " ").trim());
      if (!/Read-only/.test(tileShot.bar) || !/Tile 8/.test(tileShot.bar) || !/as cell \(3, 10\) shows it/.test(tileShot.bar)) {
        throw new Error(`The tile snapshot is not cell (3, 10)'s tile 8: ${tileShot.bar}`);
      }
      if (tileShot.pixels !== 64 || JSON.stringify(stored) === JSON.stringify(tileShot.shown)) {
        throw new Error(`The tile snapshot does not show 64 pixels that rotate and mirror: ${JSON.stringify({ pixels: tileShot.pixels })}`);
      }
      // --- As stored: tile 8's top row is colour 13 at offset 2, its left half colour 14
      if (stored[0] !== stored[7] || stored[0] === stored[15] || stored[8] === stored[15]) {
        throw new Error(`Tile 8 as stored is not a top row over a left half: ${JSON.stringify(stored.slice(0, 16))}`);
      }
      await klive.cmd("show-tilemap 3 10", 1200);

      // --- As displayed: scrolled by (12, 8), so display (20, 8) shows map (32, 16) (tile 1's frame)
      await klive.ide.locator('[aria-label="Map mode"] button', { hasText: "As displayed" }).click();
      await klive.sleep(600);
      const shown = await klive.ide.evaluate(() => {
        const map = document.querySelector('canvas[aria-label="Tilemap"]');
        const ctx = map.getContext("2d");
        const alpha = (x, y) => ctx.getImageData(x, y, 1, 1).data[3];
        // --- (4, 4) is outside the clip window (x from 16, y from 8); (20, 8) is map (32, 16)
        return { clipped: alpha(4, 4), frame: alpha(20, 8) };
      });
      if (shown.clipped !== 0 || shown.frame !== 255) throw new Error(`As displayed is wrong: ${JSON.stringify(shown)}`);
      console.log("  as displayed ·", JSON.stringify(shown));
      await klive.ide.locator('[aria-label="Map mode"] button', { hasText: "Whole map" }).click();


      // --- Narrow: tabs, the inspector band; the Tiles view with tile 8 selected
      await resize(860);
      await klive.sleep(1200);
      await klive.cmd("show-tiles 8", 1500);
      const narrow = await klive.ide.evaluate(() => ({
        layout: document.querySelector("[data-layout]")?.getAttribute("data-layout"),
        tabs: [...document.querySelectorAll('[aria-label="Tilemap Inspector view"] [role="tab"]')].map((t) => t.textContent),
        tiles: !!document.querySelector('canvas[aria-label="Tile definitions"]'),
        map: !!document.querySelector('canvas[aria-label="Tilemap"]'),
        inspector: document.querySelector('[aria-label="Inspector"]')?.textContent ?? "",
        // --- The sheet and the inspector scroll through the IDE's ScrollViewer (OverlayScrollbars),
        // --- never through a native scroll bar
        nativeScrollers: [...document.querySelectorAll('[data-layout="narrow"] *')].filter((e) => {
          if (e.closest("[data-overlayscrollbars-viewport]") === e) return false;
          const o = getComputedStyle(e);
          return /auto|scroll/.test(o.overflowX + o.overflowY) && !e.hasAttribute("data-overlayscrollbars-viewport");
        }).length,
        sheetScroller: !!document.querySelector('canvas[aria-label="Tile definitions"]')?.closest("[data-overlayscrollbars-viewport]"),
        inspectorScroller: !!document.querySelector('[aria-label="Inspector"] [data-overlayscrollbars-viewport]')
      }));
      await klive.ide.mouse.move(5, 5);
      await klive.shot(DOC, "working-with-ide/tilemap-inspector-tiles.png", { displayWidth: 680 });
      if (narrow.layout !== "narrow") throw new Error(`Expected the narrow layout at 860px; got ${narrow.layout}`);
      if (narrow.tabs.includes("Both")) throw new Error("Both is offered in the narrow layout");
      if (!narrow.tiles || narrow.map) throw new Error(`Expected the Tiles tab alone: ${JSON.stringify(narrow)}`);
      if (narrow.nativeScrollers || !narrow.sheetScroller || !narrow.inspectorScroller) {
        throw new Error(`A pane scrolls natively: ${JSON.stringify({ ...narrow, inspector: undefined })}`);
      }
      if (!/Tile 8 · 40 cells use it/.test(narrow.inspector)) {
        throw new Error(`The inspector does not show tile 8's 40 users: ${narrow.inspector}`);
      }
      console.log("  narrow · tiles tab, tile 8 with 40 users");

      // --- 80 columns (T6): `nextreg $6B,$C0 / jr $` at $8100. The map doubles to 640 layer pixels,
      // --- and cell (79, 0) exists
      await klive.cmd("setmem $8100 $C06B91ED -b32", 150);
      await klive.cmd("setmem $8104 $FE18 -b16", 150);
      await klive.cmd("setz80reg pc $8100", 400);
      await klive.cmd("em-debug", 1200);
      await klive.cmd("em-pause", 1200);
      await klive.cmd("show-tilemap 79 0", 1500);
      const cols80 = await klive.ide.evaluate(() => {
        const map = document.querySelector('canvas[aria-label="Tilemap"]');
        const ctx = map.getContext("2d");
        return {
          size: [map.width, map.height],
          globals: document.querySelector('[aria-label="Tilemap globals"]')?.textContent ?? "",
          inspector: document.querySelector('[aria-label="Inspector"]')?.textContent ?? "",
          frame: ctx.getImageData(32, 0, 1, 1).data[3],
          inside: ctx.getImageData(35, 3, 1, 1).data[3]
        };
      });
      if (cols80.size.join("x") !== "640x256" || !cols80.globals.includes("80×32")) {
        throw new Error(`80 columns not shown: ${JSON.stringify({ ...cols80, inspector: undefined })}`);
      }
      if (!/Cell \(79, 0\)/.test(cols80.inspector)) throw new Error(`Cell (79, 0) not selected: ${cols80.inspector}`);
      if (cols80.frame !== 255 || cols80.inside !== 255) throw new Error(`80-column pixels are wrong: ${JSON.stringify(cols80)}`);
      console.log("  80 columns · 640x256, cell (79, 0)");
    } finally {
      fixture.cleanup();
    }
  }
};
