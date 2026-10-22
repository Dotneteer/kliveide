/*
 * z88dk (C) in the running IDE (`.plans/Z88DK_INTEGRATION_PLAN.md` §10): launches the built Klive under
 * Playwright (`scripts/doc-shots/harness.cjs`) with a throwaway home, and checks, part by part:
 *
 *   run    - an sp48 project from the z88-dk template builds and runs; a syntax error reports zcc's
 *            diagnostic at its line;
 *   debug  - a breakpoint inside a C function pauses the machine, and the Call Stack names the C
 *            functions;
 *   export - a TAP export copies the .tap z88dk wrote, byte for byte;
 *   zx81   - the ZX81 template's Run loads z88dk's .P;
 *   setup  - z88dk-setup opens the z88dk Integration dialog, which reports the configured install
 *            (screenshot);
 *   nosetup - with no z88dk configured, a build says so and offers the Set up z88dk... link.
 *   templates - every ZX Spectrum family z88-dk template (`.plans/ZX_SPECTRUM_C_TEMPLATES_PLAN.md`
 *            T5), one fresh app per machine and model: Build (zcc's result, no errors), Run (the
 *            loop leaves `counter` at 6 in the Watch panel), Debug (a breakpoint in `square` pauses
 *            on its line; the Call Stack and Variables panels show square <- main, `value` and
 *            `counter`; Step Over and Step Out move as in the core tests) and Export (the native file
 *            is the one zcc wrote, byte for byte). `templates:<case>` runs one case (`templates:zxnext`).
 *            The TS2068 case runs when KLIVE_TS2068_ROM names its ROM, like the core tests; the Next
 *            case copies the NextZXOS card ~/Klive/ks2.cim (or Z88DK_IDE_CARD) into its own home.
 *
 *   npx electron-vite build --config build/electron.vite.config.ts
 *   node scripts/z88dk-ide-check.cjs [run|debug|export|zx81|setup|nosetup ...]
 *
 * z88dk comes from Z88DK_ROOT, else ~/z88dk (v2.4 or newer); Klive's own download goes to
 * ~/KliveTools/z88dk/<version>, so set Z88DK_ROOT for it. Screenshots and the throwaway homes go
 * to `.z88dk-ide-check/` (git-ignored). Local only: it needs a z88dk installation.
 */
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { launchKlive } = require("./doc-shots/harness.cjs");

const ROOT = process.env.Z88DK_ROOT || path.join(os.homedir(), "z88dk");
const OUT = path.join(__dirname, "..", ".z88dk-ide-check");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** The NextZXOS SD card image a Next case copies into its own home (as the Klive BASIC and Boriel checks do). */
const NEXT_CARD = process.env.Z88DK_IDE_CARD ?? path.join(os.homedir(), "Klive", "ks2.cim");

