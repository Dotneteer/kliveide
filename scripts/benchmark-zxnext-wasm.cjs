#!/usr/bin/env node

const { existsSync, readFileSync, statSync } = require("node:fs");
const { performance } = require("node:perf_hooks");

const {
  buildZxNextWasm,
  productionOutput
} = require("./build-zxnext-wasm.cjs");

const DEFAULT_FRAMES = 120;
const DEFAULT_RUNS = 7;
const DEFAULT_WARMUP = 20;
const SAFETY_GUARD_STOP_REASONS = new Set(["safetyGuard", "frameSafetyGuard", "instructionSafetyGuard"]);

function parseArgs(argv) {
  const options = {
    build: false,
    frames: DEFAULT_FRAMES,
    json: false,
    runs: DEFAULT_RUNS,
    warmup: DEFAULT_WARMUP
  };

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    switch (arg) {
      case "--build":
        options.build = true;
        break;
      case "--frames":
        options.frames = parsePositiveInteger(argv[++i], "--frames");
        break;
      case "--runs":
        options.runs = parsePositiveInteger(argv[++i], "--runs");
        break;
      case "--warmup":
        options.warmup = parsePositiveInteger(argv[++i], "--warmup");
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

function parsePositiveInteger(value, flag) {
  if (value == null || value.startsWith("--")) {
    throw new Error(`${flag} requires a value.`);
  }
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`${flag} must be a positive integer.`);
  }
  return parsed;
}

function printHelp() {
  console.log(`Usage: node scripts/benchmark-zxnext-wasm.cjs [options]

Options:
  --build           Build the production ZX Spectrum Next WASM artifact first.
  --frames <count>  Measured frames per run. Default: ${DEFAULT_FRAMES}.
  --warmup <count>  Warmup frames before each run. Default: ${DEFAULT_WARMUP}.
  --runs <count>    Repeated measurements. Default: ${DEFAULT_RUNS}.
  --json            Print JSON instead of a table.
  --help            Show this help text.`);
}

async function instantiateArtifact(artifact = productionOutput) {
  if (!existsSync(artifact)) {
    buildZxNextWasm();
  }
  const bytes = readFileSync(artifact);
  const { instance } = await WebAssembly.instantiate(bytes);
  return {
    artifact,
    bytes: bytes.byteLength,
    exports: instance.exports
  };
}

function prepareRawWasmFrame(wasm) {
  wasm.zxnextHardReset();
  wasm.zxnextSetCpuPc(0x8000);
  wasm.zxnextSetCpuSp(0xfffe);
  for (let i = 0; i < 0x100; i++) {
    wasm.zxnextWriteMemory(0x8000 + i, 0x00);
  }
}

function runRawWasmFrames(wasm, frames) {
  const stopReasons = {};
  for (let i = 0; i < frames; i++) {
    wasm.zxnextExecuteFrame();
    addStopReason(stopReasons, "wasmFrameComplete");
  }
  return stopReasons;
}

function addStopReason(stopReasons, reason) {
  stopReasons[reason] = (stopReasons[reason] ?? 0) + 1;
}

function assertNoSafetyGuardStops(stopReasons) {
  for (const reason of Object.keys(stopReasons)) {
    if (SAFETY_GUARD_STOP_REASONS.has(reason)) {
      throw new Error(`ZX Spectrum Next WASM frame benchmark stopped by safety guard '${reason}'.`);
    }
  }
}

async function benchmarkZxNextWasm(options = {}) {
  const normalized = {
    build: false,
    frames: DEFAULT_FRAMES,
    runs: DEFAULT_RUNS,
    warmup: DEFAULT_WARMUP,
    ...options
  };
  if (normalized.build) buildZxNextWasm();
  const artifact = await instantiateArtifact(normalized.artifact);
  const runs = [];
  const aggregateStopReasons = {};

  for (let i = 0; i < normalized.runs; i++) {
    prepareRawWasmFrame(artifact.exports);
    runRawWasmFrames(artifact.exports, normalized.warmup);
    const startFrames = artifact.exports.zxnextGetFrames();
    const startTacts = artifact.exports.zxnextGetTacts();
    const start = performance.now();
    const stopReasons = runRawWasmFrames(artifact.exports, normalized.frames);
    const elapsedMs = performance.now() - start;
    const endFrames = artifact.exports.zxnextGetFrames();
    const endTacts = artifact.exports.zxnextGetTacts();
    assertNoSafetyGuardStops(stopReasons);
    for (const [reason, count] of Object.entries(stopReasons)) {
      aggregateStopReasons[reason] = (aggregateStopReasons[reason] ?? 0) + count;
    }
    runs.push({
      elapsedMs,
      framesPerSecond: normalized.frames * 1000 / elapsedMs,
      framesAdvanced: endFrames - startFrames,
      millisecondsPerFrame: elapsedMs / normalized.frames,
      samplesPerFrame: artifact.exports.zxnextGetAudioMixerSampleCount() / Math.max(1, normalized.frames),
      tactsAdvanced: endTacts - startTacts
    });
  }

  return {
    artifact: artifact.artifact,
    artifactBytes: statSync(artifact.artifact).size,
    frames: normalized.frames,
    runs: normalized.runs,
    warmup: normalized.warmup,
    stopReasons: aggregateStopReasons,
    metrics: summarizeRuns(runs)
  };
}

function summarizeRuns(runs) {
  return {
    framesAdvanced: median(runs.map(run => run.framesAdvanced)),
    framesPerSecond: stats(runs.map(run => run.framesPerSecond)),
    millisecondsPerFrame: stats(runs.map(run => run.millisecondsPerFrame)),
    samplesPerFrame: median(runs.map(run => run.samplesPerFrame)),
    tactsAdvanced: median(runs.map(run => run.tactsAdvanced))
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

function printTable(report) {
  const ms = report.metrics.millisecondsPerFrame;
  const fps = report.metrics.framesPerSecond;
  console.log(`ZX Spectrum Next WASM benchmark (${report.frames} frames/run, ${report.warmup} warmup, ${report.runs} runs)`);
  console.log(`  artifact: ${report.artifact}`);
  console.log(`  size: ${report.artifactBytes.toLocaleString("en-US")} bytes`);
  console.log(`  ms/frame median [min..max]: ${formatNumber(ms.median)} [${formatNumber(ms.min)}..${formatNumber(ms.max)}]`);
  console.log(`  fps median [min..max]:      ${formatNumber(fps.median)} [${formatNumber(fps.min)}..${formatNumber(fps.max)}]`);
  console.log(`  frames advanced/run:        ${formatNumber(report.metrics.framesAdvanced, 0)}`);
  console.log(`  tacts advanced/run:         ${formatNumber(report.metrics.tactsAdvanced, 0)}`);
  console.log(`  audio samples/frame:        ${formatNumber(report.metrics.samplesPerFrame)}`);
  console.log(`  frame stop reasons:         ${JSON.stringify(report.stopReasons)}`);
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    printHelp();
    return;
  }
  const report = await benchmarkZxNextWasm(options);
  if (options.json) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    printTable(report);
  }
}

if (require.main === module) {
  main().catch(error => {
    console.error(error.stack ?? error.message);
    process.exitCode = 1;
  });
}

module.exports = {
  SAFETY_GUARD_STOP_REASONS,
  assertNoSafetyGuardStops,
  benchmarkZxNextWasm,
  parseArgs,
  summarizeRuns
};
