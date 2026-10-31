#!/usr/bin/env node
/*
 * F3 of .plans/ZX_NEXT_FIDELITY_PROOF_PLAN.md (§8): every program the Next hardware tests load,
 * replayed on Klive's Next core and on the whole FPGA core simulated from vendor/next-fpga/3.02.01/src (nvc),
 * compared right after the instruction that writes the ready marker ($A5 to NextReg $7F).
 *
 *   node test/vhdl/f3/run-f3.cjs [--sample N] [--jobs N] [--klive N] [--out DIR] [--programs FILE]
 *
 * Phases: 1 capture the programs (runs test/zxnext-hw with F3_CAPTURE; --programs reuses a file);
 * 2 compile and elaborate the VHDL; 3 Klive replays (writes each program's simulator inputs and
 * Klive's result); 4 the simulator runs, --jobs at a time; 5 compare and report. A status line goes
 * to stdout and run.log at every phase change and every 5 minutes, with the forecast finish.
 * --stop-after S stops phase 4 after S seconds (the specification's stop rule).
 */
"use strict";
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { spawn, execFileSync, spawnSync } = require("child_process");

const ROOT = path.resolve(__dirname, "../../..");
// --- The 3.02.01 reference, fetched (`npm run next-fpga:fetch`, `.plans/ZXNEXT_CORE_VERSIONS_PLAN.md` D4)
const SRC = path.dirname(require(path.join(ROOT, "scripts/next-fpga-path.cjs")).nextFpgaPath("3.02.01", "src/zxnext.vhd"));
const F3 = __dirname;
const args = process.argv.slice(2);
const opt = (n, d) => (args.includes(n) ? args[args.indexOf(n) + 1] : d);
const sample = opt("--sample", null);
const jobs = Number(opt("--jobs", 10));
const klives = Number(opt("--klive", 4));
const stopAfter = Number(opt("--stop-after", 0));
const planOnly = args.includes("--plan-only");
/** The specification's expected phase-4 time (s); 5 minutes in, a forecast >10 % over it stops the run */
const expectS = Number(opt("--expect", 0));
/** --compare-only: redo phase 5 on an existing run folder (--out), e.g. after a comparison fix */
const compareOnly = args.includes("--compare-only");
/** results made before the testbench's frame-count fix (frames_run := -1 at an entry at line 310) */
const legacyFrames = args.includes("--legacy-frames");
const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
const out = path.resolve(opt("--out", path.join(F3, "results", `${stamp}-${sample ? "sample" : "full"}`)));
fs.mkdirSync(out, { recursive: true });
const REPORT_EVERY_S = 300;
/** NextRegs that move with the raster while the stopped machine's registers are read back */
const VOLATILE_NR = new Set([0x1e, 0x1f]);
/** Klive's deliberate identity: machine ID $08 ("emulator", not the board's $0A) and sub-version */
const IDENTITY_NR = new Set([0x00, 0x0e]);
/**
 * Where the testbench releases the firmware stand-in's soft reset (the core's raw vc, hc), so the
 * program's first fetch lands at Klive's line 0, HC 0: the core's line 310, hc 448, as Klive's HC is
 * the core's hc + 8. Calibrated with --release on a sample (the fetch comes 259 hc after the release).
 */
const RELEASE = (opt("--release", null) ?? "310 197").split(" ").map(Number);

const t0 = Date.now();
const log = (m) => {
  const line = `[${new Date().toLocaleTimeString("en-GB")}] ${m}`;
  console.log(line);
  fs.appendFileSync(path.join(out, "run.log"), line + "\n");
};
const fmt = (ms) => new Date(ms).toLocaleTimeString("en-GB");
const sha = (f) => crypto.createHash("sha256").update(fs.readFileSync(f)).digest("hex");

function run(cmd, argv, opts = {}) {
  return new Promise((resolve) => {
    const p = spawn(cmd, argv, { ...opts });
    let stdout = "";
    p.stdout?.on("data", (d) => { stdout += d; opts.onData?.(String(d)); });
    p.stderr?.on("data", (d) => { if (opts.errFile) fs.appendFileSync(opts.errFile, d); });
    p.on("exit", (code) => resolve({ code, stdout }));
    opts.onSpawn?.(p);
  });
}

