/**
 * The automation server and the `klive ide` command line against the real app
 * (`.plans/COMMAND_LINE_AUTOMATION_PLAN.md` Phase 3–5 exit criteria).
 *
 * Starts the built Klive with `--automation --noide` and an isolated `KLIVE_SETTINGS_FILE` (so it
 * never touches, or answers for, the developer's own Klive: T6), then drives it only through the
 * built CLI (`out/main/cli.js` on Klive's own Electron binary in Node mode):
 *
 * - `project.open` and `newp` through `ide.command` create and open a ZX Spectrum 128 project;
 * - a build with an error exits 2 and prints `file:line:col: error: ...`; the fixed build exits 0;
 * - a breakpoint with a condition, `debug`, then `wait` stops at the breakpoint;
 * - registers, memory by address and by partition (`B0:$0000` is `$C000`), `poke`, a screenshot;
 * - `wait` resolves on Stop (T9); a denied command (T5); a wrong token and a level that is too low
 *   exit 3; quitting deletes the connection file, and a file left by a dead process is stale.
 *
 * Exits 1 on failure.
 *
 *   npx electron-vite build --config build/electron.vite.config.ts   # out/ must be current
 *   xvfb-run -a node scripts/automation-ide-check.cjs                 # (xvfb-run only without a display)
 */
const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawn, spawnSync } = require("child_process");

