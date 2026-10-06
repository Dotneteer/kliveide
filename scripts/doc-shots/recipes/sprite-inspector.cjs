/**
 * Screenshots for `docs/content/working-with-ide/sprite-inspector.mdx`, and the running-app check of
 * the Sprite Inspector (`.plans/SPRITE_INSPECTOR_PLAN.md` Phases 5-8).
 *
 * A ZX Spectrum Next cannot run IDE-built code without NextZXOS on a card, so the recipe pokes a
 * small program into a paused machine instead: `sprite-demo.kz80.asm` beside this file, assembled
 * by Klive's own assembler into `PROGRAM` below. It uploads three patterns and nine sprites (a
 * unified anchor with a relative, 4- and 8-bit sprites, a hidden one, one off screen, one partly off
 * screen, one slot read both as 4-bit and 8-bit), then parks in `jr $`.
 *
 * It verifies before it photographs: the table, the globals strip and the sheet are read back from
 * the DOM and the run throws if they are wrong.
 */
const os = require("os");
const path = require("path");
const fs = require("fs");
const { fixtureProjectFolder } = require("../harness.cjs");

/* --- sprite-demo.kz80.asm, assembled at $8000. Re-assemble it after changing the source. */
const PROGRAM = [
  0xf3, 0x01, 0x3b, 0x30, 0xaf, 0xed, 0x79, 0x01, 0x5b, 0x00, 0x16, 0x00, 0xed, 0x51, 0x14, 0x20,
  0xfb, 0x1e, 0x00, 0x7b, 0xe6, 0x0f, 0x28, 0x11, 0xfe, 0x0f, 0x28, 0x0d, 0x7b, 0xe6, 0xf0, 0x28,
  0x08, 0xfe, 0xf0, 0x28, 0x04, 0x3e, 0xe3, 0x18, 0x02, 0x3e, 0xe0, 0xed, 0x79, 0x1c, 0x20, 0xe3,
  0x1e, 0x00, 0x7b, 0xe6, 0x10, 0x3e, 0x12, 0x28, 0x02, 0x3e, 0x45, 0xed, 0x79, 0x1c, 0x20, 0xf2,
  0x01, 0x3b, 0x30, 0xaf, 0xed, 0x79, 0x21, 0x5b, 0x80, 0x01, 0x57, 0x00, 0x16, 0x28, 0x7e, 0xed,
  0x79, 0x23, 0x15, 0x20, 0xf9, 0xed, 0x91, 0x15, 0x03, 0x18, 0xfe, 0x64, 0x50, 0x00, 0xc0, 0x2a,
  0x10, 0x00, 0x00, 0xc1, 0x40, 0xc8, 0x3c, 0x2a, 0x81, 0x28, 0x96, 0x50, 0xc2, 0x80, 0x46, 0x96,
  0x50, 0xc2, 0xc0, 0x0a, 0x0a, 0x00, 0x01, 0x4a, 0x78, 0x01, 0x80, 0x36, 0x64, 0x01, 0x80, 0x78,
  0xb4, 0x00, 0x82,
];

const DOC = '[class*="_documentContainer_"]';
const hex = (v, d) => "$" + v.toString(16).toUpperCase().padStart(d, "0");

