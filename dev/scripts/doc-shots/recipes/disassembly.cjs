/**
 * Screenshots for `docs/content/working-with-ide/disassembly.mdx`.
 *
 * Currently one shot: `disass-branch-verdicts.png`, the branch verdict gutter with a conditional
 * branch under the execution point.
 */
const { fixtureProjectFolder } = require("../harness.cjs");

const WRAPPER = '[class*="_disassemblyWrapper_"]';

module.exports = {
  name: "disassembly",
  /*
   * Iosevka at 12px is Klive's own default panel font, and it is also what makes this shot work:
   * the execution-point readout swaps to its short form below `113ch`, so the window has to be wide
   * enough in *characters*, not pixels. Iosevka's 0.500em advance at 12px puts the threshold near
   * 680px, which a 1100px window clears comfortably while still cropping to something legible at
   * documentation size. The default jetbrains-mono at 14px would need ~950px and produce a wider,
   * coarser image.
   *
   * The height and the shrunken tool panel exist to fit roughly twenty rows: enough for the listing
   * to reach a `ret` and an `rst` below the execution point, so the shot shows several of the gutter
   * glyphs rather than the same arrow repeated. A shorter window cropped to nine rows and showed
   * only one.
   */
  window: {
    width: 1100,
    height: 700,
    toolPanelHeight: "110px",
    panelFontFamily: "iosevka",
    panelFontSize: 12
  },

  async run(klive) {
    const fixture = fixtureProjectFolder(process.env.DOC_SHOTS_PROJECT || "DisassemblyShots");
    try {
      await klive.cmd(`newp sp48 ${fixture.name} -p "${fixture.parent}" -o`, 9000);
      await klive.cmd("em-start", 3000);
      await klive.sleep(2000);
      await klive.cmd("em-pause", 2500);
      await klive.cmd("show-disass", 3000);
      await klive.sleep(1500);

      /*
       * Step until the listing is worth photographing, which means two things at once:
       *
       * - the execution point is a *conditional* branch, so the readout carries its condition
       *   clause — an unconditional jump produces no clause and under-sells the feature;
       * - at least one branch in view is *not* taken, so the fall-through mark appears. That mark
       *   is the most common one in practice, and a shot without it shows only arrows.
       *
       * Detected from the rendered DOM rather than by address, so it does not depend on where the
       * ROM happens to be when the machine pauses. Stepping rather than a breakpoint: `bp-set` was
       * tried and never fired, silently. A step either moves PC or fails loudly.
       *
       * `best` keeps the furthest the search got, so a run that never finds both still produces a
       * shot rather than nothing.
       */
      const inspect = () =>
        klive.ide.evaluate((sel) => {
          const wrap = document.querySelector(sel);
          if (!wrap) return { clause: false, glyphs: [] };
          const long = wrap.querySelector('[data-readout="long"]');
          return {
            clause: !!long && / met /.test(long.textContent),
            glyphs: [
              ...new Set(
                [...wrap.querySelectorAll("[data-branch-glyph]")].map((g) =>
                  g.getAttribute("data-branch-glyph")
                )
              )
            ]
          };
        }, WRAPPER);

      /*
       * Keep the richest frame the walk finds, rather than the first acceptable one.
       *
       * "Richest" is the count of *distinct* gutter glyphs on screen, because the shot's job is to
       * show the vocabulary — an earlier version stopped at the first conditional branch and
       * produced a frame with one glyph repeated nine times.
       *
       * Five is the target and the ceiling: a 48K ROM can show back, forward, call, return and
       * fall-through, but never the unobtainable mark, which belongs to Z80N's `jp (c)`. Stopping
       * at four was tried and settled immediately on a frame with no call in it.
       */
      let best = null;
      for (let step = 0; step < 120; step++) {
        const state = await inspect();
        if (state.clause && (!best || state.glyphs.length > best.glyphs.length)) best = state;
        if (best && best.clause && best.glyphs.length >= 5) break;
        await klive.cmd("em-sti", 600);
      }
      const landed = !!best;
      if (!landed) throw new Error("never stepped onto a conditional branch");
      console.log(`  glyphs in frame: ${best.glyphs.sort().join(", ")}`);

      await klive.shot(WRAPPER, "working-with-ide/disass-branch-verdicts.png", {
        displayWidth: 640
      });
    } finally {
      fixture.cleanup();
    }
  }
};
