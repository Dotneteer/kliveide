/**
 * Screenshots for `docs/content/working-with-ide/breakpoints.mdx`.
 *
 * One shot: `bp-view.png`, the Breakpoints panel with one breakpoint of each kind, grouped under
 * its headers. It replaces a hand-captured image that predates both the grouping and the sixth
 * breakpoint type.
 *
 * The machine is a ZX Spectrum Next, because that is the only one where a `nr:` breakpoint can be
 * set at all.
 */
const { fixtureProjectFolder } = require("../harness.cjs");

const PANEL = '[class*="_breakpointsPanel_"]';

module.exports = {
  name: "breakpoints",
  /*
   * Narrow and tall: this is a sidebar panel, and the published image is 384px wide, so a wide
   * window would only add empty space to the right of every row. The height matters more than it
   * looks - the panel's list is virtualized and shares the sidebar with the other Debug panels, so
   * rows past the fold are not merely clipped, they are absent from the DOM and from the shot.
   *
   * Iosevka at 12px for the same reason `disassembly` uses it: it is Klive's own default panel
   * font and the most legible of them at documentation size.
   */
  window: {
    width: 900,
    height: 1100,
    toolPanelHeight: "110px",
    panelFontFamily: "iosevka",
    panelFontSize: 12
  },

  async run(klive) {
    const fixture = fixtureProjectFolder(process.env.DOC_SHOTS_PROJECT || "BreakpointShots");
    try {
      await klive.cmd(`newp zxnext ${fixture.name} -p "${fixture.parent}" -o`, 12000);
      await klive.sleep(1500);

      /*
       * Four breakpoints across three kinds, not one of every kind.
       *
       * The Breakpoints panel shares the sidebar's height with the other Debug panels and its list
       * is virtualized, so only the rows that fit are in the DOM at all - a set large enough to
       * show all six groups scrolled the NextReg ones, the point of the shot, out of frame. The
       * type catalogue lives in its own image (`bp-types.png`); this one shows the *view*.
       *
       * Two execution breakpoints, because a group of one says nothing about the count in its
       * header. `$07` is the CPU speed register, whose documented name is short enough for a 384px
       * panel, and the filtered `$4C` shows the `=$0B` key form a bare register does not.
       */
      for (const command of [
        "bp-set $8000",
        "bp-set $8010",
        "bp-set $9100 -w",
        "bp-set nr:$07",
        "bp-set nr:$4c -v $0b"
      ]) {
        await klive.cmd(command, 1200);
      }
      await klive.sleep(800);

      /*
       * Open the Debug activity, where the Breakpoints panel lives.
       *
       * Clicked rather than commanded: there is no IDE command that selects an activity.
       *
       * By its accessible name, not by a class: `ActivityButton` is a real `<button role="tab">`
       * with `aria-label` set from the activity's title, so this selector is the same thing a
       * keyboard user or a screen reader addresses, and it survives a restyle.
       */
      await klive.ide.getByRole("tab", { name: "Debug" }).click();
      await klive.sleep(1200);

      const rows = await klive.ide.evaluate((sel) => {
        const panel = document.querySelector(sel);
        return panel ? panel.textContent : "";
      }, PANEL);
      if (!rows.includes("NR:$07")) {
        throw new Error(`Breakpoints panel is not showing the NextReg rows; got: ${rows}`);
      }

      await klive.shot(PANEL, "working-with-ide/bp-view.png", { displayWidth: 384 });
    } finally {
      fixture.cleanup();
    }
  }
};
