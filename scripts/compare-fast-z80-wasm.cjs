const { mkdirSync, readFileSync, statSync, writeFileSync } = require("node:fs");
const { dirname, resolve } = require("node:path");
const { performance } = require("node:perf_hooks");
const {
  buildSp48Wasm,
  fastZ80ReferenceOutput,
  fastZ80TestOutput,
  testOutput
} = require("./build-sp48-wasm.cjs");

const repeats = Number(process.env.Z80_WASM_FAST_REFERENCE_REPEATS ?? 9);
const iterations = Number(process.env.Z80_WASM_FAST_REFERENCE_ITERATIONS ?? 10000);
const currentMode = process.env.Z80_WASM_CURRENT_MODE ?? "test";
const currentOutput = currentMode === "fast-z80-test" ? fastZ80TestOutput : testOutput;
const shouldWriteBaseline = process.argv.includes("--write-baseline");
const baselineOutput = resolve(
  __dirname,
  "..",
  process.env.Z80_WASM_FAST_REFERENCE_BASELINE ?? ".ai/zx-spectrum48-wasm-fast-z80-f0-benchmark.md"
);

const stateOffset = {
  words: 0,
  counters: 28,
  controls: 44
};

const word = {
  af: 0,
  bc: 1,
  de: 2,
  hl: 3,
  afAlt: 4,
  bcAlt: 5,
  deAlt: 6,
  hlAlt: 7,
  ix: 8,
  iy: 9,
  ir: 10,
  wz: 11,
  pc: 12,
  sp: 13
};

const scenarios = [
  {
    name: "standard-00-nop-jr",
    description: "Standard-page NOP/JR loop.",
    program: loop([0x00, 0x3c, 0x3d, 0x18, 0xfb]),
    steps: iterations
  },
  {
    name: "standard-40-7f-register-ld",
    description: "Register-to-register LD row without memory access.",
    program: loop([0x41, 0x4a, 0x53, 0x5c, 0x65, 0x6f, 0x78, 0x18, 0xf6]),
    setup: runtime => {
      writeWord(runtime.state, word.bc, 0x1234);
      writeWord(runtime.state, word.de, 0x5678);
      writeWord(runtime.state, word.hl, 0x9abc);
      writeWord(runtime.state, word.af, 0xdef0);
    },
    steps: iterations
  },
  {
    name: "standard-80-bf-register-alu",
    description: "Register ALU rows ADD/ADC/SUB/SBC/AND/XOR/OR/CP.",
    program: loop([0x80, 0x89, 0x92, 0x9b, 0xa4, 0xad, 0xb6, 0xbf, 0x18, 0xf5]),
    setup: runtime => {
      runtime.memory[0x4000] = 0x33;
      writeWord(runtime.state, word.hl, 0x4000);
      writeWord(runtime.state, word.bc, 0x1201);
      writeWord(runtime.state, word.de, 0x347f);
      writeWord(runtime.state, word.af, 0x5601);
    },
    steps: iterations
  },
  {
    name: "memory-stack-call-ret",
    description: "Memory load/store plus CALL/RET stack traffic.",
    program: assemble([
      0x21, 0x00, 0x40,
      0x34,
      0xcd, 0x0c, 0x00,
      0x18, 0xf7,
      0x00, 0x00, 0x00,
      0x7e,
      0xc9
    ]),
    setup: runtime => {
      writeWord(runtime.state, word.sp, 0xfffe);
    },
    steps: iterations
  },
  {
    name: "cb-rotate-bit",
    description: "CB-prefix rotate and bit-test loop.",
    program: loop([0xcb, 0x00, 0xcb, 0x11, 0xcb, 0x7c, 0x18, 0xf8]),
    setup: runtime => {
      writeWord(runtime.state, word.bc, 0x8180);
      writeWord(runtime.state, word.hl, 0x4000);
    },
    steps: iterations
  },
  {
    name: "ed-block-io",
    description: "ED-page IN/OUT and NEG instructions.",
    program: loop([0xed, 0x44, 0xed, 0x78, 0xed, 0x79, 0x18, 0xf8]),
    setup: runtime => {
      writeWord(runtime.state, word.bc, 0x00fe);
      writeWord(runtime.state, word.af, 0x5500);
      runtime.ioInput.fill(0xa5);
      runtime.setIoInputCount(runtime.ioInput.length);
    },
    steps: iterations
  },
  {
    name: "ix-iy-indexed",
    description: "DD/FD indexed register and memory operations.",
    program: loop([
      0xdd, 0x21, 0x00, 0x40,
      0xdd, 0x34, 0x03,
      0xfd, 0x21, 0x10, 0x40,
      0xfd, 0x35, 0x02,
      0x18, 0xf0
    ]),
    steps: Math.max(1000, Math.floor(iterations / 3))
  },
  {
    name: "z80n-ed-extension",
    description: "Small Z80N ED extension loop.",
    program: loop([0xed, 0x23, 0xed, 0x24, 0x18, 0xfa]),
    setup: runtime => {
      runtime.state.setUint8(stateOffset.controls + 12, 1);
      writeWord(runtime.state, word.af, 0x3c00);
    },
    steps: iterations
  }
];

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});

