/**
 * The SAM Coupé parity oracle run (dev/plans/SAM_SIMCOUPE_PARITY_PLAN.md §2). Developer tool, never CI.
 *
 * 1. Runs the parity probes in Klive (test/sam-hw/parity/parity.test.ts with SAM_PARITY_OUT), which writes
 *    each probe's boot disk, Klive's written-back disk and Klive's records.
 * 2. Boots each probe disk in SimCoupé (decision D1: run, never read) with fixed fidelity settings and an
 *    isolated HOME, so the developer's own SimCoupé settings are never touched. BASIC's BOOT (-keyin)
 *    starts it; no keystrokes are ever sent to the desktop. After a fixed time the script sends SIGTERM to
 *    the process it started, which saves the disk image.
 * 3. Decodes both result blocks and writes `report.md` and `report.json` in the run folder.
 *
 *   node dev/scripts/sam-parity/oracle.cjs [probe...] [--app <SimCoupe.app>] [--seconds <n>]
 *
 * The app: --app, else SIMCOUPE_APP, else /Applications/SimCoupe.app or ~/Applications/SimCoupe.app. A
 * mounted disk image works too (hdiutil attach -nobrowse -readonly SimCoupe-1.2.17-macos.dmg).
 * Output: .local/sam-parity/runs/<timestamp>/ (the newest is also .local/sam-parity/runs/latest).
 *
 * A probe marked "@tape <name>" needs the developer: SimCoupé takes no tape on the command line and ignores
 * dropped files on macOS, so the script asks for the tape (`.local/sam-parity/tapes/<name>.tzx`) to be inserted through
 * SimCoupé's tape browser (F3), then waits for the probe's green border instead of a fixed time. A probe marked
 * "@sound" turns SimCoupé's sound on and records it from a loopback device (`AUDIO_DEVICE`) with ffmpeg; the
 * report measures both recordings (sound.cjs).
 */
const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawn, spawnSync } = require("child_process");

const { REPO_ROOT } = require("../repo-root.cjs");
const { RESULT_OFFSET, readResultRecords } = require("./result-block.cjs");
const { comparePictures, compareFull } = require("./picture.cjs");
const { sadToMgt, edskToMgt } = require("./disk-formats.cjs");
const { measure: measureSound } = require("./sound.cjs");
const sharp = require(path.join(REPO_ROOT, "node_modules", "sharp"));

const ROM = path.join(REPO_ROOT, "src", "public", "roms", "sam-rom30.rom");

/**
 * SimCoupé's settings for every run (its bundled Manual.md, "Command-line Options"). The fidelity ones:
 * no fast reset (the real memory test), no fast disk or tape, no tape traps, no DOS substitution, the
 * ASIC start-up delay as on a real machine, NMOS Z80, 512K, no external memory, no DAC or SID add-on (SimCoupé
 * fits a Blue Alpha sampler on ports 7Ch-7Fh by default). The rest make the window
 * comparable with Klive's picture and keep the run quiet.
 */
const SIMCOUPE_SETTINGS = {
  rom: ROM,
  externalmem: 0,
  cmosz80: 0,
  asicdelay: 1,
  fastreset: 0,
  turbodisk: 0,
  turbotape: 0,
  tapetraps: 0,
  dosboot: 0,
  autoload: 0,
  drive1: 1,
  drive2: 0,
  sound: 0,
  status: 0,
  drivelights: 0,
  profile: 0,
  scale: 2,
  visiblearea: 3,
  tvaspect: 0,
  filter: 0,
  mouse: 0,
  // --- No add-ons a real SAM lacks: the Blue Alpha sampler on ports 7Ch-7Fh, the SID interface
  dac7c: 0,
  sid: 0
};

/**
 * The loopback device a "@sound" probe records SimCoupé from (SAM_PARITY_AUDIO_DEVICE, else BlackHole 2ch): the
 * system's sound output must reach it (a Multi-Output Device with the speakers and BlackHole), since SimCoupé
 * plays to the default output
 */
const AUDIO_DEVICE = process.env.SAM_PARITY_AUDIO_DEVICE || "BlackHole 2ch";

