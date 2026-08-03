const { mkdirSync, readFileSync, statSync, writeFileSync } = require("node:fs");
const { dirname, resolve } = require("node:path");
const { performance } = require("node:perf_hooks");
const { buildSp48Wasm, layoutValues, output } = require("./build-sp48-wasm.cjs");

require("ts-node").register({
  transpileOnly: true,
  compilerOptions: {
    module: "commonjs",
    moduleResolution: "node",
    rootDir: "."
  }
});
require("tsconfig-paths/register");

const { ZxSpectrum48Machine } = require("../src/emu/machines/zxSpectrum48/ZxSpectrum48Machine");

const CPU_STATE_OFFSET = layoutValues.machineStateCpuStateOffset;
const CPU_PC_OFFSET = CPU_STATE_OFFSET + 24;
const CPU_TACTS_OFFSET = CPU_STATE_OFFSET + 28;
const CPU_FRAME_TACTS_OFFSET = CPU_STATE_OFFSET + 32;
const CPU_FRAMES_OFFSET = CPU_STATE_OFFSET + 36;
const CPU_TACTS_IN_FRAME_OFFSET = CPU_STATE_OFFSET + 40;
const INPUT_KEYBOARD_ROWS_OFFSET = layoutValues.inputKeyboardRowsOffset;
const INPUT_TAPE_MODE_OFFSET = layoutValues.inputTapeModeOffset;
const INPUT_TAPE_EAR_DEFAULT_OFFSET = layoutValues.inputTapeEarDefaultOffset;
const TAPE_MODE_LOAD = 1;

const COUNTER = {
  instructions: 0,
  memoryReads: 1,
  memoryWrites: 2,
  portReads: 3,
  portWrites: 4,
  contentionDelays: 5,
  floatingBusReads: 6,
  traceEvents: 7,
  tapeBoundaryYields: 8
};

const frameTacts = 69_888;
const repeats = Number(process.env.SP48_WASM_BENCH_REPEATS ?? 7);
const defaultFrames = Number(process.env.SP48_WASM_BENCH_FRAMES ?? 200);
const debugSteps = Number(process.env.SP48_WASM_BENCH_DEBUG_STEPS ?? 10_000);
const shouldWriteBaseline = process.argv.includes("--write-baseline");
const baselineOutput = resolve(__dirname, "..", ".ai", "zx-spectrum48-wasm-performance-baseline.md");

const scenarios = [
  {
    name: "idle-rom-loop",
    description: "NOP plus short relative jump in ROM.",
    frames: defaultFrames,
    rom: romLoop([0x00])
  },
  {
    name: "ram-heavy-loop",
    description: "Repeated contended RAM increment/read at 0x4000.",
    frames: defaultFrames,
    rom: romLoop([0x21, 0x00, 0x40, 0x34, 0x7e], 3)
  },
  {
    name: "contended-screen-loop",
    description: "Same RAM-heavy loop with every contention table tact set to 1.",
    frames: defaultFrames,
    rom: romLoop([0x21, 0x00, 0x40, 0x34, 0x7e], 3),
    setup: runtime => runtime.contentionTable.fill(1)
  },
  {
    name: "fe-border-audio-loop",
    description: "Alternating OUT (0xFE) writes, exercising border/audio traces.",
    frames: defaultFrames,
    rom: romLoop([0x3e, 0x18, 0xd3, 0xfe, 0x3e, 0x00, 0xd3, 0xfe])
  },
  {
    name: "keyboard-polling-loop",
    description: "Repeated IN A,(0xFE) keyboard polling.",
    frames: defaultFrames,
    rom: romLoop([0xdb, 0xfe]),
    setup: runtime => {
      for (let line = 0; line < 8; line++) runtime.input.setUint8(INPUT_KEYBOARD_ROWS_OFFSET + line, 0x1f);
      runtime.input.setUint8(INPUT_KEYBOARD_ROWS_OFFSET + 1, 0x1e);
    }
  },
  {
    name: "tape-load-ear-loop",
    description: "Repeated IN A,(0xFE) while tape LOAD mode samples the EAR table.",
    frames: defaultFrames,
    rom: romLoop([0xdb, 0xfe]),
    setup: runtime => {
      runtime.input.setUint8(INPUT_TAPE_MODE_OFFSET, TAPE_MODE_LOAD);
      runtime.input.setUint8(INPUT_TAPE_EAR_DEFAULT_OFFSET, 1);
      for (let tact = 0; tact < runtime.tapeEarTable.length; tact++) {
        runtime.tapeEarTable[tact] = (tact & 0x20) === 0 ? 1 : 0;
      }
    }
  },
  {
    name: "floating-bus-loop",
    description: "Repeated IN A,(0xFF) while the floating-bus table points at screen RAM.",
    frames: defaultFrames,
    rom: romLoop([0xdb, 0xff]),
    setup: runtime => {
      runtime.memory[0x4000] = 0xa5;
      for (let tact = 0; tact < runtime.floatingBusTable.byteLength / 2; tact++) {
        runtime.floatingBusTable.setUint16(tact * 2, 0x4000, true);
      }
    }
  },
  {
    name: "debug-step-nop-loop",
    description: "Instruction-bounded execution, one instruction per JS/WASM call.",
    debugSteps,
    rom: romLoop([0x00]),
    run: (runtime, steps) => {
      for (let index = 0; index < steps; index++) {
        runtime.exports.sp48_execute_instructions(1, frameTacts, 0);
      }
    }
  }
];

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});

