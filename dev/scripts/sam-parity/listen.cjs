/**
 * Plays the SAM Coupé SAA 1099 listening demo in a real Klive, with nothing to type
 * (`dev/plans/SAM_SIMCOUPE_PARITY_PLAN.md`, Phase 6).
 *
 * Starts the built Klive with `--automation` and an isolated settings file, home and user data (in
 * `.local/sam-parity/listen/`, so the developer's own Klive and settings are never touched), creates a
 * SAM Coupé 512K project through the `klive ide` command line, puts `probes/sound-demo.kz80.asm` in it
 * as the build root and Runs it. The demo loops until Klive is closed or this script gets Ctrl+C.
 *
 *   node dev/scripts/sam-parity/listen.cjs              # builds out/ first
 *   node dev/scripts/sam-parity/listen.cjs --no-build   # out/ is already current
 *   node dev/scripts/sam-parity/listen.cjs --asm <file> # another .kz80.asm instead of the demo
 */
const fs = require("fs");
const path = require("path");
const { spawn, spawnSync } = require("child_process");

const { REPO_ROOT } = require("../repo-root.cjs");
const REPO = REPO_ROOT;
const ELECTRON = require(path.join(REPO, "node_modules", "electron"));
const MAIN = path.join(REPO, "out", "main", "index.js");
const CLI = path.join(REPO, "out", "main", "cli.js");

const args = process.argv.slice(2);
const noBuild = args.includes("--no-build");
const asmIndex = args.indexOf("--asm");
const asmFile = asmIndex >= 0 ? path.resolve(args[asmIndex + 1]) : path.join(__dirname, "probes", "sound-demo.kz80.asm");

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  if (!fs.existsSync(asmFile)) {
    console.error(`No program at ${asmFile}`);
    process.exit(1);
  }
  if (!noBuild) {
    console.log("Building the SAM core and the app (pass --no-build to skip) ...");
    for (const cmd of [
      ["node", ["dev/scripts/build-sam-wasm.cjs"]],
      ["npx", ["electron-vite", "build", "--config", "build/electron.vite.config.ts"]]
    ]) {
      const r = spawnSync(cmd[0], cmd[1], { cwd: REPO, stdio: "inherit" });
      if (r.status !== 0) process.exit(r.status ?? 1);
    }
  }
  for (const file of [MAIN, CLI]) {
    if (!fs.existsSync(file)) {
      console.error(`No build at ${file}: run without --no-build.`);
      process.exit(1);
    }
  }

  // --- An isolated Klive: its own settings, home and user data, recreated each run
  const work = path.join(REPO, ".local", "sam-parity", "listen");
  fs.rmSync(work, { recursive: true, force: true });
  const home = path.join(work, "home");
  const userHome = path.join(work, "user");
  fs.mkdirSync(home, { recursive: true });
  fs.mkdirSync(path.join(userHome, "Klive"), { recursive: true });
  const settingsFile = path.join(home, "klive.settings");
  fs.writeFileSync(
    settingsFile,
    JSON.stringify({
      startScreenDisplayed: true,
      borielSetup: { declined: true, offeredVersion: "*" },
      windowStates: { showIdeOnStartup: true },
      // --- `full`: creating and opening a project goes through ide.command
      userSettings: { automation: { level: "full" } }
    })
  );
  const connectionFile = path.join(home, "run", "automation.json");
  const env = { ...process.env, KLIVE_SETTINGS_FILE: settingsFile, HOME: userHome };
  delete env.ELECTRON_RUN_AS_NODE;

  const klive = (cliArgs) => {
    const r = spawnSync(ELECTRON, [CLI, "ide", ...cliArgs], {
      env: { ...env, ELECTRON_RUN_AS_NODE: "1" },
      cwd: work,
      encoding: "utf8",
      timeout: 180_000
    });
    return { code: r.status, out: (r.stdout || "").trim(), err: (r.stderr || "").trim() };
  };
  const must = (result, what) => {
    if (result.code !== 0) {
      console.error(`${what} failed (exit ${result.code})\n${result.out}\n${result.err}`);
      stop(1);
    }
    return result;
  };

  const app = spawn(ELECTRON, [MAIN, "--automation", `--user-data-dir=${path.join(work, "userdata")}`], {
    env,
    cwd: REPO,
    stdio: process.env.SAM_LISTEN_VERBOSE ? "inherit" : "ignore"
  });
  let appExited = false;
  const stop = (code) => {
    if (!appExited) app.kill();
    process.exit(code);
  };
  app.on("exit", () => {
    appExited = true;
    console.log("Klive closed.");
    process.exit(0);
  });
  process.on("SIGINT", () => stop(0));

  console.log("Starting Klive ...");
  const deadline = Date.now() + 90_000;
  while (!fs.existsSync(connectionFile) && Date.now() < deadline && !appExited) await sleep(250);
  if (!fs.existsSync(connectionFile)) {
    console.error("Klive did not start its automation server (set SAM_LISTEN_VERBOSE=1 to see its output).");
    stop(1);
  }
  must(klive(["--timeout", "90", "status"]), "status");

  const projects = path.join(work, "projects");
  fs.mkdirSync(projects, { recursive: true });
  must(klive(["--timeout", "90", "cmd", `newp sam:sam512 sound-demo default -p "${projects}"`]), "newp");
  const folder = path.join(projects, "sound-demo");
  must(klive(["--timeout", "90", "rpc", "project.open", JSON.stringify({ folder })]), "project.open");
  fs.copyFileSync(asmFile, path.join(folder, "code", "code.kz80.asm"));

  const built = klive(["build"]);
  if (built.code !== 0) {
    console.error(`The program does not build:\n${built.err || built.out}`);
    stop(1);
  }
  must(klive(["--timeout", "90", "run"]), "run");
  console.log(
    [
      "Playing, with the border showing the part:",
      "  1 blue     tone, middle C on channel 0",
      "  2 red      envelope alone (repeating triangle) on channel 2",
      "  3 magenta  the same envelope gated by channel 2's tone",
      "  4 green    noise at 31.25, 15.6, 7.8 kHz",
      "  5 cyan     plucked notes (single-decay envelope, retriggered)",
      "  6 yellow   stereo: left, right, then a mirrored envelope",
      "  black      a pause, then it loops",
      "Close Klive or press Ctrl+C to stop."
    ].join("\n")
  );
})();
