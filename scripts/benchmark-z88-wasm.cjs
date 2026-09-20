#!/usr/bin/env node

/*
 * Cambridge Z88: TypeScript vs WASM, milliseconds per 5 ms machine frame.
 *
 * Both backends are driven through the Z88 test harness (`test/harness/z88`) - the same public machine
 * API the app's emulator loop uses (`executeMachineFrame`, keys, audio, the LCD), so a figure includes
 * the adapter's work, not only the core's. Step 12 of `.plans/CAMBRIDGE_Z88_WASM_MIGRATION_PLAN.md`;
 * the results are recorded in `src/emu/machines/z88/wasm/README.md`.
 *
 *   node scripts/benchmark-z88-wasm.cjs [--frames 200] [--runs 5] [--scenario id] [--json]
 */

const { existsSync, readFileSync } = require("node:fs");
const { dirname, resolve } = require("node:path");
const { performance } = require("node:perf_hooks");

const root = resolve(__dirname, "..");

const DEFAULTS = { frames: 200, runs: 5, warmup: 20 };

/* A flat-RAM program for the harness's `loadCode` */
const CPU_LOOP = `
      .org $8000
start:
      ld hl,$a000
      ld b,0
loop: ld a,(hl)
      add a,b
      ld (hl),a
      inc hl
      res 6,h
      set 5,h
      djnz loop
      jr loop
`;

const BEEPER = `
      .org $8000
start:
      ld c,0
next: ld a,$45
      out ($b0),a
      ld b,c
w1:   djnz w1
      ld a,$05
      out ($b0),a
      ld b,c
w2:   djnz w2
      inc c
      jr next
`;

const LCD = `
      .org $8000
start:
      ld hl,$4000
loop: inc (hl)
      inc hl
      res 7,h
      set 6,h
      jr loop
`;

const FLASH = `
      .org $8000
start:
      ld a,$41
      out ($d3),a
      ld hl,$c000
prog: ld a,$aa
      ld ($c555),a
      ld a,$55
      ld ($c2aa),a
      ld a,$a0
      ld ($c555),a
      ld a,l
      ld (hl),a
poll: ld a,(hl)
      ld c,a
      ld a,(hl)
      xor c
      and $40
      jr nz,poll
      inc hl
      ld a,h
      or $c0
      ld h,a
      jr prog
`;

function outWord(s, port, value) {
  s.out(((value >> 8) << 8) | port, value & 0xff);
}

const SCENARIOS = [
  {
    id: "oz-idle",
    label: "OZ 5.0 booted, idle (snoozing)",
    async setup(h, backend) {
      const s = await h.createZ88Session({ backend, model: "OZ50", rom: "model", audioSampleRate: 44100 });
      s.runFrames(1700);
      return s;
    },
    frame: (s) => s.runFrames(1)
  },
  {
    id: "oz-typing",
    label: "OZ 5.0 at the keyboard",
    async setup(h, backend) {
      const s = await h.createZ88Session({ backend, model: "OZ50", rom: "model", audioSampleRate: 44100 });
      s.runFrames(1700);
      s.keyDown("Index").runFrames(6).keyUp("Index").runFrames(30);
      return s;
    },
    frame: (s, i) => {
      const keys = ["A", "B", "C", "Delete", "Delete", "Delete"];
      const key = keys[Math.floor(i / 8) % keys.length];
      if (i % 8 === 0) s.keyDown(key);
      if (i % 8 === 4) s.keyUp(key);
      s.runFrames(1);
    }
  },
  {
    id: "cpu-loop",
    label: "CPU-heavy loop (flat RAM)",
    async setup(h, backend) {
      const s = await h.createZ88Session({ backend, audioSampleRate: 44100 });
      await s.loadCode(CPU_LOOP, { entry: "start" });
      return s;
    },
    frame: (s) => s.runFrames(1)
  },
  {
    id: "lcd-800x480",
    label: "800x480 LCD drawing changing screen memory",
    async setup(h, backend) {
      const model = h.z88Model();
      const config = { ...model.config, screenSize: "800x480" };
      const s = await h.createZ88Session({ backend, config, audioSampleRate: 44100 });
      await s.loadCode(LCD, { entry: "start" });
      outWord(s, 0x70, (0x21 << 5) | (0x1200 >> 9));
      outWord(s, 0x71, (0x21 << 2) | (0x1000 >> 12));
      outWord(s, 0x72, (0x20 << 1) | (0x2000 >> 13));
      outWord(s, 0x73, (0x21 << 3) | (0x2800 >> 11));
      outWord(s, 0x74, (0x21 << 3) | (0x0000 >> 11));
      s.out(0xb0, 0x05);
      return s;
    },
    frame: (s) => s.runFrames(1)
  },
  {
    id: "beeper",
    label: "Beeper toggling (44.1 kHz)",
    async setup(h, backend) {
      const s = await h.createZ88Session({ backend, audioSampleRate: 44100 });
      await s.loadCode(BEEPER, { entry: "start" });
      return s;
    },
    frame: (s) => {
      s.runFrames(1);
      s.machine.getAudioSamples();
    }
  },
  {
    id: "flash-program",
    label: "AMD flash programming loop (slot 1)",
    async setup(h, backend) {
      const s = await h.createZ88Session({ backend, audioSampleRate: 44100 });
      await s.loadCode(FLASH, { entry: "start" });
      await s.plugCard(1, { cardType: "AMDF29F040B", size: 512 });
      return s;
    },
    frame: (s) => s.runFrames(1)
  },
  {
    id: "debug-run",
    label: "Running under the debugger, a breakpoint set (never hit)",
    async setup(h, backend) {
      const s = await h.createZ88Session({ backend, audioSampleRate: 44100 });
      await s.loadCode(CPU_LOOP, { entry: "start" });
      s.breakpoint(0x7000);
      const ctx = s.machine.executionContext;
      ctx.frameTerminationMode = 1; // FrameTerminationMode.DebugEvent
      ctx.debugStepMode = 1; // DebugStepMode.StopAtBreakpoint
      return s;
    },
    frame: (s) => {
      s.machine.executeMachineFrame();
    }
  },
  {
    id: "debug-step",
    label: "Debugger step-into x 200 (per frame of steps)",
    async setup(h, backend) {
      const s = await h.createZ88Session({ backend, audioSampleRate: 44100 });
      await s.loadCode(CPU_LOOP, { entry: "start" });
      return s;
    },
    frame: (s) => {
      for (let i = 0; i < 200; i++) s.debug("stepInto");
    }
  }
];