// ------------------------------------------------------------------------------------- 1. programs
function capture() {
  const given = opt("--programs", null);
  const raw = given ? path.resolve(given) : path.join(out, "captured.jsonl");
  if (!given) {
    log("phase 1: capturing the programs of test/zxnext-hw");
    const r = spawnSync("npx", ["vitest", "run", "--config", "build/vitest.config.ts", "--project", "e2e-cores", "test/zxnext-hw"], {
      cwd: ROOT, env: { ...process.env, F3_CAPTURE: raw }, encoding: "utf8"
    });
    const summary = (r.stdout.match(/Tests\s+.*$/m) || [""])[0];
    log(`captured (${summary.trim()})`);
  }
  const seen = new Map();
  for (const line of fs.readFileSync(raw, "utf8").split("\n")) {
    if (!line) continue;
    const p = JSON.parse(line);
    const key = JSON.stringify([p.source, p.entry ?? null, p.sp ?? null]);
    if (!seen.has(key)) seen.set(key, { ...p, tests: [] });
    seen.get(key).tests.push(`${path.relative(ROOT, p.testPath)} > ${p.testName}`);
  }
  let programs = [...seen.values()].map((p, id) => ({ id, ...p }));
  if (sample) programs = programs.filter((_, i) => i % Math.ceil(programs.length / Number(sample)) === 0).slice(0, Number(sample));
  const ids = opt("--ids", null);
  if (ids) { const want = new Set(ids.split(",").map(Number)); programs = programs.filter((p) => want.has(p.id)); }
  fs.writeFileSync(path.join(out, "programs.jsonl"), programs.map((p) => JSON.stringify(p)).join("\n") + "\n");
  return programs;
}

// ------------------------------------------------------------------------------------- 2. VHDL
function build() {
  const work = path.join(out, "work");
  const patched = path.join(out, "patched");
  fs.mkdirSync(patched, { recursive: true });
  // fifop.vhd's to_unsigned(-1, n) (ISE accepts it, nvc does not): an all-ones aggregate instead,
  // written to the run folder; _input/ is never changed
  const fifop = fs.readFileSync(path.join(SRC, "serial/fifop.vhd"), "utf8")
    .replace("std_logic_vector(to_unsigned(-1,stored'length-1))", "(stored'length-2 downto 0 => '1')");
  fs.writeFileSync(path.join(patched, "fifop.vhd"), fifop);
  const a = (files) => spawnSync("nvc", ["--std=2008", `--work=${work}`, "-a", "--relaxed", ...files], { encoding: "utf8" });
  const cpu = ["t80n_pack", "t80n_alu", "t80n_mcode", "t80n", "t80na"].map((f) => path.join(SRC, "cpu", `${f}.vhd`));
  let r = a([...cpu, path.join(F3, "models.vhd"), path.join(patched, "fifop.vhd")]);
  if (r.status !== 0) throw new Error(r.stderr);
  const all = execFileSync("find", [".", "-name", "*.vhd"], { cwd: SRC, encoding: "utf8" }).trim().split("\n")
    .filter((f) => !/top_issue|\/pll\/|\/hdmi\/|flashboot|uart_old|\/cpu\/|bootrom\.vhd|ram\/dpram2\.vhd|serial\/fifop\.vhd/.test(f)).sort();
  let left = all;
  for (let pass = 0; pass < 12 && left.length; pass++) {
    const next = left.filter((f) => a([path.join(SRC, f)]).status !== 0);
    if (next.length === left.length) break;
    left = next;
  }
  if (left.length) throw new Error(`VHDL files that do not analyse: ${left.join(", ")}`);
  r = a([path.join(F3, "tb_next.vhd")]);
  if (r.status !== 0) throw new Error(r.stderr);
  r = spawnSync("nvc", ["--std=2008", `--work=${work}`, "-e", "tb_next"], { encoding: "utf8" });
  if (r.status !== 0) throw new Error(r.stderr);
  return work;
}

