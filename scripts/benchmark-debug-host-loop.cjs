#!/usr/bin/env node
/*
 * What "running with debugging" costs on the real machine hosts (`.plans/WASM_CORE_LEAN_AND_DEBUG_PLAN.md`
 * Phase 0, §1.2): the production cores driven through their TypeScript machines (`*WasmV2Machine`),
 * built by the test harnesses, timing `executeMachineFrame()` in three modes:
 *   - run:        NoDebug + Normal - a plain Run, one core call per frame;
 *   - debug:      StopAtBreakpoint + DebugEvent with one execution breakpoint that is never hit - a
 *                 debug session running freely;
 *   - exec-point: NoDebug + UntilExecutionPoint at an address never reached - the project-start boot
 *                 (`ReachExecPoint`) before it arrives;
 *   - history:    the debug session with execution history recording (advanced debugging), the
 *                 recorder on only for this mode;
 *   - access:     the debug session with a memory-read and a port-write breakpoint never hit (D14's 4b row);
 *   - cond:       the debug session with a conditional breakpoint on the mixed loop's hottest instruction
 *                 whose condition is never true (D14's 4c row; machines without the mixed loop skip it).
 * The workload is `benchmark-debug-overhead.cjs`'s mixed RAM loop (ROM-booted on the Spectrums).
 *
 * `--source-step` instead times a Klive BASIC Step Over of a call that runs 2,000 loop iterations, in the
 * core (stops at statement entries and return points only, Phase 4d) and instruction by instruction.
 *
 * Usage: node scripts/benchmark-debug-host-loop.cjs [--core sp48,zxnext] [--frames 100] [--rounds 5] [--json]
 *        node scripts/benchmark-debug-host-loop.cjs --source-step [--rounds 5]
 */
const { existsSync, readFileSync } = require("node:fs");
const { dirname, resolve } = require("node:path");
const { performance } = require("node:perf_hooks");
const { mixedProgram } = require("./benchmark-debug-overhead.cjs");

const root = resolve(__dirname, "..");
const NEVER = 0x7000;

// --- FrameTerminationMode / DebugStepMode values (src/emu/abstractions)
const FTM = { Normal: 0, DebugEvent: 1, UntilExecutionPoint: 2 };
const DSM = { NoDebug: 0, StopAtBreakpoint: 1 };

function loadMixed(x, p, di) {
  const program = mixedProgram({ port: p === "z88" ? 0xffb2 : 0x7ffe, di });
  program.forEach((v, i) => x[`${p}WriteMemory`](0x8000 + i, v));
  x[`${p}SetCpuPc`](0x8000);
  x[`${p}SetCpuSp`](0xbff0);
}

const HOSTS = {
  sp48: {
    async create() {
      const s = await require("../test/harness/sp48/index.ts").createSp48Session();
      s.bootToBasic();
      return { machine: s.machine, prefix: "sp48", di: false };
    }
  },
  sp128: {
    async create() {
      const s = await require("../test/harness/sp128/index.ts").createSp128Session("sp128");
      s.runFrames(150);
      return { machine: s.machine, prefix: "sp128", di: false };
    }
  },
  spp3e: {
    async create() {
      const s = await require("../test/harness/sp128/index.ts").createSp128Session("nofdd");
      s.runFrames(150);
      return { machine: s.machine, prefix: "spp3e", di: false };
    }
  },
  zxnext: {
    async create() {
      const s = await require("../test/harness/zxnext/index.ts").createSession();
      return { machine: s.machine, prefix: "zxnext", di: true };
    }
  },
  z88: {
    async create() {
      const s = await require("../test/harness/z88/index.ts").createZ88Session({ audioSampleRate: 44100 });
      const L = require("../test/harness/z88/index.ts").Z88_FLAT_RAM_LAYOUT;
      const x = s.machine.wasmV2Runtime.exports;
      x.z88SetCom(L.COM);
      [L.SR0, L.SR1, L.SR2, L.SR3].forEach((b, i) => x.z88SetSr(i, b));
      return { machine: s.machine, prefix: "z88", di: true };
    }
  },
  // --- A Klive BASIC program on the 48K under the source debugger: the statement tracker and the
  // --- error stops wired as MachineController wires them (D14's BASIC row)
  kbasic: {
    async create() {
      const { startBasic } = require("../test/kbasic/codegen/run-kit.ts");
      const { CurrentStatementTracker, SourceDebugIndex } = require("../src/emu/machines/SourceStepDecision.ts");
      const source = [
        "DIM i AS UInteger",
        "DIM s AS ULong",
        "DO",
        "  FOR i = 1 TO 1000",
        "    s = s + i",
        "  NEXT i",
        "LOOP",
        ""
      ].join("\n");
      const { session, generated } = await startBasic(source);
      const info = generated.debug.sourceLevel;
      const index = new SourceDebugIndex(info);
      return {
        machine: session.machine,
        prefix: "sp48",
        noMixed: true,
        prepare(debugSupport) {
          debugSupport.errorStopAddress = info.extensions.errorEntry;
          debugSupport.romErrorAddress = 0x0008;
          debugSupport.statementTracker = new CurrentStatementTracker(index);
        }
      };
    }
  },
  zx8081: {
    async create() {
      const s = await require("../test/harness/zx81/index.ts").createZx81Session();
      s.bootToBasic();
      // --- The ZX81 runs its own display loop in ROM: the workload is the SLOW-mode prompt
      return { machine: s.machine, prefix: "zx8081", noMixed: true };
    }
  }
};

