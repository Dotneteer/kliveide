/**
 * Screenshots for `docs/content/scripting/overview.mdx`.
 *
 * Spike scope: reproduces `script-output-pane.png` — the tool area with the OUTPUT
 * tab active and the Script Output pane selected, after a couple of script runs and
 * one deliberate parse error.
 */
const path = require("path");
const fs = require("fs");
const { fixtureProjectFolder } = require("../harness.cjs");

// --- Selectors are prefix matches: CSS-module class names carry a content hash
// --- (`_toolArea_vexl8_9`) that changes whenever the stylesheet changes.
const TOOL_AREA = '[class*="_toolArea_"]';

module.exports = {
  name: "scripting",
  async run(klive) {
    // --- Under ~/KliveProjects so the paths the screenshot shows read like a real
    // --- user's. Guarded: an existing folder of this name aborts the run.
    const fixture = fixtureProjectFolder("MyFirstKliveProject");
    const { name, parent: projects, project } = fixture;

    try {
      await klive.cmd(`newp sp48 ${name} -p "${projects}" -o`, 8000);

      // --- Two clean runs, then a syntax error, mirroring the documented example.
      fs.writeFileSync(path.join(project, "myScript.ksx"), 'console.log("Hello from Klive");\n');
      await klive.cmd("script-run myScript.ksx", 2500);
      await klive.cmd("script-run myScript.ksx", 2500);
      fs.writeFileSync(path.join(project, "myScript.ksx"), "const t = (Date.now();\n");
      await klive.sleep(1000);
      await klive.cmd("script-run myScript.ksx", 2500);

      // --- `outp` both selects the pane and switches the tool area to the OUTPUT tab.
      await klive.cmd("outp scripting", 1500);

      await klive.shot(TOOL_AREA, "scripting/script-output-pane.png", { displayWidth: 795 });
    } finally {
      fixture.cleanup();
    }
  }
};
