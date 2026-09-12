/**
 * The type-check gate.
 *
 * ## Why this script exists rather than plain `tsc`
 *
 * `npm run build:check` was `tsc`, and `npm run build` was `tsc && electron-vite build`. Neither
 * checked anything. The root `tsconfig.json` is a *solution* file — `"files": []` plus two
 * `references` — and plain `tsc` does not follow project references; it compiled the empty file
 * list and exited 0. (It also carried an `include` of `next-env.d.ts` and `pages/**`, left over
 * from a Next.js scaffold, which have never existed in this repo.)
 *
 * So the type checker had been silent for long enough that the codebase moved to TypeScript 6
 * underneath it. Running the real project configs surfaces the backlog that accumulated in that
 * silence.
 *
 * ## Why a baseline rather than "zero errors"
 *
 * That backlog is large and sits partly in the emulator cores, where a careless type "fix" can
 * change runtime behaviour. Demanding zero errors before the gate can be switched on means the gate
 * stays off — which is how it got here. So the gate is a ratchet instead: the known errors are
 * recorded in `build/type-errors-baseline.json`, and the build fails only on errors that are *new*.
 * The backlog can then be paid down at leisure, and cannot grow while it is being paid down.
 *
 * ## Why the baseline is keyed by file and rule, not by line
 *
 * A baseline that stores line numbers goes stale on the first unrelated edit to the file, and the
 * usual response to that is to stop trusting it. `file::TS-code -> count` survives code moving
 * around inside a file, survives reworded diagnostics (TypeScript renders union members in a
 * different order between the two project configs, which alone would break exact-text matching),
 * and still catches a genuinely new violation: a new code in a file, a new file, or one more of an
 * existing code in the same file.
 *
 * Usage:
 *   npm run build:check              compare against the baseline; exit 1 on new errors
 *   npm run build:check -- --update  rewrite the baseline from the current state
 */
const { spawnSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const REPO = path.join(__dirname, "..");
const BASELINE = path.join(REPO, "build", "type-errors-baseline.json");

/**
 * Both projects are checked.
 *
 * They overlap almost entirely — `tsconfig.node.json` pulls in `src/renderer/**` because four files
 * under `src/main` import types from it — so today they report the same diagnostics. They are still
 * both run: they resolve different `lib`/`types` (DOM versus `electron-vite/node`), so the day the
 * main process gains a Node-only type error, only its own project would see it.
 */
const PROJECTS = [
  { name: "node", config: "build/tsconfig.node.json" },
  { name: "web", config: "build/tsconfig.web.json" }
];

/** `src/foo/bar.ts(12,34): error TS2322: Some message.` */
const ERROR_LINE = /^(.+?)\((\d+),(\d+)\):\s+error\s+(TS\d+):\s+(.*)$/;

/**
 * Both configs are `composite`, so tsc writes a `.tsbuildinfo` next to them even under `--noEmit` —
 * and `build/tsconfig.node.tsbuildinfo` is checked into the repository. Running the gate must not
 * show up as a source change, so each run is pointed at its own cache under `node_modules/.cache`.
 */
const CACHE_DIR = path.join(REPO, "node_modules", ".cache", "klive-typecheck");

function runProject(project) {
  fs.mkdirSync(CACHE_DIR, { recursive: true });
  const result = spawnSync(
    process.execPath,
    [
      path.join(REPO, "node_modules", "typescript", "bin", "tsc"),
      "-p",
      project.config,
      "--noEmit",
      "--tsBuildInfoFile",
      path.join(CACHE_DIR, `${project.name}.tsbuildinfo`)
    ],
    { cwd: REPO, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 }
  );

  if (result.error) {
    throw new Error(`Could not run tsc for ${project.config}: ${result.error.message}`);
  }

  const output = `${result.stdout ?? ""}${result.stderr ?? ""}`;
  const errors = [];
  for (const line of output.split(/\r?\n/)) {
    const match = ERROR_LINE.exec(line.trim());
    // --- Only diagnostics carrying a file location are counted. tsc's trailing summary lines and
    // --- its config-level errors have no file, and would otherwise land under a key of "".
    if (match) {
      errors.push({ file: match[1].replace(/\\/g, "/"), code: match[4], message: match[5] });
    }
  }

  // --- A tsc run that fails for a reason other than type errors — a missing config, a crash — must
  // --- not read as "zero errors, baseline satisfied".
  if (result.status !== 0 && errors.length === 0) {
    throw new Error(
      `tsc failed for ${project.config} without reporting any file diagnostic:\n${output.trim()}`
    );
  }

  return errors;
}

/** `{ "src/foo.ts::TS6133": 3, ... }` — the highest count either project reported for that pair. */
function tally(runs) {
  const counts = new Map();
  for (const errors of runs) {
    const perRun = new Map();
    for (const { file, code } of errors) {
      const key = `${file}::${code}`;
      perRun.set(key, (perRun.get(key) ?? 0) + 1);
    }
    for (const [key, count] of perRun) {
      counts.set(key, Math.max(counts.get(key) ?? 0, count));
    }
  }
  return Object.fromEntries([...counts].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)));
}