/** Starts recording the loopback device to `file` (48 kHz stereo); returns a function that stops it */
function startRecording(file) {
  const rec = spawn(
    "ffmpeg",
    ["-hide_banner", "-loglevel", "error", "-y", "-f", "avfoundation", "-i", `:${AUDIO_DEVICE}`, "-ac", "2", "-ar", "48000", file],
    { stdio: ["ignore", "ignore", "inherit"] }
  );
  let done = false;
  rec.on("exit", () => (done = true));
  return async () => {
    if (!done) rec.kill("SIGINT");
    const deadline = Date.now() + 5000;
    while (!done && Date.now() < deadline) await sleep(100);
    if (!done) rec.kill("SIGKILL");
  };
}

/** How long a tape probe may take, the tape browser included */
const TAPE_SECONDS = 300;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function parseArgs(argv) {
  const opts = { probes: [], app: process.env.SIMCOUPE_APP, seconds: 12 };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--app") opts.app = argv[++i];
    else if (argv[i] === "--seconds") opts.seconds = Number(argv[++i]);
    else opts.probes.push(argv[i]);
  }
  return opts;
}

function findApp(given) {
  const candidates = given
    ? [given]
    : ["/Applications/SimCoupe.app", path.join(os.homedir(), "Applications", "SimCoupe.app")];
  for (const app of candidates) {
    const binary = app.endsWith(".app") ? path.join(app, "Contents", "MacOS", "SimCoupe") : app;
    if (fs.existsSync(binary)) return binary;
  }
  console.error(
    `SimCoupé not found (${candidates.join(", ")}). Pass --app <path to SimCoupe.app> or set SIMCOUPE_APP; ` +
      "a mounted SimCoupe-1.2.17-macos.dmg works."
  );
  process.exit(3);
}

/** The window of process `pid` grabbed to `file` (screencapture -l), or false */
function captureWindow(pid, file) {
  const id = spawnSync("swift", [path.join(__dirname, "window-id.swift"), String(pid)], { encoding: "utf8" });
  const windowId = Number((id.stdout || "").trim());
  if (!(windowId > 0)) return false;
  return spawnSync("screencapture", ["-x", "-o", "-l", String(windowId), file]).status === 0;
}

/**
 * Whether the window of process `pid` shows the frame's green end border: five points down the left border,
 * all green (the ROM's LOAD flashes the border, so one point could be green by chance)
 */
async function showsGreenBorder(pid, file) {
  if (!captureWindow(pid, file)) return false;
  const { data, info } = await sharp(file).raw().toBuffer({ resolveWithObject: true });
  const x = Math.round(info.width * 0.02);
  for (const f of [0.2, 0.35, 0.5, 0.65, 0.8]) {
    const at = (Math.round(info.height * f) * info.width + x) * info.channels;
    const [r, g, b] = [data[at], data[at + 1], data[at + 2]];
    if (!(g > 100 && r < 80 && b < 80)) return false;
  }
  return true;
}

/**
 * Boots `disk` in SimCoupé for `seconds`, then SIGTERM (which saves the image); with `picture`, its window
 * is grabbed to that file first
 */
