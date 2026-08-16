#!/usr/bin/env node

const { existsSync, readFileSync, statSync } = require("node:fs");
const { relative, resolve } = require("node:path");
const { performance } = require("node:perf_hooks");

const {
  buildZxNextWasm,
  productionOutput
} = require("./build-zxnext-wasm.cjs");

const root = resolve(__dirname, "..");
const PROGRAM_START = 0x8000;

const scenarios = [
  {
    id: "nop-loop",
    label: "NOP-heavy frame loop",
    program: [0x00, 0x00, 0x00, 0x00, 0x00, 0x18, 0xf9]
  },
  {
    id: "screen-write-loop",
    label: "Screen-write-heavy loop",
    program: [0x21, 0x00, 0x40, 0x06, 0x00, 0x70, 0x2c, 0x10, 0xfc, 0x18, 0xf8]
  },
  {
    id: "border-out-loop",
    label: "ULA border OUT loop",
    program: [0x3c, 0xd3, 0xfe, 0x18, 0xfb]
  },
  {
    id: "nextreg-loop",
    label: "NEXTREG MMU write loop",
    program: [0xed, 0x91, 0x56, 0x10, 0x18, 0xfa]
  },
  {
    id: "psg-dac-loop",
    label: "PSG and DAC exact-port loop",
    program: [
      0x01, 0xfd, 0xff, 0x3e, 0x08, 0xed, 0x79,
      0x01, 0xfd, 0xbf, 0x3c, 0xed, 0x79,
      0x01, 0x1f, 0x00, 0xed, 0x79,
      0x18, 0xec
    ],
    setup: wasm => {
      wasm.zxnextWriteNextReg(0x84, 0xff);
    }
  },
  {
    id: "spi-loop",
    label: "SD SPI data-port loop",
    program: [
      0x01, 0xe7, 0x00, 0x3e, 0x02, 0xed, 0x79,
      0x01, 0xeb, 0x00, 0x3c, 0xed, 0x79,
      0x18, 0xf9
    ],
    setup: wasm => {
      wasm.zxnextSetSdCardInfo(0, 2048);
    }
  }
];

function parseArgs(argv) {
  const options = {
    frames: 120,
    json: false,
    runs: 5,
    scenario: null,
    warmup: 20
  };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    switch (arg) {
      case "--frames":
        options.frames = parsePositiveInteger(argv[++i], "--frames");
        break;
      case "--help":
      case "-h":
        options.help = true;
        break;
      case "--json":
        options.json = true;
        break;
      case "--runs":
        options.runs = parsePositiveInteger(argv[++i], "--runs");
        break;
      case "--scenario":
        options.scenario = requireValue(argv[++i], "--scenario");
        break;
      case "--warmup":
        options.warmup = parsePositiveInteger(argv[++i], "--warmup");
        break;
      default:
        throw new Error(`Unknown argument '${arg}'. Run with --help for usage.`);
    }
  }
  return options;
}

function requireValue(value, flag) {
  if (value == null || value.startsWith("--")) throw new Error(`${flag} requires a value.`);
  return value;
}

function parsePositiveInteger(value, flag) {
  const numeric = Number.parseInt(requireValue(value, flag), 10);
  if (!Number.isFinite(numeric) || numeric <= 0) throw new Error(`${flag} must be a positive integer.`);
  return numeric;
}

function printHelp() {
  console.log(`Usage: node scripts/benchmark-zxnext-wasm.cjs [options]

Options:
  --scenario <id>      Run one scenario by id.
  --frames <count>     Measured frames per run. Default: 120.
  --warmup <count>     Warmup frames before each run. Default: 20.
  --runs <count>       Repeated measurements per scenario. Default: 5.
  --json               Print JSON instead of a table.
  --help               Show this help text.

Scenario ids:
  ${scenarios.map(scenario => scenario.id).join(", ")}`);
}

async function instantiateArtifact(artifactPath) {
  const bytes = readFileSync(artifactPath);
  const { instance } = await WebAssembly.instantiate(bytes);
  return instance.exports;
}

function selectedScenarios(options) {
  if (options.scenario == null) return scenarios;
  const selected = scenarios.filter(scenario => scenario.id === options.scenario);
  if (selected.length === 0) {
    throw new Error(`Unknown scenario '${options.scenario}'. Expected one of: ${scenarios.map(s => s.id).join(", ")}.`);
  }
  return selected;
}

