/**
 * Guides screenshot of the Klive BASIC source-level debugger
 * (`docs/content/en/guides/debugging/call-stack-variables`):
 *
 * - `klive-basic-paused.webp` — the Get Started bouncing ball (`fixtures/get-started/bouncing-ball`)
 *   paused on a breakpoint inside its `DrawBall` SUB: the editor's highlight, the Call Stack and the
 *   Variables panels.
 */
const path = require("path");
const fs = require("fs");
const { fixtureProjectFolder, REPO } = require("../harness.cjs");
const h = require("../guides-helpers.cjs");

const SOURCE = fs.readFileSync(
  path.join(REPO, "scripts", "doc-shots", "fixtures", "get-started", "bouncing-ball", "code", "program.zxbas"),
  "utf8"
);
const FILE = "code/ball.zxbas";
/** `PRINT AT 10, column; ball` inside `SUB DrawBall` */
const LINE = 9;

module.exports = {
  name: "guides-basic",
  window: {
    width: 1280,
    height: 820,
    sideBarWidth: "330px",
    toolPanelHeight: "150px",
    panelFontFamily: "iosevka",
    panelFontSize: 12
  },

  async run(klive) {
    const { ide } = klive;
    const fixture = fixtureProjectFolder(process.env.DOC_SHOTS_PROJECT || "BasicDebugShots");
    try {
      await h.projectWithSource(klive, fixture, { machine: "sp48", template: "zx-basic", file: FILE, source: SOURCE });
      await klive.cmd(`bp-set [${FILE}]:${LINE}`, 900);
      await h.activity(klive, "Debug");
      await klive.cmd("debug", 10000);
      // --- Continue a few times, so the ball has moved and the bounce counter is not at its start
      for (let i = 0; i < 3; i++) await klive.cmd("em-debug", 1200);
      await h.hideEmu(klive);
      await h.focusIde(klive);
      await h.showFile(klive, FILE);
      await h.sections(ide, ["Call Stack", "Variables"]);
      await klive.cmd("cls", 400);
      const stack = await h.sectionLocator(ide, "Call Stack").innerText();
      console.log("  call stack ·", stack.replace(/\s+/g, " ").slice(0, 200));
      if (!/DrawBall/i.test(stack)) throw new Error(`The Call Stack does not show DrawBall: ${stack}`);
      await h.park(ide);
      await klive.shot(h.ROOT, "en/guides/debugging/call-stack-variables/klive-basic-paused.webp", {
        displayWidth: 900,
        markers: {
          current: { selector: h.lineNumber(LINE), x: 3, y: 0.5 },
          callstack: { selector: '[class*="_sideBarPanel_"]:has([class*="_headerText_"]:text("Call Stack"))', x: 0.5, y: 0.15 },
          variables: { selector: '[class*="_sideBarPanel_"]:has([class*="_headerText_"]:text("Variables"))', x: 0.5, y: 0.15 }
        }
      });
      await klive.cmd("em-stop", 1500);
    } finally {
      fixture.cleanup();
    }
  }
};
