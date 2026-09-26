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
  console.log("\nKlive BASIC breakpoints and execution point work in the IDE.");
  process.exit(0);
})();