module.exports = {
  name: "sprite-inspector",
  window: {
    width: 1560,
    height: 1000,
    sideBarWidth: "200px",
    toolPanelHeight: "90px",
    panelFontFamily: "iosevka",
    panelFontSize: 12,
    // --- A Next launch writes `~/Klive/ks2.cim`: keep it out of the real home
    userHome: path.join(os.tmpdir(), "klive-shots-sprite-inspector-home")
  },

  async run(klive) {
    const fixture = fixtureProjectFolder(process.env.DOC_SHOTS_PROJECT || "SpriteInspectorShots");
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

      /*
       * The layout follows the document's own width (.plans/mockups/sprite-inspector-layout.html).
       * With the 200px sidebar and Iosevka at 12px (6px a ch), these window widths put the document
       * in each layout; every one is checked from the DOM before it is photographed.
       */
      const resize = (width) =>
        klive.app.evaluate(({ BrowserWindow }, w) => {
          const ide = BrowserWindow.getAllWindows().find((x) => x.webContents.getURL().includes("?ide"));
          ide.setContentSize(w, 1000);
        }, width);

      await resize(1560);
      await klive.sleep(800);
      await klive.cmd("show-sprites 1", 2500);
      const state = await klive.ide.evaluate(() => {
        const rows = [...document.querySelectorAll("[data-sprite]")].map((r) => r.textContent);
        const globals = document.querySelector('[aria-label="Sprite globals"]')?.textContent ?? "";
        const cells = document.querySelectorAll('[aria-label="Sprite pattern RAM"] [data-pattern]').length;
        const layout = document.querySelector("[data-layout]")?.getAttribute("data-layout");
        return { rows, globals, cells, layout };
      });
      if (state.layout !== "wide") throw new Error(`Expected the wide layout at 1560px; got ${state.layout}`);
      if (state.rows.length !== 9) throw new Error(`Expected 9 rows up to the last visible sprite; got ${JSON.stringify(state.rows)}`);
      if (!/rel·unified/.test(state.rows[1])) throw new Error(`Sprite #1 is not a unified relative: ${state.rows[1]}`);
      if (!/off screen/.test(state.rows[6])) throw new Error(`Sprite #6 is not off screen: ${state.rows[6]}`);
      if (!/ON/.test(state.globals)) throw new Error(`The globals strip does not show the sprites on: ${state.globals}`);
      if (state.cells < 64) throw new Error(`The pattern sheet has ${state.cells} cells`);
      console.log("  wide · rows:", state.rows.length, "· cells:", state.cells);
      await klive.ide.mouse.move(5, 5);
      await klive.shot(DOC, "working-with-ide/sprite-inspector.png", { displayWidth: 900 });

      // --- Sprite #1's pattern popped out into a read-only sprite editor
      await klive.ide.locator('[aria-label="Sprite Inspector selection"] button', { hasText: "Open in sprite editor" }).click();
      await klive.sleep(1500);
      const snapshot = await klive.ide.evaluate(() => {
        const bar = document.querySelector('[aria-label="Read-only snapshot"]');
        return {
          bar: bar?.textContent ?? "",
          pixels: document.querySelectorAll('[data-role="pixels"] rect').length,
          pencil: !!document.querySelector('button[aria-label^="Pencil tool"]'),
          undo: !!document.querySelector('button[aria-label^="Undo"]')
        };
      });
      console.log("  snapshot ·", JSON.stringify(snapshot));
      await klive.ide.mouse.move(5, 5);
      await klive.shot(DOC, "working-with-ide/sprite-pattern-snapshot.png", { displayWidth: 900 });
      if (!/Read-only/.test(snapshot.bar) || !/as sprite #1 shows it/.test(snapshot.bar)) {
        throw new Error(`The snapshot is not a read-only view of sprite #1's pattern: ${snapshot.bar}`);
      }
      if (snapshot.pixels !== 256 || snapshot.pencil || snapshot.undo) {
        throw new Error(`The snapshot editor is not read-only: ${JSON.stringify(snapshot)}`);
      }

      // --- Narrow: tabs, the inspector band with the details and the map side by side
      await resize(860);
      await klive.sleep(1200);
      await klive.cmd("show-sprites 3", 1500);
      const narrow = await klive.ide.evaluate(() => {
        const root = document.querySelector("[data-layout]");
        const band = document.querySelector('[data-layout="band"]');
        const map = band?.querySelector('[aria-label="Sprite space"]')?.getBoundingClientRect();
        const fields = band?.querySelector("dl")?.getBoundingClientRect();
        const bandBox = band?.getBoundingClientRect();
        // --- Scroll the table sideways: the pinned cells and their headers must not move or narrow
        const table = document.querySelector('[aria-label="Sprite attribute slots"]');
        let scroller = table?.parentElement;
        while (scroller && scroller.scrollWidth <= scroller.clientWidth) scroller = scroller.parentElement;
        const pinned = () =>
          [...table.querySelectorAll("thead th, tbody tr:first-child td")]
            .filter((c) => getComputedStyle(c).position === "sticky" && getComputedStyle(c).left !== "auto")
            .map((c) => {
              const r = c.getBoundingClientRect();
              return [Math.round(r.left), Math.round(r.width)];
            });
        const before = pinned();
        const headerX = () => Math.round(table.querySelector("thead th:nth-child(5)").getBoundingClientRect().left);
        const cellX = () => Math.round(table.querySelector("tbody tr:first-child td:nth-child(5)").getBoundingClientRect().left);
        const scrollable = !!scroller && scroller !== document.documentElement;
        if (scrollable) scroller.scrollLeft = 200;
        const after = pinned();
        const aligned = headerX() === cellX();
        const moved = scrollable ? scroller.scrollLeft : 0;
        if (scrollable) scroller.scrollLeft = 0;
        return {
          layout: root?.getAttribute("data-layout"),
          tabs: [...document.querySelectorAll('[aria-label="Sprite Inspector view"] [role="tab"]')].map((t) => t.textContent),
          mapVisible: !!map && map.bottom <= bandBox.bottom + 1 && map.height > 40,
          fieldsVisible: !!fields && fields.bottom <= bandBox.bottom + 1,
          before,
          after,
          aligned,
          moved
        };
      });
      await klive.ide.mouse.move(5, 5);
      // --- Photographed before the checks, so a failure leaves a picture of itself in .doc-shots/
      await klive.shot(DOC, "working-with-ide/sprite-inspector-narrow.png", { displayWidth: 680 });
      if (narrow.layout !== "narrow") throw new Error(`Expected the narrow layout at 860px; got ${narrow.layout}`);
      if (narrow.tabs.includes("Both")) throw new Error("Both is offered in the narrow layout");
      if (!narrow.mapVisible || !narrow.fieldsVisible) {
        throw new Error(`The band does not show the fields and the map together: ${JSON.stringify(narrow)}`);
      }
      if (narrow.moved === 0) throw new Error("The sprite table did not scroll sideways at the narrow width");
      if (JSON.stringify(narrow.before) !== JSON.stringify(narrow.after) || narrow.before.length !== 6) {
        throw new Error(`The pinned columns moved or changed width: ${JSON.stringify(narrow)}`);
      }
      if (!narrow.aligned) throw new Error("The header did not scroll with its column");
      console.log("  narrow · pinned:", JSON.stringify(narrow.before), "· scrolled", narrow.moved, "px");

      // --- Medium: tabs and the rail; the Patterns tab with a slot read both ways
      await resize(1240);
      await klive.sleep(1200);
      await klive.cmd("show-patterns 2", 1500);
      const medium = await klive.ide.evaluate(() => ({
        layout: document.querySelector("[data-layout]")?.getAttribute("data-layout"),
        rail: !!document.querySelector('[data-layout="rail"]'),
        sheet: !!document.querySelector('[aria-label="Sprite pattern RAM"]')
      }));
      if (medium.layout !== "medium" || !medium.rail || !medium.sheet) {
        throw new Error(`Expected the medium layout with the rail and the sheet: ${JSON.stringify(medium)}`);
      }
      console.log("  medium · rail and sheet");
      await klive.ide.mouse.move(5, 5);
      await klive.shot(DOC, "working-with-ide/sprite-inspector-pattern.png", { displayWidth: 900 });

      // --- Phase 9: export the pattern RAM and check the file
      await klive.cmd("export-patterns", 2500);
      const exported = path.join(fixture.project, "pattern-ram.spr");
      if (!fs.existsSync(exported) || fs.statSync(exported).size !== 0x4000) {
        throw new Error(`export-patterns did not write a 16K ${exported}`);
      }
    } finally {
      fixture.cleanup();
    }
  }
};
