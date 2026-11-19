/**
 * Guides screenshots of the `.dma` editor support (`docs/content/en/guides/next/dma.mdx`,
 * `dev/plans/NEXT_DMA_DEBUGGING_PLAN.md` §10):
 *
 * - `dma/dma-editor.webp` — a `.dma` program after the background compile: the summary line above it
 *   and the Z0389 squiggle on an enable that has no load before it;
 * - `dma/dma-hover.webp` — the hover of the program's `.dma wr2` line.
 *
 * One Next project with `code/main.kz80.asm` as the build root. **Compile in the background** is seeded
 * on, so the warning shows inline and the summary appears without a build.
 */
const h = require("../guides-helpers.cjs");
const { fixtureProjectFolder } = require("../harness.cjs");

const MAIN = "code/main.kz80.asm";
const SOURCE = `; Play a sample to the Specdrum DAC
    .model next
    .org $8000
Start:
    ld hl,Prog
    ld b,ProgEnd-Prog
    ld c,$6b
    otir
    ret

Prog:
    .dma disable
    .dma wr0 a_to_b, transfer, $c000, 2048
    .dma wr1 memory, increment
    .dma wr2 io, fixed, 3t, 55
    .dma wr4 burst, $00df
    .dma wr5
    .dma enable
ProgEnd:
`;
const EDITOR = ".monaco-editor";
const line = (ide, text) => ide.locator(`${EDITOR} .view-line`, { hasText: text }).first();

module.exports = {
  name: "guides-dma-editor",
  window: {
    width: 1280,
    height: 820,
    sideBarWidth: "260px",
    toolPanelHeight: "160px",
    globalSettings: { editorOptions: { allowBackgroundCompile: true } }
  },

  async run(klive) {
    const { ide } = klive;
    const fixture = fixtureProjectFolder(process.env.DOC_SHOTS_PROJECT || "DmaEditor");
    try {
      await h.projectWithSource(klive, fixture, { machine: "zxnext", file: MAIN, source: SOURCE });
      await h.activity(klive, "Explorer");
      await h.showFile(klive, MAIN);
      await h.sleep(4000); // --- the background compile behind the warning and the summary
      await ide.locator(`${EDITOR} .codelens-decoration`).first().waitFor({ timeout: 15000 });
      await h.park(ide);

      // --- 1. The program with its summary and the warning
      const ed = await ide.locator(EDITOR).first().boundingBox();
      const first = await line(ide, "Prog:").boundingBox();
      const last = await line(ide, "ProgEnd:").boundingBox();
      await klive.shot(EDITOR, "en/guides/next/dma/dma-editor.webp", {
        displayWidth: 820,
        crop: { x: 0, y: first.y - ed.y - 34, width: ed.width, height: last.y - first.y + 52 }
      });

      // --- 2. The hover of `.dma wr2`
      const wr2 = line(ide, ".dma wr2");
      const box = await wr2.boundingBox();
      await ide.mouse.move(box.x + 60, box.y + box.height / 2);
      const hover = ide.locator(".monaco-hover:visible").first();
      await hover.waitFor({ timeout: 10000 });
      await h.sleep(600);
      const hb = await hover.boundingBox();
      const top = Math.max(ed.y, Math.min(box.y, hb.y) - 16);
      const bottom = Math.min(ed.y + ed.height, Math.max(box.y + box.height, hb.y + hb.height) + 16);
      await klive.shot(EDITOR, "en/guides/next/dma/dma-hover.webp", {
        displayWidth: 820,
        crop: { x: 0, y: top - ed.y, width: ed.width, height: bottom - top }
      });
    } finally {
      fixture.cleanup();
    }
  }
};
