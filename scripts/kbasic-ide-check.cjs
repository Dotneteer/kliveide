/**
 * Klive BASIC in the running IDE (plan Phase 3 exit criterion, §10.1): breakpoints and the execution
 * point on a Klive BASIC build, with no debugger changes.
 *
 * Launches Klive under Playwright's Electron driver (the doc-shots harness), creates a ZX BASIC
 * project in a temporary folder, selects Klive BASIC (`zxbasic.compiler klive`), sets two source
 * breakpoints (a line holding two statements, and a line inside a SUB), starts `debug`, and checks at
 * each stop that the machine is paused and the editor marks the expected line. Exits 1 on failure.
 *
 *   npx electron-vite build --config build/electron.vite.config.ts   # out/ must be current
 *   xvfb-run -a node scripts/kbasic-ide-check.cjs                     # (xvfb-run only without a display)
 *
 * Then the source-level debugger (plan Phase 5): a second program stops in a SUB; the Call Stack
 * panel must show the SUB and the main program, the Variables panel the parameter and the global;
 * Step Over moves to the next statement, Step Out stops at the calling statement as a return point,
 * and continuing stops at the runtime error the program raises, before the ROM's report. A value
 * edited in the Variables panel is written to memory. With Just My Code off, Step Into enters a
 * standard-library routine, shown in a read-only view of the library file.
 *
 * Then CODEBANK on the ZX Spectrum Next (plan Phase 6): a Next project whose FUNCTION lives in a bank
 * stops at a breakpoint inside it (NextZXOS boots and `.nexload`s the exported NEX); the execution
 * point, the Call Stack (the banked routine and its caller), a bank-local global in the Variables
 * panel, and Step Out to the resident caller are checked. It needs a NextZXOS SD card image: the
 * real `~/Klive/ks2.cim` (or `KBASIC_IDE_CARD=<file>`) is **copied** into the run's own home (the app
 * runs with `HOME` there), so the user's card is never written. Without one the scenario is skipped.
 *
 * Then the NEX debug sidecar (plan §8.5): a fresh Klive opens that project without building it and
 * runs the exported NEX with `nex-run -d`; its breakpoint and the panels come from the sidecar.
 *
 * Then editor intelligence (`.plans/BASIC_EDITOR_INTELLIGENCE_PLAN.md` §7): hover on a local, a
 * global, a FUNCTION with a doc comment, PRINT and a header option; Go to Definition into a library
 * file; the references of a shadowed name; completion after AS, after GOTO, of a library routine
 * that adds its #include and of a header option's value; signature help in a nested call; a rename
 * across two files (and back); folding a FUNCTION; the outline of an included file; hover surviving a
 * syntax error; and keyword help with zxbc selected.
 *
 * `KBASIC_IDE_SHOTS=<folder>` also saves a screenshot of the IDE at each stop;
 * `KBASIC_IDE_ONLY=next` (or `classic`, `intel`) runs only that part; each part runs in a fresh Klive.
 */
const fs = require("fs");
const os = require("os");
const path = require("path");
const { launchKlive } = require("./doc-shots/harness.cjs");

const PROGRAM = ['PRINT "one" : PRINT "two"', "SUB greet()", ' PRINT "in sub"', "END SUB", "greet", 'PRINT "end"', ""];
const STOPS = [
  { line: 1, text: PROGRAM[0] },
  { line: 3, text: PROGRAM[2] }
];

const JMC = ["#include <hex.bas>", "DIM s AS String", "s = hex8(255)", "PRINT s", ""];

const INTEL = [
  "'@heap-size 2048", // 1
  "#include <attr.bas>", // 2
  '#include "helpers.zxbas"', // 3
  "DIM total AS UInteger", // 4
  "' Doubles a value.", // 5
  "FUNCTION Twice(n AS UByte) AS UInteger", // 6
  "  DIM total AS UInteger", // 7
  "  total = n * 2", // 8
  "  RETURN total", // 9
  "END FUNCTION", // 10
  "total = Twice(4)", // 11
  "PRINT total; ATTR(0, 0)", // 12
  "Greet", // 13
  "done:", // 14
  ""
];
const HELPERS = ["SUB Greet()", '  PRINT "hi"', "END SUB", ""];

