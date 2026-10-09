#!/usr/bin/env node
/*
 * What the debugging support costs the WASM cores (`.plans/WASM_CORE_LEAN_AND_DEBUG_PLAN.md` Phase 0).
 *
 * Every core is compiled three ways from the same sources, with the production flags:
 *   - baseline:    the production build, as shipped;
 *   - strip-stack: `-DZ80_BENCH_STRIP_STEP_OUT`, without the shadow step-out stack (plan D5);
 *   - strip-all:   `-DZ80_BENCH_STRIP_DEBUG`, without any debug work - the stack, the history and
 *                  profile hooks, bus capture and each core's own debug bookkeeping (plan D2).
 * The switches are benchmark-only: a strip build cannot debug, but it must emulate exactly as the
 * baseline does, so every scenario ends by comparing registers, RAM and the picture of all variants.
 *
 * Fast frames (`<prefix>ExecuteFrame`) are timed in interleaved rounds, the minimum of each variant
 * kept. With `--debug-loop`, the baseline's debugger paths are timed too: the per-instruction loop
 * the Spectrum and Next hosts run (`ExecuteInstruction` + `GetCpuPc` + `GetFrameCompleted` per call,
 * without the host's JavaScript stop test, so a lower bound) and, where the core has one, the
 * in-core `ExecuteUntilStop` the Z88 and ZX80/81 hosts use.
 *
 * `--reference <git-rev>` adds a fourth build, the production build of that revision's sources
 * (`git archive`), timed and compared like the others: a change's gain is "reference" against
 * "baseline", and the fingerprint check proves the change emulates exactly as before.
 *
 * Usage: node scripts/benchmark-debug-overhead.cjs [--core sp48,zxnext] [--frames 200] [--rounds 7]
 *        [--warmup 50] [--reference HEAD] [--debug-loop] [--json] [--keep]
 */
const { mkdirSync, mkdtempSync, readFileSync, rmSync } = require("node:fs");
const { relative } = require("node:path");
const { tmpdir } = require("node:os");
const { join, resolve } = require("node:path");
const { performance } = require("node:perf_hooks");
const { spawnSync } = require("node:child_process");
const { createHash } = require("node:crypto");

const root = resolve(__dirname, "..");
const ROMS = join(root, "src/public/roms");
const rom = (name) => readFileSync(join(ROMS, name));

const VARIANTS = [
  { id: "baseline", defines: [] },
  { id: "strip-stack", defines: ["-DZ80_BENCH_STRIP_STEP_OUT"] },
  { id: "strip-all", defines: ["-DZ80_BENCH_STRIP_DEBUG"] }
];

const NO_EXTRA_STOP = 0xffffffff;

// ----------------------------------------------------------------------------------------------
// Workloads

/*
 * A mixed loop in RAM at $8000: a block copy (data reads and writes), a CALL/RET with PUSH/POP (the
 * shadow stack), a port read, an arithmetic loop, and a 16-bit iteration counter at $A202 that shows
 * the program ran. `di` makes it independent of interrupt handlers on cores without a ROM.
 */
function mixedProgram({ port, di }) {
  const code = [];
  const at = () => 0x8000 + code.length;
  const w = (v) => code.push(v & 0xff, (v >> 8) & 0xff);
  code.push(di ? 0xf3 : 0xfb); // di / ei
  const start = at();
  code.push(0x21); w(0xa000); // ld hl,$a000
  code.push(0x11); w(0xa100); // ld de,$a100
  code.push(0x01); w(0x0040); // ld bc,$0040
  code.push(0xed, 0xb0); // ldir
  code.push(0xcd); const callAt = code.length; w(0); // call sub
  code.push(0x01); w(port); // ld bc,port
  code.push(0xed, 0x78); // in a,(c)
  code.push(0x06, 0x20); // ld b,$20
  const inner = at();
  code.push(0x80); // add a,b
  code.push(0x10, (inner - (at() + 2)) & 0xff); // djnz inner
  code.push(0x32); w(0xa200); // ld ($a200),a
  code.push(0x2a); w(0xa202); // ld hl,($a202)
  code.push(0x23); // inc hl
  code.push(0x22); w(0xa202); // ld ($a202),hl
  code.push(0x18, (start - (at() + 2)) & 0xff); // jr start
  const sub = at();
  code[callAt] = sub & 0xff;
  code[callAt + 1] = sub >> 8;
  code.push(0xe5, 0x7e, 0x3c, 0x77, 0xe1, 0xc9); // push hl; ld a,(hl); inc a; ld (hl),a; pop hl; ret
  return code;
}