async function main() {
  buildSp48Wasm({ mode: currentMode });
  buildSp48Wasm({ mode: "fast-z80-reference" });

  const currentModule = await WebAssembly.compile(readFileSync(currentOutput));
  const fastModule = await WebAssembly.compile(readFileSync(fastZ80ReferenceOutput));
  const results = [];

  for (const scenario of scenarios) {
    const currentCorrectness = await runScenario(currentModule, "", scenario);
    const fastCorrectness = await runScenario(fastModule, "fast_", scenario);
    const correctness = compareSnapshots(currentCorrectness.snapshot, fastCorrectness.snapshot);
    const currentTimings = [];
    const fastTimings = [];

    for (let repeat = 0; repeat < repeats; repeat++) {
      currentTimings.push((await timeScenario(currentModule, "", scenario)).elapsedMs);
      fastTimings.push((await timeScenario(fastModule, "fast_", scenario)).elapsedMs);
    }

    results.push({
      name: scenario.name,
      description: scenario.description,
      steps: scenario.steps,
      correctness,
      currentMedianMs: round3(median(currentTimings)),
      currentMinMs: round3(Math.min(...currentTimings)),
      currentMaxMs: round3(Math.max(...currentTimings)),
      fastMedianMs: round3(median(fastTimings)),
      fastMinMs: round3(Math.min(...fastTimings)),
      fastMaxMs: round3(Math.max(...fastTimings)),
      speedup: round3(median(currentTimings) / median(fastTimings))
    });
  }

  const report = {
    generatedAt: new Date().toISOString(),
    currentMode,
    currentArtifact: currentOutput,
    currentArtifactBytes: statSync(currentOutput).size,
    fastReferenceArtifact: fastZ80ReferenceOutput,
    fastReferenceArtifactBytes: statSync(fastZ80ReferenceOutput).size,
    repeats,
    iterations,
    results
  };

  console.log(JSON.stringify(report, null, 2));
  if (shouldWriteBaseline) {
    mkdirSync(dirname(baselineOutput), { recursive: true });
    writeFileSync(baselineOutput, renderMarkdown(report));
    console.log(`Wrote ${baselineOutput}`);
  }
}

async function timeScenario(module, prefix, scenario) {
  const runtime = await createRuntime(module, prefix, scenario);
  const started = performance.now();
  execute(runtime, scenario.steps);
  return {
    elapsedMs: performance.now() - started,
    snapshot: snapshot(runtime)
  };
}

async function runScenario(module, prefix, scenario) {
  const runtime = await createRuntime(module, prefix, scenario);
  execute(runtime, scenario.steps);
  return { snapshot: snapshot(runtime) };
}

