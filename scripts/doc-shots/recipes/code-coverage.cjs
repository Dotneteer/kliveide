/**
 * The running-app check of code coverage and the heat map (`.plans/CODE_COVERAGE_AND_HEAT_MAP_PLAN.md`
 * Phases 4-5), with staged shots for `docs/content/working-with-ide/code-coverage.mdx`.
 *
 * On the 48K it writes a program with a branch that is never taken and a byte it modifies after
 * running it, turns coverage on, runs the project (the injection flow resets coverage after the ROM's
 * boot, T11), pauses, and verifies before it photographs:
 *
 * - the editor's strip: covered lines, the two never-run lines hollow, nothing on comments;
 * - `coverage status` and `coverage smc` in the command output;
 * - the disassembly's coverage cell on the program's rows;
 * - the memory view's heat cells after `memory-heat exec`.
 */
const path = require("path");
const fs = require("fs");
const { fixtureProjectFolder, IMAGES } = require("../harness.cjs");

const SOURCE = `; Code coverage demo
    .model Spectrum48
    .org #8000
Start:
    ld b,3
Loop:
    ld a,b
    cp 5
    jr z,Never      ; never taken
    call Patched
    djnz Loop
    ld hl,Patched+1
    inc (hl)        ; modifies code that already ran
Wait:
    jr Wait
Never:
    ld a,0          ; never runs
    ret
Patched:
    ld a,0
    ret
`;

const fail = (what, state) => {
  throw new Error(`${what}: ${JSON.stringify(state)}`);
};

const editorState = (ide) =>
  ide.evaluate(() => {
    const count = (sel) => document.querySelectorAll(sel).length;
    return {
      covered: count('[class*="_coverageCovered_"]'),
      uncovered: count('[class*="_coverageUncovered_"]'),
      partial: count('[class*="_coveragePartial_"]')
    };
  });

const outputText = (ide) =>
  ide.evaluate(() => document.querySelector('[class*="_commandPanel_"]')?.textContent ?? "");

module.exports = {
  name: "code-coverage",
  window: {
    // --- Coverage is an advanced debugging feature: off unless the user turns it on
    userSettings: { features: { advancedDebugging: "1" } },
    width: 1280,
    height: 860,
    sideBarWidth: "200px",
    toolPanelHeight: "200px",
    panelFontFamily: "iosevka",
    panelFontSize: 12
  },

  async run(klive) {
    const fixture = fixtureProjectFolder(process.env.DOC_SHOTS_PROJECT || "CoverageShots");
    try {
      await klive.cmd(`newp sp48 ${fixture.name} -p "${fixture.parent}" -o`, 8000);
      // --- The demo is a new file made the build root, and the project reopened: the template's own
      // --- file was opened on creation, and its editor model outlives a project close, so replacing
      // --- that file would show the template's text under the demo's coverage
      fs.writeFileSync(path.join(fixture.project, "code", "demo.kz80.asm"), SOURCE);
      await klive.cmd("close", 2000);
      const projectFile = path.join(fixture.project, "klive.project");
      const project = JSON.parse(fs.readFileSync(projectFile, "utf8"));
      project.builder = { ...(project.builder ?? {}), roots: ["code/demo.kz80.asm"] };
      fs.writeFileSync(projectFile, JSON.stringify(project, null, 2));
      await klive.cmd(`open "${fixture.project}"`, 5000);
      await klive.cmd("coverage on", 1000);
      await klive.cmd("run", 9000);
      await klive.cmd("em-pause", 1500);
      await klive.cmd("nav code/demo.kz80.asm", 2500);

      let editor;
      for (let i = 0; i < 20; i++) {
        editor = await editorState(klive.ide);
        if (editor.covered > 0) break;
        await klive.sleep(500);
      }
      console.log("  editor strip ·", JSON.stringify(editor));
      // --- Lines 5-15 ran (ld b / ld a,b / cp / jr z / call / djnz / ld hl / inc (hl) / jr Wait,
      // --- Patched's two); Never's two lines did not
      if (editor.covered < 9) fail("Too few covered lines in the editor strip", editor);
      if (editor.uncovered !== 2) fail("The two never-run lines are not hollow", editor);
      const editorShot = path.join(IMAGES, "working-with-ide", "code-coverage-editor.png");
      fs.mkdirSync(path.dirname(editorShot), { recursive: true });
      await klive.ide.locator('[class*="monaco-editor"]').first().screenshot({ path: editorShot });
      console.log(`  ✓ ${path.relative(process.cwd(), editorShot)}`);

      await klive.cmd("cls", 500);
      await klive.cmd("coverage status", 1200);
      await klive.cmd("coverage smc", 1200);
      const out = await outputText(klive.ide);
      console.log("  output ·", out.replace(/\s+/g, " ").slice(0, 400));
      if (!/Coverage is on/.test(out)) fail("coverage status does not say it is on", out);
      if (!/lines covered/.test(out)) fail("coverage status has no source line summary", out);
      if (!/self-modified run/.test(out) || !/patched/i.test(out)) fail("coverage smc does not find Patched", out);

      await klive.cmd("show-disass", 2500);
      let disass = { covered: 0 };
      for (let i = 0; i < 20; i++) {
        disass = await klive.ide.evaluate(() => ({
          covered: document.querySelectorAll('[data-coverage="covered"]').length,
          cells: document.querySelectorAll('[class*="_coverageCell_"]').length
        }));
        if (disass.covered > 0) break;
        await klive.sleep(500);
      }
      console.log("  disassembly ·", JSON.stringify(disass));
      if (!disass.covered) fail("No covered rows in the disassembly", disass);

      await klive.cmd("show-memory", 2500);
      await klive.cmd("memory-heat all", 2000);
      let heat = { cells: 0 };
      for (let i = 0; i < 20; i++) {
        heat = await klive.ide.evaluate(() => ({
          cells: document.querySelectorAll('[class*="_heatCell_"]').length,
          kinds: [...new Set([...document.querySelectorAll('[class*="_heatCell_"]')].map((e) => e.className.match(/_heat(Exec|Read|Write)\d/)?.[0]))]
        }));
        if (heat.cells > 0) break;
        await klive.sleep(500);
      }
      console.log("  heat map ·", JSON.stringify(heat));
      if (!heat.cells) fail("No heat cells in the memory view", heat);
      const memoryShot = path.join(IMAGES, "working-with-ide", "code-coverage-heat.png");
      await klive.ide.screenshot({ path: memoryShot });
      console.log(`  ✓ ${path.relative(process.cwd(), memoryShot)}`);

      await klive.cmd("memory-heat off", 500);
      await klive.cmd("coverage off", 500);
      await klive.cmd("em-stop", 1500);
    } finally {
      fixture.cleanup();
    }
  }
};
