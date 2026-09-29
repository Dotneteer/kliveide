#!/usr/bin/env node
/**
 * Klive BASIC optimiser report (`.docs/kbasic-optimiser.md` §7): builds every 48K corpus program at
 * each optimisation level, runs it, prints the totals and rewrites `test/kbasic/opt/opt-baseline.json`
 * (code size and T-states per program and level). The test `test/kbasic/opt/opt-report.test.ts`
 * fails when a level gets worse than that file.
 *
 *   node scripts/kbasic-opt-report.cjs          # rewrite the baseline and print the totals
 */
const { spawnSync } = require("child_process");

const result = spawnSync(
  "npx",
  ["vitest", "run", "--config", "build/vitest.config.ts", "--project", "node", "test/kbasic/opt/opt-report.test.ts"],
  { stdio: ["ignore", "pipe", "pipe"], env: { ...process.env, KBASIC_OPT_UPDATE: "1" }, encoding: "utf8" }
);
const line = `${result.stdout}\n${result.stderr}`.split("\n").find((l) => l.startsWith("KBASIC-OPT"));
console.log(line ? line.replace(/^KBASIC-OPT /, "") : `${result.stdout}\n${result.stderr}`);
process.exit(result.status ?? 1);