async function runSimCoupe(binary, disk, workDir, seconds, overrides = {}, picture = undefined, keyin = "BOOT\\n", untilGreen = false, record = undefined, shots = undefined) {
  const home = path.join(workDir, "simcoupe-home");
  fs.rmSync(home, { recursive: true, force: true });
  fs.mkdirSync(home, { recursive: true });
  // --- Settings that only the config file takes: SimCoupé 1.2.17 ignores the documented -mainmemory (the
  // --- config key is "mainmem"; checked by the screen page the ROM chooses)
  const { cfg = {}, ...cli } = overrides;
  if (Object.keys(cfg).length) {
    const prefs = path.join(home, "Library", "Preferences", "SimCoupe");
    fs.mkdirSync(prefs, { recursive: true });
    fs.writeFileSync(path.join(prefs, "SimCoupe.cfg"), Object.entries(cfg).map(([k, v]) => `${k}=${v}\n`).join(""));
  }
  const args = [];
  for (const [key, value] of Object.entries({ ...SIMCOUPE_SETTINGS, ...cli })) args.push(`-${key}`, String(value));
  if (disk) args.push("-disk1", disk);
  if (keyin) args.push("-keyin", keyin);
  const log = fs.openSync(path.join(workDir, "simcoupe.log"), "w");
  const stopRecording = record ? startRecording(record) : undefined;
  const child = spawn(binary, args, { env: { ...process.env, HOME: home }, stdio: ["ignore", log, log] });
  let exited = false;
  child.on("exit", () => (exited = true));
  const started = Date.now();
  const deadline = started + seconds * 1000;
  let greens = 0;
  let shot = 1;
  while (Date.now() < deadline && !exited) {
    await sleep(untilGreen ? 2000 : 250);
    // --- `shots` ({ every, prefix }): the window every `every` seconds, to `<prefix><seconds>.png`
    if (shots && !exited && Date.now() - started >= shot * shots.every * 1000) {
      captureWindow(child.pid, `${shots.prefix}${String(shot * shots.every).padStart(3, "0")}.png`);
      shot++;
    }
    // --- A tape probe ends when the green border has stayed for two looks
    if (untilGreen && !exited) {
      greens = (await showsGreenBorder(child.pid, path.join(workDir, "border.png"))) ? greens + 1 : 0;
      if (greens >= 2) break;
    }
  }
  // --- A sound probe: a second more for the output's latency, then the recording stops
  if (stopRecording) {
    await sleep(1000);
    await stopRecording();
  }
  if (!exited && picture && !captureWindow(child.pid, picture)) console.log("  (could not grab SimCoupé's window)");
  if (!exited) child.kill("SIGTERM");
  const killDeadline = Date.now() + 10_000;
  while (!exited && Date.now() < killDeadline) await sleep(100);
  if (!exited) {
    child.kill("SIGKILL");
    throw new Error("SimCoupé did not exit after SIGTERM");
  }
  fs.closeSync(log);
}

/** The 512-byte sectors (other than the result) where two images differ */
function otherSectorDiffs(a, b) {
  const diffs = [];
  for (let at = 0; at < Math.max(a.length, b.length); at += 512) {
    if (at === RESULT_OFFSET) continue;
    if (!a.subarray(at, at + 512).equals(b.subarray(at, at + 512))) diffs.push(at / 512);
  }
  return diffs;
}

module.exports = { findApp, runSimCoupe, SIMCOUPE_SETTINGS };

