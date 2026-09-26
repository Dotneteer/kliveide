#!/usr/bin/env node
/**
 * Klive BASIC's behavioural oracle (plan D12, R9): compiles Klive's own corpus programs with a
 * locally installed upstream `zxbc`, runs them on the 48K harness and records what they did.
 *
 *   node scripts/kbasic-oracle.cjs                      every corpus program
 *   node scripts/kbasic-oracle.cjs float/mod data/...   the named ones (relative to the corpus)
 *
 * `KBASIC_ORACLE_ZXBC` names the zxbc executable (default `~/zxbasic/.venv/bin/zxbc`; see
 * `.ai/kbasic/README.md`). Guard rails, as the plan requires:
 * - it refuses to run when `CI` is set: the oracle is a developer tool, never part of CI;
 * - zxbc's output goes to a temporary folder that is deleted afterwards; the only files written in
 *   the repository are `test/kbasic/oracle/<area>/<name>.json`, which hold observed results (screen
 *   rows, whether the program returned, peeked values) and never generated code.
 * The corpus runner then compares each program's expectations with its results file
 * (`test/kbasic/corpus/corpus.test.ts`).
 */
const { spawnSync } = require("child_process");
const fs = require("fs");
const os = require("os");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const CORPUS = path.join(ROOT, "test/kbasic/corpus");
const RUNNER = "test/kbasic/oracle/oracle-run.test.ts";
const DEFAULT_ORG = 32768;

/** Klive header options (plan §5.3) and the zxbc flags that ask for the same (the spec's `cli.options`). */
const FLAGS = {
  "array-base": (v) => ["--array-base", v],
  "string-base": (v) => ["--string-base", v],
  "case-insensitive": () => ["--ignore-case"],
  "sinclair-compatible": () => ["--sinclair"],
  "heap-size": (v) => ["--heap-size", v],
  "heap-address": (v) => ["--heap-address", v],
  "require-declarations": () => ["--explicit"],
  "require-types": () => ["--strict"],
  "check-memory": () => ["--debug-memory"],
  "check-bounds": () => ["--debug-array"],
  "break-key": () => ["--enable-break"],
  define: (v) => v.split(/\s*,\s*/).flatMap((d) => ["-D", d]),
  optimize: (v) => ["--optimize", v]
};
/** Options that change nothing zxbc would do differently for a 48K run. */
const IGNORED = new Set(["output", "emit-asm", "emit-ir", "emit-map", "debug-info", "disable-warning", "enable-warning", "expect-warnings"]);

function fail(message) {
  console.error(`kbasic-oracle: ${message}`);
  process.exit(1);
}

/** The `'@name value` lines of a program's leading comment block, `'@expect` lines excepted. */
function headerOptions(source) {
  const out = [];
  for (const line of source.split(/\r?\n/)) {
    const t = line.trim();
    if (t === "") continue;
    if (!t.startsWith("'")) break;
    const m = /^'\s*@([\w-]+)\s*(.*)$/.exec(t);
    if (m && m[1] !== "expect") out.push({ name: m[1], value: m[2].trim() });
  }
  return out;
}

const off = (v) => /^(false|off|no|0)$/i.test(v);

/** The zxbc arguments for a program's header, its load address, or why it cannot be run. */
function zxbcArguments(options) {
  const args = [];
  let org = DEFAULT_ORG;
  for (const { name, value } of options) {
    if (name === "origin") {
      org = value.startsWith("$") ? parseInt(value.slice(1), 16) : Number(value);
      continue;
    }
    if (name === "target") {
      if (value !== "zx48k") return { skip: `target ${value}: the oracle runs 48K programs` };
      continue;
    }
    if (IGNORED.has(name)) continue;
    const flag = FLAGS[name];
    if (!flag) return { skip: `header option ${name} has no zxbc counterpart here` };
    if (value && off(value)) continue;
    args.push(...flag(value));
  }
  return { args: [...args, "--org", String(org)], org };
}

function corpusPrograms(dir) {
  return fs
    .readdirSync(dir, { withFileTypes: true })
    .flatMap((e) => (e.isDirectory() ? corpusPrograms(path.join(dir, e.name)) : e.name.endsWith(".zxbas") ? [path.join(dir, e.name)] : []))
    .sort();
}

function main() {
  if (process.env.CI) fail("refusing to run with CI set: the oracle never runs in CI (plan D12)");
  const zxbc = process.env.KBASIC_ORACLE_ZXBC || path.join(os.homedir(), "zxbasic/.venv/bin/zxbc");
  if (!fs.existsSync(zxbc)) fail(`no zxbc at ${zxbc}: install it (.ai/kbasic/README.md) or set KBASIC_ORACLE_ZXBC`);
  const version = spawnSync(zxbc, ["--version"], { encoding: "utf8" });
  if (version.status !== 0) fail(`${zxbc} --version failed: ${version.stderr || version.error}`);
  const zxbcVersion = (version.stdout || version.stderr).trim();

  const named = process.argv.slice(2);
  const files = named.length
    ? named.map((n) => path.join(CORPUS, n.endsWith(".zxbas") ? n : `${n}.zxbas`))
    : corpusPrograms(CORPUS);
  for (const f of files) if (!fs.existsSync(f)) fail(`no corpus program ${path.relative(CORPUS, f)}`);

  const work = fs.mkdtempSync(path.join(os.tmpdir(), "kbasic-oracle-"));
  try {
    const entries = [];
    for (const file of files) {
      const program = path.relative(CORPUS, file).replace(/\\/g, "/");
      const source = fs.readFileSync(file, "utf8");
      const plan = zxbcArguments(headerOptions(source));
      if (plan.skip) {
        console.log(`skip ${program}: ${plan.skip}`);
        continue;
      }
      // --- zxbc reads a .bas file; the copy and its output stay in the temporary folder
      const base = path.join(work, program.replace(/[\\/]/g, "__").replace(/\.zxbas$/, ""));
      fs.writeFileSync(`${base}.bas`, source);
      const run = spawnSync(zxbc, ["--output-format", "bin", "--output", `${base}.bin`, ...plan.args, `${base}.bas`], {
        encoding: "utf8",
        cwd: work
      });
      const entry = { program, source: file, org: plan.org };
      if (run.status !== 0 || !fs.existsSync(`${base}.bin`)) {
        const message = `${run.stderr || run.stdout || run.error || ""}`.split(/\r?\n/).find((l) => l.trim()) || `exit code ${run.status}`;
        entry.compileError = message.replace(work, "").replace(/^[\\/]+/, "");
      } else entry.bin = `${base}.bin`;
      entries.push(entry);
      console.log(`${entry.bin ? "built" : "rejected"} ${program}`);
    }
    const manifest = path.join(work, "manifest.json");
    fs.writeFileSync(manifest, JSON.stringify({ zxbc: zxbcVersion, entries }, null, 2));
    const test = spawnSync("npx", ["vitest", "run", "--config", "build/vitest.config.ts", "--project", "node", RUNNER], {
      cwd: ROOT,
      stdio: "inherit",
      env: { ...process.env, KBASIC_ORACLE_MANIFEST: manifest },
      shell: process.platform === "win32"
    });
    if (test.status !== 0) fail("the oracle runner failed");
    console.log(`Wrote ${entries.length} results to test/kbasic/oracle/ (${zxbcVersion}).`);
  } finally {
    fs.rmSync(work, { recursive: true, force: true });
  }
}

if (require.main === module) main();

module.exports = { headerOptions, zxbcArguments };
