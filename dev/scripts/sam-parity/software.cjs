/**
 * Phase 7 of dev/plans/SAM_SIMCOUPE_PARITY_PLAN.md: third-party SAM software side by side in Klive and SimCoupé,
 * for confidence (never a fixture, never CI, never committed). Developer tool.
 *
 *   node dev/scripts/sam-parity/software.cjs [--app <SimCoupe.app>] [--dir <folder>]
 *
 * The disks: every .mgt, .dsk, .sad, .sbt or .gz in the folder (default .local/sam-parity/software/); a .zip is
 * unpacked into it first. A disk whose name contains "extmem" gets a 1 MB external pack in both. Each disk
 * boots in Klive as Run boots a disk (test/sam-hw/parity/software.test.ts) and in SimCoupé with BASIC's BOOT,
 * both with the oracle's settings (oracle.cjs), and both are pictured every 5 s for a minute. SimCoupé's
 * disk is untimed, so the two rarely reach a screen at the same moment: the sheet is read by eye.
 *
 * Output: .local/sam-parity/software/runs/<time>/index.html (and runs/latest).
 */
const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const { REPO_ROOT } = require("../repo-root.cjs");
const { findApp, runSimCoupe } = require("./oracle.cjs");

const DISK = /\.(mgt|dsk|sad|sbt|gz)$/i;
const SHOTS = 12;
const EVERY = 5;

function parseArgs(argv) {
  const opts = { app: process.env.SIMCOUPE_APP, dir: path.join(REPO_ROOT, ".local", "sam-parity", "software") };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--app") opts.app = argv[++i];
    else if (argv[i] === "--dir") opts.dir = path.resolve(argv[++i]);
  }
  return opts;
}

(async () => {
  const opts = parseArgs(process.argv.slice(2));
  const binary = findApp(opts.app);
  // --- Zips unpacked (their disk images only, flat) into the folder
  for (const zip of fs.readdirSync(opts.dir).filter((f) => /\.zip$/i.test(f))) {
    spawnSync("unzip", ["-o", "-j", "-qq", path.join(opts.dir, zip), "*.mgt", "*.MGT", "*.dsk", "*.DSK", "*.sad", "*.SAD", "*.gz", "-d", opts.dir]);
  }
  const disks = fs.readdirSync(opts.dir).filter((f) => DISK.test(f)).sort();
  if (!disks.length) {
    console.error(`No disk images in ${opts.dir} (.mgt, .dsk, .sad, .sbt, .gz or a .zip of them)`);
    process.exit(1);
  }
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const runDir = path.join(opts.dir, "runs", stamp);
  fs.mkdirSync(runDir, { recursive: true });

  console.log(`Klive: ${disks.length} disk(s) ...`);
  const klive = spawnSync("node", ["dev/scripts/run-tests.cjs", "test/sam-hw/parity/software.test.ts"], {
    cwd: REPO_ROOT,
    env: { ...process.env, SAM_SOFTWARE_DIR: opts.dir, SAM_SOFTWARE_OUT: runDir },
    encoding: "utf8"
  });
  fs.writeFileSync(path.join(runDir, "klive-tests.log"), `${klive.stdout}\n${klive.stderr}`);

  for (const disk of disks) {
    const dir = path.join(runDir, disk);
    fs.mkdirSync(dir, { recursive: true });
    // --- A copy, so that a disk the software writes to stays as downloaded
    const copy = path.join(dir, `simcoupe${path.extname(disk)}`);
    fs.copyFileSync(path.join(opts.dir, disk), copy);
    console.log(`SimCoupé: ${disk} ...`);
    const overrides = /extmem/i.test(disk) ? { externalmem: 1 } : {};
    await runSimCoupe(binary, copy, dir, SHOTS * EVERY + 2, overrides, undefined, "BOOT\\n", false, undefined, {
      every: EVERY,
      prefix: path.join(dir, "simcoupe-")
    });
  }

  // --- The sheet: per disk, a row every 5 s
  const img = (file, style) => (fs.existsSync(file) ? `<img src="${path.relative(runDir, file)}" style="${style}">` : "<em>none</em>");
  const parts = [
    "<!doctype html><meta charset=utf-8><title>SAM software side by side</title>",
    "<style>body{font:14px system-ui;margin:16px;background:#fff;color:#111}td{vertical-align:top;padding:4px}h2{margin-top:32px}" +
      "@media (prefers-color-scheme:dark){body{background:#111;color:#eee}}</style>",
    "<h1>SAM software side by side</h1>",
    `<p>Klive (left, 640 x 288 shown at 2:1) and SimCoupé 1.2.17 (right, its window) every ${EVERY} s after the boot. ` +
      "SimCoupé's disk is untimed, so the same screen may come at different times.</p>"
  ];
  for (const disk of disks) {
    const dir = path.join(runDir, disk);
    parts.push(`<h2>${disk}</h2><table>`);
    for (let shot = 1; shot <= SHOTS; shot++) {
      const t = String(shot * EVERY).padStart(3, "0");
      parts.push(
        `<tr><td>${shot * EVERY} s</td><td>${img(path.join(dir, `klive-${t}.png`), "width:480px;height:432px;image-rendering:pixelated")}</td>` +
          `<td>${img(path.join(dir, `simcoupe-${t}.png`), "width:480px")}</td></tr>`
      );
    }
    parts.push("</table>");
  }
  fs.writeFileSync(path.join(runDir, "index.html"), parts.join("\n"));
  const latest = path.join(opts.dir, "runs", "latest");
  fs.rmSync(latest, { force: true, recursive: true });
  fs.symlinkSync(runDir, latest);
  console.log(`Sheet: ${path.relative(REPO_ROOT, path.join(runDir, "index.html"))}`);
})();