async function session(name, { configured = true, globalSettings = {}, card = false, ideViewOptions = {} } = {}) {
  const out = path.join(OUT, name);
  fs.rmSync(out, { recursive: true, force: true });
  const projects = path.join(out, "projects");
  const userHome = path.join(out, "home");
  fs.mkdirSync(projects, { recursive: true });
  fs.mkdirSync(path.join(userHome, "Klive"), { recursive: true });
  // --- A fresh home has no NextZXOS card: the Next would stop on "Error reading file ... enAltZX.rom"
  if (card) fs.copyFileSync(NEXT_CARD, path.join(userHome, "Klive", "ks2.cim"));
  const k = await launchKlive({
    home: path.join(out, "klive"),
    userHome,
    userSettings: configured ? { z88dk: { root: ROOT } } : {},
    globalSettings,
    ideViewOptions
  });
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
  /** Creates a project from the machine's z88-dk template, optionally replacing its program. */
  const project = async (machine, lines) => {
    // --- `machine` may name a model too (`sp128:pentagon`), as `newp` takes it
    await k.cmd(`newp ${machine} ccheck z88-dk -p "${projects}"`, 5000);
    const folder = path.join(projects, "ccheck");
    if (lines) fs.writeFileSync(path.join(folder, "code", "main.c"), [...lines, ""].join("\n"));
    await k.cmd(`open "${folder}"`, 8000);
    // --- Opening a project switches the machine: wait for it before building
    await sleep(4000);
    await k.cmd("nav code/main.c", 3000);
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
  const sideBarText = async () =>
    (await k.ide.evaluate(() => document.querySelector('[class*="_sideBar_"]')?.innerText ?? document.body.innerText)).replace(/\s+/g, " ");
  /** Opens a side bar activity (its button's label) and expands one of its panels unless `probe` already shows. */
  const showPanel = async (activity, title, probe) => {
    // --- Clicking the active activity's button closes the side bar: open it only when it is not showing
    const open = await k.ide.evaluate((t) => {
      const bar = document.querySelector('[class*="_sideBar_"]');
      return !!bar && bar.getBoundingClientRect().width > 0 && new RegExp(t, "i").test(bar.innerText);
    }, title);
    if (!open) {
      await k.ide.locator(`button[aria-label="${activity}"]`).click({ force: true });
      await sleep(800);
    }
    if (probe.test(await sideBarText())) return;
    await k.ide.locator('[class*="_headerText_"]', { hasText: new RegExp(`^${title}$`, "i") }).first().click({ force: true });
    await sleep(1200);
  };
  /** The line of the editor's execution point, as text (the IDE marks it `activeBreakpointLine`). */
  const executionLine = () =>
    k.ide.evaluate(() => {
      const deco = document.querySelector('[class*="activeBreakpointLine"]');
      if (!deco) return undefined;
      const top = deco.getBoundingClientRect().top;
      const line = [...document.querySelectorAll(".monaco-editor .view-line")].find((l) => Math.abs(l.getBoundingClientRect().top - top) < 2);
      return line?.textContent.replace(/\u00a0/g, " ").trim();
    });
  const waitLine = async (ok, ms = 10000) => {
    let line;
    for (let t = Date.now(); Date.now() - t < ms; ) {
      line = (await executionLine()) ?? "";
      if (ok(line)) return line;
      await sleep(300);
    }
    return line;
  };
  return { k, out, ideText, emuText, project, waitPaused, sideBarText, showPanel, executionLine, waitLine };
}

/*
 * The ZX Spectrum family's z88-dk templates in the IDE (`.plans/ZX_SPECTRUM_C_TEMPLATES_PLAN.md` T5).
 * `machine` is what `newp` takes; `target` and `org` are what the build output names; `ext` is the
 * native file Export copies. The +2A/+3/+2E/+3E family's other models, the 48K NTSC and the TC2048 on
 * its own ROM differ from these only in ROM or timing: the slow core sweep covers them.
 */
const TEMPLATE_CASES = [
  { id: "sp48", machine: "sp48:pal", target: "+zx", org: "8000", ext: "tap" },
  { id: "sp128", machine: "sp128:sp128", target: "+zx", org: "8000", ext: "tap" },
  { id: "pentagon", machine: "sp128:pentagon", target: "+zx", org: "8000", ext: "tap" },
  { id: "plus2e", machine: "spp3e:nofdd", target: "+zx -subtype=plus3", org: "8000", ext: "dsk" },
  { id: "plus3", machine: "spp3e:plus3-fdd1", target: "+zx -subtype=plus3", org: "8000", ext: "dsk" },
  { id: "scorpion", machine: "scorpion", target: "+zx", org: "8000", ext: "tap" },
  { id: "tc2048", machine: "timex:tc2048", target: "+zx", org: "8000", ext: "tap" },
  {
    id: "ts2068",
    machine: "timex:ts2068",
    target: "+ts2068",
    org: "9C40",
    ext: "tap",
    rom: process.env.KLIVE_TS2068_ROM,
    globalSettings: (rom) => ({ emuOptions: { ts2068RomFile: rom } })
  },
  { id: "zxnext", machine: "zxnext", target: "+zxn", org: "8000", ext: "nex", next: true }
];

const escapeRe = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** One template case: Build, Run, Debug and Export in a fresh app on that machine and model. */
async function templateCase(c) {
  const name = `templates/${c.id}`;
  if (c.globalSettings && !(c.rom && fs.existsSync(c.rom))) {
    console.log(`SKIP ${c.id}: its ROM is not named (KLIVE_TS2068_ROM)`);
    return;
  }
  if (c.next && !fs.existsSync(NEXT_CARD)) {
    console.log(`SKIP ${c.id}: no NextZXOS SD card image at ${NEXT_CARD} (Z88DK_IDE_CARD)`);
    return;
  }
  // --- "Sync the Source with the Current Breakpoint" (a global IDE option, off by default) makes the
  // --- editor follow every stop, so a stop off screen (Step Out to the Next's line 39) is checked too
  const s = await session(name, {
    globalSettings: c.globalSettings ? c.globalSettings(c.rom) : {},
    card: !!c.next,
    ideViewOptions: { syncBreakpoints: true }
  });
  const label = (what) => `${c.id}: ${what}`;
  try {
    const folder = await s.project(c.machine);
    const source = fs.readFileSync(path.join(folder, "code", "main.c"), "utf8").split(/\r?\n/);
    const lineOf = (text) => source.findIndex((l) => l.includes(text)) + 1;
    const resultLine = lineOf("int result = value * value;");
    const returnLine = lineOf("return result;");
    const callLine = lineOf("square(counter)");

    // --- Build: zcc's result for this machine's target, and no errors
    await s.k.cmd("compile", 15000);
    let text = await s.ideText();
    check(new RegExp(`z88dk: \\d+ bytes at \\$${c.org} \\(${escapeRe(c.target)}\\)`).test(text), label(`Build names zcc's result at $${c.org} (${c.target})`));
    check(!/ZCC:|error:/i.test(text.slice(text.lastIndexOf("z88dk: zcc"))), label("Build reports no errors"));
    await s.k.ide.screenshot({ path: path.join(s.out, "built.png") });

    // --- Run: the loop leaves counter at 6, read from the Watch panel. The Next's first Run boots
    // --- NextZXOS from the card before `.nexload` (a minute or more from a fresh home), so the panel
    // --- is polled while the machine runs, then read once more paused
    await s.k.cmd("w-add counter:w", 1000);
    await s.k.cmd("run", 5000);
    await s.showPanel("Debug", "Watch", /COUNTER/);
    const counterRow = async () => {
      const watch = await s.sideBarText();
      return watch.slice(watch.indexOf("COUNTER"), watch.indexOf("COUNTER") + 30).trim();
    };
    for (let t = Date.now(); !/^COUNTER\s*\$0006/.test(await counterRow()) && Date.now() - t < (c.next ? 240000 : 30000); ) await sleep(1000);
    await (await s.k.emu()).screenshot({ path: path.join(s.out, "running.png") });
    await s.k.ide.screenshot({ path: path.join(s.out, "run-ide.png") });
    await s.k.cmd("em-pause", 1500);
    // --- The Watch panel shows a word as hex and decimal: `COUNTER $0006 (6)`
    const row = await counterRow();
    check(/^COUNTER\s*\$0006\s*\(6\)/.test(row), label(`Run leaves counter at 6 (${row})`));
    await s.k.cmd("em-stop", 2000);

    // --- Debug: the breakpoint in square, the panels, Step Over, Step Out
    await s.k.cmd(`bp-set [code/main.c]:${resultLine}`, 1500);
    await s.k.cmd("debug", c.next ? 25000 : 15000);
    check(!!(await s.waitPaused(c.next ? 90000 : 30000)), label("Debug pauses at the breakpoint in square"));
    check((await s.waitLine((l) => l.includes("int result = value * value;"))).includes("int result"), label(`the execution point is on line ${resultLine}`));
    await s.showPanel("Debug", "Call Stack", /Top:/);
    await s.showPanel("Debug", "Variables", /Globals/);
    await sleep(1000);
    const panels = await s.sideBarText();
    fs.writeFileSync(path.join(s.out, "panels.txt"), panels);
    check(new RegExp(`Top:\\s*square\\s*main\\.c:${resultLine}`).test(panels), label(`the Call Stack's top is square at main.c:${resultLine}`));
    check(/\b1:\s*main\s*main\.c:\d+/.test(panels), label("the Call Stack's next row is main"));
    // --- `Locals — square result <stack garbage> int value 1 int Globals counter 1 int`
    check(/Locals — square\b[^]*?\bvalue\s+1\s+int\b[^]*?Globals/.test(panels), label("the Variables panel shows square's value = 1"));
    check(/Globals\s+counter\s+1\s+int\b/.test(panels), label("the Variables panel shows the global counter = 1"));
    check(/Top:\s*square\s*main\.c:\d+\s*1:\s*main\s*main\.c:\d+\s*2:\s*\(startup\)/.test(panels), label("the Call Stack is square <- main <- (startup)"));
    await s.k.ide.screenshot({ path: path.join(s.out, "paused.png") });
    await s.k.cmd("em-sto", 1500);
    check((await s.waitLine((l) => l.includes("return result;"))).includes("return result;"), label(`Step Over moves to line ${returnLine}`));
    check(/Locals — square\b[^]*?\bresult\s+1\s+int\b/.test(await s.sideBarText()), label("the Variables panel shows result = 1 after the step"));
    await s.k.cmd("em-out", 1500);
    const outLine = await s.waitLine((l) => l.includes("square(counter)"));
    check(outLine.includes("square(counter)"), label(`Step Out returns to main's line ${callLine}, which called square (shown: ${JSON.stringify(outLine)})`));
    await s.k.ide.screenshot({ path: path.join(s.out, "step-out.png") });
    await s.k.cmd("em-stop", 2000);
    await s.k.cmd("bp-ea", 800);

    // --- Export: the native file is zcc's, byte for byte
    const exported = path.join(s.out, `main.${c.ext}`);
    await s.k.cmd(`expc "${exported}" -f ${c.ext}`, 15000);
    const built = path.join(folder, "_klive", "z88dk", "build", `main.${c.ext}`);
    check(
      fs.existsSync(exported) && fs.existsSync(built) && Buffer.compare(fs.readFileSync(exported), fs.readFileSync(built)) === 0,
      label(`Export writes the .${c.ext} zcc wrote, byte for byte`)
    );
  } catch (error) {
    check(false, label(`the case stopped: ${error.message}`));
    await s.k.ide.screenshot({ path: path.join(s.out, "failure.png") }).catch(() => {});
  } finally {
    await s.k.close();
  }
}

const results = [];
const check = (ok, label) => {
  results.push({ ok, label });
  console.log(`${ok ? "PASS" : "FAIL"} ${label}`);
};

const PARTS = {
  async run() {
    const s = await session("run");
    const folder = await s.project("sp48");
    await s.k.cmd("run", 15000);
    const text = await s.ideText();
    check(/z88dk: \d+ bytes at \$8000 \(\+zx\)/.test(text), "run: the build output names zcc's result");
    check(/Code injected and started|started/i.test(text), "run: the program started");
    await (await s.k.emu()).screenshot({ path: path.join(s.out, "running.png") });
    fs.writeFileSync(path.join(folder, "code", "main.c"), "int main(void)\n{\n    int x = ;\n    return 0;\n}\n");
    await s.k.cmd("em-stop", 1500);
    await s.k.cmd("compile", 10000);
    check(/ZCC: Invalid expression/.test(await s.ideText()), "run: a syntax error reports zcc's diagnostic");
    await s.k.close();
  },

  async debug() {
    const s = await session("debug");
    await s.project("sp48");
    // --- `int result = value * value;` in square(), line 12 of the template
    await s.k.cmd("bp-set [code/main.c]:12", 1500);
    await s.k.cmd("debug", 15000);
    check(!!(await s.waitPaused(30000)), "debug: a breakpoint inside a C function pauses the machine");
    await sleep(2000);
    const text = await s.ideText();
    check(/square/.test(text) && /main/.test(text), "debug: the IDE names the C functions");
    await s.k.ide.screenshot({ path: path.join(s.out, "paused.png") });
    await s.k.close();
  },

  async export() {
    const s = await session("export");
    const folder = await s.project("sp48");
    const tap = path.join(s.out, "main.tap");
    await s.k.cmd(`expc "${tap}" -f tap`, 15000);
    const built = path.join(folder, "_klive", "z88dk", "build", "main.tap");
    check(
      fs.existsSync(tap) && fs.existsSync(built) && Buffer.compare(fs.readFileSync(tap), fs.readFileSync(built)) === 0,
      "export: the TAP is the one z88dk wrote"
    );
    await s.k.close();
  },

  async zx81() {
    const s = await session("zx81");
    await s.project("zx81");
    await s.k.cmd("run", 15000);
    const text = await s.ideText();
    check(/Loading .*main\.P/.test(text), "zx81: Run loads z88dk's .P");
    await sleep(8000);
    await (await s.k.emu()).screenshot({ path: path.join(s.out, "running.png") });
    await s.k.close();
  },

  async setup() {
    const s = await session("setup");
    await s.k.cmd("z88dk-setup", 6000);
    const text = await s.ideText();
    check(/z88dk Integration/i.test(text), "setup: z88dk-setup opens the dialog");
    for (let t = Date.now(); !/Configured in User settings/.test(await s.ideText()) && Date.now() - t < 30000; ) await sleep(500);
    check(/Configured in User settings/.test(await s.ideText()), "setup: the dialog reports the configured installation");
    await s.k.ide.screenshot({ path: path.join(s.out, "dialog.png") });
    await s.k.close();
  },

  async templates(only) {
    const cases = only ? TEMPLATE_CASES.filter((c) => c.id === only) : TEMPLATE_CASES;
    if (!cases.length) throw new Error(`No template case ${only}; the cases are ${TEMPLATE_CASES.map((c) => c.id).join(", ")}`);
    for (const c of cases) await templateCase(c);
  },

  async nosetup() {
    const s = await session("nosetup", { configured: false });
    await s.project("sp48");
    await s.k.cmd("compile", 8000);
    const text = await s.ideText();
    // --- Detection may find ~/z88dk on this machine: then the build simply works
    check(/Set up z88dk\.\.\./.test(text) || /z88dk: \d+ bytes/.test(text), "nosetup: a build without z88dk offers the setup link (or finds one)");
    await s.k.ide.screenshot({ path: path.join(s.out, "output.png") });
    await s.k.close();
  }
};

(async () => {
  if (!fs.existsSync(path.join(ROOT, "lib", "config"))) {
    throw new Error(`No z88dk at ${ROOT}: set Z88DK_ROOT or install it from Klive (z88dk-setup).`);
  }
  const parts = process.argv.slice(2).length ? process.argv.slice(2) : ["run", "debug", "export", "zx81", "setup"];
  for (const arg of parts) {
    // --- `part:argument` (`templates:zxnext`) passes the argument to the part
    const [part, argument] = arg.split(":");
    if (!PARTS[part]) throw new Error(`Unknown part ${part}`);
    await PARTS[part](argument);
  }
  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} passed; screenshots in ${OUT}`);
  process.exit(failed.length ? 1 : 0);
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