async function createRuntime(module, prefix, scenario) {
  const exports = (await WebAssembly.instantiate(module, {})).exports;
  const memoryBuffer = exports.memory.buffer;
  const stateStart = exports[`${prefix}z80_state_block_ptr`]();
  const stateSize = exports[`${prefix}z80_state_block_size`]();
  const memoryStart = exports[`${prefix}z80_test_memory_ptr`]();
  const ioInputStart = exports[`${prefix}z80_test_io_input_ptr`]();
  const runtime = {
    exports,
    prefix,
    state: new DataView(memoryBuffer, stateStart, stateSize),
    memory: new Uint8Array(memoryBuffer, memoryStart, 0x10000),
    ioInput: new Uint8Array(memoryBuffer, ioInputStart, 256),
    setIoInputCount: count => exports[`${prefix}z80_test_io_input_count_set`](count)
  };

  exports[`${prefix}z80_test_bus_reset`]();
  runtime.memory.fill(0);
  runtime.memory.set(scenario.program, 0);
  exports[`${prefix}z80_reset`]();
  writeWord(runtime.state, word.pc, 0);
  writeWord(runtime.state, word.sp, 0xfffe);
  runtime.state.setUint8(stateOffset.controls + 13, 1);
  scenario.setup?.(runtime);
  exports[`${prefix}z80_state_import`]();
  return runtime;
}

function execute(runtime, steps) {
  for (let instruction = 0; instruction < steps; instruction++) {
    do {
      runtime.exports[`${runtime.prefix}z80_execute_instruction`]();
    } while (runtime.state.getUint8(stateOffset.controls) !== 0);
  }
}

function snapshot(runtime) {
  return {
    af: readWord(runtime.state, word.af),
    bc: readWord(runtime.state, word.bc),
    de: readWord(runtime.state, word.de),
    hl: readWord(runtime.state, word.hl),
    ix: readWord(runtime.state, word.ix),
    iy: readWord(runtime.state, word.iy),
    ir: readWord(runtime.state, word.ir),
    wz: readWord(runtime.state, word.wz),
    pc: readWord(runtime.state, word.pc),
    sp: readWord(runtime.state, word.sp),
    tacts: runtime.state.getUint32(stateOffset.counters, true),
    halted: runtime.state.getUint8(stateOffset.controls + 1),
    memory4000: runtime.memory[0x4000],
    memory4003: runtime.memory[0x4003],
    memory4012: runtime.memory[0x4012]
  };
}

function compareSnapshots(current, fast) {
  const mismatches = [];
  for (const key of Object.keys(current)) {
    if (current[key] !== fast[key]) {
      mismatches.push({ field: key, current: current[key], fast: fast[key] });
    }
  }
  return {
    matches: mismatches.length === 0,
    mismatches
  };
}

function assemble(bytes) {
  const program = new Uint8Array(0x100);
  program.set(bytes);
  return program;
}

function loop(body) {
  const program = new Uint8Array(0x100);
  program.set(body);
  return program;
}

function readWord(view, field) {
  return view.getUint16(stateOffset.words + field * 2, true);
}

function writeWord(view, field, value) {
  view.setUint16(stateOffset.words + field * 2, value & 0xffff, true);
}

function median(values) {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
}

function round3(value) {
  return Math.round(value * 1000) / 1000;
}

function renderMarkdown(report) {
  const lines = [
    "# ZX Spectrum 48K WASM fast Z80 F0 benchmark",
    "",
    `Generated: ${report.generatedAt}`,
    "",
    `- Current test artifact: ${report.currentArtifact}`,
    `- Current test artifact bytes: ${report.currentArtifactBytes}`,
    `- Fast reference artifact: ${report.fastReferenceArtifact}`,
    `- Fast reference artifact bytes: ${report.fastReferenceArtifactBytes}`,
    `- Repeats: ${report.repeats}`,
    `- Default iterations: ${report.iterations}`,
    "",
    "| Scenario | Correct | Current median ms | Fast median ms | Speedup | Mismatches |",
    "| --- | --- | ---: | ---: | ---: | --- |"
  ];

  for (const result of report.results) {
    const mismatches = result.correctness.mismatches
      .map(mismatch => `${mismatch.field}:${mismatch.current}->${mismatch.fast}`)
      .join(", ");
    lines.push(`| ${result.name} | ${result.correctness.matches ? "yes" : "no"} | ${result.currentMedianMs} | ${result.fastMedianMs} | ${result.speedup}x | ${mismatches || "-"} |`);
  }
  lines.push("");
  lines.push("This is a comparison-only F0 artifact. It is not linked into the production SP48 WASM backend.");
  lines.push("");
  return `${lines.join("\n")}\n`;
}