function total(entries) {
  return Object.values(entries).reduce((sum, n) => sum + n, 0);
}

function main() {
  const update = process.argv.includes("--update");

  const runs = [];
  for (const project of PROJECTS) {
    process.stderr.write(`Type-checking ${project.config} ...\n`);
    runs.push(runProject(project));
  }
  const current = tally(runs);

  if (update) {
    fs.writeFileSync(
      BASELINE,
      `${JSON.stringify(
        {
          $comment:
            "Known type errors, keyed by file and TypeScript diagnostic code. The build fails on " +
            "anything NOT listed here. Regenerate with `npm run build:check -- --update` — but " +
            "only ever to LOWER a count. See scripts/check-types.cjs.",
          updated: new Date().toISOString().slice(0, 10),
          total: total(current),
          entries: current
        },
        null,
        2
      )}\n`
    );
    console.log(`Baseline written: ${total(current)} known errors in ${Object.keys(current).length} file/rule pairs.`);
    return 0;
  }

  if (!fs.existsSync(BASELINE)) {
    console.error(`No baseline at ${BASELINE}. Create one with: npm run build:check -- --update`);
    return 1;
  }
  const baseline = JSON.parse(fs.readFileSync(BASELINE, "utf8")).entries ?? {};

  const added = [];
  const fixed = [];
  for (const [key, count] of Object.entries(current)) {
    const known = baseline[key] ?? 0;
    if (count > known) added.push({ key, count, known });
  }
  for (const [key, known] of Object.entries(baseline)) {
    const count = current[key] ?? 0;
    if (count < known) fixed.push({ key, count, known });
  }

  if (fixed.length) {
    const cleared = fixed.reduce((sum, f) => sum + (f.known - f.count), 0);
    console.log(`${cleared} known type error(s) no longer reported — nice.`);
    for (const { key, count, known } of fixed) console.log(`  ${key}: ${known} -> ${count}`);
    console.log("Run `npm run build:check -- --update` to lock that in.\n");
  }

  if (added.length) {
    const newCount = added.reduce((sum, a) => sum + (a.count - a.known), 0);
    console.error(`${newCount} NEW type error(s):\n`);
    for (const { key, count, known } of added) {
      const [file, code] = key.split("::");
      console.error(`  ${file}  ${code}  ${known} known -> ${count} now`);
    }
    console.error(
      "\nFix them, or — if a diagnostic genuinely cannot be resolved yet — say why in the PR and " +
        "run `npm run build:check -- --update`."
    );
    return 1;
  }

  console.log(`No new type errors. ${total(current)} known (see build/type-errors-baseline.json).`);
  return 0;
}

process.exit(main());