function setMode(machine, mode, debugSupport, accessSupport, condSupport) {
  const ctx = machine.executionContext;
  machine.setHistoryEnabled?.(mode === "history");
  if (mode === "run") {
    ctx.debugStepMode = DSM.NoDebug;
    ctx.frameTerminationMode = FTM.Normal;
    ctx.debugSupport = undefined;
  } else if (mode === "debug" || mode === "history" || mode === "access" || mode === "cond") {
    ctx.debugStepMode = DSM.StopAtBreakpoint;
    ctx.frameTerminationMode = FTM.DebugEvent;
    ctx.debugSupport = mode === "access" ? accessSupport : mode === "cond" ? condSupport : debugSupport;
  } else {
    ctx.debugStepMode = DSM.NoDebug;
    ctx.frameTerminationMode = FTM.UntilExecutionPoint;
    ctx.terminationPoint = NEVER;
    ctx.debugSupport = undefined;
  }
}

function timeFrames(machine, frames) {
  const start = performance.now();
  for (let i = 0; i < frames; i++) {
    const r = machine.executeMachineFrame();
    if (r !== FTM.Normal) throw new Error(`Frame ended with termination ${r} at PC=${machine.pc.toString(16)}`);
  }
  return performance.now() - start;
}

async function benchmarkHost(id, options) {
  const { DebugSupport } = require("../src/emu/machines/DebugSupport.ts");
  const { connectConditionSupport } = require("../src/emu/machines/conditionStore.ts");
  const host = await HOSTS[id].create();
  const { machine, prefix } = host;
  if (!host.noMixed) loadMixed(machine.wasmV2Runtime.exports, prefix, host.di);
  const debugSupport = new DebugSupport(undefined, []);
  debugSupport.addBreakpoint({ address: NEVER, exec: true });
  host.prepare?.(debugSupport);
  const accessSupport = new DebugSupport(undefined, []);
  accessSupport.addBreakpoint({ address: NEVER, exec: true });
  accessSupport.addBreakpoint({ address: 0xbfff, memoryRead: true });
  accessSupport.addBreakpoint({ address: 0x1234, ioWrite: true });
  host.prepare?.(accessSupport);
  // --- The mixed loop's inner `add a,b` runs 32 times an iteration with B from 32 down to 1: never 0
  const code = mixedProgram({ port: 0, di: false });
  const hot = 0x8000 + code.findIndex((v, i) => v === 0x06 && code[i + 1] === 0x20) + 2;
  const condSupport = new DebugSupport(undefined, []);
  if (!host.noMixed) {
    connectConditionSupport(condSupport, machine);
    condSupport.addBreakpoint({ address: hot, exec: true, condition: "B == 0" });
  }
  host.prepare?.(condSupport);

  const modes = ["run", "debug", "exec-point", "history", "access", "cond"];
  const times = Object.fromEntries(modes.map((m) => [m, []]));
  for (const m of modes) {
    setMode(machine, m, debugSupport, accessSupport, condSupport);
    timeFrames(machine, Math.ceil(options.frames / 5));
  }
  for (let round = 0; round < options.rounds; round++) {
    for (let i = 0; i < modes.length; i++) {
      const m = modes[(i + round) % modes.length];
      setMode(machine, m, debugSupport, accessSupport, condSupport);
      times[m].push(timeFrames(machine, options.frames));
    }
  }
  setMode(machine, "run");
  const ms = (m) => Math.min(...times[m]) / options.frames;
  return {
    core: id,
    msPerFrame: Object.fromEntries(modes.map((m) => [m, ms(m)])),
    slowdown: { debug: ms("debug") / ms("run"), "exec-point": ms("exec-point") / ms("run"), history: ms("history") / ms("run"), access: ms("access") / ms("run"), cond: ms("cond") / ms("run") }
  };
}

// ---------------------------------------------------------------------------------------------
// Loading the TypeScript sources in plain Node (the pattern of `benchmark-z88-wasm.cjs`)

