#!/usr/bin/env node
/*
 * `npm run test:timings`: run the fast tiers (`npm run test:fast`'s projects) with a JSON report and
 * list the files over the fast-tier budget, slowest first.
 *
 * The fast set has to stay within ~3 minutes locally and ~10 on GitHub
 * (`.plans/FAST_SLOW_TEST_TIERS_PLAN.md`). A file over the budget moves to `E2E_SLOW_TESTS` in
 * `build/e2e-tests.ts`, or gets cheaper. Times come from a full parallel run, the way the tier
 * actually runs, so they are inflated by contention: the budget is set against that.
 *
 *   npm run test:timings                       run, then report files over 20 s
 *   npm run test:timings -- --budget 15        another budget, in seconds
 *   npm run test:timings -- --report <file>    report on an existing vitest JSON report, no run
 *   npm run test:timings -- --top 30           also list the 30 slowest files
 */
const { spawnSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const args = process.argv.slice(2);
const option = (name, fallback) => {
  const i = args.indexOf(name);
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback;
};
const budget = Number(option("--budget", "20"));
const top = Number(option("--top", "0"));
let report = option("--report", undefined);

if (!report) {
  report = path.join(root, "node_modules", ".cache", "klive-tests", "timings.json");
  fs.mkdirSync(path.dirname(report), { recursive: true });
  const started = Date.now();
  const result = spawnSync(
    "npx",
    [
      "vitest",
      "run",
      "--config",
      "build/vitest.config.ts",
      ...["node", "jsdom", "e2e-cores", "e2e-kbasic"].map((p) => `--project=${p}`),
      "--reporter=dot",
      "--reporter=json",
      `--outputFile.json=${report}`
    ],
    { cwd: root, stdio: "inherit", shell: process.platform === "win32" }
  );
  console.log(`\n[timings] Fast tiers: ${((Date.now() - started) / 1000).toFixed(0)} s wall.`);
  if (result.status !== 0) console.log("[timings] Some tests failed; the times below still stand.");
}

const data = JSON.parse(fs.readFileSync(report, "utf8"));
const files = data.testResults
  .map((t) => ({
    file: path.relative(root, t.name).split(path.sep).join("/"),
    seconds: (t.endTime - t.startTime) / 1000
  }))
  .sort((a, b) => b.seconds - a.seconds);
const total = files.reduce((sum, f) => sum + f.seconds, 0);
console.log(`[timings] ${files.length} files, ${total.toFixed(0)} test-seconds.`);

if (top > 0) {
  console.log(`\n[timings] The ${top} slowest:`);
  for (const f of files.slice(0, top)) console.log(`${f.seconds.toFixed(1).padStart(8)} s  ${f.file}`);
}

// --- The e2e globs, read from the list file's string literals (it is TypeScript; this is not)
const picomatch = require("picomatch");
const e2eGlobs = [...fs.readFileSync(path.join(root, "build", "e2e-tests.ts"), "utf8").matchAll(/^\s*"(test\/[^"]+)",?\s*$/gm)].map(
  (m) => m[1]
);
const isE2E = picomatch(e2eGlobs);

const over = files.filter((f) => f.seconds > budget);
const e2eOver = over.filter((f) => isE2E(f.file));
const unitOver = over.filter((f) => !isE2E(f.file));
if (e2eOver.length === 0) {
  console.log(`[timings] No fast e2e file is over the ${budget} s budget.`);
} else {
  console.log(`\n[timings] Fast e2e files over the ${budget} s budget - move to E2E_SLOW_TESTS in build/e2e-tests.ts, or make cheaper:`);
  for (const f of e2eOver) console.log(`${f.seconds.toFixed(1).padStart(8)} s  ${f.file}`);
}
if (unitOver.length > 0) {
  console.log(`\n[timings] Unit-tier files over the budget (they cannot move; make them cheaper if it grows):`);
  for (const f of unitOver) console.log(`${f.seconds.toFixed(1).padStart(8)} s  ${f.file}`);
}