// ------------------------------------------------------------------------------------- 5. compare
function readBlocks(file, mem) {
  if (!fs.existsSync(file)) return;
  for (const line of fs.readFileSync(file, "utf8").split("\n")) {
    if (!line) continue;
    const v = line.split(" ").map(Number);
    for (let k = 0; k < 64; k++) mem[v[0] + k] = v[1 + k];
  }
}
function readSparse(file, mem, base, length) {
  mem.fill(0, base, base + length);
  if (!fs.existsSync(file)) return;
  for (const line of fs.readFileSync(file, "utf8").split("\n")) {
    if (!line) continue;
    const [i, v] = line.split(" ").map(Number);
    mem[base + i] = v;
  }
}
function readKv(file) {
  const kv = { nr: [] };
  for (const line of fs.readFileSync(file, "utf8").split("\n")) {
    if (!line) continue;
    const t = line.split(" ");
    if (t[0] === "nr") kv.nr[Number(t[1])] = Number(t[2]);
    else kv[t[0]] = t.slice(1).join(" ");
  }
  return kv;
}
const hex = (v, n = 2) => "$" + Number(v).toString(16).toUpperCase().padStart(n, "0");

function compare(p) {
  const dir = path.join(out, "progs", String(p.id));
  const kl = readKv(path.join(dir, "klive.txt"));
  if (kl.status !== "marker") return { verdict: kl.status === "no-marker" ? "klive-no-marker" : "klive-error", detail: kl.status };
  const resFile = path.join(dir, "out", "result.txt");
  if (!fs.existsSync(resFile)) return { verdict: "tb-error", detail: "no result" };
  const tb = readKv(resFile);
  if (tb.started !== "true") return { verdict: "tb-error", detail: "the program never started" };
  if (tb.hard_reset === "true") return { verdict: "tb-hard-reset", detail: "the program asked for a hard reset" };
  if (!tb.marker.startsWith("true")) return { verdict: "tb-no-marker", detail: `no marker within ${tb.clocks} clocks` };
  const why = [];
  const kinds = [];
  for (const k of ["pc", "a", "f", "sp"]) if (Number(tb[k]) !== Number(kl[k])) why.push(`${k}: VHDL ${hex(tb[k], k === "pc" || k === "sp" ? 4 : 2)} Klive ${hex(kl[k], k === "pc" || k === "sp" ? 4 : 2)}`);
  const nrDiff = [];
  // --- Real time from the first fetch to the stop, in 7 MHz HC: the simulated core's 28 MHz clocks
  // --- / 4 against Klive's frames and beam. (Not CPU clocks or Klive's tacts: contention stretches
  // --- the CPU clock, and a higher CPU speed makes more T-states in the same time.)
  // --- When the stop came: frames since the first fetch and line/HC, in Klive's coordinates (HC =
  // --- the core's hc + 8). Both machines start at Klive's frame 0, line 0, HC 0 and run the same
  // --- timing, so equal triples mean equal time to the 7 MHz pixel clock.
  // runs before the frame-count fix counted the wrap right after an entry at line 310 as frame 1
  const [sf, sv, sh] = (tb.stop_klive ?? "").split(" ").map(Number);
  const tbFrame = tb.entry_beam && !tb.entry_beam.startsWith("0 ") && Number(tb.stop_frame) >= 1 && legacyFrames ? sf - 1 : sf;
  const tbWhen = `${tbFrame} ${sv} ${sh}`, klWhen = `${kl.stop_frame} ${kl.stop_beam}`;
  if (tbWhen !== klWhen) {
    kinds.push("time");
    why.push(`stop at frame/line/HC: VHDL ${tbWhen} Klive ${klWhen}`);
  }
  // --- $22 bit 7 (the ULA interrupt is active) as the core had it at the stop itself
  if (tb.stop_int === "0" || tb.stop_int === "1") tb.nr[0x22] = (tb.nr[0x22] & 0x7f) | (Number(tb.stop_int) << 7);
  for (let r = 0; r < 256; r++) {
    if (VOLATILE_NR.has(r) || IDENTITY_NR.has(r) || tb.nr[r] === kl.nr[r]) continue;
    nrDiff.push(`${hex(r)}: VHDL ${hex(tb.nr[r])} Klive ${hex(kl.nr[r])}`);
    kinds.push(`NR ${hex(r)} bits ${hex(tb.nr[r] ^ kl.nr[r])}`);
  }
  if (nrDiff.length) why.push(`NextRegs (${nrDiff.length}): ${nrDiff.slice(0, 12).join(", ")}${nrDiff.length > 12 ? ", ..." : ""}`);
  const vm = new Uint8Array(0x200000), km = new Uint8Array(0x200000);
  readBlocks(path.join(dir, "out", "sram.txt"), vm);
  readSparse(path.join(dir, "out", "bank5.txt"), vm, 0x54000, 0x4000);
  readSparse(path.join(dir, "out", "bank7.txt"), vm, 0x5c000, 0x2000);
  readBlocks(path.join(dir, "klive-ram.txt"), km);
  const memDiff = [];
  for (let a = 0x40000; a < 0x200000; a++) if (vm[a] !== km[a]) memDiff.push(a);
  for (const k of ["pc", "a", "f", "sp"]) if (Number(tb[k]) !== Number(kl[k])) kinds.push(`cpu ${k}`);
  if (memDiff.length) kinds.push("memory");
  if (memDiff.length) {
    why.push(`memory (${memDiff.length} bytes): ` + memDiff.slice(0, 8).map((a) => `${hex(a, 6)} VHDL ${hex(vm[a])} Klive ${hex(km[a])}`).join(", ") + (memDiff.length > 8 ? ", ..." : ""));
  }
  return { verdict: why.length ? "differ" : "pass", detail: why.join("; "), kinds, entryBeam: tb.entry_beam, tacts: Number(kl.tacts), cpuClocks: Number(tb.stop_cpu) };
}

