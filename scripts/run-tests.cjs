#!/usr/bin/env node
/*
 * `npm test`: the unit tier always, each fast end-to-end tier only when its inputs changed.
 *
 * The end-to-end tiers (`build/e2e-tests.ts`) run the real WASM machine cores and are most of the
 * suite's time. They cannot be affected by a change that touches none of their inputs, so each tier
 * keeps a fingerprint - a content hash of the files that can change its outcome - of the last run in
 * which it passed on this machine. A tier whose fingerprint still matches is skipped and says so.
 *
 * The slowest e2e files form a tier of their own, `e2e-slow`, which only runs when asked for: when a
 * plan is about to complete and before a release is prepared (`.plans/FAST_SLOW_TEST_TIERS_PLAN.md`).
 *
 *   npm test                   unit + changed fast e2e tiers (never the slow tier)
 *   npm test -- <args>         any vitest arguments, run as given across every tier but the slow one
 *                              (focused runs; name a slow file and add `--project e2e-slow` to run it)
 *   npm run test:e2e           every fast e2e tier, regardless of changes
 *   npm run test:fast          unit + every fast e2e tier (CI, release:prepare)
 *   npm run test:slow          the slow tier
 *   npm run test:all           everything, the slow tier included (plan completion, before a release)
 *   npm run test:slow-status   exit 0 when the slow tier passed on the current inputs, 1 otherwise
 *   npm test -- --dry-run      only say which tiers would run, and why
 *
 * Arguments after a mode go to vitest (`npm run test:fast -- --shard=1/2`).
 *
 * Content, not timestamps: a branch switch or a pull rewrites mtimes without changing anything, and
 * changes content without a fresh mtime when a file is restored. The stamps live under
 * `node_modules/.cache/klive-tests/`, so a fresh checkout (CI) has none and runs every tier.
 */
const { spawnSync } = require("child_process");
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const stampDir = path.join(root, "node_modules", ".cache", "klive-tests");
const vitestArgs = ["vitest", "run", "--config", "build/vitest.config.ts"];

/*
 * What can change each tier's outcome. Kept beside the runner rather than in the test list because
 * these are *inputs*, not tests: the cores' sources, their ROMs and build scripts, the harnesses
 * that drive them, and the tests themselves.
 */
const CORE_INPUTS = [
  "src/emu",
  "src/public/roms",
  "scripts/wasm-build-lock.cjs",
  /^scripts\/build-[a-z0-9]+-wasm\.cjs$/,
  "test/harness",
  "test/wasm",
  // --- Every machine's hardware tests (zxnext-hw, timex-hw, sp128-hw, ht1080z-hw, tvc-hw, ...)
  /^test\/[a-z0-9]+-hw\//,
  "test/zxnext-shared",
  "test/zxSpectrum",
  "test/z88",
  "test/emu",
  "build/e2e-tests.ts",
  // --- The condition front end emits the bytecode the cores' evaluator runs
  //     (`.plans/BREAKPOINT_CONDITIONS_IN_C_PLAN.md` §6)
  "src/common/utils/breakpoint-condition"
];

// --- The programs are compiled by Klive BASIC (on the shared Z80 back end) and assembled by the Klive
// --- assembler before they run, so any of them changing is a reason to run them - as is any core change.
const KBASIC_INPUTS = [
  ...CORE_INPUTS,
  "src/main/kbasic",
  "src/main/z80-backend",
  "src/main/compiler-shell",
  "src/main/z80-compiler",
  "test/kbasic",
  "test/z80-backend"
];

const TIERS = [
  { project: "e2e-cores", title: "machine cores", inputs: CORE_INPUTS },
  { project: "e2e-kbasic", title: "Klive BASIC programs on the cores", inputs: KBASIC_INPUTS },
  // --- Files from both lists above, so it depends on everything either does
  { project: "e2e-slow", title: "slow end-to-end tests", inputs: KBASIC_INPUTS, slow: true }
];

const MODES = {
  "--e2e": { name: "e2e", unit: false, fast: true, slow: false },
  "--fast": { name: "fast", unit: true, fast: true, slow: false },
  "--slow": { name: "slow", unit: false, fast: false, slow: true },
  "--all": { name: "all", unit: true, fast: true, slow: true }
};

const dryRun = process.argv.includes("--dry-run");
const args = process.argv.slice(2).filter((a) => a !== "--dry-run");

if (args[0] === "--slow-status") process.exit(slowStatus());

const mode = MODES[args[0]] ?? { name: "auto", unit: true, fast: true, slow: false };
const forced = mode.name !== "auto";
const passthrough = forced ? args.slice(1) : args;

