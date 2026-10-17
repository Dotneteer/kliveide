/*
 * Boriel BASIC in the running IDE (`.plans/BORIEL_BASIC_INTEGRATION_PLAN.md` §8): launches the built
 * Klive under Playwright (`scripts/doc-shots/harness.cjs`) with a throwaway home, and checks, part by
 * part:
 *
 *   run    - an sp48 project with Boriel selected builds, runs, and a syntax error reports E342;
 *   debug  - a breakpoint inside a SUB pauses the machine at source level;
 *   next   - the same inside a FUNCTION on the ZX Spectrum Next, through NextZXOS's .nexload of
 *            zxbc's .nex (needs ~/Klive/ks2.cim, copied);
 *   export - a TAP export of an sp48 build holds the injected code; a Next build's NEX export
 *            writes the debug sidecar beside it, and `nex-run -d` of that file stops at a source
 *            breakpoint (needs the card image too).
 *
 *   npx electron-vite build --config build/electron.vite.config.ts
 *   node scripts/boriel-ide-check.cjs [run|debug|next|export ...]
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
    check(!!(await s.waitPaused(120000)), "next: a breakpoint inside a FUNCTION pauses the Next");
    await s.k.ide.screenshot({ path: path.join(s.out, "ide.png") });
    await s.k.close();
  },

  async export() {
    const s = await session("export", { card: true });
    // --- TAP: a header block naming the code, then a data block holding exactly zxbc's .bin
    const tapFolder = await s.project("sp48", ['PRINT AT 10, 5; "Boriel TAP"']);
    const tap = path.join(s.out, "program.tap");
    await s.k.cmd(`expc "${tap}" -f tap -n boriel`, 6000);
    const bin = path.join(tapFolder, "_klive", "boriel", "program.bin");
    const blocks = tapBlocks(fs.existsSync(tap) ? fs.readFileSync(tap) : Buffer.alloc(0));
    const code = blocks.find((b) => b[0] === 0xff);
    check(
      fs.existsSync(bin) && !!code && Buffer.compare(code.subarray(1, -1), fs.readFileSync(bin)) === 0 && blocks.every(tapChecksumOk),
      "export: the TAP holds zxbc's code in a valid code block"
    );
    await s.k.close();

    // --- NEX: zxbc's file and Klive's sidecar, then nex-run -d stops at a source breakpoint
    const n = await session("export-next", { card: true });
    await n.project("zxnext", ["FUNCTION Square(n As UByte) As UInteger", "    RETURN n * n", "END FUNCTION", "PRINT AT 11, 2; Square(7)"]);
    for (let t = Date.now(); !/ZX Spectrum Next/.test(await n.emuText()) && Date.now() - t < 30000; ) await sleep(500);
    await sleep(3000);
    const nex = path.join(n.out, "boriel.nex");
    await n.k.cmd(`expc "${nex}"`, 8000);
    check(fs.existsSync(nex) && fs.readFileSync(nex).subarray(0, 4).toString() === "Next", "export: the NEX export writes zxbc's .nex");
    check(fs.existsSync(`${nex}.kbasic-debug.json`), "export: the NEX export writes the debug sidecar beside it");
    await n.k.cmd("bp-set [code/program.zxbas]:2", 1200);
    await n.k.cmd(`nex-run "${nex}" -d`, 5000);
    check(!!(await n.waitPaused(120000)), "export: nex-run -d of the exported NEX stops at a source breakpoint");
    await n.k.ide.screenshot({ path: path.join(n.out, "nex-run.png") });
    await n.k.close();
  }
};

/** A TAP file's blocks, each with its flag byte first and its checksum last. */
function tapBlocks(bytes) {
  const blocks = [];
  for (let i = 0; i + 2 <= bytes.length; ) {
    const length = bytes[i] | (bytes[i + 1] << 8);
    blocks.push(bytes.subarray(i + 2, i + 2 + length));
    i += 2 + length;
  }
  return blocks;
}
const tapChecksumOk = (block) => block.reduce((x, b) => x ^ b, 0) === 0;

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
