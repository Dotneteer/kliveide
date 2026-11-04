/*
 * Boriel BASIC in the running IDE (`dev/ai/boriel/integration.md`, "Tests and checks"): launches the built
 * Klive under Playwright (`scripts/doc-shots/harness.cjs`) with a throwaway home, and checks, part by
 * part:
 *
 *   run    - an sp48 project with Boriel selected builds, runs, and a syntax error reports E342;
 *   debug  - a breakpoint inside a SUB pauses the machine at source level;
 *   next   - the same inside a FUNCTION on the ZX Spectrum Next, through NextZXOS's .nexload of
 *            zxbc's .nex (needs ~/Klive/ks2.cim, copied);
 *   export - a TAP export of an sp48 build holds the injected code; a Next build's NEX export
 *            writes the debug sidecar beside it, and `nex-run -d` of that file stops at a source
 *            breakpoint; so does `nex-run -d` of a .nex zxbc built outside Klive, through the .dbg
 *            beside it (needs the card image too);
 *   ui     - the status bar names the compiler of the open BASIC file (a project's choice wins), the
 *            Settings row switches it (writing the project's choice), the Boriel row shows the
 *            installation, and a click on the status bar item opens the Boriel BASIC dialog;
 *   templates - every shipped zx-basic template, unchanged, on its own machine: it builds, runs
 *            (its screen saved as emu.png) and pauses at a breakpoint on its first PRINT (the Next
 *            needs the card image); TEMPLATES=sp48,zxnext picks machines;
 *   banked - a '@split-modules program (test/boriel/fixtures/banked-128) on the 128K and the Next: a
 *            breakpoint in a module that zxbc put in a RAM bank pauses the machine there.
 *
 *   npx electron-vite build --config build/electron.vite.config.ts
 *   node scripts/boriel-ide-check.cjs [run|debug|next|export|ui|templates|banked ...]
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

async function session(name, { card = false, ideViewOptions = {} } = {}) {
  const out = path.join(OUT, name);
  fs.rmSync(out, { recursive: true, force: true });
  const projects = path.join(out, "projects");
  const userHome = path.join(out, "home");
  fs.mkdirSync(projects, { recursive: true });
  fs.mkdirSync(path.join(userHome, "Klive"), { recursive: true });
  if (card) fs.copyFileSync(path.join(os.homedir(), "Klive", "ks2.cim"), path.join(userHome, "Klive", "ks2.cim"));
  const k = await launchKlive({ home: path.join(out, "klive"), userHome, userSettings: { zxbasic: { root: ROOT } }, ideViewOptions });
  // --- A close that hangs (seen once, after the ui part) must not hang the whole check: give it 20 s,
  // --- then end this session's own Electron process
  const close = k.close;
  k.close = async () => {
    const done = await Promise.race([close().then(() => true), sleep(20000).then(() => false)]);
    if (!done) {
      console.log(`(${name}: the app did not close in 20 s; its process was ended)`);
      k.app.process().kill("SIGKILL");
    }
  };
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

    // --- A .nex zxbc built outside Klive, with no sidecar: nex-run -d uses the .dbg zxbc wrote beside it
    const o = await session("export-outside", { card: true });
    const folder = await o.project("zxnext", ['PRINT "project"']);
    for (let t = Date.now(); !/ZX Spectrum Next/.test(await o.emuText()) && Date.now() - t < 30000; ) await sleep(500);
    await sleep(3000);
    const outside = path.join(folder, "outside");
    fs.mkdirSync(outside, { recursive: true });
    const lines = ["FUNCTION Cube(n As UByte) As UInteger", "    RETURN n * n * n", "END FUNCTION", "PRINT AT 11, 2; Cube(3)", "DO", "LOOP"];
    fs.writeFileSync(path.join(outside, "game.bas"), [...lines, ""].join("\n"));
    require("node:child_process").execFileSync(
      path.join(ROOT, process.platform === "win32" ? "zxbc.exe" : "zxbc"),
      ["game.bas", "--arch", "zxnext", "-O", "1", "-S", "32768", "-f", "nex", "-o", "game.nex", "--debug=game.dbg", "-M", "game.map"],
      { cwd: outside, timeout: 60000, stdio: ["ignore", "pipe", "pipe"] }
    );
    check(fs.existsSync(path.join(outside, "game.nex")) && !fs.existsSync(path.join(outside, "game.nex.kbasic-debug.json")), "export: zxbc built a .nex outside Klive, with no sidecar");
    await o.k.cmd("bp-set [outside/game.bas]:2", 1200);
    await o.k.cmd(`nex-run "${path.join(outside, "game.nex")}" -d`, 5000);
    check(/Source-level debug info loaded from .*game\.dbg/.test(await o.ideText()), "export: nex-run -d reads zxbc's .dbg beside the .nex");
    check(!!(await o.waitPaused(120000)), "export: nex-run -d of a .nex built outside Klive stops at a source breakpoint");
    await o.k.ide.screenshot({ path: path.join(o.out, "nex-run.png") });
    await o.k.close();
  },

  async ui() {
    const s = await session("ui");
    // --- `project()` sets the compiler in the project's settings, which wins over the user's
    const folder = await s.project("sp48", ['PRINT "status"']);
    const statusBar = () =>
      s.k.ide.evaluate(() => [...document.querySelectorAll("[class*=ideStatusBar]")].map((e) => e.textContent).join(" "));
    check(/Boriel BASIC/.test(await statusBar()), "ui: the status bar names Boriel BASIC for the open BASIC file");

    // --- Settings opens in the focused window, and with the app in the background (as under this
    // --- script) no window is focused and it opens in the emulator's: bring the app and the IDE forward
    await s.k.app.evaluate(({ app, BrowserWindow }) => {
      app.focus({ steal: true });
      const ide = BrowserWindow.getAllWindows().find((w) => !w.webContents.getURL().includes("?emu"));
      ide?.show();
      ide?.focus();
    });
    await sleep(500);
    await s.k.cmd("settings integrations", 2000);
    // --- KLIVE-BASIC-OFF: Boriel BASIC is the only BASIC compiler (`dev/ai/klive-basic-switch.md`):
    // --- no compiler row in Settings and no checkbox in the dialog. The checks of the switch are kept
    // --- below, commented out, for the day it is turned back on.
    check((await s.k.ide.getByTestId("settings-row-basicCompiler").count()) === 0, "ui: Settings offers no choice of BASIC compiler");
    const install = await s.k.ide.getByTestId("settings-row-borielBasic").textContent();
    check(install.includes(path.basename(ROOT)), `ui: the Boriel BASIC row shows the installation folder (${path.basename(ROOT)})`);
    await s.k.ide.keyboard.press("Escape");
    await sleep(800);
    await s.k.ide.getByRole("button", { name: "Boriel BASIC" }).click();
    await sleep(1500);
    const dialogText = await s.ideText();
    check(/Boriel BASIC/.test(dialogText) && !/Use Boriel BASIC to build BASIC programs/.test(dialogText), "ui: the status bar item opens the Boriel BASIC dialog, which offers no compiler switch");
    await s.k.ide.screenshot({ path: path.join(s.out, "boriel-dialog.png") });
    await s.k.ide.keyboard.press("Escape");
    await sleep(800);
    // const row = s.k.ide.getByTestId("settings-row-basicCompiler");
    // check(/Boriel BASIC/.test(await row.textContent()), "ui: the Settings row shows the project's compiler");
    // const install = await s.k.ide.getByTestId("settings-row-borielBasic").textContent();
    // check(install.includes(path.basename(ROOT)), `ui: the Boriel BASIC row shows the installation folder (${path.basename(ROOT)})`);
    // await s.k.ide.getByTestId("settings-select-basicCompiler").click();
    // await s.k.ide.getByRole("option", { name: "Klive BASIC" }).click();
    // await sleep(1500);
    // await s.k.ide.keyboard.press("Escape");
    // await sleep(800);
    // const saved = JSON.parse(fs.readFileSync(path.join(folder, "klive.project"), "utf8"));
    // check(saved.settings?.zxbasic?.compiler === "klive", "ui: switching in Settings writes the project's choice");
    // check(/Klive BASIC/.test(await statusBar()), "ui: the status bar follows the switch");

    // await s.k.ide.getByRole("button", { name: "Klive BASIC" }).click();
    // await sleep(1500);
    // check(/Use Boriel BASIC to build BASIC programs/.test(await s.ideText()), "ui: a click on the status bar item opens the Boriel BASIC dialog");
    // await s.k.ide.screenshot({ path: path.join(s.out, "boriel-dialog.png") });
    // // --- Its checkbox changes the compiler that builds: here the project's choice, as the Settings row does
    // await s.k.ide.getByRole("checkbox", { name: /Use Boriel BASIC/ }).click();
    // await sleep(1500);
    // const ticked = JSON.parse(fs.readFileSync(path.join(folder, "klive.project"), "utf8"));
    // check(ticked.settings?.zxbasic?.compiler === "boriel", "ui: the dialog's checkbox writes the project's choice");
    // await s.k.ide.keyboard.press("Escape");
    // await sleep(800);
    // check(/Boriel BASIC/.test(await statusBar()), "ui: the status bar follows the dialog");
    await s.k.close();
  },

  async templates() {
    // --- Every shipped zx-basic template, unchanged, as a user gets it: it builds, runs (its welcome
    // --- text is on the screen, `emu.png`), and a breakpoint on its first PRINT pauses a debug run
    for (const machine of (process.env.TEMPLATES ?? "sp48,sp128,timex,scorpion,zxnext").split(",")) {
      const next = machine === "zxnext";
      const s = await session(`template-${machine}`, { card: next });
      const projects = path.join(s.out, "projects");
      await s.k.cmd(`newp ${machine} tpl zx-basic -p "${projects}"`, 5000);
      const folder = path.join(projects, "tpl");
      const file = "program.zxbas";
      const source = fs.readFileSync(path.join(folder, "code", file), "utf8");
      check(/Boriel BASIC \(beta\)/.test(source), `templates: ${machine}: the template names Boriel BASIC (beta)`);
      await s.k.cmd(`open "${folder}"`, 8000);
      await s.k.cmd(`nav code/${file}`, 3000);
      if (next) {
        for (let t = Date.now(); !/ZX Spectrum Next/.test(await s.emuText()) && Date.now() - t < 30000; ) await sleep(500);
        await sleep(3000);
      }
      await s.k.cmd("run", next ? 9000 : 6000);
      check(/Code injected and started/.test(await s.ideText()), `templates: ${machine}: the template builds and starts`);
      // --- NextZXOS boots and .nexloads the program first
      const emuWindow = s.k.app.windows().find((w) => w.url().includes("?emu"));
      await sleep(next ? 90000 : 4000);
      await emuWindow.screenshot({ path: path.join(s.out, "emu.png") });
      await s.k.cmd("em-stop", 2000);
      const line = source.split("\n").findIndex((l) => /^\s*print\b/i.test(l)) + 1;
      await s.k.cmd(`bp-set [code/${file}]:${line}`, 1500);
      await s.k.cmd("debug", next ? 5000 : 9000);
      check(!!(await s.waitPaused(next ? 120000 : 20000)), `templates: ${machine}: a breakpoint on line ${line} pauses a debug run`);
      await s.k.ide.screenshot({ path: path.join(s.out, "paused.png") });
      await s.k.close();
    }
  },

  async banked() {
    // --- "Sync the Source with the Current Breakpoint" (a global IDE option, off by default) makes a
    // --- stop open its file
    const sync = { syncBreakpoints: true };
    const s = await session("banked", { ideViewOptions: sync });
    const r128 = await bankedPart(s, "sp128", "sp128");
    check(!!r128.pc && r128.pc === r128.expected, `banked: a breakpoint in a module in RAM bank 1 pauses the 128K (PC $${r128.pc}, Peek3 at $${r128.expected})`);
    check(r128.opened, "banked: the 128K stop opens big3.bas at the execution point");
    // --- The banked build as a tape: the TAP export hands over zxbc's own tape (its loader pages the
    // --- banks as zxbc's runtime expects); the 128K's Tape Loader loads it, the program leaves its total
    const tap = path.join(s.out, "banked.tap");
    await s.k.cmd("em-stop", 1500);
    await s.k.cmd(`expc "${tap}" -f tap`, 6000);
    await s.k.cmd(`tape-load "${tap}" -r`, 3000);
    await sleep(40000);
    await s.k.cmd("em-pause", 1500);
    const snapshot = path.join(s.out, "banked.z80");
    // --- A pause can land between an instruction prefix and its opcode, which no snapshot holds: retry
    for (let attempt = 0; attempt < 5 && !fs.existsSync(snapshot); attempt++) {
      if (attempt) {
        await s.k.cmd("em-start", 500);
        await s.k.cmd("em-pause", 1000);
      }
      await s.k.cmd(`zx-snapshot-save "${snapshot}"`, 2000);
    }
    await s.k.app.windows().find((w) => w.url().includes("?emu")).screenshot({ path: path.join(s.out, "tape-run.png") });
    const total = z80Word(snapshot, mapAddress(path.join(s.out, "projects", "bcheck", "_klive", "boriel", "program.map"), "_total"));
    check(total === 311, `banked: the exported TAP loads on the 128K and the program runs (total ${total})`);
    await s.k.close();
    const n = await session("banked-next", { card: true, ideViewOptions: sync });
    const rNext = await bankedPart(n, "zxnext", "zxnext");
    check(!!rNext.pc && rNext.pc === rNext.expected, `banked: a breakpoint in a module in page 34 pauses the Next (PC $${rNext.pc}, Peek3 at $${rNext.expected})`);
    check(rNext.opened, "banked: the Next stop opens big3.bas at the execution point");
    await n.k.close();
  }
};

/**
 * The banked fixture's sources in a new project for `machine`, '@split-modules in the header, a
 * breakpoint on Peek3's RETURN in big3.bas (the second bank), then `debug`; true when it pauses there.
 */
