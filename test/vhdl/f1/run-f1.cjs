#!/usr/bin/env node
/*
 * F1 of .plans/ZX_NEXT_FIDELITY_PROOF_PLAN.md (§8, "F1 run specification"): runs the T80N
 * single-instruction differential end to end and writes the evidence.
 *
 *   node test/vhdl/f1/run-f1.cjs --sample            the 1,775-case bring-up sample
 *   node test/vhdl/f1/run-f1.cjs --full              all 115,854 cases (the measured run)
 *   options: --shards N (simulator processes, default 8), --klive N (Klive processes, default 2),
 *            --out DIR (default test/vhdl/f1/results/<timestamp>-<mode>)
 *
 * Phases: generate the cases; compile and elaborate the VHDL (not timed); then, timed, run the
 * simulator shards and the Klive runners side by side and compare. A status line goes to stdout
 * at the start, every 5 minutes (percent done and forecast finish) and at the end. A run that has
 * not finished after 5 minutes is stopped: by then it is far beyond the 10 % margin over
 * 30 s per 100,000 tests (the spec's stop rule).
 */
"use strict";
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { spawn, execFileSync } = require("child_process");

const ROOT = path.resolve(__dirname, "../../..");
const CPU = path.join(ROOT, "_input/next-fpga/src/cpu");
const CPU_FILES = ["t80n_pack.vhd", "t80n_alu.vhd", "t80n_mcode.vhd", "t80n.vhd", "t80na.vhd"].map((f) => path.join(CPU, f));
const TB = path.join(__dirname, "cpu_tb.vhd");
const GEN = path.join(__dirname, "generate-cases.cjs");
const KLIVE = path.join(__dirname, "f1-klive.f1.ts");
const WASM = path.join(ROOT, "src/emu/machines/zxNext/wasm/dist/zx-spectrum-next.wasm");
const IO_VALUE = 191; // port $xxFE with no key pressed and EAR/MIC written 0 ($BF), as Klive reads it
const EXPECTED_S_PER_100K = 30;
const MARGIN = 0.1;
const STOP_AFTER_S = 300;
const REPORT_EVERY_S = 300;

const args = process.argv.slice(2);
const opt = (name, def) => (args.includes(name) ? args[args.indexOf(name) + 1] : def);
const mode = args.includes("--full") ? "full" : "sample";
const shards = Number(opt("--shards", 8));
const klives = Number(opt("--klive", 2));
const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
const out = path.resolve(opt("--out", path.join(__dirname, "results", `${stamp}-${mode}`)));
fs.mkdirSync(out, { recursive: true });

const sha = (file) => crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");
const log = (msg) => {
  const line = `[${new Date().toLocaleTimeString("en-GB")}] ${msg}`;
  console.log(line);
  fs.appendFileSync(path.join(out, "run.log"), line + "\n");
};
const fmtTime = (d) => d.toLocaleTimeString("en-GB");

// ------------------------------------------------------------------------------------------ comparison
const FIELDS = ["pc", "af", "bc", "de", "hl", "af_", "bc_", "de_", "hl_", "ix", "iy", "sp", "i", "r", "iff1", "iff2", "im", "tstates"];

function parseResult(line) {
  const tok = line.trim().split(" ");
  const id = Number(tok[0]);
  if (tok[1] === "ERROR") return { id, error: tok.slice(1).join(" ") };
  const regs = tok.slice(1, 1 + FIELDS.length).map(Number);
  const n = Number(tok[1 + FIELDS.length]);
  const mem = tok.slice(2 + FIELDS.length, 2 + FIELDS.length + 2 * n).join(" ");
  return { id, regs, mem: `${n}${n ? " " + mem : ""}` };
}

function readResults(files) {
  const map = new Map();
  for (const f of files) {
    if (!fs.existsSync(f)) continue;
    for (const line of fs.readFileSync(f, "utf8").split("\n")) if (line.trim()) { const r = parseResult(line); map.set(r.id, r); }
  }
  return map;
}