async function main() {
  buildSp48Wasm();
  const artifactBytes = readFileSync(output);
  const module = await WebAssembly.compile(artifactBytes);
  const results = [];

  for (const scenario of scenarios) {
    const timings = [];
    let lastCounters;
    const typeScriptTimings = [];
    for (let repeat = 0; repeat < repeats; repeat++) {
      const runtime = await createRuntime(module, scenario);
      runtime.exports.sp48_diagnostics_reset();
      const started = performance.now();
      if (scenario.run) {
        scenario.run(runtime, scenario.debugSteps);
      } else {
        for (let frame = 0; frame < scenario.frames; frame++) {
          runtime.exports.sp48_execute_frame();
        }
      }
      timings.push(performance.now() - started);
      lastCounters = readCounters(runtime);

      const tsMachine = await createTypeScriptMachine(scenario);
      const tsStarted = performance.now();
      if (scenario.debugSteps == null) {
        for (let frame = 0; frame < scenario.frames; frame++) {
          tsMachine.executeMachineFrame();
        }
      } else {
        executeTypeScriptInstructions(tsMachine, scenario.debugSteps);
      }
      typeScriptTimings.push(performance.now() - tsStarted);
    }
    results.push({
      name: scenario.name,
      description: scenario.description,
      iterations: scenario.debugSteps ?? scenario.frames,
      unit: scenario.debugSteps == null ? "frames" : "steps",
      typeScriptMedianMs: round3(median(typeScriptTimings)),
      typeScriptMinMs: round3(Math.min(...typeScriptTimings)),
      typeScriptMaxMs: round3(Math.max(...typeScriptTimings)),
      wasmMedianMs: round3(median(timings)),
      wasmMinMs: round3(Math.min(...timings)),
      wasmMaxMs: round3(Math.max(...timings)),
      counters: lastCounters
    });
  }

  const report = {
    generatedAt: new Date().toISOString(),
    artifact: output,
    artifactBytes: statSync(output).size,
    repeats,
    frameTacts,
    results
  };

  console.log(JSON.stringify(report, null, 2));
  if (shouldWriteBaseline) {
    mkdirSync(dirname(baselineOutput), { recursive: true });
    writeFileSync(baselineOutput, renderBaselineMarkdown(report));
    console.log(`Wrote ${baselineOutput}`);
  }
}

async function createRuntime(module, scenario) {
  const instance = await WebAssembly.instantiate(module, {});
  const exports = instance.exports;
  const memoryBuffer = exports.memory.buffer;
  const runtime = {
    exports,
    memory: new Uint8Array(memoryBuffer, exports.sp48_memory_ptr(), exports.sp48_memory_size()),
    machineState: new DataView(memoryBuffer, exports.sp48_machine_state_block_ptr(), layoutValues.machineStateBlockSize),
    input: new DataView(memoryBuffer, exports.sp48_input_block_ptr(), layoutValues.inputBlockSize),
    contentionTable: new Uint8Array(memoryBuffer, exports.sp48_contention_table_ptr(), exports.sp48_timing_table_capacity()),
    floatingBusTable: new DataView(
      memoryBuffer,
      exports.sp48_floating_bus_table_ptr(),
      exports.sp48_timing_table_capacity() * 2
    ),
    tapeEarTable: new Uint8Array(memoryBuffer, exports.sp48_tape_ear_table_ptr(), layoutValues.tapeEarTableCapacity)
  };

  exports.sp48_reset();
  for (let address = 0; address < scenario.rom.length; address++) {
    exports.sp48_load_rom_byte(address, scenario.rom[address]);
  }
  runtime.input.setUint8(INPUT_TAPE_EAR_DEFAULT_OFFSET, 1);
  runtime.machineState.setUint16(CPU_PC_OFFSET, 0, true);
  runtime.machineState.setUint32(CPU_TACTS_OFFSET, 0, true);
  runtime.machineState.setUint32(CPU_FRAME_TACTS_OFFSET, 0, true);
  runtime.machineState.setUint32(CPU_FRAMES_OFFSET, 0, true);
  runtime.machineState.setUint32(CPU_TACTS_IN_FRAME_OFFSET, frameTacts, true);
  scenario.setup?.(runtime);
  exports.sp48_import_state();
  return runtime;
}

