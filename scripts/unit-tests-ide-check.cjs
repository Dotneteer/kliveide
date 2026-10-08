/**
 * Z80 unit tests in the running IDE (`.plans/Z80_UNIT_TESTS_PLAN.md` Phase 2 and 3 exit criteria).
 *
 * Launches Klive under Playwright's Electron driver (the doc-shots harness), creates a ZX Spectrum
 * 48K project with the Klive assembler in a temporary folder, adds unit-test support with `test-init`,
 * writes three tests (one passes, one fails an assertion, one returns with RET), and checks:
 *
 * - `test-run` fills the Unit Tests panel (statuses, T-states, the failure's values, the summary) and
 *   the Tests output pane, and the panel's badge counts the two that did not pass;
 * - a click on the failure's message moves the editor to the failing line (the macro invocation);
 * - `test-debug` stops at the test's first instruction, and Continue reaches "UT_pass passed".
 *
 * Exits 1 on failure.
 *
 *   npx electron-vite build --config build/electron.vite.config.ts   # out/ must be current
 *   xvfb-run -a node scripts/unit-tests-ide-check.cjs                 # (xvfb-run only without a display)
 *
 * `UNIT_TESTS_IDE_SHOTS=<folder>` also saves a screenshot of the IDE at each check.
 */
const fs = require("fs");
const os = require("os");
const path = require("path");
const { launchKlive } = require("./doc-shots/harness.cjs");

const TESTS = [
  "  .org $8000", // the include line comes first (test-init adds it)
  "  UNITTEST_INITIALIZE()",
  "    ret",
  "",
  "UT_pass:",
  "    ld a,1",
  "    TEST_A(1)",
  "    TC_END()",
  "",
  "UT_fail:",
  "    ld a,2",
  "    TEST_A(3)",
  "    TC_END()",
  "",
  "UT_returns:",
  "    ret",
  ""
];