function registerTsRuntime() {
  const esbuild = require("esbuild");
  require.extensions[".ts"] = (module, filename) => {
    const result = esbuild.transformSync(readFileSync(filename, "utf8"), {
      format: "cjs",
      loader: "ts",
      platform: "node",
      target: "es2020",
      tsconfigRaw: { compilerOptions: { esModuleInterop: true, useDefineForClassFields: false } }
    });
    module._compile(result.code, filename);
  };
  require("tsconfig-paths").register({
    baseUrl: root,
    paths: {
      "@abstractions/*": ["src/common/abstractions/*"],
      "@common/*": ["src/common/*"],
      "@messaging/*": ["src/common/messaging/*"],
      "@state/*": ["src/common/state/*"],
      "@utils/*": ["src/common/utils/*"],
      "@renderer/*": ["src/renderer/*"],
      "@emu/*": ["src/emu/*"],
      "@appIde/*": ["src/renderer/appIde/*"],
      "@main/*": ["src/main/*"],
      "@controls/*": ["src/renderer/controls/*"]
    }
  });
  const Module = require("node:module");
  const original = Module._resolveFilename;
  Module._resolveFilename = function (request, parent, isMain, opts) {
    try {
      return original.call(this, request, parent, isMain, opts);
    } catch (error) {
      if (error?.code === "MODULE_NOT_FOUND" && request.startsWith(".") && parent?.filename) {
        for (const candidate of [`${request}.ts`, `${request}/index.ts`]) {
          const path = resolve(dirname(parent.filename), candidate);
          if (existsSync(path)) return path;
        }
      }
      throw error;
    }
  };
}

/* Step Over a call to a SUB that loops 2,000 times, on the 48K, in the core and instruction by instruction */
async function benchmarkSourceStep(rounds) {
  const { startBasic } = require("../test/kbasic/codegen/run-kit.ts");
  const { SourceDebugIndex } = require("../src/emu/machines/SourceStepDecision.ts");
  const { wasmDebugLoopOptions } = require("../src/emu/machines/wasmDebugLoop.ts");
  const source = [
    "SUB Heavy()",
    "  DIM i AS UInteger",
    "  DIM s AS ULong",
    "  FOR i = 1 TO 2000",
    "    s = s + i",
    "  NEXT i",
    "END SUB",
    "DO",
    "  Heavy",
    "LOOP",
    ""
  ].join("\n");
  const { session, generated } = await startBasic(source);
  const index = new SourceDebugIndex(generated.debug.sourceLevel);
  session.attachDebugSupport();
  // --- To the call statement (`Heavy`); from there Step Over alternates between the whole call and `LOOP`
  session.sourceStep(index, "into", { maxFrames: 2000 });
  const time = (inCore, steps) => {
    wasmDebugLoopOptions.inCore = inCore;
    const start = performance.now();
    for (let i = 0; i < steps; i++) session.sourceStep(index, "over", { maxFrames: 2000 });
    wasmDebugLoopOptions.inCore = true;
    return (performance.now() - start) / steps;
  };
  time(true, 4);
  time(false, 4);
  const results = { inCore: [], perInstruction: [] };
  for (let r = 0; r < rounds; r++) {
    results.inCore.push(time(true, 10));
    results.perInstruction.push(time(false, 10));
  }
  const min = (a) => Math.min(...a);
  console.log(
    `source Step Over (half of them a 2,000-iteration call): in the core ${min(results.inCore).toFixed(2)} ms, ` +
      `instruction by instruction ${min(results.perInstruction).toFixed(2)} ms ` +
      `(x${(min(results.perInstruction) / min(results.inCore)).toFixed(1)} faster)`
  );
}

async function main() {
  const options = { cores: Object.keys(HOSTS), frames: 100, rounds: 5, json: false };
  const argv = process.argv.slice(2);
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--core") options.cores = argv[++i].split(",");
    else if (argv[i] === "--frames") options.frames = Number(argv[++i]);
    else if (argv[i] === "--rounds") options.rounds = Number(argv[++i]);
    else if (argv[i] === "--json") options.json = true;
    else if (argv[i] === "--source-step") options.sourceStep = true;
    else throw new Error(`Unknown argument '${argv[i]}'`);
  }
  registerTsRuntime();
  if (options.sourceStep) return benchmarkSourceStep(options.rounds);
  const results = [];
  for (const id of options.cores) {
    const r = await benchmarkHost(id, options);
    results.push(r);
    if (!options.json) {
      const m = r.msPerFrame;
      console.log(
        `${id.padEnd(7)} run ${m.run.toFixed(3)} ms   debug ${m.debug.toFixed(3)} ms (x${r.slowdown.debug.toFixed(1)})   ` +
          `exec-point ${m["exec-point"].toFixed(3)} ms (x${r.slowdown["exec-point"].toFixed(1)})   ` +
          `history ${m.history.toFixed(3)} ms (x${r.slowdown.history.toFixed(2)})   ` +
          `access ${m.access.toFixed(3)} ms (x${r.slowdown.access.toFixed(2)})   ` +
          `cond ${m.cond.toFixed(3)} ms (x${r.slowdown.cond.toFixed(2)})`
      );
    }
  }
  if (options.json) console.log(JSON.stringify(results, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
