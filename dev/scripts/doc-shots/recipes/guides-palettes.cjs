/**
 * Guides screenshots of `docs/content/en/guides/next/palettes.mdx` (NEXT_PALETTE_DEBUGGING_PLAN §4):
 *
 * - `palettes/palette-document.webp` — the Palette document stopped on a `pal:` breakpoint, Follow on:
 *   the sprite palette's two banks, six entries written since the last stop, entry $03 selected with
 *   its old colour in the corner and the breakpoint's details;
 * - `palettes/palette-panel.webp` — the Next Palettes panel (Machine info) with its pop-out button and
 *   the written and breakpoint dots on the Sprites row.
 *
 * It pokes a program into a paused Next (no NextZXOS needed): it selects the first sprite palette,
 * writes entries $10-$15 and then entry $03, which `pal:spr1:$03 -changed` stops on. The Next writes
 * its SD card image under the user's home, so the run gets a throwaway one.
 */
const os = require("os");
const path = require("path");
const { fixtureProjectFolder } = require("../harness.cjs");
const h = require("../guides-helpers.cjs");
const { step, reportFailures, panelShot } = require("../guides-helpers-shot.cjs");

// prettier-ignore
const PROGRAM = [
  0x31, 0x00, 0x90,       // 8000 LD SP,$9000
  0xf3,                   // 8003 DI
  0xed, 0x91, 0x43, 0x20, // 8004 NEXTREG $43,$20  ; write the first sprite palette
  0xed, 0x91, 0x40, 0x10, // 8008 NEXTREG $40,$10
  0xed, 0x91, 0x41, 0xe0, // 800C NEXTREG $41,$E0  ; $10-$15: red, yellow, green, cyan, blue, magenta
  0xed, 0x91, 0x41, 0xfc,
  0xed, 0x91, 0x41, 0x1c,
  0xed, 0x91, 0x41, 0x1f,
  0xed, 0x91, 0x41, 0x03,
  0xed, 0x91, 0x41, 0xe3,
  0xed, 0x91, 0x40, 0x03, // 8024 NEXTREG $40,$03
  0xed, 0x91, 0x41, 0xe0, // 8028 NEXTREG $41,$E0  ; entry $03 becomes red: the breakpoint
  0x18, 0xfe              // 802C JR $
];
const hex = (v, d) => "$" + v.toString(16).toUpperCase().padStart(d, "0");
const DOCS = '[class*="_documentArea_"], [class*="_documentsContainer_"]';

module.exports = {
  name: "guides-palettes",
  window: {
    width: 1280,
    height: 820,
    sideBarWidth: "380px",
    toolPanelHeight: "120px",
    panelFontFamily: "iosevka",
    panelFontSize: 12,
    userHome: path.join(os.tmpdir(), "klive-shots-guides-palettes-home")
  },

  async run(klive) {
    const { ide } = klive;
    const fixture = fixtureProjectFolder(process.env.DOC_SHOTS_PROJECT || "PaletteShots");
    try {
      await klive.cmd(`newp zxnext ${fixture.name} -p "${fixture.parent}" -o`, 12000);
      await klive.cmd("em-debug", 4000);
      await klive.cmd("em-pause", 1000);
      for (let i = 0; i < PROGRAM.length; i += 4) {
        const chunk = PROGRAM.slice(i, i + 4);
        const value = chunk.reduce((v, b, k) => v + b * 2 ** (8 * k), 0);
        const bits = [8, 16, 24, 32][chunk.length - 1];
        await klive.cmd(`setmem ${hex(0x8000 + i, 4)} ${hex(value, chunk.length * 2)} -b${bits}`, 150);
      }
      await klive.cmd("setz80reg pc $8000", 400);
      await klive.cmd("bp-set pal:spr1:$03 -changed", 600);
      await klive.cmd("show-palettes spr", 2500);
      await ide.getByText("Follow changes").first().click();
      await klive.sleep(400);
      // --- Run to the breakpoint: the entry write at $8028
      await klive.cmd("em-debug", 3000);
      await h.hideEmu(klive);
      await h.focusIde(klive);
      await klive.cmd("cls", 400);

      await step(klive, "palette-document", async () => {
        const details = await ide.locator('aside[aria-label="Entry details"]').first().textContent();
        if (!details.includes("entry $03") || !details.includes("was $007") || !details.includes("$8028")) {
          throw new Error(`The document did not follow the stop: ${details}`);
        }
        await h.park(ide);
        await klive.shot(DOCS, "en/guides/next/palettes/palette-document.webp", {
          displayWidth: 900,
          markers: {
            written: { selector: '[role="grid"] >> nth=0', x: 0.06 + (3.5 / 17) * 0.94, y: 0.06 + (1.5 / 17) * 0.94 },
            follow: { selector: 'text="Follow changes"' }
          }
        });
      });

      await h.activity(klive, "Machine info");
      await step(klive, "palette-panel", async () => {
        await h.sections(ide, ["Next Palettes"]);
        await h.park(ide);
        await panelShot(klive, "Next Palettes", "en/guides/next/palettes/palette-panel.webp", {
          displayWidth: 380,
          maxHeight: 400
        });
      });
      reportFailures();
    } finally {
      fixture.cleanup();
    }
  }
};
