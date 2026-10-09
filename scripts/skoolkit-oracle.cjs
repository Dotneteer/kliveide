#!/usr/bin/env node
/*
 * The SkoolKit oracle (`.plans/REVERSE_ENGINEERING_TOOLS_PLAN.md` §8 G7.5, R7).
 *
 * Runs an *installed* SkoolKit on files Klive exported and records **pass or fail only**: whether
 * `skool2ctl` and `skool2asm` accept a skool export, and whether `sna2skool -c` accepts a control
 * export against a snapshot. Nothing SkoolKit generates is kept, copied or compared in detail, and
 * this never runs in CI — the same rule as Klive BASIC's oracle (D12). SkoolKit is GPL-3; running it
 * as a behavioural oracle on Klive's own files is allowed, reading its code is not.
 *
 * Usage:
 *   node scripts/skoolkit-oracle.cjs --skool <export.skool> [--ctl <export.ctl> --snapshot <file.z80>]
 *
 * Exit code 0 when every check passed, 1 when one failed, 2 when SkoolKit is not installed.
 */
const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

function argValue(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

function hasTool(tool) {
  const probe = spawnSync(tool, ["--version"], { encoding: "utf8" });
  return !probe.error && probe.status === 0;
}

/** Run a tool in a scratch folder; only the exit status is recorded. */
function check(name, tool, args) {
  const scratch = fs.mkdtempSync(path.join(os.tmpdir(), "klive-skoolkit-oracle-"));
  try {
    const result = spawnSync(tool, args, { cwd: scratch, encoding: "utf8" });
    const pass = !result.error && result.status === 0;
    return { name, pass, ...(pass ? {} : { exitCode: result.status ?? -1 }) };
  } finally {
    fs.rmSync(scratch, { recursive: true, force: true });
  }
}

const skool = argValue("--skool");
const ctl = argValue("--ctl");
const snapshot = argValue("--snapshot");
if (!skool && !ctl) {
  console.error("Give --skool <file>, or --ctl <file> --snapshot <file>.");
  process.exit(1);
}

const tools = ["skool2ctl", "skool2asm", "sna2skool"];
const missing = tools.filter((tool) => !hasTool(tool));
if (missing.length === tools.length) {
  console.error("SkoolKit is not installed (skool2ctl, skool2asm, sna2skool not found). Skipped.");
  process.exit(2);
}

const results = [];
if (skool) {
  const file = path.resolve(skool);
  if (!missing.includes("skool2ctl")) results.push(check("skool2ctl accepts the skool export", "skool2ctl", [file]));
  if (!missing.includes("skool2asm")) results.push(check("skool2asm accepts the skool export", "skool2asm", [file]));
}
if (ctl && snapshot && !missing.includes("sna2skool")) {
  results.push(
    check("sna2skool -c accepts the ctl export", "sna2skool", ["-c", path.resolve(ctl), path.resolve(snapshot)])
  );
}

for (const result of results) {
  console.log(`${result.pass ? "PASS" : "FAIL"}  ${result.name}${result.pass ? "" : ` (exit ${result.exitCode})`}`);
}
process.exit(results.every((result) => result.pass) ? 0 : 1);
