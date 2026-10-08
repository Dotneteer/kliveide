/**
 * The running-app check of the profiler (`.plans/PROFILER_PLAN.md` Phases 4-5), with staged shots
 * for `docs/content/working-with-ide/profiler.mdx`.
 *
 * On the 48K it writes a frame loop - HALT, then Draw (which calls Plot 200 times) and Music -
 * starts profiling with the call graph, runs the project, stops profiling, and verifies before it
 * photographs:
 *
 * - the Routines tab: Draw, Plot and Music by label, the window's facts (frames, total);
 * - the Call tree tab: the root and the IM 1 interrupt root, Draw and Music under the root, Plot
 *   under Draw;
 * - the Callers tab for Plot: Draw;
 * - `profile top` and `profile export` (speedscope JSON) in the command output and on disk;
 * - the editor's inlay hints ("% · N calls") on the routines' first lines.
 */
const path = require("path");
const fs = require("fs");
const os = require("os");
const { fixtureProjectFolder, IMAGES } = require("../harness.cjs");

const SOURCE = `; Profiler demo
    .model Spectrum48
    .org #8000
Start:
    ei
Main:
    halt
    call Draw
    call Music
    jr Main

; --- Loops use temporary labels, so each routine stays one row (a global label starts a routine)
Draw:
    ld b,200
\`loop:
    call Plot
    djnz \`loop
    ret

Plot:
    push bc
    ld b,10
\`loop:
    djnz \`loop
    pop bc
    ret

Music:
    ld b,50
\`loop:
    djnz \`loop
    ret
`;

const fail = (what, state) => {
  throw new Error(`${what}: ${JSON.stringify(state)}`);
};

const outputText = (ide) =>
  ide.evaluate(() => document.querySelector('[class*="_commandPanel_"]')?.textContent ?? "");

/** The rows of the Profiler's current table: each row's cells as text */
const tableRows = (ide) =>
  ide.evaluate(() =>
    [...document.querySelectorAll('[class*="_row_"]')]
      .filter((r) => !/_headerRow_/.test(r.className))
      .map((r) => [...r.children].map((c) => c.textContent.trim()))
  );

const clickTab = (ide, name) => ide.locator('[role="tab"]', { hasText: name }).first().click();