(async () => {
  const work = fs.mkdtempSync(path.join(os.tmpdir(), "unit-tests-ide-"));
  const shots = process.env.UNIT_TESTS_IDE_SHOTS;
  const userHome = path.join(work, "user");
  fs.mkdirSync(path.join(userHome, "Klive"), { recursive: true });
  const failures = [];
  const check = (ok, what) => {
    console.log(`${ok ? "ok  " : "FAIL"} ${what}`);
    if (!ok) failures.push(what);
  };
  // --- Coverage is an advanced debugging feature: on, so Run with coverage can be checked
  const klive = await launchKlive({
    home: path.join(work, "home"),
    height: 900,
    userHome,
    userSettings: { features: { advancedDebugging: "1" } }
  });
  const { app, ide, cmd, sleep } = klive;
  const shot = async (name) => shots && (await ide.screenshot({ path: path.join(shots, `unit-tests-${name}.png`) }));
  const ideText = () => ide.evaluate(() => document.body.innerText.replace(/ /g, " "));
  const waitFor = async (probe, ms = 30000) => {
    const start = Date.now();
    while (Date.now() - start < ms) {
      if (await probe()) return true;
      await sleep(300);
    }
    return false;
  };
  const emuText = async () => {
    const emu = app.windows().find((w) => w.url().includes("?emu"));
    return (await emu.evaluate(() => document.body.innerText)).replace(/\s+/g, " ");
  };

  try {
    const projects = path.join(work, "projects");
    fs.mkdirSync(projects, { recursive: true });
    await cmd(`newp sp48 utcheck default -p "${projects}"`, 5000);
    const folder = path.join(projects, "utcheck");
    await cmd(`open "${folder}"`, 8000);

    // --- Add unit-test support
    await cmd("test-init", 2500);
    const root = path.join(folder, "code", "code.kz80.asm");
    const include = path.join(folder, "code", "unit_tests.kz80.asm");
    check(fs.existsSync(include), "test-init wrote unit_tests.kz80.asm next to the build root");
    const rootText = fs.readFileSync(root, "utf8");
    check(rootText.startsWith('#include "unit_tests.kz80.asm"'), "test-init added the #include line to the build root");
    fs.writeFileSync(root, ['#include "unit_tests.kz80.asm"', ...TESTS].join("\n"));
    const failLine = 1 + 1 + TESTS.indexOf("    TEST_A(3)");
    await cmd("nav code/code.kz80.asm", 2500);

    // --- The Testing activity and its panel
    await ide.locator('[aria-label="Testing"]').first().click({ force: true });
    await sleep(1500);
    check(/Unit Tests/i.test(await ideText()), "the Testing activity shows the Unit Tests panel");

    // --- Run all
    await cmd("test-run", 1000);
    const done = await waitFor(async () => /3 tests: 1 passed, 1 failed, 1 error/.test(await ideText()));
    check(done, "test-run reports 3 tests: 1 passed, 1 failed, 1 error");
    const panel = await ideText();
    check(/UT_pass/.test(panel) && /UT_fail/.test(panel) && /UT_returns/.test(panel), "the panel lists the three tests");
    check(/A == B \(A=\$02, B=\$03\)/.test(panel.replace(/\s+/g, " ")), "the failure shows the values (A=$02, B=$03)");
    check(/returned with RET; end a test with TC_END/.test(panel), "the RET error says to use TC_END");
    check(/\d[\d,]* T\b/.test(panel), "the panel shows T-states");
    await shot("panel");

    // --- The Tests pane
    await cmd("outp tests", 1500);
    const pane = await ideText();
    check(/PASS\s+UT_pass/.test(pane) && /FAIL\s+UT_fail/.test(pane) && /ERROR\s+UT_returns/.test(pane), "the Tests pane has one line per test");
    await shot("tests-pane");
    // --- Back to the Commands tab, where the prompt is
    const commandsTab = async () => {
      await ide.getByText("Commands", { exact: false }).filter({ hasText: /^commands$/i }).first().click({ force: true });
      await sleep(800);
    };
    await commandsTab();

    // --- Click-to-source: the failure's message goes to the invocation line
    await ide.locator('[class*="_message_"]', { hasText: "A == B" }).first().click({ force: true });
    await sleep(1500);
    const cursorLine = await ide.evaluate(() => {
      const current = document.querySelector(".monaco-editor .current-line");
      if (!current) return undefined;
      const top = current.getBoundingClientRect().top;
      const number = [...document.querySelectorAll(".monaco-editor .line-numbers")].find(
        (n) => Math.abs(n.getBoundingClientRect().top - top) < 3
      );
      return number ? Number(number.textContent.trim()) : undefined;
    });
    check(cursorLine === failLine, `a click on the failure goes to line ${failLine} (got ${cursorLine})`);

    // --- Debug a test (D12)
    await cmd("test-debug UT_pass", 1000);
    const paused = await waitFor(async () => /Paused \(PC:/i.test(await emuText()), 30000);
    check(paused, "test-debug pauses the emulator");
    await cmd("outp emu", 1000);
    check(
      await waitFor(async () => /UT_pass: stopped at the test's first instruction/.test(await ideText()), 10000),
      "the debugger stops at UT_pass's first instruction"
    );
    await shot("debug-start");
    await commandsTab();
    await cmd("em-debug", 2500);
    await cmd("outp emu", 1000);
    check(
      await waitFor(async () => /UT_pass passed/.test(await ideText()), 20000),
      "Continue reaches the success loop: \"UT_pass passed\""
    );
    await shot("debug-passed");

    // --- A failing assertion under the debugger stops on its invocation line (T2)
    await commandsTab();
    await cmd("test-debug UT_fail", 1000);
    await waitFor(async () => /Paused \(PC:/i.test(await emuText()), 30000);
    await sleep(1500);
    await commandsTab();
    await cmd("em-debug", 2500);
    await cmd("outp emu", 1000);
    check(
      await waitFor(async () => new RegExp(`ASSERTION failed at code\\.kz80\\.asm:${failLine}: A == B`).test(await ideText()), 20000),
      `the failing assertion stops with "ASSERTION failed at code.kz80.asm:${failLine}"`
    );

    // --- Run with coverage (D17)
    await commandsTab();
    await cmd("em-stop", 1500);
    await cmd("test-run -coverage", 1000);
    await waitFor(async () => /\d+ tests?: /.test(await ideText()), 30000);
    await cmd("outp tests", 1000);
    check(
      await waitFor(async () => /The tests' coverage is in the editor/.test(await ideText()), 10000),
      "test-run -coverage merges the tests' coverage into the emulator's profile"
    );
    await commandsTab();
    await cmd("coverage status", 1500);
    check(/lines covered/.test(await ideText()), "coverage status reports source lines covered by the tests");
  } catch (err) {
    failures.push(`unexpected: ${err?.message ?? err}`);
    console.log(err);
  } finally {
    await klive.close();
  }
  if (failures.length) {
    console.log(`\n${failures.length} check(s) failed:\n  ${failures.join("\n  ")}`);
    process.exit(1);
  }
  console.log("\nAll unit-test IDE checks passed.");
})();