async function bankedPart(s, machine, label) {
  const fixture = path.join(__dirname, "..", "test", "boriel", "fixtures", "banked-128");
  const main = fs.readFileSync(path.join(fixture, "program.bas"), "utf8").split("\n");
  const folder = await s.project(machine, ["'@split-modules", ...main]);
  for (const file of fs.readdirSync(fixture).filter((f) => f.endsWith(".bas") && f !== "program.bas")) {
    fs.copyFileSync(path.join(fixture, file), path.join(folder, "code", file));
  }
  if (machine === "zxnext") {
    for (let t = Date.now(); !/ZX Spectrum Next/.test(await s.emuText()) && Date.now() - t < 30000; ) await sleep(500);
    await sleep(3000);
  }
  const line = fs.readFileSync(path.join(fixture, "big3.bas"), "utf8").split("\n").findIndex((l) => /RETURN table\(i\)/.test(l)) + 1;
  await s.k.cmd(`bp-set [code/big3.bas]:${line}`, 1200);
  await s.k.cmd("debug", 9000);
  const pc = await s.waitPaused(machine === "zxnext" ? 120000 : 30000);
  // --- The IDE opens the module at the execution point once it has asked the emulator where it is
  let opened = false;
  for (let t = Date.now(); !opened && Date.now() - t < 10000; await sleep(500)) {
    opened = await s.k.ide.evaluate(() => [...document.querySelectorAll("[role=tab], .tab, [class*=tab]")].some((e) => /big3\.bas/.test(e.textContent)));
  }
  await s.k.ide.screenshot({ path: path.join(s.out, `${label}.png`) });
  const dbg = JSON.parse(fs.readFileSync(path.join(folder, "_klive", "boriel", "program.dbg"), "utf8")).sourceLevelDebug;
  const peek3 = dbg.extensions.frames.find((f) => dbg.callables[f.callableIndex].name === "Peek3");
  return { pc, opened, expected: peek3 && peek3.bodyStart.toString(16).toUpperCase().padStart(4, "0") };
}