const REPO = path.join(__dirname, "..");
const ELECTRON = require(path.join(REPO, "node_modules", "electron"));
const MAIN = path.join(REPO, "out", "main", "index.js");
const CLI = path.join(REPO, "out", "main", "cli.js");

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  for (const file of [MAIN, CLI]) {
    if (!fs.existsSync(file)) {
      console.error(`No build at ${file}: run 'npx electron-vite build --config build/electron.vite.config.ts' first.`);
      process.exit(1);
    }
  }
  const work = fs.mkdtempSync(path.join(os.tmpdir(), "automation-ide-"));
  const home = path.join(work, "home");
  const userHome = path.join(work, "user");
  fs.mkdirSync(home, { recursive: true });
  fs.mkdirSync(path.join(userHome, "Klive"), { recursive: true });
  const settingsFile = path.join(home, "klive.settings");
  fs.writeFileSync(
    settingsFile,
    JSON.stringify({
      startScreenDisplayed: true,
      windowStates: { showIdeOnStartup: false },
      // --- `full`, so the check can create a project through ide.command; lowered at the end
      userSettings: { automation: { level: "full" } }
    })
  );
  const connectionFile = path.join(home, "run", "automation.json");
  const env = { ...process.env, KLIVE_SETTINGS_FILE: settingsFile, HOME: userHome };
  delete env.ELECTRON_RUN_AS_NODE;

  const failures = [];
  const check = (ok, what) => {
    console.log(`${ok ? "ok  " : "FAIL"} ${what}`);
    if (!ok) failures.push(what);
  };

  /** Runs the built CLI; returns its exit code and output */
  const klive = (args, extraEnv = {}) => {
    const r = spawnSync(ELECTRON, [CLI, "ide", ...args], {
      env: { ...env, ...extraEnv, ELECTRON_RUN_AS_NODE: "1" },
      cwd: work,
      encoding: "utf8",
      timeout: 120_000
    });
    return { code: r.status, out: r.stdout.trim(), err: r.stderr.trim() };
  };
  const kliveAsync = (args) =>
    new Promise((resolve) => {
      const child = spawn(ELECTRON, [CLI, "ide", ...args], { env: { ...env, ELECTRON_RUN_AS_NODE: "1" }, cwd: work });
      let out = "";
      let err = "";
      child.stdout.on("data", (d) => (out += d));
      child.stderr.on("data", (d) => (err += d));
      child.on("exit", (code) => resolve({ code, out: out.trim(), err: err.trim() }));
    });

  // --- Isolated userData too, so a developer's running Klive does not hold the single-instance lock
  const app = spawn(ELECTRON, [MAIN, "--automation", "--noide", `--user-data-dir=${path.join(work, "userdata")}`], {
    env,
    cwd: REPO,
    stdio: process.env.AUTOMATION_IDE_VERBOSE ? "inherit" : "ignore"
  });
  let appExited = false;
  app.on("exit", () => (appExited = true));

  try {
    // --- The connection file appears beside the isolated settings file (T6)
    let deadline = Date.now() + 60_000;
    while (!fs.existsSync(connectionFile) && Date.now() < deadline && !appExited) await sleep(250);
    check(fs.existsSync(connectionFile), `the connection file appeared at ${connectionFile}`);
    if (process.platform !== "win32") {
      check((fs.statSync(connectionFile).mode & 0o777) === 0o600, "the connection file is 0600");
    }

    let status = klive(["status"]);
    check(status.code === 0, `status answers (${status.out.split("\n")[0]})`);

    // --- Create and open a 128K project (ide.command and project.open need the full level)
    const projects = path.join(work, "projects");
    fs.mkdirSync(projects, { recursive: true });
    const created = klive(["--timeout", "60", "cmd", `newp sp128 autocheck default -p "${projects}"`]);
    check(created.code === 0, `newp through ide.command (exit ${created.code})`);
    const folder = path.join(projects, "autocheck");
    const opened = klive(["--timeout", "60", "rpc", "project.open", JSON.stringify({ folder })]);
    check(opened.code === 0 && JSON.parse(opened.out).isKliveProject === true, "project.open opened it");
    const root = path.join(folder, "code", "code.kz80.asm");
    check(fs.existsSync(root), "the project has its build root");

    // --- A build with an error: exit 2, gcc-format diagnostics
    fs.writeFileSync(root, ["  .org $8000", "start:", "  ld a,5", "  ld a,nosuchsymbol", ""].join("\n"));
    let build = klive(["build"]);
    check(build.code === 2, `a build with an error exits 2 (exit ${build.code})`);
    check(/code\.kz80\.asm:4:\d+: error: /.test(build.err), `the error prints as file:line:col (${build.err.split("\n")[0]})`);
    const json = klive(["--json", "build"]);
    const parsed = JSON.parse(json.out);
    check(parsed.success === false && parsed.errors.length === 1 && parsed.errors[0].line === 4, "build --json returns the structured error");

    // --- The fixed program: $8000 ld a,5 / $8002 ld hl,$C000 / $8005 ld (hl),a / $8006 loop
    fs.writeFileSync(
      root,
      ["  .org $8000", "start:", "  ld a,5", "  ld hl,$C000", "  ld (hl),a", "loop:", "  inc a", "  jr loop", ""].join("\n")
    );
    build = klive(["build"]);
    check(build.code === 0, `the fixed build exits 0 (exit ${build.code}; ${build.err})`);

    // --- A breakpoint with a condition, debug, wait
    const bp = klive(["bp", "set", "$8006", "-if", "A", "==", "5"]);
    check(bp.code === 0, `bp set with a condition (${bp.out || bp.err})`);
    const list = klive(["--json", "bp", "list"]);
    const bps = JSON.parse(list.out).breakpoints;
    check(bps.some((b) => b.address === 0x8006 && b.condition === "A == 5"), "bp list shows it with its condition");
    const debugStarted = Date.now();
    const debug = klive(["--timeout", "90", "debug"]);
    if (process.env.AUTOMATION_IDE_VERBOSE_TIMES) console.log(`     debug took ${Date.now() - debugStarted} ms`);
    check(debug.code === 0, `debug runs the project (exit ${debug.code}; ${debug.err})`);
    const waited = klive(["--timeout", "60", "wait"]);
    check(waited.code === 0 && /paused at \$8006/.test(waited.out), `wait stops at the breakpoint (${waited.out || waited.err})`);
    check(/exec breakpoint/.test(waited.out), "wait names the breakpoint");

    // --- Registers and memory
    const regs = JSON.parse(klive(["--json", "regs"]).out);
    check(regs.a === 5 && regs.pc === 0x8006, `regs: A=${regs.a}, PC=${regs.pc?.toString(16)}`);
    const viaAddress = JSON.parse(klive(["--json", "mem", "$C000", "1"]).out).bytes[0];
    check(viaAddress === 5, `the program wrote A to $C000 (${viaAddress})`);
    // --- Bank 5 is always at $4000 on the 128K: the same bytes by address and by partition (T8)
    const poke = klive(["poke", "B5:$0010", "1", "2", "3"]);
    const byAddress = JSON.parse(klive(["--json", "mem", "$4010", "3"]).out).bytes;
    const byBank = JSON.parse(klive(["--json", "mem", "B5:$0010", "3"]).out).bytes;
    check(
      poke.code === 0 && byAddress.join(",") === "1,2,3" && byBank.join(",") === "1,2,3",
      `poke by partition, read back by address ($4010: ${byAddress}) and by partition (B5:$0010: ${byBank}) (T8)`
    );
    const shot = klive(["screenshot", "shot.png"]);
    const png = fs.existsSync(path.join(work, "shot.png")) ? fs.readFileSync(path.join(work, "shot.png")) : Buffer.alloc(0);
    check(shot.code === 0 && png.subarray(1, 4).toString("ascii") === "PNG", `screenshot writes a PNG (${shot.out})`);
    const step = klive(["step"]);
    check(step.code === 0 && /paused at \$8007/.test(step.out), `step into (${step.out})`);

    // --- A denied command (T5): refused, and Klive is still there
    const exit = klive(["cmd", "exit"]);
    check(exit.code === 3 && /cannot be run through automation/.test(exit.err), "'exit' is refused through automation");
    check(klive(["status"]).code === 0, "Klive still answers after the refusal");

    // --- wait resolves on Stop (T9)
    klive(["bp", "clear"]);
    klive(["start"]);
    const waiting = kliveAsync(["wait", "--timeout", "30"]);
    await sleep(1500);
    const stop = klive(["stop"]);
    const stopped = await waiting;
    check(stop.code === 0 && stopped.code === 0 && /^stopped/.test(stopped.out), `wait resolves on Stop (${stopped.out || stopped.err})`);

    // --- A wrong token: exit 3
    const info = JSON.parse(fs.readFileSync(connectionFile, "utf8"));
    const forged = path.join(work, "forged.json");
    fs.writeFileSync(forged, JSON.stringify({ ...info, token: "0".repeat(64) }));
    const wrong = klive(["status"], { KLIVE_AUTOMATION_FILE: forged });
    check(wrong.code === 3 && /token/i.test(wrong.err), `a wrong token is rejected with exit 3 (${wrong.err})`);

    // --- A level that is too low: exit 3, naming the setting
    klive(["cmd", "set -u automation.level read"]);
    await sleep(500);
    const low = klive(["start"]);
    check(low.code === 3 && /automation\.level/.test(low.err), "a level that is too low exits 3 and names the setting");
    check(klive(["regs"]).code === 0, "the read level still reads");

    // --- Quit: the connection file goes with the process
    app.kill("SIGTERM");
    deadline = Date.now() + 20_000;
    while (!appExited && Date.now() < deadline) await sleep(250);
    check(appExited, "Klive quit");
    const left = fs.existsSync(connectionFile);
    check(!left, "quitting deleted the connection file");
    if (left) {
      const stale = klive(["status"]);
      check(stale.code === 3 && /no longer running/.test(stale.err), "a file left by a dead process is reported stale");
    }
  } catch (err) {
    failures.push(String(err?.stack ?? err));
    console.error(err);
  } finally {
    if (!appExited) app.kill("SIGKILL");
    if (!process.env.AUTOMATION_IDE_KEEP) fs.rmSync(work, { recursive: true, force: true });
  }
  console.log(failures.length ? `\n${failures.length} check(s) failed.` : "\nAll checks passed.");
  process.exit(failures.length ? 1 : 0);
})();