async function createTypeScriptMachine(scenario) {
  class BenchmarkSpectrum48Machine extends ZxSpectrum48Machine {
    constructor(rom) {
      super();
      this.rom = rom;
    }

    async loadRomFromResource() {
      return this.rom;
    }
  }

  const machine = new BenchmarkSpectrum48Machine(scenario.rom);
  await machine.setup();
  machine.setTactsInFrame(frameTacts);
  if (scenario.name === "contended-screen-loop") {
    for (let tact = 0; tact < frameTacts; tact++) {
      machine.setContentionValue(tact, 1);
    }
  }
  return machine;
}

function executeTypeScriptInstructions(machine, count) {
  for (let index = 0; index < count; index++) {
    do {
      machine.executeCpuCycle();
    } while (machine.instructionExecutionInProgress());
  }
}

function romLoop(body, loopOffset = 0) {
  const rom = new Uint8Array(0x4000);
  rom.set(body);
  const jumpAddress = body.length;
  rom[jumpAddress] = 0x18;
  rom[jumpAddress + 1] = (loopOffset - (jumpAddress + 2)) & 0xff;
  return rom;
}

function readCounters(runtime) {
  return {
    instructions: runtime.exports.sp48_diagnostics_value(COUNTER.instructions),
    memoryReads: runtime.exports.sp48_diagnostics_value(COUNTER.memoryReads),
    memoryWrites: runtime.exports.sp48_diagnostics_value(COUNTER.memoryWrites),
    portReads: runtime.exports.sp48_diagnostics_value(COUNTER.portReads),
    portWrites: runtime.exports.sp48_diagnostics_value(COUNTER.portWrites),
    contentionDelays: runtime.exports.sp48_diagnostics_value(COUNTER.contentionDelays),
    floatingBusReads: runtime.exports.sp48_diagnostics_value(COUNTER.floatingBusReads),
    traceEvents: runtime.exports.sp48_diagnostics_value(COUNTER.traceEvents),
    tapeBoundaryYields: runtime.exports.sp48_diagnostics_value(COUNTER.tapeBoundaryYields)
  };
}

function median(values) {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[middle - 1] + sorted[middle]) / 2
    : sorted[middle];
}

function round3(value) {
  return Number(value.toFixed(3));
}

function renderBaselineMarkdown(report) {
  const rows = report.results
    .map(result => [
      result.name,
      `${result.iterations} ${result.unit}`,
      result.typeScriptMedianMs,
      result.typeScriptMinMs,
      result.typeScriptMaxMs,
      result.wasmMedianMs,
      result.wasmMinMs,
      result.wasmMaxMs,
      result.counters.instructions,
      result.counters.memoryReads,
      result.counters.memoryWrites,
      result.counters.portReads,
      result.counters.portWrites,
      result.counters.contentionDelays,
      result.counters.floatingBusReads,
      result.counters.traceEvents,
      result.counters.tapeBoundaryYields
    ].join(" | "))
    .map(row => `| ${row} |`)
    .join("\n");

  return `# ZX Spectrum 48K WASM Performance Baseline

Generated by \`npm run benchmark:sp48-wasm -- --write-baseline\`.

- Generated at: ${report.generatedAt}
- Artifact: \`${report.artifact}\`
- Artifact size: ${report.artifactBytes} bytes
- Repeats per scenario: ${report.repeats}
- Frame tacts: ${report.frameTacts}

| Scenario | Iterations | TS median ms | TS min ms | TS max ms | WASM median ms | WASM min ms | WASM max ms | Instr | Mem R | Mem W | Port R | Port W | Contention | Floating | Traces | Tape yields |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
${rows}
`;
}
