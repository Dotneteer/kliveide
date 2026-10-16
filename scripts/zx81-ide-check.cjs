/**
 * ZX81 machine code in the running IDE (`.plans/ZX8081_CODE_INJECTION_PLAN.md` phase 4): a Klive
 * assembler project on the ZX81, debugged from its source.
 *
 * Launches Klive under Playwright's Electron driver (the doc-shots harness), creates a ZX81 project
 * from the default template in a temporary folder, replaces its code with a small program, sets a
 * source breakpoint and starts `debug`. The machine boots, the IDE writes the `1 REM` program and
 * types RUN, and `RAND USR` calls the code. The check then follows the execution point in the
 * editor through the breakpoint, Step Into (into a subroutine), Step Over, Step Out (back past the
 * CALL), a second hit of the breakpoint, and the program's return to BASIC. Exits 1 on failure.
 *
 *   npx electron-vite build --config build/electron.vite.config.ts   # out/ must be current
 *   xvfb-run -a node scripts/zx81-ide-check.cjs                       # (xvfb-run only without a display)
 *
 * `ZX81_IDE_SHOTS=<folder>` also saves a screenshot of the IDE at each stop.
 */
const fs = require("fs");
const os = require("os");
const path = require("path");
const { launchKlive } = require("./doc-shots/harness.cjs");

const PROGRAM = [
  "    .model ZX81", // 1
  "Start:", // 2
  "    ld b,3", // 3
  "Loop:", // 4
  "    call Step", // 5
  "    djnz Loop", // 6
  "    ret", // 7
  "Step:", // 8
  "    ld a,b", // 9
  "    ld (Last),a", // 10
  "    ret", // 11
  "Last:", // 12
  "    .defb 0", // 13
  ""
];
const line = (n) => PROGRAM[n - 1];

(async () => {
  const work = fs.mkdtempSync(path.join(os.tmpdir(), "zx81-ide-"));
  const shots = process.env.ZX81_IDE_SHOTS;
  const failures = [];
  const check = (ok, what) => {
    console.log(`${ok ? "ok  " : "FAIL"} ${what}`);
    if (!ok) failures.push(what);
  };

  const klive = await launchKlive({ home: path.join(work, "home"), height: 900, userHome: path.join(work, "user") });
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
      const row = [...document.querySelectorAll(".monaco-editor .view-line")].find(
        (l) => Math.abs(l.getBoundingClientRect().top - top) < 2
      );
      return row?.textContent.replace(/ /g, " ");
    });
  const waitPaused = async () => {
    const start = Date.now();
    while (Date.now() - start < 30000) {
      const pc = /Paused \(PC: \$([0-9A-F]{4})\)/i.exec(await emuText())?.[1];
      if (pc) return pc;
      await sleep(250);
    }
    return undefined;
  };
  const waitLine = async (expected) => {
    let current;
    const start = Date.now();
    while (Date.now() - start < 10000) {
      current = await executionLine();
      if (current === expected) return current;
      await sleep(300);
    }
    return current;
  };
  const shot = async (name) => shots && (await ide.screenshot({ path: path.join(shots, `zx81-${name}.png`) }));
  const expectStop = async (lineNo, what) => {
    const pc = await waitPaused();
    const at = await waitLine(line(lineNo));
    check(!!pc && at === line(lineNo), `${what}: paused at $${pc}, execution point on ${JSON.stringify(at)} (line ${lineNo})`);
    await shot(what.replace(/\W+/g, "-").toLowerCase());
  };

  try {
    const projects = path.join(work, "projects");
    fs.mkdirSync(projects, { recursive: true });
    await cmd(`newp zx81 zx81check -p "${projects}"`, 5000);
    const folder = path.join(projects, "zx81check");
    fs.writeFileSync(path.join(folder, "code", "code.kz80.asm"), PROGRAM.join("\n"));
    await cmd(`open "${folder}"`, 8000);
    await cmd("nav code/code.kz80.asm", 3000);
    await cmd("bp-set [code/code.kz80.asm]:5", 1200);
    await cmd("debug", 5000);

    await expectStop(5, "the breakpoint in the code");
    await cmd("em-sti", 1000);
    await expectStop(9, "Step Into enters Step");
    await cmd("em-sto", 1000);
    await expectStop(10, "Step Over moves to the next instruction");
    await cmd("em-out", 1000);
    await expectStop(6, "Step Out returns past the CALL");
    await cmd("em-debug", 1000);
    await expectStop(5, "Continue hits the breakpoint again");

    // --- Without breakpoints the code runs out and RET goes back to BASIC (report 0/2)
    await cmd("bp-ea", 800);
    await cmd("em-debug", 3000);
    const after = await emuText();
    check(!/Paused/i.test(after), "the program runs to its end and returns to BASIC");
  } catch (err) {
    failures.push(String(err));
    console.log(`FAIL ${err}`);
  } finally {
    await app.close();
  }
  if (failures.length > 0) {
    console.log(`\n${failures.length} failure(s)`);
    process.exit(1);
  }
  console.log("\nAll ZX81 IDE checks passed.");
})();