// ------------------------------------------------------------------------------------- main
async function main() {
  if (compareOnly) return report(JSON.parse("[" + fs.readFileSync(path.join(out, "programs.jsonl"), "utf8").trim().split("\n").join(",") + "]"), null, Date.now(), Date.now(), false);
  log(`F3 run, output ${path.relative(ROOT, out)}`);
  const programs = capture();
  log(`programs: ${programs.length} unique${sample ? " (sample)" : ""}`);
  log("phase 2: compiling and elaborating the VHDL");
  const work = build();
  log("phase 2 done");

  // --- 3. Klive replays
  log(`phase 3: Klive replays in ${klives} processes`);
  const vitest = ["vitest", "run", "--config", "test/vhdl/vitest.f1.config.ts", "test/vhdl/f3/f3-klive.f3.ts"];
  await run("npx", vitest, { cwd: ROOT, env: { ...process.env, F3_PREP: "1", F3_OUT: out }, errFile: path.join(out, "klive-prep.log") });
  fs.writeFileSync(path.join(out, "shared", "release.txt"), `${RELEASE[0]} ${RELEASE[1]}\n`);
  const t3 = Date.now();
  const kDone = new Array(klives).fill(0);
  const shards = Array.from({ length: klives }, () => []);
  programs.forEach((p, i) => shards[i % klives].push(p));
  const kProgress = setInterval(() => {
    shards.forEach((_, j) => {
      const f = path.join(out, `klive-${j}.progress`);
      if (fs.existsSync(f)) kDone[j] = parseInt(fs.readFileSync(f, "utf8"), 10) || 0;
    });
  }, 1000);
  let kNext = Date.now() + REPORT_EVERY_S * 1000;
  const kTicker = setInterval(() => {
    if (Date.now() < kNext) return;
    kNext += REPORT_EVERY_S * 1000;
    const done = kDone.reduce((x, y) => x + y, 0), el = Date.now() - t3;
    log(`PROGRESS phase 3: ${done}/${programs.length} (${((done / programs.length) * 100).toFixed(1)} %), forecast end of phase ${done ? fmt(t3 + (el * programs.length) / done) : "unknown"}`);
  }, 1000);
  await Promise.all(shards.map((list, j) => {
    const file = path.join(out, `klive-${j}.jsonl`);
    fs.writeFileSync(file, list.map((p) => JSON.stringify(p)).join("\n") + "\n");
    return run("npx", vitest, {
      cwd: ROOT,
      env: { ...process.env, F3_PROGRAMS: file, F3_OUT: out, F3_PROGRESS: path.join(out, `klive-${j}.progress`) },
      errFile: path.join(out, `klive-${j}.log`)
    });
  }));
  clearInterval(kProgress); clearInterval(kTicker);
  const withMarker = programs.filter((p) => fs.readFileSync(path.join(out, "progs", String(p.id), "klive.txt"), "utf8").startsWith("status marker"));
  log(`phase 3 done in ${((Date.now() - t3) / 1000).toFixed(0)} s: ${withMarker.length} of ${programs.length} programs reach the marker on Klive`);

  // --- 4. the simulator
  const frames = (p) => Number((fs.readFileSync(path.join(out, "progs", String(p.id), "klive.txt"), "utf8").match(/^frames (\d+)/m) || [0, 1])[1]);
  const totalFrames = withMarker.reduce((s, p) => s + frames(p), 0);
  fs.writeFileSync(path.join(out, "phase4-plan.json"), JSON.stringify({ programs: programs.length, simulatorRuns: withMarker.length, frames: totalFrames, jobs }, null, 2));
  if (planOnly) { log(`--plan-only: ${programs.length} programs, ${withMarker.length} simulator runs, ${totalFrames} frames`); return; }
  log(`phase 4: ${withMarker.length} simulator runs (${totalFrames} frames on Klive's clock), ${jobs} at a time`);
  const t4 = Date.now();
  const queue = [...withMarker].sort((a, b) => frames(b) - frames(a)); // longest first
  let done = 0, doneFrames = 0, stopped = false, checked5 = false;
  const live = new Set();
  let next4 = t4 + REPORT_EVERY_S * 1000;
  const inFlight = new Map(); // run id -> frames simulated so far (from its PROGRESS lines)
  const simulated = () => doneFrames + [...inFlight.values()].reduce((x, y) => x + y, 0);
  const status = (label) => {
    const el = Date.now() - t4;
    const frac = totalFrames ? simulated() / totalFrames : 0;
    log(`${label}: ${done}/${withMarker.length} runs, ${(frac * 100).toFixed(1)} % of the frames, ${(el / 1000).toFixed(0)} s, forecast finish ${frac > 0 ? fmt(t4 + el / frac) : "unknown"}`);
  };
  const ticker = setInterval(() => {
    if (Date.now() >= next4) { next4 += REPORT_EVERY_S * 1000; status("PROGRESS phase 4"); }
    if (expectS && !stopped && !checked5 && Date.now() - t4 >= 300_000) {
      checked5 = true;
      const frac = totalFrames ? simulated() / totalFrames : 0;
      const forecastS = frac > 0 ? (Date.now() - t4) / 1000 / frac : Infinity;
      log(`5-minute check: forecast ${forecastS.toFixed(0)} s for phase 4, expected ${expectS} s, limit ${(expectS * 1.1).toFixed(0)} s`);
      if (forecastS > expectS * 1.1) {
        stopped = true; status("STOP (more than 10 % slower than expected)");
        queue.length = 0;
        for (const p of live) p.kill("SIGTERM");
      }
    }
    if (stopAfter && Date.now() - t4 >= stopAfter * 1000 && !stopped) {
      stopped = true; status("STOP (time limit)");
      queue.length = 0;
      for (const p of live) p.kill("SIGTERM");
    }
  }, 1000);
  await Promise.all(Array.from({ length: jobs }, async () => {
    while (queue.length) {
      const p = queue.shift();
      const dir = path.join(out, "progs", String(p.id));
      inFlight.set(p.id, 0);
      await run("nvc", ["--std=2008", `--work=${work}`, "-r", "tb_next"], {
        cwd: dir, errFile: path.join(dir, "nvc-stderr.txt"),
        onSpawn: (proc) => { live.add(proc); proc.on("exit", () => live.delete(proc)); },
        onData: (d) => {
          const m = String(d).match(/PROGRESS (\d+)/g);
          if (m) inFlight.set(p.id, Math.min(frames(p), Number(m[m.length - 1].split(" ")[1]) / 560000));
        }
      });
      inFlight.delete(p.id);
      done++; doneFrames += frames(p);
    }
  }));
  clearInterval(ticker);
  status(stopped ? "STOPPED" : "phase 4 done");
  fs.rmSync(work, { recursive: true, force: true });

  return report(programs, withMarker.length, t3, t4, stopped);
}