module.exports = {
  name: "profiler",
  window: {
    // --- The profiler is an advanced debugging feature: off unless the user turns it on
    userSettings: { features: { advancedDebugging: "1" } },
    ideViewOptions: { profilerInlays: true },
    width: 1360,
    height: 860,
    sideBarWidth: "200px",
    toolPanelHeight: "200px",
    panelFontFamily: "iosevka",
    panelFontSize: 12
  },

  async run(klive) {
    const fixture = fixtureProjectFolder(process.env.DOC_SHOTS_PROJECT || "ProfilerShots");
    const exported = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "klive-profile-")), "demo.speedscope.json");
    try {
      await klive.cmd(`newp sp48 ${fixture.name} -p "${fixture.parent}" -o`, 8000);
      // --- A new file made the build root, and the project reopened (see code-coverage.cjs)
      fs.writeFileSync(path.join(fixture.project, "code", "demo.kz80.asm"), SOURCE);
      await klive.cmd("close", 2000);
      const projectFile = path.join(fixture.project, "klive.project");
      const project = JSON.parse(fs.readFileSync(projectFile, "utf8"));
      project.builder = { ...(project.builder ?? {}), roots: ["code/demo.kz80.asm"] };
      fs.writeFileSync(projectFile, JSON.stringify(project, null, 2));
      await klive.cmd(`open "${fixture.project}"`, 5000);

      await klive.cmd("profile start -calls", 1000);
      await klive.cmd("run", 9000);
      await klive.cmd("profile stop", 1500);
      await klive.cmd("em-pause", 1500);

      // --- profile top and the export, in the command output and on disk
      await klive.cmd("cls", 500);
      await klive.cmd("profile top 5", 1500);
      await klive.cmd(`profile export "${exported}" -f`, 2000);
      const out = await outputText(klive.ide);
      console.log("  output ·", out.replace(/\s+/g, " ").slice(0, 500));
      if (!/Routines from labels \(Klive asm\)/.test(out)) fail("profile top does not name its routine source", out);
      if (!/Plot/.test(out) || !/Draw/.test(out)) fail("profile top does not list Draw and Plot", out);
      const speedscope = JSON.parse(fs.readFileSync(exported, "utf8"));
      const names = speedscope.shared.frames.map((f) => f.name);
      console.log("  speedscope frames ·", names.join(", "));
      if (speedscope.profiles[0].type !== "sampled" || !names.includes("Plot")) fail("The speedscope export is wrong", names);

      // --- The Routines tab
      await klive.cmd("show-profiler", 2500);
      let rows = [];
      for (let i = 0; i < 20; i++) {
        rows = await tableRows(klive.ide);
        if (rows.some((r) => r[0] === "Plot")) break;
        await klive.sleep(500);
      }
      console.log("  routines ·", JSON.stringify(rows.slice(0, 6)));
      for (const name of ["Plot", "Draw", "Music"]) {
        if (!rows.some((r) => r[0] === name)) fail(`No ${name} row in the Routines tab`, rows);
      }
      // --- Plot is called 200 times per Draw call: the call graph's count, a multiple of 200
      const plot = rows.find((r) => r[0] === "Plot");
      const draw = rows.find((r) => r[0] === "Draw");
      const header = await klive.ide.evaluate(() =>
        [...(document.querySelector('[class*="_headerRow_"]')?.children ?? [])].map((c) => c.textContent.trim())
      );
      const callsColumn = header.findIndex((h) => /^Calls/.test(h));
      const calls = (row) => Number(row[callsColumn].replace(/,/g, ""));
      if (calls(plot) !== 200 * calls(draw)) fail("Plot is not called 200 times per Draw call", { plot, draw });
      const facts = await klive.ide.evaluate(() => document.querySelector('[class*="_facts_"]')?.textContent ?? "");
      console.log("  facts ·", facts);
      if (!/frames/.test(facts) || !/Total/.test(facts)) fail("The header facts are missing", facts);
      await klive.shot('[class*="_documentArea_"], [class*="DocumentArea"]', "working-with-ide/profiler-routines.png");

      // --- The Call tree tab: expand the root and Draw
      await clickTab(klive.ide, "Call tree");
      await klive.sleep(800);
      const toggle = (name) =>
        klive.ide.evaluate((n) => {
          const row = [...document.querySelectorAll('[class*="_row_"]')].find(
            (r) => r.querySelector('[class*="_treeName_"]')?.textContent.replace(/^[▸▾]/, "").trim() === n
          );
          row?.querySelector('[role="button"]')?.click();
          return !!row;
        }, name);
      if (!(await toggle("(entered before profiling)"))) fail("No root row in the Call tree", await tableRows(klive.ide));
      await klive.sleep(500);
      await toggle("Draw");
      await klive.sleep(500);
      const tree = await klive.ide.evaluate(() =>
        [...document.querySelectorAll('[class*="_treeName_"]')].map((e) => ({
          name: e.textContent.replace(/^[▸▾]/, "").trim(),
          indent: e.style.paddingLeft
        }))
      );
      console.log("  call tree ·", JSON.stringify(tree));
      const at = (name) => tree.find((t) => t.name === name);
      if (!at("Draw") || at("Draw").indent !== "2ch") fail("Draw is not under the root", tree);
      if (!at("Plot") || at("Plot").indent !== "4ch") fail("Plot is not under Draw", tree);
      if (!tree.some((t) => /^IM 1 handler at \$0038/.test(t.name))) fail("No IM 1 interrupt root", tree);
      await klive.shot('[class*="_documentArea_"], [class*="DocumentArea"]', "working-with-ide/profiler-call-tree.png");

      // --- The Callers tab for Plot
      await klive.ide.evaluate(() => {
        const row = [...document.querySelectorAll('[class*="_row_"]')].find(
          (r) => r.querySelector('[class*="_treeName_"]')?.textContent.replace(/^[▸▾]/, "").trim() === "Plot"
        );
        row?.click();
      });
      await clickTab(klive.ide, "Callers");
      await klive.sleep(800);
      const callers = await klive.ide.evaluate(() => ({
        caption: [...document.querySelectorAll('[class*="_caption_"]')].map((c) => c.textContent),
        rows: [...document.querySelectorAll('[class*="_row_"]')].map((r) => r.querySelector('[class*="_name_"]')?.textContent)
      }));
      console.log("  callers ·", JSON.stringify(callers));
      if (!callers.caption.some((c) => /^Plot:/.test(c)) || !callers.rows.includes("Draw")) fail("Plot's callers are wrong", callers);

      // --- The editor's inlay hints
      await klive.cmd("nav code/demo.kz80.asm", 3000);
      let hints = [];
      for (let i = 0; i < 20; i++) {
        hints = await klive.ide.evaluate(() =>
          [...document.querySelectorAll(".monaco-editor .view-lines span")]
            .map((s) => s.textContent)
            .filter((t) => /%\s·\s\d/.test(t ?? ""))
        );
        if (hints.length) break;
        await klive.sleep(500);
      }
      console.log("  inlay hints ·", JSON.stringify(hints));
      if (hints.length < 3) fail("The editor shows too few profile hints", hints);
      const editorShot = path.join(IMAGES, "working-with-ide", "profiler-editor.png");
      await klive.ide.locator('[class*="monaco-editor"]').first().screenshot({ path: editorShot });
      console.log(`  ✓ ${path.relative(process.cwd(), editorShot)}`);

      await klive.cmd("em-stop", 1500);
    } finally {
      fixture.cleanup();
      fs.rmSync(path.dirname(exported), { recursive: true, force: true });
    }
  }
};
