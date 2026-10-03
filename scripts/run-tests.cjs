#!/usr/bin/env node
/*
 * `npm test`: the unit tier always, each end-to-end tier only when its inputs changed.
 *
 * The end-to-end tiers (`build/e2e-tests.ts`) run the real WASM machine cores and are most of the
 * suite's time. They cannot be affected by a change that touches none of their inputs, so each tier
 * keeps a fingerprint - a content hash of the files that can change its outcome - of the last run in
 * which it passed on this machine. A tier whose fingerprint still matches is skipped and says so.
 *
 *   npm test                 unit + changed e2e tiers
 *   npm test -- <args>       any vitest arguments, run as given across every tier (focused runs)
 *   npm run test:e2e         every e2e tier, regardless of changes
 *   npm run test:all         everything (CI)
 *   npm test -- --dry-run    only say which tiers would run, and why
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
  "test/zxnext-hw",
  "test/zxnext-shared",
  "test/zxSpectrum",
  "test/z88",
  "test/emu",
  "build/e2e-tests.ts",
  // --- The condition front end emits the bytecode the cores' evaluator runs
  //     (`.plans/BREAKPOINT_CONDITIONS_IN_C_PLAN.md` §6)
  "src/common/utils/breakpoint-condition"
];

const TIERS = [
  {
    project: "e2e-cores",
    title: "machine cores",
    inputs: CORE_INPUTS
  },
  {
    project: "e2e-kbasic",
    title: "Klive BASIC programs on the cores",
    // --- The programs are compiled by Klive BASIC and assembled by the Klive assembler before
    // --- they run, so either changing is a reason to run them - as is any core change.
    inputs: [...CORE_INPUTS, "src/main/kbasic", "src/main/z80-compiler", "test/kbasic"]
  }
];

const dryRun = process.argv.includes("--dry-run");
const args = process.argv.slice(2).filter((a) => a !== "--dry-run");
const mode = args[0] === "--e2e" ? "e2e" : args[0] === "--all" ? "all" : "auto";
const passthrough = mode === "auto" ? args : args.slice(1);

// --- Focused runs: vitest arguments are honoured as given, across every tier but perf
if (mode === "auto" && passthrough.length > 0) {
  process.exit(run([...vitestArgs, "--project=!perf", ...passthrough]));
}

const projects = mode === "e2e" ? [] : ["node", "jsdom"];
const ran = [];
for (const tier of TIERS) {
  const fingerprint = fingerprintOf(tier.inputs);
  const stamp = readStamp(tier.project);
  if (mode === "auto" && stamp?.fingerprint === fingerprint) {
    console.log(
      `[test] Skipping ${tier.project} (${tier.title}): its inputs are unchanged since it last ` +
        `passed (${stamp.passedAt}). Run \`npm run test:e2e\` to force it.`
    );
    continue;
  }
  console.log(
    `[test] Including ${tier.project} (${tier.title}): ` +
      (mode !== "auto" ? "requested." : stamp ? "its inputs changed." : "no record of a passing run.")
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