const ITERATIONS_ADDRESS = 0xa202;

/* Loads the mixed program through the core's CPU-view memory write and starts it */
function startMixed(x, p, opts, writeMemory) {
  const program = mixedProgram(opts);
  const write = writeMemory ?? ((a, v) => x[`${p}WriteMemory`](a, v));
  program.forEach((v, i) => write(0x8000 + i, v));
  write(ITERATIONS_ADDRESS, 0);
  write(ITERATIONS_ADDRESS + 1, 0);
  x[`${p}SetCpuPc`](0x8000);
  x[`${p}SetCpuSp`](0xbff0);
}

function uploadRom(bytes, upload) {
  for (let i = 0; i < bytes.length; i++) upload(i, bytes[i]);
}

/* ZX81 keys: line * 5 + bit; held 4 frames and released 6 (the ROM's debounce) */
function typeZx81(x, ...chords) {
  for (const chord of chords) {
    chord.forEach((k) => x.zx8081SetKeyStatus(k, 1));
    for (let i = 0; i < 4; i++) x.zx8081ExecuteFrame();
    chord.forEach((k) => x.zx8081SetKeyStatus(k, 0));
    for (let i = 0; i < 6; i++) x.zx8081ExecuteFrame();
  }
}

function bootZx81(x) {
  x.zx8081Configure(1, 1, 16, 0);
  new Uint8Array(x.memory.buffer, x.zx8081RomPtr(), 8192).set(rom("zx81.rom"));
  x.zx8081HardReset();
  for (let i = 0; i < 200; i++) x.zx8081ExecuteFrame();
}