function compare(ids, tb, kl) {
  const mismatches = [];
  for (const id of ids) {
    const a = tb.get(id), b = kl.get(id);
    if (!a || !b) { mismatches.push({ id, why: [`missing on ${!a ? "T80N" : "Klive"}`] }); continue; }
    if (a.error || b.error) { mismatches.push({ id, why: [`error: T80N ${a.error ?? "-"} / Klive ${b.error ?? "-"}`] }); continue; }
    const why = [];
    FIELDS.forEach((f, k) => { if (a.regs[k] !== b.regs[k]) why.push(`${f}: T80N ${a.regs[k]} Klive ${b.regs[k]}`); });
    if (a.mem !== b.mem) why.push(`memory changes: T80N [${a.mem}] Klive [${b.mem}]`);
    if (why.length) mismatches.push({ id, why });
  }
  return mismatches;
}

// ------------------------------------------------------------------------------------------ main
async function main() {
  const t0 = Date.now();
  log(`F1 ${mode} run, output ${path.relative(ROOT, out)}`);

  // --- 1. Cases (not timed)
  const genArgs = [GEN, "--out", out, "--shards", String(shards)];
  if (mode === "sample") genArgs.push("--sample");
  const summary = JSON.parse(execFileSync("node", genArgs, { encoding: "utf8" }).trim());
  const total = summary.written;
  const expected = mode === "sample" ? 1775 : 115854;
  if (total !== expected) throw new Error(`generated ${total} cases, the specification says ${expected}`);
  const meta = new Map(fs.readFileSync(path.join(out, "cases-meta.tsv"), "utf8").trim().split("\n").map((l) => { const [id, set, group, op] = l.split("\t"); return [Number(id), { set, group, op }]; }));
  const tGen = Date.now();
  log(`generated ${total} cases in ${shards} shards (${((tGen - t0) / 1000).toFixed(1)} s)`);

  // --- 2. VHDL (not timed)
  const work = path.join(out, "work");
  execFileSync("nvc", ["--std=2008", `--work=${work}`, "-a", "--relaxed", ...CPU_FILES, TB], { stdio: "pipe" });
  execFileSync("nvc", ["--std=2008", `--work=${work}`, "-e", "cpu_tb",
    "-gCASES=cases.txt", "-gRESULTS=results.txt", `-gIO_VALUE=${IO_VALUE}`, "-gPROGRESS_EVERY=250"], { stdio: "pipe" });
  for (let k = 0; k < shards; k++) {
    const dir = path.join(out, `shard-${k}`);
    fs.mkdirSync(dir, { recursive: true });
    fs.renameSync(path.join(out, `cases-${k}.txt`), path.join(dir, "cases.txt"));
  }
  const tVhdl = Date.now();
  log(`VHDL analysed and elaborated (${((tVhdl - tGen) / 1000).toFixed(1)} s)`);

  // --- 3. The timed run
  const start = Date.now();
  const expectedS = (EXPECTED_S_PER_100K * total) / 100000;
  log(`START: ${total} tests; expected ${expectedS.toFixed(1)} s (30 s per 100,000), limit ${(expectedS * (1 + MARGIN)).toFixed(1)} s; forecast finish ${fmtTime(new Date(start + expectedS * 1000))}`);
  const tbDone = new Array(shards).fill(0);
  const tbExit = new Array(shards).fill(null);
  const procs = [];
  for (let k = 0; k < shards; k++) {
    const p = spawn("nvc", ["--std=2008", `--work=${work}`, "-r", "cpu_tb"], { cwd: path.join(out, `shard-${k}`) });
    let buf = "";
    p.stdout.on("data", (d) => {
      buf += d;
      let i;
      while ((i = buf.indexOf("\n")) >= 0) {
        const l = buf.slice(0, i); buf = buf.slice(i + 1);
        const m = /^(PROGRESS|DONE) (\d+)/.exec(l);
        if (m) tbDone[k] = Number(m[2]);
      }
    });
    p.stderr.on("data", (d) => fs.appendFileSync(path.join(out, `shard-${k}`, "stderr.txt"), d));
    p.on("exit", (code) => { tbExit[k] = code; });
    procs.push(p);
  }
  const kDone = new Array(klives).fill(0);
  const kExit = new Array(klives).fill(null);
  const kResults = [];
  for (let j = 0; j < klives; j++) {
    const files = [];
    for (let k = j; k < shards; k += klives) files.push(path.join(out, `shard-${k}`, "cases.txt"));
    const res = path.join(out, `klive-${j}.txt`);
    const prog = path.join(out, `klive-${j}.progress`);
    kResults.push(res);
    const p = spawn("npx", ["vitest", "run", "--config", "test/vhdl/vitest.f1.config.ts"], {
      cwd: ROOT,
      env: { ...process.env, F1_CASES: files.join(","), F1_RESULTS: res, F1_PROGRESS: prog, F1_IO_VALUE: String(IO_VALUE) }
    });
    p.stdout.on("data", (d) => fs.appendFileSync(path.join(out, `klive-${j}.log`), d));
    p.stderr.on("data", (d) => fs.appendFileSync(path.join(out, `klive-${j}.log`), d));
    p.on("exit", (code) => { kExit[j] = code; });
    procs.push(p);
    const timer = setInterval(() => {
      if (fs.existsSync(prog)) kDone[j] = parseInt(fs.readFileSync(prog, "utf8"), 10) || 0;
      if (kExit[j] !== null) clearInterval(timer);
    }, 500);
  }

  let stopped = false;
  let nextReport = start + REPORT_EVERY_S * 1000;
  const status = (label) => {
    const tb = tbDone.reduce((x, y) => x + y, 0), kl = kDone.reduce((x, y) => x + y, 0);
    const frac = (tb + kl) / (2 * total);
    const el = (Date.now() - start) / 1000;
    const eta = frac > 0 ? new Date(start + (el / frac) * 1000) : null;
    log(`${label}: ${(frac * 100).toFixed(1)} % done (T80N ${tb}/${total}, Klive ${kl}/${total}), ${el.toFixed(0)} s elapsed, forecast finish ${eta ? fmtTime(eta) : "unknown"}`);
  };
  await new Promise((resolve) => {
    const tick = setInterval(() => {
      const allExited = tbExit.every((c) => c !== null) && kExit.every((c) => c !== null);
      if (allExited) { clearInterval(tick); resolve(); return; }
      if (Date.now() >= nextReport) { status("PROGRESS"); nextReport += REPORT_EVERY_S * 1000; }
      if (Date.now() - start >= STOP_AFTER_S * 1000) {
        stopped = true;
        status("STOP (5 minutes reached, run too slow)");
        for (const p of procs) p.kill("SIGTERM");
        clearInterval(tick); setTimeout(resolve, 2000);
      }
    }, 250);
  });
  for (let j = 0; j < klives; j++) if (fs.existsSync(path.join(out, `klive-${j}.progress`))) kDone[j] = parseInt(fs.readFileSync(path.join(out, `klive-${j}.progress`), "utf8"), 10) || 0;

  // --- 4. Compare (timed)
  const tb = readResults(Array.from({ length: shards }, (_, k) => path.join(out, `shard-${k}`, "results.txt")));
  const kl = readResults(kResults);
  const ids = [...meta.keys()];
  const mismatches = compare(ids, tb, kl);
  const end = Date.now();
  const runS = (end - start) / 1000;
  status(stopped ? "STOPPED" : "FINISHED");

  // --- 5. Evidence: negative control and capture check
  const control = (() => {
    const done = ids.filter((id) => tb.has(id) && kl.has(id) && !tb.get(id).error);
    if (done.length < 5) return { ok: false, note: "too few results for the control" };
    const pick = [done[0], done[Math.floor(done.length / 4)], done[Math.floor(done.length / 2)], done[Math.floor((3 * done.length) / 4)], done[done.length - 1]];
    const bad = new Map(kl);
    const clone = (r) => ({ ...r, regs: [...r.regs] });
    let r;
    r = clone(bad.get(pick[0])); r.regs[1] ^= 0x0020; bad.set(pick[0], r); // undocumented flag bit 5
    r = clone(bad.get(pick[1])); r.regs[17] += 1; bad.set(pick[1], r); // one T-state more
    r = clone(bad.get(pick[2])); r.regs[0] = (r.regs[0] + 1) & 0xffff; bad.set(pick[2], r); // PC
    r = clone(bad.get(pick[3])); r.mem = r.mem + " (extra)"; bad.set(pick[3], r); // memory change
    bad.delete(pick[4]); // a missing result
    const found = compare(done, tb, bad).map((m) => m.id);
    const realBefore = new Set(compare(done, tb, kl).map((m) => m.id));
    const injected = pick.filter((id) => !realBefore.has(id));
    const caught = injected.filter((id) => found.includes(id));
    return { ok: caught.length === injected.length && found.length === realBefore.size + injected.length, injected: injected.length, caught: caught.length, found: found.length, realMismatches: realBefore.size };
  })();
  const capture = (() => {
    // NOP cases: the registers after the instruction are the data block the prologue loaded
    let checked = 0, ok = 0;
    for (let k = 0; k < shards; k++) {
      const file = path.join(out, `shard-${k}`, "cases.txt");
      for (const line of fs.readFileSync(file, "utf8").split("\n")) {
        if (!line) continue;
        const v = line.split(" ").map(Number);
        const id = v[0], m = meta.get(id);
        if (!m || m.op !== "00" || m.set !== "random" || !tb.has(id) || tb.get(id).error) continue;
        const data = v.slice(5 + v[4] + 1, 5 + v[4] + 1 + 24); // id m1 nInstr io nCode code... nData data
        const w = (o) => data[o] | (data[o + 1] << 8);
        const want = [w(12), w(14), w(16), w(18), w(4), w(6), w(8), w(10), w(20), w(22)]; // af bc de hl af_ bc_ de_ hl_ ix iy
        const got = tb.get(id).regs.slice(1, 11);
        checked++;
        if (want.every((x, i) => x === got[i]) && tb.get(id).regs[12] === data[1]) ok++;
      }
    }
    return { checked, ok };
  })();

  // --- 6. Report
  const executedTb = tb.size, executedKl = kl.size;
  const compared = ids.filter((id) => tb.has(id) && kl.has(id)).length;
  const byGroup = {};
  const bad = new Set(mismatches.map((m) => m.id));
  for (const [id, m] of meta) {
    const g = m.set === "random" ? `random ${m.group}` : m.set;
    byGroup[g] ??= { cases: 0, compared: 0, pass: 0 };
    byGroup[g].cases++;
    if (tb.has(id) && kl.has(id)) { byGroup[g].compared++; if (!bad.has(id)) byGroup[g].pass++; }
  }
  const mismatchLines = mismatches.map((m) => {
    const md = meta.get(m.id) ?? {};
    return `${m.id}\t${md.set}\t${md.group}\t${md.op}\t${m.why.join("; ")}`;
  });
  fs.writeFileSync(path.join(out, "mismatches.tsv"), "id\tset\tgroup\topcode\tdifferences\n" + mismatchLines.join("\n") + "\n");
  let git = "";
  try { git = execFileSync("git", ["rev-parse", "HEAD"], { cwd: ROOT, encoding: "utf8" }).trim(); } catch { /* not a checkout */ }
  const dirty = (() => { try { return execFileSync("git", ["status", "--porcelain"], { cwd: ROOT, encoding: "utf8" }).trim().split("\n").filter(Boolean).length; } catch { return -1; } })();
  const nvcVersion = execFileSync("nvc", ["--version"], { encoding: "utf8" }).split("\n")[0];
  const caseHash = crypto.createHash("sha256");
  for (let k = 0; k < shards; k++) caseHash.update(fs.readFileSync(path.join(out, `shard-${k}`, "cases.txt")));
  const pass = !stopped && mismatches.length === 0 && compared === total && control.ok && capture.ok === capture.checked && capture.checked > 0;
  const rate = (runS / total) * 100000;
  const summaryJson = {
    mode, verdict: pass ? "PASS" : stopped ? "STOPPED" : "DIFFERENCES", total, executed: { t80n: executedTb, klive: executedKl }, compared,
    mismatches: mismatches.length, runSeconds: runS, secondsPer100k: rate, expectedSecondsPer100k: EXPECTED_S_PER_100K,
    limitSecondsPer100k: EXPECTED_S_PER_100K * (1 + MARGIN), stopped, negativeControl: control, captureCheck: capture, byGroup,
    timings: { generateS: (tGen - t0) / 1000, vhdlS: (tVhdl - tGen) / 1000, runS }, shards, klives
  };
  fs.writeFileSync(path.join(out, "summary.json"), JSON.stringify(summaryJson, null, 2));
  const rows = Object.entries(byGroup).map(([g, v]) => `| ${g} | ${v.cases} | ${v.compared} | ${v.pass} | ${v.compared - v.pass} |`).join("\n");
  const report = `# F1 — T80N single-instruction differential: ${mode} run

Run ${new Date(start).toISOString()} · verdict **${summaryJson.verdict}**

Specification: \`.plans/ZX_NEXT_FIDELITY_PROOF_PLAN.md\` §8, "F1 run specification".

## Result

| | |
|---|---|
| Tests in the specification for this mode | ${expected} |
| Generated | ${total} |
| Executed on the T80N (VHDL, nvc) | ${executedTb} |
| Executed on Klive | ${executedKl} |
| Compared | ${compared} |
| Mismatches | ${mismatches.length} (\`mismatches.tsv\`) |
| Run time (shards + Klive + comparison) | ${runS.toFixed(1)} s |
| Rate | ${rate.toFixed(1)} s per 100,000 (expected ${EXPECTED_S_PER_100K}, limit ${(EXPECTED_S_PER_100K * (1 + MARGIN)).toFixed(1)}) |
| Stopped by the 5-minute rule | ${stopped ? "yes" : "no"} |
| Not timed: generation / VHDL compile+elaborate | ${((tGen - t0) / 1000).toFixed(1)} s / ${((tVhdl - tGen) / 1000).toFixed(1)} s |

## Per set

| Set | Cases | Compared | Pass | Differ |
|---|---|---|---|---|
${rows}

## Evidence that the comparison works

- **Negative control:** ${control.injected ?? 0} differences were injected into a copy of Klive's results (flag bit 5, T-states, PC, a memory change, a missing result); the comparator reported ${control.caught ?? 0} of them${control.realMismatches ? ` (plus the ${control.realMismatches} real ones)` : ""}. ${control.ok ? "**OK**" : "**FAILED**"}
- **Capture check:** in ${capture.checked} NOP cases the registers the testbench captured after the instruction equal the data block the prologue loaded: ${capture.ok} of ${capture.checked}. ${capture.ok === capture.checked && capture.checked > 0 ? "**OK**" : "**FAILED**"}

## Inputs

| Input | Version / SHA-256 |
|---|---|
| Repository | ${git || "unknown"}${dirty > 0 ? ` (+${dirty} uncommitted files)` : ""} |
| nvc | ${nvcVersion} |
| Node | ${process.version} |
${CPU_FILES.map((f) => `| ${path.relative(ROOT, f)} | \`${sha(f)}\` |`).join("\n")}
| ${path.relative(ROOT, TB)} | \`${sha(TB)}\` |
| ${path.relative(ROOT, GEN)} | \`${sha(GEN)}\` |
| ${path.relative(ROOT, KLIVE)} | \`${sha(KLIVE)}\` |
| ${path.relative(ROOT, WASM)} | \`${sha(WASM)}\` |
| Case files (all shards, in order) | \`${caseHash.digest("hex")}\` |

## Not covered by this run

- Port writes are counted by the testbench but not compared (the harness has no I/O log; F4 covers ports).
- MEMPTR (WZ) and Q are not compared directly; they show only through flags (\`BIT n,(HL)\`, \`SCF\`/\`CCF\`).
- \`HALT\`, \`ED 91\`/\`ED 92\` (NEXTREG), prefix chains (\`DD DD\`, \`DD ED\`, \`DD FD\`...) and interrupts are not in the set.
`;
  fs.writeFileSync(path.join(out, "report.md"), report);
  log(`verdict ${summaryJson.verdict}: ${compared}/${total} compared, ${mismatches.length} mismatches, ${runS.toFixed(1)} s (${rate.toFixed(1)} s per 100,000); report ${path.relative(ROOT, path.join(out, "report.md"))}`);
  // the work library and shard case copies are large and reproducible: drop the library
  fs.rmSync(work, { recursive: true, force: true });
}

main().catch((e) => { console.error(e); process.exit(1); });
