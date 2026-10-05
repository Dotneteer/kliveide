#!/usr/bin/env node
/**
 * Plays every `.rzx` file in a local folder headless on the real cores and reports how each one ends
 * (`.plans/RZX_PLAN.md` Phase 8): pass, desync (frame, creator), refused (the reader's or the
 * mapping's reason) or error, with a summary by creator. It is the yardstick for the real-world long
 * tail (§7) and for whether a per-creator compatibility workaround is worth adding.
 *
 *   node scripts/rzx-archive-check.cjs <folder> [--report <file.json>] [--max-frames <n>]
 *
 * Local only, never in CI: the RZX Archive's files carry no licence statement, so none is committed.
 * The work runs in `test/spectrum/rzx/rzx-sp-archive-run.test.ts`, which does nothing unless this
 * script starts it.
 */
const { spawnSync } = require("child_process");
const fs = require("fs");
const os = require("os");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const RUNNER = "test/spectrum/rzx/rzx-sp-archive-run.test.ts";

function fail(message) {
  console.error(`rzx-archive-check: ${message}`);
  process.exit(1);
}

function parseArgs(argv) {
  const args = { folder: undefined, report: undefined, maxFrames: undefined };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--report") args.report = argv[++i];
    else if (a === "--max-frames") args.maxFrames = argv[++i];
    else if (!args.folder) args.folder = a;
    else fail(`unexpected argument '${a}'`);
  }
  if (!args.folder) fail("usage: node scripts/rzx-archive-check.cjs <folder> [--report <file.json>] [--max-frames <n>]");
  return args;
}

/** Counts per creator and outcome, most files first */
function summarise(results) {
  const byCreator = new Map();
  for (const r of results) {
    const row = byCreator.get(r.creator) ?? { creator: r.creator, pass: 0, desync: 0, refused: 0, error: 0, total: 0 };
    row[r.outcome]++;
    row.total++;
    byCreator.set(r.creator, row);
  }
  return [...byCreator.values()].sort((a, b) => b.total - a.total);
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const folder = path.resolve(args.folder);
  if (!fs.existsSync(folder) || !fs.statSync(folder).isDirectory()) fail(`${folder} is not a folder`);
  const report = path.resolve(args.report ?? path.join(os.tmpdir(), `rzx-archive-${Date.now()}.json`));

  const run = spawnSync(
    "npx",
    ["vitest", "run", "--config", "build/vitest.config.ts", "--project", "e2e-cores", RUNNER],
    {
      cwd: ROOT,
      stdio: "inherit",
      env: {
        ...process.env,
        RZX_ARCHIVE_DIR: folder,
        RZX_ARCHIVE_REPORT: report,
        ...(args.maxFrames ? { RZX_ARCHIVE_MAX_FRAMES: String(args.maxFrames) } : {})
      },
      shell: process.platform === "win32"
    }
  );
  if (run.status !== 0 || !fs.existsSync(report)) fail("the runner failed");

  const results = JSON.parse(fs.readFileSync(report, "utf8"));
  const rows = summarise(results);
  const total = (k) => results.filter((r) => r.outcome === k).length;
  console.log("\nBy creator:");
  console.log(`${"creator".padEnd(28)} ${"files".padStart(6)} ${"pass".padStart(6)} ${"desync".padStart(7)} ${"refused".padStart(8)} ${"error".padStart(6)}`);
  for (const r of rows) {
    console.log(
      `${r.creator.slice(0, 28).padEnd(28)} ${String(r.total).padStart(6)} ${String(r.pass).padStart(6)} ${String(r.desync).padStart(7)} ${String(r.refused).padStart(8)} ${String(r.error).padStart(6)}`
    );
  }
  const n = results.length || 1;
  console.log(
    `\n${results.length} files: ${total("pass")} pass (${((100 * total("pass")) / n).toFixed(1)}%), ` +
      `${total("desync")} desync, ${total("refused")} refused, ${total("error")} error. Report: ${report}`
  );
}

if (require.main === module) main();

module.exports = { summarise };