/** The first file named `name` below `dir`, or undefined. */
function findFile(dir, name) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isFile() && entry.name === name) return full;
    if (entry.isDirectory()) {
      const found = findFile(full, name);
      if (found) return found;
    }
  }
  return undefined;
}

const NEXT_PROGRAM = [
  "DIM total AS UInteger = 5", // 1
  "CODEBANK 1", // 2
  "DIM factor AS UByte = 3", // 3
  "FUNCTION Scale(n AS UByte) AS UInteger", // 4
  "  RETURN n * factor", // 5
  "END FUNCTION", // 6
  "END CODEBANK", // 7
  "total = total + Scale(4)", // 8
  "PRINT total", // 9
  ""
];

const DEBUGGER = [
  "DIM total AS UInteger = 5", // 1
  "FUNCTION Twice(n AS UByte) AS UByte", // 2
  "  RETURN n * 2", // 3
  "END FUNCTION", // 4
  "SUB Show(v AS UByte)", // 5
  "  total = total + v", // 6
  "  PRINT total", // 7
  "END SUB", // 8
  "Show Twice(4)", // 9
  "ERROR 2", // 10
  ""
];

(async () => {
  const work = fs.mkdtempSync(path.join(os.tmpdir(), "kbasic-ide-"));
  const shots = process.env.KBASIC_IDE_SHOTS;
  // --- The app's own home: Next launches write the SD card image under it (a copy of the user's card)
  const userHome = path.join(work, "user");
  const card = process.env.KBASIC_IDE_CARD ?? path.join(os.homedir(), "Klive", "ks2.cim");
  const hasCard = fs.existsSync(card);
  fs.mkdirSync(path.join(userHome, "Klive"), { recursive: true });
  if (hasCard) fs.copyFileSync(card, path.join(userHome, "Klive", "ks2.cim"));
  const only = process.env.KBASIC_IDE_ONLY;
  const failures = [];
  // --- Each part in a fresh Klive: after a machine switch the IDE's project service can keep the
  // --- previous project's tree (the document-cache quirk in the plan's handoff), which a long
  // --- session across a 48K and a Next project runs into
  const runPart = async (part) => {
  const klive = await launchKlive({ home: path.join(work, "home"), height: 900, userHome });
  const { app, ide, cmd, sleep } = klive;
  const emuText = async () => {
    const emu = app.windows().find((w) => w.url().includes("?emu"));
    return (await emu.evaluate(() => document.body.innerText)).replace(/\s+/g, " ");
  };
  // --- The text of the editor line carrying the execution-point decoration
  const executionLine = () =>
    ide.evaluate(() => {
      const deco = document.querySelector('[class*="activeBreakpointLine"]');
      if (!deco) return undefined;
      const top = deco.getBoundingClientRect().top;
      const line = [...document.querySelectorAll(".monaco-editor .view-line")].find((l) => Math.abs(l.getBoundingClientRect().top - top) < 2);
      return line?.textContent.replace(/ /g, " ");
    });
  const waitForStop = async (stop, index) => {
    const start = Date.now();
    while (Date.now() - start < 20000) {
      const pc = /Paused \(PC: \$([0-9A-F]{4})\)/i.exec(await emuText())?.[1];
      if (pc) {
        await sleep(1500);
        const line = await executionLine();
        const ok = line === stop.text;
        console.log(`${ok ? "ok  " : "FAIL"} stop ${index + 1}: paused at $${pc}, execution point on ${JSON.stringify(line)}`);
        if (!ok) failures.push(`stop ${index + 1}: expected the execution point on line ${stop.line} ${JSON.stringify(stop.text)}`);
        if (shots) await ide.screenshot({ path: path.join(shots, `kbasic-stop-${index + 1}.png`) });
        return;
      }
      await sleep(250);
    }
    failures.push(`stop ${index + 1}: the machine did not pause at line ${stop.line}`);
    console.log(`FAIL stop ${index + 1}: not paused (${(await emuText()).slice(0, 120)})`);
  };
  try {
    const projects = path.join(work, "projects");
    fs.mkdirSync(projects, { recursive: true });
    if (part === "classic") {
    await cmd(`newp sp48 kbcheck zx-basic -p "${projects}"`, 5000);
    const folder = path.join(projects, "kbcheck");
    fs.writeFileSync(path.join(folder, "code", "program.zxbas"), PROGRAM.join("\n"));
    await cmd(`open "${folder}"`, 8000);
    await cmd("set -p zxbasic.compiler klive", 1500);
    await cmd("nav code/program.zxbas", 3000);
    for (const stop of STOPS) await cmd(`bp-set [code/program.zxbas]:${stop.line}`, 1200);
    await cmd("debug", 5000);
    for (let i = 0; i < STOPS.length; i++) {
      await waitForStop(STOPS[i], i);
      await cmd("em-debug", 500);
    }
    await sleep(2500);
    const after = await emuText();
    if (/Paused/i.test(after)) failures.push("the program did not run to its end after the last stop");
    else console.log("ok   the program ran to its end after the last stop");
    }

    // --- The source-level debugger (Phase 5)
    const check = (ok, what) => {
      console.log(`${ok ? "ok  " : "FAIL"} ${what}`);
      if (!ok) failures.push(what);
    };
    const sideBarText = () => ide.evaluate(() => document.querySelector('[class*="_sideBar_"]')?.innerText ?? document.body.innerText);
    const expandPanel = async (title, probe) => {
      if ((await sideBarText()).includes(probe)) return;
      await ide.locator('[class*="_headerText_"]', { hasText: new RegExp(`^${title}$`, "i") }).first().click({ force: true });
      await sleep(1200);
    };
    const shot = async (name) => shots && (await ide.screenshot({ path: path.join(shots, `kbasic-${name}.png`) }));
    // --- The execution line once it satisfies `ok` (steps and editor refreshes take a moment)
    const waitLine = async (ok) => {
      let line;
      const start = Date.now();
      while (Date.now() - start < 10000) {
        line = (await executionLine()) ?? "";
        if (ok(line)) return line;
        await sleep(300);
      }
      return line;
    };
    const waitPaused = async () => {
      const start = Date.now();
      while (Date.now() - start < 20000) {
        if (/Paused \(PC:/i.test(await emuText())) return true;
        await sleep(250);
      }
      return false;
    };
    // --- A project of its own: the IDE keeps an open document's text across a reopen of its folder
    if (part === "classic") {
    await cmd("em-stop", 1500);
    await cmd("bp-ea", 800);
    await cmd(`newp sp48 kbdebug zx-basic -p "${projects}"`, 5000);
    const debugFolder = path.join(projects, "kbdebug");
    fs.writeFileSync(path.join(debugFolder, "code", "program.zxbas"), DEBUGGER.join("\n"));
    await cmd(`open "${debugFolder}"`, 8000);
    await cmd("set -p zxbasic.compiler klive", 1500);
    await cmd("nav code/program.zxbas", 3000);
    await cmd("bp-set [code/program.zxbas]:6", 1200);
    await cmd("debug", 5000);
    check(await waitPaused(), "the debugger program paused at its breakpoint");
    await sleep(1500);
    check((await executionLine()) === DEBUGGER[5], `the execution point is on ${JSON.stringify(DEBUGGER[5])}`);
    await ide.locator('button[aria-label="Debug"]').click({ force: true });
    await sleep(1000);
    await expandPanel("Call Stack", "Top:");
    await expandPanel("Variables", "Globals");
    await sleep(1500);
    const panels = await sideBarText();
    check(/Top:\s*Show\s*program\.zxbas:6/.test(panels), "the Call Stack shows Show at line 6");
    check(/1:\s*main\s*program\.zxbas:9/.test(panels), "the Call Stack shows the main program at line 9");
    check(/Locals — Show\s*v\s*8/.test(panels), "the Variables panel shows the parameter v = 8");
    check(/total\s*5\s*UInteger/.test(panels), "the Variables panel shows the global total = 5");
    await shot("variables");

    await cmd("em-sto", 1000);
    check((await waitLine((l) => l === DEBUGGER[6])) === DEBUGGER[6], `Step Over moves to ${JSON.stringify(DEBUGGER[6])}`);
    check(/total\s*13\s*UInteger/.test(await sideBarText()), "the Variables panel follows the step (total = 13)");
    // --- Editing a value writes memory (§10.7)
    await ide.locator('[class*="_variablesPanel_"]').getByText("13", { exact: true }).first().dblclick({ force: true });
    await sleep(500);
    await ide.locator('input[aria-label="New value of total"]').fill("100");
    await ide.locator('input[aria-label="New value of total"]').press("Enter");
    await sleep(1500);
    check(/total\s*100\s*UInteger/.test(await sideBarText()), "editing total in the Variables panel writes 100 to memory");
    await cmd("em-out", 1000);
    const returned = await waitLine((l) => l.startsWith(DEBUGGER[8]));
    check(returned.startsWith(DEBUGGER[8]) && returned.includes("returned from Show"), `Step Out stops at the call as a return point (${JSON.stringify(returned)})`);
    await shot("return-point");

    await cmd("em-debug", 2500);
    check(await waitPaused(), "the machine paused at the runtime error");
    const errorLine = await waitLine((l) => l.startsWith(DEBUGGER[9]));
    check(errorLine.startsWith(DEBUGGER[9]) && errorLine.includes("3 Subscript wrong"), `the error stop marks ${JSON.stringify(DEBUGGER[9])} (${JSON.stringify(errorLine)})`);
    check(/runtime error: 3 Subscript wrong/.test(await sideBarText()), "the Call Stack names the error");
    await shot("error-stop");

    // --- Just My Code off (§10.12): Step Into enters the standard library, shown read-only
    await cmd("em-stop", 1500);
    await cmd("bp-ea", 800);
    await cmd(`newp sp48 kbjmc zx-basic -p "${projects}"`, 5000);
    const jmcFolder = path.join(projects, "kbjmc");
    fs.writeFileSync(path.join(jmcFolder, "code", "program.zxbas"), JMC.join("\n"));
    await cmd(`open "${jmcFolder}"`, 8000);
    await cmd("set -p zxbasic.compiler klive", 1500);
    await cmd("nav code/program.zxbas", 3000);
    await cmd("bp-set [code/program.zxbas]:3", 1200);
    await cmd("em-jmc off", 800);
    await cmd("debug", 5000);
    check(await waitPaused(), "the library program paused at its breakpoint");
    await sleep(1500);
    await cmd("em-sti", 3000);
    // --- The editor follows the execution point only with source sync on; select the frame instead
    await ide.locator('[class*="_callStackPanel_"]').getByText("hex8", { exact: true }).first().click({ force: true });
    const inLibrary = (await waitLine((l) => l.trim() === "RETURN __kbHexDigits(n, 2)")).trim();
    const tabs = await ide.evaluate(() => document.body.innerText);
    check(inLibrary === "RETURN __kbHexDigits(n, 2)" && tabs.includes("hex.bas (library)"), `Step Into enters hex8 in the library's read-only view (${JSON.stringify(inLibrary)})`);
    check(/Top:\s*hex8\s*hex\.bas:\d+/.test(await sideBarText()), "the Call Stack shows hex8 in hex.bas");
    await shot("library");
    await cmd("em-jmc on", 800);
    }

    // --- Editor intelligence (BASIC_EDITOR_INTELLIGENCE_PLAN §7)
    if (part === "intel") {
      const MOD = process.platform === "darwin" ? "Meta" : "Control";
      await cmd(`newp sp48 kbintel zx-basic -p "${projects}"`, 5000);
      const folder = path.join(projects, "kbintel");
      fs.writeFileSync(path.join(folder, "code", "program.zxbas"), INTEL.join("\n"));
      fs.writeFileSync(path.join(folder, "code", "helpers.zxbas"), HELPERS.join("\n"));
      await cmd(`open "${folder}"`, 8000);
      await cmd("set -p zxbasic.compiler klive", 1500);
      await cmd("nav code/program.zxbas", 3000);

      // --- The screen position of a 1-based (line, column) in the visible editor
      const point = (line, column) =>
        ide.evaluate(
          ([line, column]) => {
            const visible = (e) => e.getBoundingClientRect().width > 0;
            const num = [...document.querySelectorAll(".monaco-editor .line-numbers")].filter(visible).find((n) => n.textContent.trim() === String(line));
            if (!num) return undefined;
            const top = num.getBoundingClientRect().top;
            const row = [...document.querySelectorAll(".monaco-editor .view-line")].filter(visible).find((l) => Math.abs(l.getBoundingClientRect().top - top) < 3);
            if (!row) return undefined;
            const walker = document.createTreeWalker(row, NodeFilter.SHOW_TEXT);
            let remaining = column - 1;
            let node;
            while ((node = walker.nextNode())) {
              if (remaining < node.textContent.length) {
                const r = document.createRange();
                r.setStart(node, remaining);
                r.setEnd(node, remaining + 1);
                const rect = r.getBoundingClientRect();
                return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
              }
              remaining -= node.textContent.length;
            }
            return undefined;
          },
          [line, column]
        );
      const visibleText = (selector) =>
        ide.evaluate((selector) => [...document.querySelectorAll(selector)].filter((e) => e.getBoundingClientRect().height > 0).map((e) => e.textContent).join("\n"), selector);
      const editorLines = () =>
        ide.evaluate(() =>
          [...document.querySelectorAll(".monaco-editor .view-line")]
            .filter((e) => e.getBoundingClientRect().width > 0)
            .sort((a, b) => a.getBoundingClientRect().top - b.getBoundingClientRect().top)
            .map((l) => l.textContent.replace(/ /g, " "))
        );
      const hover = async (line, column) => {
        await ide.mouse.move(5, 5);
        await sleep(300);
        const p = await point(line, column);
        if (!p) return "";
        await ide.mouse.move(p.x, p.y);
        for (let t = Date.now(); Date.now() - t < 4000; ) {
          const text = await visibleText(".monaco-hover-content");
          if (text.trim()) return text;
          await sleep(200);
        }
        return "";
      };
      const clickAt = async (line, column) => {
        const p = await point(line, column);
        if (!p) throw new Error(`no editor position ${line}:${column}`);
        await ide.mouse.click(p.x, p.y);
        await sleep(300);
      };
      const key = (k) => ide.keyboard.press(k.replace("Mod", MOD));
      const waitFor = async (probe, ms = 6000) => {
        for (let t = Date.now(); Date.now() - t < ms; ) {
          const value = await probe();
          if (value) return value;
          await sleep(250);
        }
        return undefined;
      };
      // --- Type on a fresh line at the end of the program; Escape and undo take it back out
      const typeAtEnd = async (text) => {
        await clickAt(INTEL.length - 1, 1);
        await key("End");
        await key("Enter");
        await ide.keyboard.type(text, { delay: 30 });
        await sleep(400);
      };
      const suggestions = async () => {
        await key("Control+Space");
        return (await waitFor(async () => (await visibleText(".suggest-widget .monaco-list-row")) || undefined)) ?? "";
      };
      // --- Undo until the editor shows the program as written (a typed line takes several steps)
      const original = await editorLines();
      const undoAll = async () => {
        await key("Escape");
        await key("Escape");
        for (let i = 0; i < 30; i++) {
          if (JSON.stringify(await editorLines()) === JSON.stringify(original)) return;
          await key("Mod+z");
          await sleep(120);
        }
      };

      // --- The first background check publishes the snapshot
      const first = await waitFor(async () => ((await hover(11, 10)).includes("FUNCTION Twice") ? "ok" : undefined), 20000);
      check(!!first, "hover on a FUNCTION shows its signature (the snapshot arrived)");
      const twice = await hover(11, 10);
      check(twice.includes("Doubles a value."), `the FUNCTION's hover shows its doc comment (${JSON.stringify(twice.slice(0, 120))})`);
      check((await hover(8, 4)).includes("local variable"), "hover on a local shows 'local variable'");
      check((await hover(11, 2)).includes("global variable"), "hover on the shadowed global shows 'global variable'");
      check((await hover(12, 2)).includes("CC BY 4.0"), "hover on PRINT shows keyword help with the attribution");
      check((await hover(1, 5)).includes("heap size in bytes"), "hover on '@heap-size shows the option's help");
      await shot("intel-hover");

      // --- References of the shadowed name: the local's three, not the global's
      await clickAt(8, 4);
      await key("Shift+F12");
      const refs = (await waitFor(async () => (await visibleText(".peekview-title")) || undefined)) ?? "";
      check(/3 references|References \(3\)/.test(refs), `the references of the local total are its own three (${JSON.stringify(refs)})`);
      await key("Escape");

      // --- Folding the FUNCTION hides its body
      await clickAt(6, 2);
      await key("Mod+Alt+BracketLeft");
      await sleep(600);
      check(!(await editorLines()).includes("  total = n * 2"), "folding the FUNCTION hides its body");
      await key("Mod+Alt+BracketRight");
      await sleep(400);

      // --- Completion
      await typeAtEnd("DIM z AS U");
      const types = await suggestions();
      check(/UBYTE/.test(types), "completion after AS offers the types");
      await undoAll();
      await typeAtEnd("GOTO d");
      check(/done/.test(await suggestions()), "completion after GOTO offers the labels");
      await undoAll();
      await typeAtEnd("PRINT hex1");
      const lib = await suggestions();
      check(/HEX16/i.test(lib), "completion offers a library routine the program does not include");
      await key("Enter");
      await sleep(600);
      check((await editorLines()).some((l) => l.trim() === "#include <hex.bas>"), "accepting it adds #include <hex.bas>");
      await undoAll();
      check(!(await editorLines()).some((l) => l.trim() === "#include <hex.bas>"), "undo takes the #include back out");
      await clickAt(1, 1);
      await key("End");
      await key("Enter");
      await ide.keyboard.type("'@optimize-for ", { delay: 30 });
      const optionValues = await suggestions();
      await shot("intel-header-values");
      check(/balanced/.test(optionValues), `completion offers a header option's values (${JSON.stringify(optionValues.slice(0, 80))})`);
      await undoAll();

      // --- Signature help in a nested call
      await typeAtEnd("PRINT ATTR(1, ABS(");
      const inner = (await waitFor(async () => (await visibleText(".parameter-hints-widget")) || undefined)) ?? "";
      check(/ABS\(expr\)/.test(inner), `signature help shows the inner call (${JSON.stringify(inner.slice(0, 60))})`);
      await ide.keyboard.type("2), ", { delay: 30 });
      await sleep(600);
      const outer = (await visibleText(".parameter-hints-widget")) ?? "";
      check(/ATTR\(BYVAL row AS UByte, BYVAL col AS UByte\)/.test(outer), `then the outer one (${JSON.stringify(outer.slice(0, 80))})`);
      await undoAll();

      // --- Go to Definition into the standard library
      await clickAt(12, 15);
      await key("F12");
      const opened = await waitFor(async () => ((await ide.evaluate(() => document.body.innerText)).includes("attr.bas (library)") ? "ok" : undefined));
      check(!!opened, "Go to Definition on ATTR opens attr.bas read-only");
      await shot("intel-library");

      // --- The outline of an included file
      await cmd("nav code/helpers.zxbas", 2500);
      await clickAt(1, 1);
      await key("Mod+Shift+o");
      const outline = (await waitFor(async () => (await visibleText(".quick-input-list")) || undefined)) ?? "";
      check(/Greet/.test(outline) && !/Twice/.test(outline), `the outline of helpers.zxbas is its own (${JSON.stringify(outline.slice(0, 60))})`);
      await key("Escape");

      // --- Rename across the two files, and back
      await cmd("nav code/program.zxbas", 2500);
      await clickAt(13, 2);
      await key("F2");
      await sleep(600);
      await ide.keyboard.press(`${MOD}+a`);
      await ide.keyboard.type("SayHello", { delay: 20 });
      await key("Enter");
      await sleep(1500);
      await shot("intel-rename-done");
      const renamed = await waitFor(() => fs.readFileSync(path.join(folder, "code", "helpers.zxbas"), "utf8").includes("SUB SayHello()"));
      check(!!renamed && (await editorLines()).includes("SayHello"), "renaming Greet edits program.zxbas and helpers.zxbas");
      // --- The next snapshot knows the new name; rename it back
      const fresh = await waitFor(async () => ((await hover(13, 2)).includes("SUB SayHello") ? "ok" : undefined), 20000);
      await clickAt(13, 2);
      await key("F2");
      await sleep(600);
      await ide.keyboard.press(`${MOD}+a`);
      await ide.keyboard.type("Greet", { delay: 20 });
      await key("Enter");
      const back = await waitFor(() => fs.readFileSync(path.join(folder, "code", "helpers.zxbas"), "utf8").includes("SUB Greet()"));
      check(!!fresh && !!back, "renaming it back restores both files");

      // --- A syntax error keeps the last good snapshot
      await typeAtEnd("PRINT (");
      await sleep(4000);
      check((await hover(11, 10)).includes("FUNCTION Twice"), "hover still works on unchanged symbols while the file has an error");
      await undoAll();

      // --- zxbc: the static help remains (E13)
      await cmd("set -p zxbasic.compiler zxbc", 1500);
      await cmd("nav code/program.zxbas", 1500);
      check((await hover(12, 2)).includes("PRINT"), "with zxbc selected, keyword help remains");
      await cmd("set -p zxbasic.compiler klive", 1000);
    }

    // --- CODEBANK on the ZX Spectrum Next (Phase 6)
    if (part === "next") {
      await cmd("em-stop", 1500);
      await cmd("bp-ea", 800);
      await cmd(`newp zxnext kbnext zx-basic -p "${projects}"`, 5000);
      const nextFolder = path.join(projects, "kbnext");
      // --- A file name of its own: the IDE keeps an open document's text by its project path across
      // --- projects (the ProjectService cache quirk), and every earlier scenario used program.zxbas
      fs.writeFileSync(path.join(nextFolder, "code", "banked.zxbas"), NEXT_PROGRAM.join("\n"));
      const projectFile = path.join(nextFolder, fs.readdirSync(nextFolder).find((f) => f.endsWith("klive.project")));
      const project = JSON.parse(fs.readFileSync(projectFile, "utf8"));
      project.builder = { ...(project.builder ?? {}), roots: ["code/banked.zxbas"] };
      fs.writeFileSync(projectFile, JSON.stringify(project, null, 2));
      await cmd(`open "${nextFolder}"`, 8000);
      if (process.env.KBASIC_IDE_TRACE) {
        const out = await ide.evaluate(() => document.body.innerText);
        console.log(`  (after open: ${out.slice(out.lastIndexOf("newp zxnext")).slice(0, 500).replace(/\s+/g, " ")})`);
      }
      await cmd("set -p zxbasic.compiler klive", 1500);
      await cmd("nav code/banked.zxbas", 3000);
      // --- Opening the project switches the machine and then restores the project's own (no)
      // --- breakpoints; a breakpoint set before that finishes is wiped, so wait for the Next first
      for (let t = Date.now(); !/ZX Spectrum Next/.test(await emuText()) && Date.now() - t < 30000; ) await sleep(500);
      await sleep(3000);
      await cmd("bp-set [code/banked.zxbas]:5", 1200);
      const bpText = async (label) => {
        await cmd("bp-list", 1200);
        const out = await ide.evaluate(() => document.body.innerText);
        console.log(`  (${label}: ${out.slice(out.lastIndexOf("bp-set [")).slice(0, 400).replace(/\s+/g, " ")})`);
      };
      if (process.env.KBASIC_IDE_TRACE) await bpText("after bp-set");
      await cmd("debug", 5000);
      if (process.env.KBASIC_IDE_TRACE) await bpText("after debug");
      // --- NextZXOS boots and loads the NEX: this takes a while
      let paused = false;
      for (let t = Date.now(); !paused && Date.now() - t < 120000; ) paused = await waitPaused();
      check(paused, "the Next program paused at the breakpoint in its bank");
      if (!paused) {
        await cmd("bp-list", 1500);
        const out = await ide.evaluate(() => document.body.innerText);
        console.log(`  (breakpoints: ${out.slice(out.lastIndexOf("bp-list")).slice(0, 400).replace(/\s+/g, " ")})`);
        await ide.screenshot({ path: path.join(os.tmpdir(), "kbasic-next-nopause.png") });
      }
      await sleep(2000);
      const banked = await waitLine((l) => l === NEXT_PROGRAM[4]);
      if (banked !== NEXT_PROGRAM[4]) {
        console.log(`  (emulator: ${(await emuText()).slice(0, 200)}; execution line ${JSON.stringify(banked)})`);
        await ide.screenshot({ path: path.join(os.tmpdir(), "kbasic-next-fail.png") });
      }
      check(banked === NEXT_PROGRAM[4], `the execution point is on the banked line ${JSON.stringify(NEXT_PROGRAM[4])}`);
      await ide.locator('button[aria-label="Debug"]').click({ force: true });
      await sleep(1000);
      await expandPanel("Call Stack", "Top:");
      await expandPanel("Variables", "Globals");
      await sleep(1500);
      const nextPanels = await sideBarText();
      check(/Top:\s*Scale\s*banked\.zxbas:5/.test(nextPanels), "the Call Stack shows the banked Scale at line 5");
      check(/1:\s*main\s*banked\.zxbas:8/.test(nextPanels), "the Call Stack shows its resident caller at line 8");
      check(/Locals — Scale\s*n\s*4/.test(nextPanels), "the Variables panel shows the parameter n = 4");
      check(/factor\s*3\s*UByte/.test(nextPanels), "the Variables panel reads the bank-local factor = 3");
      await shot("next-banked");
      await cmd("em-out", 1000);
      const back = await waitLine((l) => l.startsWith(NEXT_PROGRAM[7]));
      check(back.startsWith(NEXT_PROGRAM[7]) && back.includes("returned from Scale"), `Step Out returns to the resident caller (${JSON.stringify(back)})`);
      await cmd("em-sto", 1000);
      check((await waitLine((l) => l === NEXT_PROGRAM[8])) === NEXT_PROGRAM[8], `Step Over moves to ${JSON.stringify(NEXT_PROGRAM[8])}`);
      check(/total\s*17\s*UInteger/.test(await sideBarText()), "the Variables panel shows total = 17");
      await shot("next-return");
    }

    // --- The NEX debug sidecar (plan §8.5): a fresh Klive opens the Next project without building it
    // --- and `nex-run -d`s the NEX the previous part exported; the breakpoint in the bank resolves
    // --- through the sidecar's tables and the panels show the program
    if (part === "nex") {
      const nextFolder = path.join(projects, "kbnext");
      const nex = findFile(userHome, "banked.nex");
      check(!!nex && fs.existsSync(`${nex}.kbasic-debug.json`), `the export wrote the NEX and its sidecar (${nex})`);
      await cmd(`open "${nextFolder}"`, 8000);
      await cmd("nav code/banked.zxbas", 3000);
      for (let t = Date.now(); !/ZX Spectrum Next/.test(await emuText()) && Date.now() - t < 30000; ) await sleep(500);
      await sleep(3000);
      await cmd("bp-set [code/banked.zxbas]:5", 1200);
      await cmd(`nex-run "${nex}" -d`, 5000);
      let paused = false;
      for (let t = Date.now(); !paused && Date.now() - t < 120000; ) paused = await waitPaused();
      check(paused, "the launched NEX paused at the breakpoint in its bank");
      await sleep(2000);
      // --- The NEX launch opens its bank views in front of the source: bring the source back
      await cmd("nav code/banked.zxbas", 2000);
      check((await waitLine((l) => l === NEXT_PROGRAM[4])) === NEXT_PROGRAM[4], `the execution point is on ${JSON.stringify(NEXT_PROGRAM[4])}`);
      await ide.locator('button[aria-label="Debug"]').click({ force: true });
      await sleep(1000);
      await expandPanel("Call Stack", "Top:");
      await expandPanel("Variables", "Globals");
      await sleep(1500);
      const panels = await sideBarText();
      check(/Top:\s*Scale\s*banked\.zxbas:5/.test(panels), "the Call Stack shows Scale, from the sidecar");
      check(/factor\s*3\s*UByte/.test(panels), "the Variables panel reads the bank-local factor, from the sidecar");
      await cmd("em-out", 1000);
      await cmd("nav code/banked.zxbas", 2000);
      const back = await waitLine((l) => l.startsWith(NEXT_PROGRAM[7]));
      check(back.includes("returned from Scale"), `Step Out returns to the caller (${JSON.stringify(back)})`);
      await shot("nex-sidecar");
    }
  } catch (e) {
    failures.push(e.message.split("\n")[0]);
  } finally {
    await Promise.race([klive.close(), new Promise((r) => setTimeout(r, 10000))]);
  }
  };
  const parts = only === "next" ? ["next", "nex"] : only === "classic" ? ["classic"] : only === "intel" ? ["intel"] : ["classic", "intel", "next", "nex"];
  for (const part of parts) {
    if ((part === "next" || part === "nex") && !hasCard) console.log(`skip the ${part} scenario: no NextZXOS SD card image at ${card}`);
    else await runPart(part);
  }
  fs.rmSync(work, { recursive: true, force: true });
  if (failures.length) {
    console.log(`\n${failures.length} problem(s):\n  ${failures.join("\n  ")}`);
    process.exit(1);
  }
  console.log("\nKlive BASIC breakpoints, the execution point, the source-level debugger and editor intelligence work in the IDE.");
  process.exit(0);
})();
