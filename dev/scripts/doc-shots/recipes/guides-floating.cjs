/**
 * Guides screenshot of a floating document window (`docs/content/en/guides/editing/editor.mdx`, "A
 * document in its own window"):
 *
 * - `editor/floating-window.webp` — a source file popped out of the IDE: Klive's own title bar with the
 *   document's name, **Dock** and **Close**, and the editor below it.
 *
 * Kept apart from `guides-editing` so publishing it does not regenerate that recipe's images.
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

module.exports = {
  name: "guides-floating",
  window: {
    width: 1280,
    height: 820,
    sideBarWidth: "260px",
    toolPanelHeight: "160px"
  },

  async run(klive) {
    const { app, ide } = klive;
    const fixture = fixtureProjectFolder(process.env.DOC_SHOTS_PROJECT || "MyGame");
    try {
      await h.projectWithSource(klive, fixture, { machine: "sp48", file: MAIN, source: SOURCE });
      await h.activity(klive, "Explorer");
      await h.showFile(klive, MAIN);
      await h.sleep(1500);

      // --- Pop the file out through its tab's context menu
      await ide.locator('[class*="_documentTab_"]', { hasText: "main.kz80.asm" }).first().click({ button: "right" });
      await h.sleep(400);
      await ide.getByText("Pop Out to Window", { exact: true }).click();
      await h.waitFor(() => app.windows().some((w) => w.url().includes("?float=")), "the floating window");
      const float = app.windows().find((w) => w.url().includes("?float="));
      await float.waitForLoadState("domcontentloaded");
      await h.waitFor(
        () => float.evaluate(() => !!document.querySelector('[data-app-ready="true"] .monaco-editor')),
        "the document in the floating window"
      );

      // --- A fixed size, so the picture does not depend on the IDE window's
      await app.evaluate(({ BrowserWindow }) => {
        const w = BrowserWindow.getAllWindows().find((b) => b.webContents.getURL().includes("?float="));
        w.webContents.setZoomFactor(1);
        w.setContentSize(640, 360);
      });
      await h.sleep(1500);
      // --- Over the scrollbar: the harness's usual spot is the gutter here, which shows its tooltip
      await float.mouse.move(636, 200);
      await h.sleep(600);
      await klive.shot("#appFloat", "en/guides/editing/editor/floating-window.webp", {
        page: float,
        displayWidth: 640
      });

      await float.click('[data-testid="float-close"]');
      await h.sleep(800);
    } finally {
      await klive.cmd("close", 1500).catch(() => {});
      fixture.cleanup();
    }
  }
};