// ------------------------------------------------------------------------------------- 5. compare and report
function report(programs, withMarkerCount, t3, t4, stopped) {
  if (withMarkerCount === null) {
    withMarkerCount = programs.filter((p) => fs.readFileSync(path.join(out, "progs", String(p.id), "klive.txt"), "utf8").startsWith("status marker")).length;
  }
  const results = programs.map((p) => ({ p, ...compare(p) }));
  const count = {};
  for (const r of results) count[r.verdict] = (count[r.verdict] ?? 0) + 1;
  fs.writeFileSync(path.join(out, "results.tsv"), "id\tverdict\tentry\ttests\tdetail\n" + results.map((r) => `${r.p.id}\t${r.verdict}\t${r.entryBeam ?? ""}\t${r.p.tests[0]}${r.p.tests.length > 1 ? ` (+${r.p.tests.length - 1})` : ""}\t${r.detail ?? ""}`).join("\n") + "\n");
  const compared = (count.pass ?? 0) + (count.differ ?? 0);
  // --- How often each kind of difference occurs, and in which tests
  const byKind = new Map();
  for (const r of results) for (const k of r.kinds ?? []) {
    if (!byKind.has(k)) byKind.set(k, { n: 0, tests: new Set() });
    byKind.get(k).n++;
    byKind.get(k).tests.add(r.p.tests[0].split(" > ")[0]);
  }
  const kindRows = [...byKind.entries()].sort((a, b) => b[1].n - a[1].n)
    .map(([k, v]) => `| ${k} | ${v.n} | ${[...v.tests].slice(0, 4).map((t) => t.replace("test/zxnext-hw/", "")).join(", ")}${v.tests.size > 4 ? ", ..." : ""} |`).join("\n");
  const onlyNr81 = results.filter((r) => r.verdict === "differ" && r.kinds.length === 1 && r.kinds[0].startsWith("NR $81")).length;
  const summary = { programs: programs.length, reachMarkerOnKlive: withMarkerCount, compared, count, stopped, seconds: { total: (Date.now() - t0) / 1000, phase3: (t4 - t3) / 1000, phase4: (Date.now() - t4) / 1000 }, jobs, klives };
  fs.writeFileSync(path.join(out, "summary.json"), JSON.stringify(summary, null, 2));
  const inputs = ["tb_next.vhd", "models.vhd", "f3-klive.f3.ts", "run-f3.cjs"].map((f) => `| test/vhdl/f3/${f} | \`${sha(path.join(F3, f))}\` |`).join("\n");
  const report = `# F3 — whole-core replay of the catalogue's programs

Run ${new Date(t0).toISOString()} · ${programs.length} programs · ${stopped ? "**STOPPED by the time rule**" : "complete"}

| Verdict | Programs |
|---|---|
${Object.entries(count).sort().map(([k, v]) => `| ${k} | ${v} |`).join("\n")}

- **pass / differ:** compared right after the marker instruction: the raster position (line, HC), PC, A, F, SP, every NextReg except the line counters $1E/$1F and Klive's deliberate identity ($00 machine ID $08 "emulator", $0E sub-version), and the whole RAM ($40000 up, banks 5 and 7 from the core's block RAM). Both machines start the program at line 0, HC 0.
- **Programs whose only difference is \`$81\` bit 7:** ${onlyNr81}.

| Kind of difference | Programs | Tests (first files) |
|---|---|---|
${kindRows}

- **klive-no-marker:** the program does not write the marker on its own within the frame limit (its test drives it from outside); not replayed.
- **tb-no-marker / tb-error / tb-hard-reset:** the simulated core did not get there; see \`results.tsv\`.

Times: phase 3 (Klive) ${summary.seconds.phase3.toFixed(0)} s, phase 4 (simulator, ${jobs} jobs) ${summary.seconds.phase4.toFixed(0)} s, total ${summary.seconds.total.toFixed(0)} s.

| Input | SHA-256 |
|---|---|
${inputs}
| vendor/next-fpga/3.02.01/src/zxnext.vhd | \`${sha(path.join(SRC, "zxnext.vhd"))}\` |
| src/emu/machines/zxNext/wasm/dist/zx-spectrum-next.wasm | \`${sha(path.join(ROOT, "src/emu/machines/zxNext/wasm/dist/zx-spectrum-next.wasm"))}\` |
`;
  fs.writeFileSync(path.join(out, "report.md"), report);
  log(`verdicts: ${JSON.stringify(count)}; report ${path.relative(ROOT, path.join(out, "report.md"))}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
