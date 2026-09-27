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
 * and continuing stops at the runtime error the program raises, before the ROM's report.
 *
 * `KBASIC_IDE_SHOTS=<folder>` also saves a screenshot of the IDE at each stop.
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
  const klive = await launchKlive({ home: path.join(work, "home"), height: 900 });
  const { app, ide, cmd, sleep } = klive;
  const failures = [];
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
    const waitPaused = async () => {
      const start = Date.now();
      while (Date.now() - start < 20000) {
        if (/Paused \(PC:/i.test(await emuText())) return true;
        await sleep(250);
      }
      return false;
    };
    // --- A project of its own: the IDE keeps an open document's text across a reopen of its folder
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

    await cmd("em-sto", 2500);
    check((await executionLine()) === DEBUGGER[6], `Step Over moves to ${JSON.stringify(DEBUGGER[6])}`);
    check(/total\s*13\s*UInteger/.test(await sideBarText()), "the Variables panel follows the step (total = 13)");
    await cmd("em-out", 2500);
    const returned = (await executionLine()) ?? "";
    check(returned.startsWith(DEBUGGER[8]) && returned.includes("returned from Show"), `Step Out stops at the call as a return point (${JSON.stringify(returned)})`);
    await shot("return-point");

    await cmd("em-debug", 2500);
    check(await waitPaused(), "the machine paused at the runtime error");
    await sleep(1500);
    const errorLine = (await executionLine()) ?? "";
    check(errorLine.startsWith(DEBUGGER[9]) && errorLine.includes("3 Subscript wrong"), `the error stop marks ${JSON.stringify(DEBUGGER[9])} (${JSON.stringify(errorLine)})`);
    check(/runtime error: 3 Subscript wrong/.test(await sideBarText()), "the Call Stack names the error");
    await shot("error-stop");
  } catch (e) {
    failures.push(e.message.split("\n")[0]);
  } finally {
    await Promise.race([klive.close(), new Promise((r) => setTimeout(r, 10000))]);
    fs.rmSync(work, { recursive: true, force: true });
  }
  if (failures.length) {
    console.log(`\n${failures.length} problem(s):\n  ${failures.join("\n  ")}`);
    process.exit(1);
  }
  console.log("\nKlive BASIC breakpoints, the execution point and the source-level debugger work in the IDE.");
  process.exit(0);
})();