const CORES = {
  sp48: {
    label: "ZX Spectrum 48K",
    script: "build-sp48-wasm.cjs",
    memoryBytes: (m) => m.buildModes.production.initialMemory,
    ram: (x) => [x.sp48MemoryPtr(), 0x10000],
    picture: (x) => [x.sp48PixelBufferPtr(), x.sp48GetScreenWidth() * x.sp48GetScreenHeight() * 4],
    boot(x) {
      uploadRom(rom("sp48.rom"), (i, v) => x.sp48UploadRomByte(i, v));
      x.sp48HardReset(0, 0);
      x.sp48SetAudioSampleRate(44100);
      for (let i = 0; i < 150; i++) x.sp48ExecuteFrame();
    },
    scenarios: {
      "rom-idle": () => {},
      mixed: (x) => startMixed(x, "sp48", { port: 0x7ffe, di: false })
    }
  },
  sp128: {
    label: "ZX Spectrum 128K",
    script: "build-sp128-wasm.cjs",
    memoryBytes: (m) => m.buildModes.production.initialMemory,
    ram: (x) => [x.sp128RamPtr(), 0x20000],
    picture: (x) => [x.sp128PixelBufferPtr(), x.sp128GetScreenWidth() * x.sp128GetScreenHeight() * 4],
    boot(x) {
      [rom("sp128-0.rom"), rom("sp128-1.rom")].forEach((bytes, r) =>
        uploadRom(bytes, (i, v) => x.sp128UploadRomByte(r, i, v))
      );
      x.sp128HardReset(0, 0);
      x.sp128SetAudioSampleRate(44100);
      for (let i = 0; i < 150; i++) x.sp128ExecuteFrame();
    },
    scenarios: {
      "rom-idle": () => {},
      mixed: (x) => startMixed(x, "sp128", { port: 0x7ffe, di: false })
    }
  },
  spp3e: {
    label: "ZX Spectrum +3E",
    script: "build-spp3e-wasm.cjs",
    memoryBytes: (m) => m.buildModes.production.initialMemory,
    ram: (x) => [x.spp3eRamPtr(), 0x20000],
    picture: (x) => [x.spp3ePixelBufferPtr(), x.spp3eGetScreenWidth() * x.spp3eGetScreenHeight() * 4],
    boot(x) {
      [0, 1, 2, 3].forEach((r) => uploadRom(rom(`spp3e-${r}.rom`), (i, v) => x.spp3eUploadRomByte(r, i, v)));
      x.spp3eHardReset();
      x.spp3eSetAudioSampleRate(44100);
      for (let i = 0; i < 150; i++) x.spp3eExecuteFrame();
    },
    scenarios: {
      "rom-idle": () => {},
      mixed: (x) => startMixed(x, "spp3e", { port: 0x7ffe, di: false })
    }
  },
  zxnext: {
    label: "ZX Spectrum Next",
    script: "build-zxnext-wasm.cjs",
    memoryBytes: (m) => m.buildModes.production.initialMemory,
    ram: (x) => [x.zxnextMemoryPtr(), x.zxnextGetMemorySize()],
    picture: (x) => [x.zxnextPixelBufferPtr(), x.zxnextGetScreenWidth() * x.zxnextGetScreenHeight() * 4],
    boot(x) {
      x.zxnextHardReset();
      x.zxnextSetAudioSampleRate(44100);
    },
    scenarios: {
      "mixed-3.5mhz": (x) => startMixed(x, "zxnext", { port: 0x7ffe, di: true }),
      "mixed-28mhz": (x) => {
        // --- NextReg $07 (CPU speed) through the register-select ports, as a program would
        x.zxnextWritePort(0x243b, 0x07);
        x.zxnextWritePort(0x253b, 0x03);
        startMixed(x, "zxnext", { port: 0x7ffe, di: true });
      }
    }
  },
  z88: {
    label: "Cambridge Z88",
    // --- A Z88 frame is about 1/10 of a Spectrum's work: more of them for a measurable time
    frameScale: 20,
    script: "build-z88-wasm.cjs",
    memoryBytes: (m) => m.buildModes.production.initialMemory,
    ram: (x) => [x.z88MemoryPtr(), x.z88GetMemorySize()],
    picture: (x) => [x.z88PixelBufferPtr(), x.z88GetPixelBufferCapacity() * 4],
    boot(x) {
      // --- 512K internal RAM and the harness's flat-RAM layout (`Z88_FLAT_RAM_LAYOUT`): COM.RAMS and
      // --- SR0-SR3 = $21-$23, so $0000-$FFFF is all internal RAM
      x.z88SetInternalRamSize(512 * 1024);
      x.z88HardReset();
      x.z88SetAudioSampleRate(44100, 0.995);
      x.z88SetCom(0x04);
      [0x21, 0x21, 0x22, 0x23].forEach((bank, i) => x.z88SetSr(i, bank));
    },
    scenarios: {
      mixed: (x) => startMixed(x, "z88", { port: 0xffb2, di: true })
    },
    untilStop: true
  },
  zx8081: {
    label: "ZX81",
    script: "build-zx8081-wasm.cjs",
    memoryBytes: (m) => m.ZX8081_WASM_MEMORY_BYTES,
    ram: (x) => [x.zx8081RamPtr(), 0x4000],
    picture: (x) => [x.zx8081PixelBufferPtr(), x.zx8081GetPixelBufferCapacity() * 4],
    boot: bootZx81,
    scenarios: {
      "slow-idle": () => {},
      "slow-basic-loop": (x) => {
        const [N1, N0, G, R, NL] = [15, 20, 9, 13, 30];
        typeZx81(x, [N1], [N0], [G], [N1], [N0], [NL]);
        for (let i = 0; i < 30; i++) x.zx8081ExecuteFrame();
        typeZx81(x, [R], [NL]);
      }
    },
    untilStop: true
  }
};