// --- Focused runs: vitest arguments are honoured as given, across every tier but perf and slow
if (!forced && passthrough.length > 0) {
  const names = projectArgs(passthrough);
  const tiers = names.length > 0 ? [] : ["--project=!perf", "--project=!e2e-slow"];
  process.exit(run([...vitestArgs, ...tiers, ...passthrough]));
}

const projects = mode.unit ? ["node", "jsdom"] : [];
const ran = [];
for (const tier of TIERS) {
  if (tier.slow ? !mode.slow : !mode.fast) continue;
  const fingerprint = fingerprintOf(tier.inputs);
  const stamp = readStamp(tier.project);
  if (!forced && stamp?.fingerprint === fingerprint) {
    console.log(
      `[test] Skipping ${tier.project} (${tier.title}): its inputs are unchanged since it last ` +
        `passed (${stamp.passedAt}). Run \`npm run test:e2e\` to force it.`
    );
    continue;
  }
  console.log(
    `[test] Including ${tier.project} (${tier.title}): ` +
      (forced ? "requested." : stamp ? "its inputs changed." : "no record of a passing run.")
  );
  projects.push(tier.project);
  ran.push({ tier, fingerprint });
}

if (dryRun) {
  console.log(`[test] Would run: ${projects.join(", ") || "nothing"}`);
  process.exit(0);
}

if (projects.length === 0) {
  console.log("[test] Nothing to run.");
  process.exit(0);
}

const status = run([...vitestArgs, ...projects.map((p) => `--project=${p}`), ...passthrough]);
if (status === 0) {
  for (const { tier, fingerprint } of ran) writeStamp(tier.project, fingerprint);
}
process.exit(status);

/** The `--project` names a focused run gives, in either `--project x` or `--project=x` form. */
function projectArgs(list) {
  const names = [];
  list.forEach((a, i) => {
    if (a === "--project" && list[i + 1]) names.push(list[i + 1]);
    else if (a.startsWith("--project=")) names.push(a.slice("--project=".length));
  });
  return names;
}

/**
 * Whether the slow tier passed on the current inputs. `release:prepare` warns on a stale one; it
 * does not run the tier itself (`.plans/FAST_SLOW_TEST_TIERS_PLAN.md` D3).
 */
function slowStatus() {
  const tier = TIERS.find((t) => t.slow);
  const stamp = readStamp(tier.project);
  if (stamp?.fingerprint === fingerprintOf(tier.inputs)) {
    console.log(`[test] ${tier.project} passed on the current inputs (${stamp.passedAt}).`);
    return 0;
  }
  console.log(
    `[test] ${tier.project} has ` +
      (stamp ? `not passed since its inputs changed (last pass: ${stamp.passedAt}).` : "no record of a passing run.") +
      " Run `npm run test:slow` (or `npm run test:all`)."
  );
  return 1;
}

function run(command) {
  const result = spawnSync("npx", command, { cwd: root, stdio: "inherit", shell: process.platform === "win32" });
  return result.status ?? 1;
}

/** A content hash over every file the inputs name: paths, directories (recursive) or patterns. */
function fingerprintOf(inputs) {
  const files = new Set();
  for (const input of inputs) {
    if (input instanceof RegExp) {
      const dir = path.join(root, "scripts");
      for (const name of fs.readdirSync(dir)) {
        const rel = `scripts/${name}`;
        if (input.test(rel)) files.add(rel);
      }
      continue;
    }
    collect(input, files);
  }
  const hash = crypto.createHash("sha256");
  for (const rel of [...files].sort()) {
    hash.update(rel);
    hash.update("\0");
    hash.update(fs.readFileSync(path.join(root, rel)));
    hash.update("\0");
  }
  return hash.digest("hex");
}

function collect(rel, files) {
  const full = path.join(root, rel);
  if (!fs.existsSync(full)) return;
  const stat = fs.statSync(full);
  if (stat.isFile()) {
    files.add(rel.split(path.sep).join("/"));
    return;
  }
  for (const entry of fs.readdirSync(full, { withFileTypes: true })) {
    // --- Build outputs are derived from the sources hashed beside them
    if (entry.isDirectory() && (entry.name === "dist" || entry.name === "test-dist" || entry.name === "node_modules")) {
      continue;
    }
    if (entry.name.startsWith(".")) continue;
    collect(path.join(rel, entry.name), files);
  }
}

function readStamp(project) {
  try {
    return JSON.parse(fs.readFileSync(path.join(stampDir, `${project}.json`), "utf8"));
  } catch {
    return undefined;
  }
}

function writeStamp(project, fingerprint) {
  fs.mkdirSync(stampDir, { recursive: true });
  fs.writeFileSync(
    path.join(stampDir, `${project}.json`),
    JSON.stringify({ fingerprint, passedAt: new Date().toISOString() }, null, 2)
  );
}
