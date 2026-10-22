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
 *
 *   npx electron-vite build --config build/electron.vite.config.ts
 *   node scripts/z88dk-ide-check.cjs [run|debug|export|zx81|setup|nosetup ...]
 *
 * z88dk comes from Z88DK_ROOT, else ~/z88dk (v2.4 or newer). Screenshots and the throwaway homes go
 * to `.z88dk-ide-check/` (git-ignored). Local only: it needs a z88dk installation.
 */
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { launchKlive } = require("./doc-shots/harness.cjs");

const ROOT = process.env.Z88DK_ROOT || path.join(os.homedir(), "z88dk");
const OUT = path.join(__dirname, "..", ".z88dk-ide-check");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function session(name, { configured = true } = {}) {
  const out = path.join(OUT, name);
  fs.rmSync(out, { recursive: true, force: true });
  const projects = path.join(out, "projects");
  const userHome = path.join(out, "home");
  fs.mkdirSync(projects, { recursive: true });
  fs.mkdirSync(path.join(userHome, "Klive"), { recursive: true });
  const k = await launchKlive({
    home: path.join(out, "klive"),
    userHome,
    userSettings: configured ? { z88dk: { root: ROOT } } : {}
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