function parseArgs(argv) {
  const options = { ...DEFAULTS, json: false, scenario: null };
  if (argv.length === 0) return options;
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    switch (arg) {
      case "--frames":
      case "--runs":
      case "--warmup": {
        const value = Number.parseInt(argv[++i], 10);
        if (!(value > 0)) throw new Error(`${arg} needs a positive integer`);
        options[arg.slice(2)] = value;
        break;
      }
      case "--scenario":
        options.scenario = argv[++i];
        if (!SCENARIOS.some((s) => s.id === options.scenario)) {
          throw new Error(`Unknown scenario '${options.scenario}'. Known: ${SCENARIOS.map((s) => s.id).join(", ")}`);
        }
        break;
      case "--json":
        options.json = true;
        break;
      case "--help":
      case "-h":
        options.help = true;
        break;
      default:
        throw new Error(`Unknown argument '${arg}'. Run with --help for usage.`);
    }
  }
  return options;
}

async function measure(h, scenario, backend, options) {
  const values = [];
  for (let run = 0; run < options.runs; run++) {
    const s = await scenario.setup(h, backend);
    for (let i = 0; i < options.warmup; i++) scenario.frame(s, i);
    const start = performance.now();
    for (let i = 0; i < options.frames; i++) scenario.frame(s, i);
    values.push((performance.now() - start) / options.frames);
  }
  values.sort((a, b) => a - b);
  return { median: values[Math.floor(values.length / 2)], min: values[0], max: values[values.length - 1] };
}

/**
 * Runs the scenarios on both backends.
 * @param options `parseArgs` options (frames, runs, warmup, scenario)
 * @param harness The Z88 test harness module; loaded here (with a TypeScript hook) when not given,
 * which is how a test runner that already compiles TypeScript passes its own
 */
async function benchmarkZ88(options, harness) {
  let h = harness;
  if (!h) {
    registerTsRuntime();
    h = require("../test/harness/z88/index.ts");
  }
  const results = [];
  for (const scenario of SCENARIOS.filter((s) => !options.scenario || s.id === options.scenario)) {
    const typescript = await measure(h, scenario, "typescript", options);
    const wasm = await measure(h, scenario, "wasm", options);
    results.push({ id: scenario.id, label: scenario.label, typescript, wasm, speedup: typescript.median / wasm.median });
  }
  const artifact = resolve(root, "src/emu/machines/z88/wasm/dist/cambridge-z88.wasm");
  return { options, artifactBytes: existsSync(artifact) ? readFileSync(artifact).length : null, results };
}

function printTable(report) {
  const { options, results, artifactBytes } = report;
  const f = (v) => v.toFixed(3).padStart(8);
  console.log(
    `Cambridge Z88: TypeScript vs WASM (${options.frames} frames/run, ${options.warmup} warmup, ${options.runs} runs)`
  );
  console.log(`WASM artifact: ${artifactBytes?.toLocaleString("en-US") ?? "?"} bytes`);
  console.log("scenario          TS ms/frame   WASM ms/frame   WASM faster by");
  for (const r of results) {
    console.log(`${r.id.padEnd(17)} ${f(r.typescript.median)}      ${f(r.wasm.median)}        ${r.speedup.toFixed(1)}x`);
  }
}

// ---------------------------------------------------------------------------------------------
// Loading the TypeScript sources in plain Node (the pattern of `benchmark-zxnext-wasm.cjs`)

let tsRuntimeRegistered = false;

function registerTsRuntime() {
  if (tsRuntimeRegistered) return;
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
  tsRuntimeRegistered = true;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    console.log(`Usage: node scripts/benchmark-z88-wasm.cjs [--frames n] [--runs n] [--warmup n] [--scenario id] [--json]
Scenarios: ${SCENARIOS.map((s) => s.id).join(", ")}`);
    return;
  }
  const report = await benchmarkZ88(options);
  if (options.json) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    printTable(report);
  }
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error.stack ?? error.message);
    process.exitCode = 1;
  });
}

module.exports = { SCENARIOS, benchmarkZ88, parseArgs };