function uploadProgram(wasm, program) {
  for (let i = 0; i < program.length; i++) {
    wasm.zxnextWriteMemory(PROGRAM_START + i, program[i] & 0xff);
  }
}

function setupScenario(wasm, scenario) {
  wasm.zxnextHardReset();
  uploadProgram(wasm, scenario.program);
  wasm.zxnextSetCpuPc(PROGRAM_START);
  wasm.zxnextSetCpuSp(0xfffe);
  if (scenario.setup != null) scenario.setup(wasm);
}

function runFrames(wasm, frameCount) {
  for (let i = 0; i < frameCount; i++) wasm.zxnextExecuteFrame();
}

function measureScenario(wasm, scenario, options) {
  const runs = [];
  for (let i = 0; i < options.runs; i++) {
    setupScenario(wasm, scenario);
    runFrames(wasm, options.warmup);
    const startInstructions = wasm.zxnextGetCpuInstructionsExecuted();
    const start = performance.now();
    runFrames(wasm, options.frames);
    const elapsedMs = performance.now() - start;
    const endInstructions = wasm.zxnextGetCpuInstructionsExecuted();
    runs.push({
      framesPerSecond: options.frames * 1000 / elapsedMs,
      instructionsPerFrame: (endInstructions - startInstructions) / options.frames,
      millisecondsPerFrame: elapsedMs / options.frames,
      screenRenderCount: wasm.zxnextGetScreenRenderCount()
    });
  }
  return {
    framesPerSecond: stats(runs.map(run => run.framesPerSecond)),
    instructionsPerFrame: median(runs.map(run => run.instructionsPerFrame)),
    millisecondsPerFrame: stats(runs.map(run => run.millisecondsPerFrame)),
    screenRenderCount: median(runs.map(run => run.screenRenderCount))
  };
}

function stats(values) {
  return {
    median: median(values),
    min: Math.min(...values),
    max: Math.max(...values)
  };
}

function median(values) {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[middle - 1] + sorted[middle]) / 2
    : sorted[middle];
}

function formatNumber(value, fractionDigits = 2) {
  return value.toLocaleString("en-US", {
    maximumFractionDigits: fractionDigits,
    minimumFractionDigits: fractionDigits
  });
}

function formatInteger(value) {
  return Math.round(value).toLocaleString("en-US");
}

function printTable(result, options) {
  console.log(`ZX Spectrum Next WASM benchmark (${options.frames} frames/run, ${options.warmup} warmup, ${options.runs} runs)`);
  console.log(`  artifact: ${relative(root, result.artifactPath)}, size: ${formatInteger(result.artifactBytes)} bytes`);
  console.log("  scenario                    ms/frame median [min..max]    fps median [min..max]      instr/frame    renders/run");
  for (const scenario of result.scenarios) {
    const ms = scenario.metrics.millisecondsPerFrame;
    const fps = scenario.metrics.framesPerSecond;
    console.log(`  ${scenario.id.padEnd(27)} ${formatNumber(ms.median).padStart(8)} [${formatNumber(ms.min)}..${formatNumber(ms.max)}]    ${formatNumber(fps.median).padStart(8)} [${formatNumber(fps.min)}..${formatNumber(fps.max)}]    ${formatInteger(scenario.metrics.instructionsPerFrame).padStart(11)}    ${formatInteger(scenario.metrics.screenRenderCount).padStart(11)}`);
  }
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    printHelp();
    return;
  }
  if (!existsSync(productionOutput)) buildZxNextWasm();
  const wasm = await instantiateArtifact(productionOutput);
  const result = {
    artifactBytes: statSync(productionOutput).size,
    artifactPath: productionOutput,
    scenarios: selectedScenarios(options).map(scenario => ({
      id: scenario.id,
      label: scenario.label,
      metrics: measureScenario(wasm, scenario, options)
    }))
  };
  if (options.json) {
    console.log(JSON.stringify({ options, result }, null, 2));
  } else {
    printTable(result, options);
  }
}

main().catch(error => {
  console.error(error.stack ?? error.message);
  process.exitCode = 1;
});
