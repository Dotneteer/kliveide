/*
 * Boriel BASIC in the running IDE (`.plans/BORIEL_BASIC_INTEGRATION_PLAN.md` §8): launches the built
 * Klive under Playwright (`scripts/doc-shots/harness.cjs`) with a throwaway home, and checks, part by
 * part:
 *
 *   run    - an sp48 project with Boriel selected builds, runs, and a syntax error reports E342;
 *   debug  - a breakpoint inside a SUB pauses the machine at source level;
 *   next   - the same on the ZX Spectrum Next through NextZXOS (needs ~/Klive/ks2.cim, copied).
 *            KNOWN TO FAIL (plan §6, "Open"): the program runs, the breakpoint never stops it.
 *
 *   npx electron-vite build --config build/electron.vite.config.ts
 *   node scripts/boriel-ide-check.cjs [run|debug|next ...]
 *
 * Boriel BASIC comes from BORIEL_ROOT, else ~/zxbasic2 (install it from Klive's setup dialog).
 * Screenshots and the throwaway homes go to `.boriel-ide-check/` (git-ignored). Local only: it needs
 * the kit and, for `next`, a NextZXOS card image.
 */
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { launchKlive } = require("./doc-shots/harness.cjs");

const ROOT = process.env.BORIEL_ROOT || path.join(os.homedir(), "zxbasic2");
const OUT = path.join(__dirname, "..", ".boriel-ide-check");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function session(name, { card = false } = {}) {
  const out = path.join(OUT, name);
  fs.rmSync(out, { recursive: true, force: true });
  const projects = path.join(out, "projects");
  const userHome = path.join(out, "home");
  fs.mkdirSync(projects, { recursive: true });
  fs.mkdirSync(path.join(userHome, "Klive"), { recursive: true });
  if (card) fs.copyFileSync(path.join(os.homedir(), "Klive", "ks2.cim"), path.join(userHome, "Klive", "ks2.cim"));
  const k = await launchKlive({ home: path.join(out, "klive"), userHome, userSettings: { zxbasic: { root: ROOT } } });
  const ideText = async () => (await k.ide.evaluate(() => document.body.innerText)).replace(/\s+/g, " ");
  const emuText = async () =>
    (await k.app.windows().find((w) => w.url().includes("?emu")).evaluate(() => document.body.innerText)).replace(/\s+/g, " ");
  /** Creates a project from the machine's zx-basic template, with `lines` as its program, Boriel selected. */
  const project = async (machine, lines) => {
    await k.cmd(`newp ${machine} bcheck zx-basic -p "${projects}"`, 5000);
    const folder = path.join(projects, "bcheck");
    fs.writeFileSync(path.join(folder, "code", "program.zxbas"), [...lines, ""].join("\n"));
    await k.cmd(`open "${folder}"`, 8000);
    await k.cmd("set -p zxbasic.compiler boriel", 1500);
    await k.cmd("nav code/program.zxbas", 3000);
    return folder;
  };
  const waitPaused = async (ms) => {
    for (let t = Date.now(); Date.now() - t < ms; ) {
      const m = /Paused \(PC: \$([0-9A-F]{4})\)/i.exec(await emuText());
      if (m) return m[1];
      await sleep(500);
    }
    return undefined;
  };
  return { k, out, ideText, emuText, project, waitPaused };
}

const results = [];
const check = (ok, label) => {
  results.push({ ok, label });
  console.log(`${ok ? "PASS" : "FAIL"} ${label}`);
};

const PARTS = {
  async run() {
    const s = await session("run");
    const folder = await s.project("sp48", ['PRINT AT 10, 5; "Boriel BASIC"']);
    await s.k.cmd("run", 9000);
    const text = await s.ideText();
    check(/Code injected and started/.test(text), "run: the program built and started");
    check(/Boriel BASIC: \d+ bytes at \$8000 \(zx48k\)/.test(text), "run: the build output names zxbc's result");
    fs.writeFileSync(path.join(folder, "code", "program.zxbas"), "DIM a As UByte\na = 1 +\n");
    await s.k.cmd("em-stop", 1500);
    await s.k.cmd("compile", 5000);
    check(/E342/.test(await s.ideText()), "run: a syntax error reports E342");
    await s.k.close();
  },

  async debug() {
    const s = await session("debug");
    await s.project("sp48", ["SUB Greet(n As UByte)", '    PRINT AT n, 0; "Hello"', "END SUB", "DIM g As UByte = 3", "Greet(g)", 'PRINT "done"']);
    await s.k.cmd("bp-set [code/program.zxbas]:2", 1500);
    await s.k.cmd("debug", 9000);
    check(!!(await s.waitPaused(20000)), "debug: a breakpoint inside a SUB pauses the machine");
    await s.k.ide.screenshot({ path: path.join(s.out, "paused.png") });
    await s.k.close();
  },

  async next() {
    const s = await session("next", { card: true });
    await s.project("zxnext", ["FUNCTION Square(n As UByte) As UInteger", "    RETURN n * n", "END FUNCTION", 'PRINT AT 10, 2; "Boriel on the Next"', "PRINT AT 11, 2; Square(7)"]);
    // --- Opening the project switches the machine; a breakpoint set before that finishes is wiped
    for (let t = Date.now(); !/ZX Spectrum Next/.test(await s.emuText()) && Date.now() - t < 30000; ) await sleep(500);
    await sleep(3000);
    await s.k.cmd("bp-set [code/program.zxbas]:2", 1200);
    await s.k.cmd("debug", 5000);
    // --- NextZXOS boots and .nexloads the exported NEX: this takes a while
    check(!!(await s.waitPaused(120000)), "next: a breakpoint inside a FUNCTION pauses the Next (KNOWN TO FAIL, plan §6 Open)");
    await s.k.ide.screenshot({ path: path.join(s.out, "ide.png") });
    await s.k.close();
  }
};

(async () => {
  if (!fs.existsSync(path.join(ROOT, process.platform === "win32" ? "zxbc.exe" : "zxbc"))) {
    throw new Error(`No Boriel BASIC at ${ROOT}: set BORIEL_ROOT or install it from Klive.`);
  }
  const parts = process.argv.slice(2).length ? process.argv.slice(2) : ["run", "debug", "next"];
  for (const part of parts) {
    if (!PARTS[part]) throw new Error(`Unknown part ${part}`);
    await PARTS[part]();
  }
  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} passed; screenshots in ${OUT}`);
  process.exit(failed.length ? 1 : 0);
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
