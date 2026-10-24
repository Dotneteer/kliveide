/**
 * Guides screenshots of the code editor and navigation (`docs/content/en/guides/editing/`):
 *
 * - `editor/hover.webp` — the hover on a label in Klive Z80 assembly;
 * - `navigation/history.webp` — the toolbar's history list after a few jumps (Explorer opens and a
 *   Go to Definition);
 * - `editor/error.webp` — an inline error from background compilation, with its hover message.
 *
 * One 48K project: `code/main.kz80.asm` (a border colour cycle) is the build root, with two more
 * source files to jump between. **Compile in the background** is seeded on, so errors show inline.
 */
const h = require("../guides-helpers.cjs");
const { fixtureProjectFolder } = require("../harness.cjs");

const MAIN = "code/main.kz80.asm";
const SOURCE = `; Border colour cycle
    .model Spectrum48
    .org #8000
Start:
    ld b,8
Loop:
    ld a,b
    and 7
    out (#fe),a       ; set the border colour
    call Delay
    djnz Loop
    jr Start

; Waits a moment
Delay:
    ld hl,#0800
Wait:
    dec hl
    ld a,h
    or l
    jr nz,Wait
    ret
`;
const SIDE = '[class*="_sideBarPanel_"]';
const EDITOR = ".monaco-editor";
const token = (ide, text) =>
  ide.locator(`${EDITOR} .view-line span`, { hasText: new RegExp(`^${text}$`) }).first();

/** Photographs the editor cropped around a token and the hover above or below it. */
async function hoverShot(klive, text, file, displayWidth) {
  const { ide } = klive;
  await h.park(ide);
  await token(ide, text).hover({ timeout: 10000 });
  const hover = ide.locator(".monaco-hover:visible").first();
  await hover.waitFor({ timeout: 10000 });
  await h.sleep(600);
  const ed = await ide.locator(EDITOR).first().boundingBox();
  const tb = await token(ide, text).boundingBox();
  const hb = await hover.boundingBox();
  const pad = 16;
  const left = Math.max(ed.x, Math.min(tb.x, hb.x) - pad - 120);
  const top = Math.max(ed.y, Math.min(tb.y, hb.y) - pad);
  const right = Math.min(ed.x + ed.width, Math.max(tb.x + tb.width, hb.x + hb.width) + pad);
  const bottom = Math.min(ed.y + ed.height, Math.max(tb.y + tb.height, hb.y + hb.height) + pad);
  await klive.shot(EDITOR, file, {
    displayWidth,
    crop: { x: left - ed.x, y: top - ed.y, width: right - left, height: bottom - top }
  });
}

module.exports = {
  name: "guides-editing",
  window: {
    width: 1280,
    height: 820,
    sideBarWidth: "260px",
    toolPanelHeight: "160px",
    globalSettings: { editorOptions: { allowBackgroundCompile: true } }
  },

  async run(klive) {
    const { ide } = klive;
    const fixture = fixtureProjectFolder(process.env.DOC_SHOTS_PROJECT || "MyGame");
    try {
      await h.projectWithSource(klive, fixture, {
        machine: "sp48",
        file: MAIN,
        source: SOURCE,
        extraFiles: {
          "code/sprites.kz80.asm": "; Sprite data\nShip:\n    .defb #18, #3c, #7e, #ff\n",
          "code/sound.kz80.asm": "; Sound effects\nBeep:\n    ret\n"
        }
      });
      await h.activity(klive, "Explorer");
      await h.showFile(klive, MAIN);
      await h.sleep(3000); // --- the background compile behind the hover

      // --- 1. The hover on a label
      await hoverShot(klive, "Delay", "en/guides/editing/editor/hover.webp", 560);
      await h.park(ide);
      await ide.keyboard.press("Escape");

      // --- 2. A few jumps, then the history list
      for (const name of ["sprites.kz80.asm", "sound.kz80.asm", "main.kz80.asm"]) {
        await ide.locator(SIDE).getByText(name, { exact: true }).first().click({ timeout: 10000 });
        await h.sleep(1200);
      }
      await token(ide, "Delay").click({ timeout: 10000 });
      await ide.keyboard.press("F12");
      await h.sleep(1500);
      const chevron = ide.locator('button[data-icon="chevron-down"]').first();
      await chevron.click({ timeout: 10000 });
      const popover = ide.locator('[role="dialog"]').first();
      await popover.waitFor({ timeout: 10000 });
      await h.park(ide);
      const pb = await popover.boundingBox();
      await klive.shot(h.ROOT, "en/guides/editing/navigation/history.webp", {
        displayWidth: 620,
        crop: { x: 0, y: 0, width: Math.ceil(Math.max(pb.x + pb.width + 16, 420)), height: Math.ceil(pb.y + pb.height + 16) }
      });
      await ide.keyboard.press("Escape");
      await h.sleep(500);

      // --- 3. A typo the background compile reports
      await token(ide, "Delay").dblclick({ timeout: 10000 });
      await ide.keyboard.type("Dleay");
      await h.sleep(4000);
      await hoverShot(klive, "Dleay", "en/guides/editing/editor/error.webp", 620);
      await ide.keyboard.press("Escape");
      await ide.keyboard.press(process.platform === "darwin" ? "Meta+z" : "Control+z");
      await h.sleep(500);
    } finally {
      await klive.cmd("close", 1500).catch(() => {});
      fixture.cleanup();
    }
  }
};
