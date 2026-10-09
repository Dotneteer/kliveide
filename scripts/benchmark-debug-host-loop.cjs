#!/usr/bin/env node
/*
 * What "running with debugging" costs on the real machine hosts (`.plans/WASM_CORE_LEAN_AND_DEBUG_PLAN.md`
 * Phase 0, §1.2): the production cores driven through their TypeScript machines (`*WasmV2Machine`),
 * built by the test harnesses, timing `executeMachineFrame()` in three modes:
 *   - run:        NoDebug + Normal - a plain Run, one core call per frame;
 *   - debug:      StopAtBreakpoint + DebugEvent with one execution breakpoint that is never hit - a
 *                 debug session running freely;
 *   - exec-point: NoDebug + UntilExecutionPoint at an address never reached - the project-start boot
 *                 (`ReachExecPoint`) before it arrives.
 * The workload is `benchmark-debug-overhead.cjs`'s mixed RAM loop (ROM-booted on the Spectrums).
 *
 * Usage: node scripts/benchmark-debug-host-loop.cjs [--core sp48,zxnext] [--frames 100] [--rounds 5] [--json]
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
  zx8081: {
    async create() {
      const s = await require("../test/harness/zx81/index.ts").createZx81Session();
      s.bootToBasic();
      // --- The ZX81 runs its own display loop in ROM: the workload is the SLOW-mode prompt
      return { machine: s.machine, prefix: "zx8081", noMixed: true };
    }
  }
};

function setMode(machine, mode, debugSupport) {
  const ctx = machine.executionContext;
  if (mode === "run") {
    ctx.debugStepMode = DSM.NoDebug;
    ctx.frameTerminationMode = FTM.Normal;
    ctx.debugSupport = undefined;
  } else if (mode === "debug") {
    ctx.debugStepMode = DSM.StopAtBreakpoint;
    ctx.frameTerminationMode = FTM.DebugEvent;
    ctx.debugSupport = debugSupport;
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
  const host = await HOSTS[id].create();
  const { machine, prefix } = host;
  if (!host.noMixed) loadMixed(machine.wasmV2Runtime.exports, prefix, host.di);
  const debugSupport = new DebugSupport(undefined, []);
  debugSupport.addBreakpoint({ address: NEVER, exec: true });

  const modes = ["run", "debug", "exec-point"];
  const times = Object.fromEntries(modes.map((m) => [m, []]));
  for (const m of modes) {
    setMode(machine, m, debugSupport);
    timeFrames(machine, Math.ceil(options.frames / 5));
  }
  for (let round = 0; round < options.rounds; round++) {
    for (let i = 0; i < modes.length; i++) {
      const m = modes[(i + round) % modes.length];
      setMode(machine, m, debugSupport);
      times[m].push(timeFrames(machine, options.frames));
    }
  }
  setMode(machine, "run");
  const ms = (m) => Math.min(...times[m]) / options.frames;
  return {
    core: id,
    msPerFrame: Object.fromEntries(modes.map((m) => [m, ms(m)])),
    slowdown: { debug: ms("debug") / ms("run"), "exec-point": ms("exec-point") / ms("run") }
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

async function main() {
  const options = { cores: Object.keys(HOSTS), frames: 100, rounds: 5, json: false };
  const argv = process.argv.slice(2);
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--core") options.cores = argv[++i].split(",");
    else if (argv[i] === "--frames") options.frames = Number(argv[++i]);
    else if (argv[i] === "--rounds") options.rounds = Number(argv[++i]);
    else if (argv[i] === "--json") options.json = true;
    else throw new Error(`Unknown argument '${argv[i]}'`);
  }
  registerTsRuntime();
  const results = [];
  for (const id of options.cores) {
    const r = await benchmarkHost(id, options);
    results.push(r);
    if (!options.json) {
      const m = r.msPerFrame;
      console.log(
        `${id.padEnd(7)} run ${m.run.toFixed(3)} ms   debug ${m.debug.toFixed(3)} ms (x${r.slowdown.debug.toFixed(1)})   ` +
          `exec-point ${m["exec-point"].toFixed(3)} ms (x${r.slowdown["exec-point"].toFixed(1)})`
      );
    }
  }
  if (options.json) console.log(JSON.stringify(results, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