// ----------------------------------------------------------------------------------------------
// Building

/* Extracts a revision's C sources (all of `src/emu`) next to the artifacts */
function extractRevision(rev, outDir) {
  const dir = join(outDir, "reference-src");
  mkdirSync(dir, { recursive: true });
  const archive = spawnSync("git", ["archive", rev, "src/emu"], { cwd: root, maxBuffer: 1 << 30 });
  if (archive.status !== 0) throw new Error(`git archive ${rev} failed: ${archive.stderr}`);
  const untar = spawnSync("tar", ["-x", "-C", dir], { input: archive.stdout });
  if (untar.status !== 0) throw new Error(`tar failed: ${untar.stderr}`);
  return dir;
}

function compile(coreId, variant, outDir) {
  const core = CORES[coreId];
  const build = require(`./${core.script}`);
  const source = variant.sourceRoot ? join(variant.sourceRoot, relative(root, build.source)) : build.source;
  const output = join(outDir, `${coreId}-${variant.id}.wasm`);
  const memory = core.memoryBytes(build);
  const args = [
    "--target=wasm32",
    "-std=c11",
    "-O3",
    "-Wl,--strip-all",
    ...variant.defines,
    "-ffreestanding",
    "-fno-builtin",
    "-nostdlib",
    "-Wl,--no-entry",
    "-Wl,--export-memory",
    `-Wl,--initial-memory=${memory}`,
    `-Wl,--max-memory=${memory}`,
    ...build.productionExports.filter((n) => n !== "memory").map((n) => `-Wl,--export=${n}`),
    source,
    "-o",
    output
  ];
  const compiler = process.env.KLIVE_WASM_CC || "clang";
  const result = spawnSync(compiler, args, { cwd: root, stdio: ["ignore", "inherit", "inherit"] });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${coreId} ${variant.id}: compilation failed (${result.status})`);
  return { path: output, bytes: readFileSync(output) };
}

async function instantiate(bytes) {
  const { instance } = await WebAssembly.instantiate(bytes);
  return instance.exports;
}

// ----------------------------------------------------------------------------------------------
// Measuring

function prefixOf(coreId) {
  return coreId;
}

function fingerprint(core, coreId, x) {
  const p = prefixOf(coreId);
  const hash = createHash("sha1");
  const [ramPtr, ramLen] = core.ram(x);
  hash.update(new Uint8Array(x.memory.buffer, ramPtr, ramLen));
  const [picPtr, picLen] = core.picture(x);
  hash.update(new Uint8Array(x.memory.buffer, picPtr, picLen));
  const regs = ["Af", "Hl", "Pc", "Sp"].map((r) => x[`${p}GetCpu${r}`]());
  return `${regs.map((v) => v.toString(16)).join(":")}/${hash.digest("hex").slice(0, 12)}`;
}

function iterations(coreId, x) {
  const p = prefixOf(coreId);
  const read = x[`${p}ReadMemory`];
  return read ? read(ITERATIONS_ADDRESS) | (read(ITERATIONS_ADDRESS + 1) << 8) : undefined;
}

function timeFastFrames(x, p, frames) {
  const run = x[`${p}ExecuteFrame`];
  const start = performance.now();
  for (let i = 0; i < frames; i++) run();
  return performance.now() - start;
}

/* The hosts' per-instruction debug loop, without its JavaScript stop test */
function timeInstructionLoop(x, p, frames) {
  const step = x[`${p}ExecuteInstruction`];
  const pc = x[`${p}GetCpuPc`];
  const completed = x[`${p}GetFrameCompleted`];
  const start = performance.now();
  for (let f = 0; f < frames; f++) {
    let done = false;
    let guard = 0;
    while (!done && guard++ < 2_000_000) {
      step();
      pc();
      done = completed() !== 0;
    }
  }
  return performance.now() - start;
}

/* The Z88 and ZX80/81 hosts' in-core debug loop, no breakpoint set */
function timeUntilStop(x, p, frames) {
  const run = x[`${p}ExecuteUntilStop`];
  const completed = x[`${p}GetFrameCompleted`];
  const start = performance.now();
  for (let f = 0; f < frames; f++) {
    let guard = 0;
    do {
      run(NO_EXTRA_STOP, 0);
    } while (completed() === 0 && guard++ < 1000);
  }
  return performance.now() - start;
}

async function benchmarkScenario(coreId, scenarioId, artifacts, options) {
  const core = CORES[coreId];
  const p = prefixOf(coreId);
  options = { ...options, frames: options.frames * (core.frameScale ?? 1), warmup: options.warmup * (core.frameScale ?? 1) };
  const machines = [];
  for (const variant of options.variants) {
    const x = await instantiate(artifacts[variant.id].bytes);
    core.boot(x);
    core.scenarios[scenarioId](x);
    timeFastFrames(x, p, options.warmup);
    machines.push({ variant: variant.id, x, times: [] });
  }

  const startIterations = machines.map((m) => iterations(coreId, m.x));
  for (let round = 0; round < options.rounds; round++) {
    // --- Rotate the order so no variant always runs first in a round
    for (let i = 0; i < machines.length; i++) {
      const m = machines[(i + round) % machines.length];
      m.times.push(timeFastFrames(m.x, p, options.frames));
    }
  }

  // --- Every variant ran the same frames from the same state: they must agree exactly
  const prints = machines.map((m) => fingerprint(core, coreId, m.x));
  const identical = prints.every((f) => f === prints[0]);
  const endIterations = machines.map((m) => iterations(coreId, m.x));

  const ms = (m) => Math.min(...m.times) / options.frames;
  const byId = Object.fromEntries(machines.map((m) => [m.variant, ms(m)]));
  const base = byId.baseline;
  const result = {
    core: coreId,
    scenario: scenarioId,
    msPerFrame: byId,
    gainPercent: Object.fromEntries(
      machines.filter((m) => m.variant !== "baseline").map((m) =>
        // --- The strips are gains over the baseline; the baseline is a gain over the reference
        m.variant === "reference" ? ["baseline", (100 * (ms(m) - base)) / ms(m)] : [m.variant, (100 * (base - ms(m))) / base]
      )
    ),
    identical,
    fingerprints: identical ? undefined : Object.fromEntries(machines.map((m, i) => [m.variant, prints[i]])),
    programIterations:
      startIterations[0] === undefined || scenarioId.indexOf("mixed") < 0
        ? undefined
        : (endIterations[0] - startIterations[0] + 0x10000) % 0x10000
  };

  if (options.debugLoop) {
    const x = machines[0].x;
    const loopFrames = Math.max(10, Math.floor(options.frames / 4));
    const fast = [];
    const loop = [];
    const until = [];
    for (let round = 0; round < options.rounds; round++) {
      fast.push(timeFastFrames(x, p, loopFrames));
      loop.push(timeInstructionLoop(x, p, loopFrames));
      if (core.untilStop) until.push(timeUntilStop(x, p, loopFrames));
    }
    const min = (a) => Math.min(...a) / loopFrames;
    result.debugLoop = {
      fastMsPerFrame: min(fast),
      instructionLoopMsPerFrame: min(loop),
      instructionLoopSlowdown: min(loop) / min(fast),
      untilStopMsPerFrame: until.length ? min(until) : undefined,
      untilStopSlowdown: until.length ? min(until) / min(fast) : undefined
    };
  }
  return result;
}

// ----------------------------------------------------------------------------------------------
// Driver

function parseArgs(argv) {
  const options = { cores: Object.keys(CORES), frames: 200, rounds: 7, warmup: 50, debugLoop: false, json: false, keep: false, reference: undefined };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const next = () => argv[++i];
    if (a === "--core") options.cores = next().split(",");
    else if (a === "--frames") options.frames = Number(next());
    else if (a === "--rounds") options.rounds = Number(next());
    else if (a === "--warmup") options.warmup = Number(next());
    else if (a === "--debug-loop") options.debugLoop = true;
    else if (a === "--json") options.json = true;
    else if (a === "--keep") options.keep = true;
    else if (a === "--reference") options.reference = next();
    else throw new Error(`Unknown argument '${a}'`);
  }
  for (const c of options.cores) if (!CORES[c]) throw new Error(`Unknown core '${c}': ${Object.keys(CORES).join(", ")}`);
  return options;
}

function printRow(r) {
  const f = (v) => v.toFixed(3).padStart(7);
  const g = (v) => `${v >= 0 ? "+" : ""}${v.toFixed(1)}%`.padStart(7);
  const ref = r.msPerFrame.reference;
  let line =
    `${r.core.padEnd(7)} ${r.scenario.padEnd(16)} ` +
    (ref !== undefined ? `${f(ref)} ` : "") +
    `${f(r.msPerFrame.baseline)} ${f(r.msPerFrame["strip-stack"])} ` +
    `${f(r.msPerFrame["strip-all"])}  ` +
    (ref !== undefined ? `${g(r.gainPercent.baseline)} ` : "") +
    `${g(r.gainPercent["strip-stack"])} ${g(r.gainPercent["strip-all"])}  ` +
    `${r.identical ? "same" : "DIFFERENT"}`;
  if (r.programIterations !== undefined) line += `  iter ${r.programIterations}`;
  console.log(line);
  if (!r.identical) console.log("        ", JSON.stringify(r.fingerprints));
  if (r.debugLoop) {
    const d = r.debugLoop;
    let dl = `        debug loop: fast ${d.fastMsPerFrame.toFixed(3)} ms, per-instruction ${d.instructionLoopMsPerFrame.toFixed(3)} ms (x${d.instructionLoopSlowdown.toFixed(1)})`;
    if (d.untilStopMsPerFrame !== undefined) {
      dl += `, ExecuteUntilStop ${d.untilStopMsPerFrame.toFixed(3)} ms (x${d.untilStopSlowdown.toFixed(2)})`;
    }
    console.log(dl);
  }
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const outDir = mkdtempSync(join(tmpdir(), "klive-debug-overhead-"));
  const results = [];
  try {
    options.variants = [...VARIANTS];
    if (options.reference) {
      options.variants.push({ id: "reference", defines: [], sourceRoot: extractRevision(options.reference, outDir) });
    }
    if (!options.json) {
      const r = options.reference !== undefined;
      console.log(`frames ${options.frames} x ${options.rounds} rounds (min kept), warmup ${options.warmup}; ms per frame` +
        (r ? `; reference = ${options.reference}` : ""));
      console.log(`${"core".padEnd(7)} ${"scenario".padEnd(16)} ` + (r ? `${"ref".padStart(7)} ` : "") +
        `${"base".padStart(7)} ${"-stack".padStart(7)} ${"-all".padStart(7)}  ` + (r ? `${"base".padStart(7)} ` : "") +
        `${"stack".padStart(7)} ${"all".padStart(7)}`);
    }
    for (const coreId of options.cores) {
      const artifacts = {};
      for (const variant of options.variants) artifacts[variant.id] = compile(coreId, variant, outDir);
      const sizes = Object.fromEntries(options.variants.map((v) => [v.id, artifacts[v.id].bytes.length]));
      for (const scenarioId of Object.keys(CORES[coreId].scenarios)) {
        const r = await benchmarkScenario(coreId, scenarioId, artifacts, options);
        r.sizes = sizes;
        results.push(r);
        if (!options.json) printRow(r);
      }
    }
    if (options.json) console.log(JSON.stringify(results, null, 2));
    if (results.some((r) => !r.identical)) {
      console.error("A strip build emulated differently from the baseline: its guards removed real behaviour.");
      process.exitCode = 1;
    }
  } finally {
    if (options.keep) console.error(`artifacts kept in ${outDir}`);
    else rmSync(outDir, { recursive: true, force: true });
  }
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}

module.exports = { CORES, VARIANTS, mixedProgram };