if (require.main === module) (async () => {
  const opts = parseArgs(process.argv.slice(2));
  const binary = findApp(opts.app);
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const runDir = path.join(REPO_ROOT, ".local", "sam-parity", "runs", stamp);
  fs.mkdirSync(runDir, { recursive: true });

  // --- 1. Klive
  console.log("Running the probes in Klive ...");
  const env = { ...process.env, SAM_PARITY_OUT: runDir };
  if (opts.probes.length) env.SAM_PARITY_PROBES = opts.probes.join(",");
  const klive = spawnSync("node", ["dev/scripts/run-tests.cjs", "test/sam-hw/parity/parity.test.ts"], {
    cwd: REPO_ROOT,
    env,
    encoding: "utf8"
  });
  fs.writeFileSync(path.join(runDir, "klive-tests.log"), `${klive.stdout}\n${klive.stderr}`);
  if (klive.status !== 0) {
    console.log("  (the pinned-results test failed; the oracle run still compares what Klive wrote)");
  }
  const probes = fs.readdirSync(runDir).filter((d) => fs.existsSync(path.join(runDir, d, "probe.mgt")));
  const wantScreens = !opts.probes.length || opts.probes.includes("screens");
  if (!probes.length) {
    console.error(`Klive produced no probe disks; see ${path.join(runDir, "klive-tests.log")}`);
    process.exit(1);
  }

  // --- The tapes in one place for the tape browser: .local/sam-parity/tapes/
  const tapesDir = path.join(REPO_ROOT, ".local", "sam-parity", "tapes");
  fs.mkdirSync(tapesDir, { recursive: true });
  for (const probe of probes) {
    for (const f of fs.readdirSync(path.join(runDir, probe)).filter((f) => f.endsWith(".tzx"))) {
      fs.copyFileSync(path.join(runDir, probe, f), path.join(tapesDir, f));
    }
  }

  // --- 2. SimCoupé, 3. compare
  const report = { simcoupe: binary, settings: SIMCOUPE_SETTINGS, date: new Date().toISOString(), probes: {} };
  for (const probe of probes.sort()) {
    const dir = path.join(runDir, probe);
    // --- "@image sad" / "@image edsk": SimCoupé gets that file; its written-back image is read as MGT
    const probeSource = fs.readFileSync(path.join(REPO_ROOT, "test", "sam-hw", "parity", "probes", `${probe}.kz80.asm`), "utf8");
    const imageKind = /@image (sad|edsk)/.exec(probeSource)?.[1];
    const ext = imageKind === "sad" ? "sad" : imageKind === "edsk" ? "dsk" : "mgt";
    const disk = path.join(dir, `simcoupe.${ext}`);
    const asMgt = (file) => {
      const bytes = fs.readFileSync(file);
      return imageKind === "sad" ? sadToMgt(bytes) : imageKind === "edsk" ? edskToMgt(bytes) : bytes;
    };
    let sim;
    // --- "@tape <name>": inserted by hand through SimCoupé's tape browser (it takes no tape on the command
    // --- line and ignores dropped files); the run waits for the probe's green border, at most TAPE_SECONDS
    const tapeName = /@tape ([\w-]+)/.exec(probeSource)?.[1];
    const tries = tapeName ? [TAPE_SECONDS] : [opts.seconds, opts.seconds * 2];
    for (const seconds of tries) {
      if (tapeName) {
        console.log(
          `\n  >>> In SimCoupé press F3 (fn+F3 or Cmd+F3), insert\n  >>>   ${path.join(".local", "sam-parity", "tapes", `${tapeName}.tzx`)}\n` +
            "  >>> and close the tape browser. The run goes on when the probe's border turns green.\n"
        );
      }
      fs.copyFileSync(path.join(dir, `probe.${ext}`), disk);
      console.log(`SimCoupé: ${probe} (${seconds} s) ...`);
      // --- The machine flags in the probe's source, as test/sam-hw/parity/parity.ts reads them
      const source = fs.readFileSync(path.join(REPO_ROOT, "test", "sam-hw", "parity", "probes", `${probe}.kz80.asm`), "utf8");
      const overrides = {};
      if (/@extmem/.test(source)) overrides.externalmem = 1;
      if (/@ram256/.test(source)) overrides.cfg = { mainmem: 256 };
      if (/@rom31/.test(source)) overrides.rom = path.join(REPO_ROOT, "src", "public", "roms", "sam-rom31.rom");
      // --- "@disk2" / "@disk2wp": drive 2 with Klive's blank disk (a fresh copy; read-only for wp)
      if (/@disk2/.test(source)) {
        const copy = path.join(dir, "simcoupe-disk2.mgt");
        if (fs.existsSync(copy)) fs.chmodSync(copy, 0o644);
        fs.copyFileSync(path.join(dir, "disk2.mgt"), copy);
        if (/@disk2wp/.test(source)) fs.chmodSync(copy, 0o444);
        overrides.drive2 = 1;
        overrides.disk2 = copy;
      }
      // --- "@sound": SimCoupé's sound on and recorded through the loopback device until the green border
      const sound = /@sound/.test(source);
      if (sound) overrides.sound = 1;
      // --- "@mouse": the mouse interface fitted (Klive's always is)
      if (/@mouse/.test(source)) overrides.mouse = 1;
      // --- "@typed <text>": the line typed before BOOT; "@hold <key>": the key typed over and over after it
      // --- (a letter key, typed in lower case so that no SHIFT comes with it)
      // --- A typed line that boots by itself (LOAD ...: BOOT) gets no BOOT after it
      const typed = /@typed (.*)$/m.exec(source)?.[1];
      const hold = /@hold (\w+)/.exec(source)?.[1];
      const boot = typed?.includes("BOOT") ? "" : "BOOT\\n";
      const keyin = `${typed !== undefined ? `${typed}\\n` : ""}${boot}${hold ? hold.toLowerCase().repeat(400) : ""}`;
      await runSimCoupe(
        binary,
        disk,
        dir,
        seconds,
        overrides,
        /@picture/.test(source) ? path.join(dir, "simcoupe.png") : undefined,
        keyin,
        !!tapeName || sound,
        sound ? path.join(dir, "simcoupe.wav") : undefined
      );
      sim = readResultRecords(asMgt(disk));
      if (sim) break;
    }
    const kliveImage = fs.readFileSync(path.join(dir, "klive.mgt"));
    const kl = readResultRecords(kliveImage);
    const names = [...new Set([...Object.keys(kl ?? {}), ...Object.keys(sim ?? {})])];
    const rows = names.map((name) => ({
      name,
      klive: kl?.[name],
      simcoupe: sim?.[name],
      same: kl?.[name] === sim?.[name]
    }));
    // --- A picture probe: the white runs of both pictures
    let picture;
    let pictureFull;
    if (fs.existsSync(path.join(dir, "klive.png")) && fs.existsSync(path.join(dir, "simcoupe.png"))) {
      picture = (await comparePictures(path.join(dir, "klive.png"), path.join(dir, "simcoupe.png"))).filter(
        (l) => l.klive && l.simcoupe
      );
      const full = await compareFull(path.join(dir, "klive.png"), path.join(dir, "simcoupe.png"), path.join(dir, "diff.png"));
      pictureFull = { differing: full.differing, merged: full.merged, rows: full.rows.slice(0, 20), colours: full.mapping.length };
    }
    // --- A sound probe: both recordings measured (sound.cjs)
    let soundResult;
    if (fs.existsSync(path.join(dir, "klive.wav")) && fs.existsSync(path.join(dir, "simcoupe.wav"))) {
      try {
        soundResult = { klive: measureSound(path.join(dir, "klive.wav")), simcoupe: measureSound(path.join(dir, "simcoupe.wav")) };
      } catch (e) {
        soundResult = { error: String(e.message || e) };
      }
    }
    report.probes[probe] = {
      sound: soundResult,
      picture,
      pictureFull,
      simcoupeWrote: !!sim,
      rows,
      otherSectorDiffs: sim ? otherSectorDiffs(kliveImage, asMgt(disk)) : []
    };
  }

  // --- The boot screens: no disk, the copyright screen as it stays, SAM BASIC after a space typed with
  // --- -keyin; Klive's are written by parity.test.ts ("SAM boot screens for the oracle")
  if (wantScreens && fs.existsSync(path.join(runDir, "screens"))) {
    report.screens = {};
    const dir = path.join(runDir, "screens");
    for (const rom of ["30", "31"]) {
      for (const [screen, keyin] of [["copyright", ""], ["basic", " "]]) {
        const name = `${rom}-${screen}`;
        console.log(`SimCoupé: the ${screen} screen of ROM ${rom} ...`);
        const work = path.join(dir, name);
        fs.mkdirSync(work, { recursive: true });
        const overrides = { rom: path.join(REPO_ROOT, "src", "public", "roms", `sam-rom${rom}.rom`) };
        await runSimCoupe(binary, null, work, 10, overrides, path.join(dir, `${name}-simcoupe.png`), keyin);
        const full = await compareFull(path.join(dir, `${name}-klive.png`), path.join(dir, `${name}-simcoupe.png`), path.join(dir, `${name}-diff.png`));
        report.screens[name] = { differing: full.differing, merged: full.merged, rows: full.rows.slice(0, 20) };
      }
    }
  }

  // --- The report
  const hex = (v) => (v === undefined ? "-" : `${v} ($${v.toString(16).toUpperCase()})`);
  const lines = [
    `# SAM parity oracle run, ${report.date}`,
    "",
    `SimCoupé: \`${binary}\``,
    "",
    `Settings: ${Object.entries(SIMCOUPE_SETTINGS)
      .map(([k, v]) => `-${k} ${k === "rom" ? path.relative(REPO_ROOT, String(v)) : v}`)
      .join(" ")}`,
    ""
  ];
  let differences = 0;
  for (const [probe, r] of Object.entries(report.probes)) {
    lines.push(`## ${probe}`, "");
    if (!r.simcoupeWrote) {
      lines.push("SimCoupé wrote no result block (see simcoupe.log; try --seconds).", "");
      differences++;
      continue;
    }
    lines.push("| Record | Klive | SimCoupé | |", "|---|---|---|---|");
    for (const row of r.rows) {
      if (!row.same) differences++;
      lines.push(`| ${row.name} | ${hex(row.klive)} | ${hex(row.simcoupe)} | ${row.same ? "same" : "**differs**"} |`);
    }
    if (r.otherSectorDiffs.length) lines.push("", `Other sectors that differ: ${r.otherSectorDiffs.join(", ")}`);
    if (r.pictureFull) {
      const f = r.pictureFull;
      if (f.differing || f.merged.length) differences++;
      lines.push(
        "",
        `Whole picture: ${f.differing} pixels differ, ${f.merged.length} colour pairs merged (${f.colours} colours mapped; diff.png)` +
          f.rows.map((x) => `; row ${x.row}: x ${x.first}-${x.last}`).join("")
      );
    }
    if (r.sound) {
      if (r.sound.error) lines.push("", `Sound: ${r.sound.error}`);
      else {
        const f = (v, d = 3) => (Number.isFinite(v) ? v.toFixed(d) : String(v));
        const rows = [
          ["DC filter tau from the step (ms)", (m) => f(m.step.tau * 1000, 1)],
          ["beeper 1 kHz pitch (Hz)", (m) => f(m.beeper1k.hz, 1)],
          ["SAA tone pitch (Hz)", (m) => f(m.saa1k.hz, 1)],
          ["beeper RMS / SAA RMS", (m) => f(m.beeperToSaa)],
          ["SAA amplitude 8 / 15", (m) => f(m.amplitudes[1])],
          ["SAA amplitude 4 / 15", (m) => f(m.amplitudes[2])],
          ["SAA amplitude 1 / 15", (m) => f(m.amplitudes[3])],
          ["SAA RMS (absolute)", (m) => f(m.saa1k.rms, 4)]
        ];
        lines.push("", "| Sound | Klive | SimCoupé |", "|---|---|---|");
        for (const [name, get] of rows) lines.push(`| ${name} | ${get(r.sound.klive)} | ${get(r.sound.simcoupe)} |`);
      }
    }
    if (r.picture) {
      const off = r.picture.filter((l) => l.klive[0] !== l.simcoupe[0] || l.klive[1] !== l.simcoupe[1]);
      differences += off.length;
      lines.push(
        "",
        `Picture: ${r.picture.length} rows with white in both, ${off.length} where the run differs` +
          off.map((l) => `; row ${l.row}: Klive ${l.klive.join("-")}, SimCoupé ${l.simcoupe.join("-")}`).join("")
      );
    }
    lines.push("");
  }
  if (report.screens) {
    lines.push("## Boot screens", "");
    for (const [name, f] of Object.entries(report.screens)) {
      if (f.differing || f.merged.length) differences++;
      lines.push(
        `- ${name}: ${f.differing} pixels differ, ${f.merged.length} colour pairs merged` +
          f.rows.map((x) => `; row ${x.row}: x ${x.first}-${x.last}`).join("")
      );
    }
    lines.push("");
  }
  lines.push(differences ? `**${differences} difference(s).**` : "No differences.");
  fs.writeFileSync(path.join(runDir, "report.md"), `${lines.join("\n")}\n`);
  fs.writeFileSync(path.join(runDir, "report.json"), JSON.stringify(report, null, 2));
  const latest = path.join(REPO_ROOT, ".local", "sam-parity", "runs", "latest");
  fs.rmSync(latest, { force: true, recursive: true });
  fs.symlinkSync(runDir, latest);
  console.log(`\n${lines.join("\n")}\nReport: ${path.relative(REPO_ROOT, path.join(runDir, "report.md"))}`);
  process.exit(differences ? 2 : 0);
})();