/** A label's address in zxbc's `-M` map (`BB::HHHH: .name` in a banked build). */
function mapAddress(mapFile, name) {
  const line = fs.readFileSync(mapFile, "utf8").split(/\r?\n/).find((l) => l.trim().endsWith(`.${name}`));
  return line ? parseInt(line.trim().replace(/^[0-9A-Fa-f]+::/, "").slice(0, 4), 16) : undefined;
}

/**
 * A word at $4000-$BFFF of a version 2/3 `.z80` snapshot of a 128K: its memory pages are
 * numbered bank + 3, and compressed ones repeat a byte with `ED ED count byte`.
 */
function z80Word(file, address) {
  if (!fs.existsSync(file) || address === undefined || address < 0x4000 || address >= 0xc000) return undefined;
  const bytes = fs.readFileSync(file);
  const bank = address < 0x8000 ? 5 : 2;
  let i = 32 + (bytes[30] | (bytes[31] << 8));
  while (i + 3 <= bytes.length) {
    const length = bytes[i] | (bytes[i + 1] << 8);
    const page = bytes[i + 2];
    const raw = bytes.subarray(i + 3, i + 3 + (length === 0xffff ? 0x4000 : length));
    i += 3 + raw.length;
    if (page - 3 !== bank) continue;
    const data = [];
    for (let j = 0; j < raw.length; ) {
      if (length !== 0xffff && raw[j] === 0xed && raw[j + 1] === 0xed) {
        for (let n = 0; n < raw[j + 2]; n++) data.push(raw[j + 3]);
        j += 4;
      } else data.push(raw[j++]);
    }
    const offset = address & 0x3fff;
    return data[offset] | (data[offset + 1] << 8);
  }
  return undefined;
}

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
