#!/usr/bin/env node

const { existsSync, readFileSync, statSync } = require("node:fs");
const { dirname, resolve } = require("node:path");
const { performance } = require("node:perf_hooks");

const {
  buildZxNextWasm,
  optimizationProfiles,
  productionOutput,
  waitForZxNextWasmBuildLock
} = require("./build-zxnext-wasm.cjs");

const root = resolve(__dirname, "..");
const DEFAULT_FRAMES = 10;
const DEFAULT_RUNS = 3;
const DEFAULT_WARMUP = 2;
const MIN_WASM_SPEED_RATIO_FOR_DEFAULT = 1.0;
const MIN_WASM_CONTROL_SPEED_RATIO_FOR_DEFAULT = 0.1;
const SAFETY_GUARD_STOP_REASONS = new Set(["safetyGuard", "frameSafetyGuard", "instructionSafetyGuard"]);

const FRAME_TERMINATION_NAMES = {
  0: "Normal",
  1: "DebugEvent",
  2: "UntilExecutionPoint"
};

const DEFAULT_SCENARIOS = [
  "nextzxos-idle",
  "screen-heavy",
  "audio-heavy",
  "storage-command",
  "debug-step"
];

let tsRuntimeRegistered = false;

function parseArgs(argv) {
  const options = {
    build: false,
    frames: DEFAULT_FRAMES,
    json: false,
    runs: DEFAULT_RUNS,
    scenarios: DEFAULT_SCENARIOS.slice(),
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
      case "--scenario":
        options.scenarios = parseScenarioList(argv[++i]);
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

function parseScenarioList(value) {
  if (value == null || value.startsWith("--")) {
    throw new Error("--scenario requires a comma-separated list.");
  }
  const scenarios = value.split(",").map(entry => entry.trim()).filter(Boolean);
  if (scenarios.length === 0) {
    throw new Error("--scenario requires at least one scenario id.");
  }
  return scenarios;
}

function printHelp() {
  console.log(`Usage: node scripts/benchmark-zxnext-wasm.cjs [options]

Options:
  --build             Build the production ZX Spectrum Next WASM artifact first.
  --frames <count>    Measured operations per run. Default: ${DEFAULT_FRAMES}.
  --warmup <count>    Warmup operations before each run. Default: ${DEFAULT_WARMUP}.
  --runs <count>      Repeated measurements. Default: ${DEFAULT_RUNS}.
  --scenario <ids>    Comma-separated scenario ids. Default: ${DEFAULT_SCENARIOS.join(",")}.
  --json              Print JSON instead of a table.
  --help              Show this help text.`);
}

async function instantiateArtifact(artifact = productionOutput) {
  waitForZxNextWasmBuildLock();
  if (!existsSync(artifact)) {
    buildZxNextWasm();
  }
  waitForZxNextWasmBuildLock();
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
    scenarios: DEFAULT_SCENARIOS.slice(),
    warmup: DEFAULT_WARMUP,
    ...options
  };
  const artifact = normalized.artifact ?? productionOutput;
  waitForZxNextWasmBuildLock();
  if (normalized.build || !existsSync(artifact)) buildZxNextWasm();
  waitForZxNextWasmBuildLock();

  const scenarioMap = createScenarioMap();
  const scenarioReports = [];
  for (const scenarioId of normalized.scenarios) {
    const scenario = scenarioMap.get(scenarioId);
    if (scenario == null) {
      throw new Error(`Unknown ZX Next WASM benchmark scenario '${scenarioId}'.`);
    }
    scenarioReports.push(await benchmarkScenario(scenario, { ...normalized, artifact }));
  }

  const firstScenario = scenarioReports[0];
  return {
    artifact,
    artifactBytes: statSync(artifact).size,
    buildProfile: {
      optimization: "speed",
      flags: optimizationProfiles.speed.slice()
    },
    frames: normalized.frames,
    runs: normalized.runs,
    warmup: normalized.warmup,
    threshold: {
      minWasmSpeedRatioForDefault: MIN_WASM_SPEED_RATIO_FOR_DEFAULT,
      minWasmControlSpeedRatioForDefault: MIN_WASM_CONTROL_SPEED_RATIO_FOR_DEFAULT,
      met: scenarioReports.every(report => report.thresholdMet)
    },
    scenarios: scenarioReports,
    stopReasons: firstScenario?.wasm.stopReasons ?? {},
    metrics: firstScenario?.wasm.metrics
  };
}

async function benchmarkScenario(scenario, options) {
  const typeScriptResult = await benchmarkBackend("typescript", scenario, options);
  const wasmResult = await benchmarkBackend("wasm", scenario, options);
  const speedRatio = wasmResult.metrics.operationsPerSecond.median /
    Math.max(typeScriptResult.metrics.operationsPerSecond.median, Number.EPSILON);

  return {
    id: scenario.id,
    name: scenario.name,
    unit: scenario.unit,
    operations: options.frames,
    minWasmSpeedRatio: scenario.minWasmSpeedRatio,
    speedRatio,
    thresholdMet: speedRatio >= scenario.minWasmSpeedRatio,
    typescript: typeScriptResult,
    wasm: wasmResult
  };
}

async function benchmarkBackend(backend, scenario, options) {
  const machine = backend === "typescript"
    ? await createTypeScriptMachine()
    : await createWasmMachine(options.artifact);
  const runs = [];
  const aggregateStopReasons = {};

  for (let i = 0; i < options.runs; i++) {
    scenario.setup(machine, backend);
    runScenarioOperations(machine, backend, scenario, options.warmup, {});

    const startFrames = machine.frames ?? 0;
    const startTacts = machine.tacts ?? 0;
    const stopReasons = {};
    const start = performance.now();
    runScenarioOperations(machine, backend, scenario, options.frames, stopReasons);
    const elapsedMs = performance.now() - start;
    const endFrames = machine.frames ?? 0;
    const endTacts = machine.tacts ?? 0;

    assertNoSafetyGuardStops(stopReasons);
    for (const [reason, count] of Object.entries(stopReasons)) {
      aggregateStopReasons[reason] = (aggregateStopReasons[reason] ?? 0) + count;
    }
    runs.push({
      elapsedMs,
      framesAdvanced: endFrames - startFrames,
      operations: options.frames,
      operationsPerSecond: options.frames * 1000 / Math.max(elapsedMs, Number.EPSILON),
      millisecondsPerOperation: elapsedMs / options.frames,
      samplesPerOperation: readAudioSampleCount(machine) / Math.max(1, options.frames),
      tactsAdvanced: endTacts - startTacts
    });
  }

  return {
    backend,
    stopReasons: aggregateStopReasons,
    metrics: summarizeRuns(runs)
  };
}

function runScenarioOperations(machine, backend, scenario, count, stopReasons) {
  for (let i = 0; i < count; i++) {
    const reason = scenario.run(machine, backend, i);
    addStopReason(stopReasons, reason);
  }
}

async function createTypeScriptMachine() {
  registerTsRuntime();
  const { createTestNextMachine } = require("../test/zxnext/TestNextMachine.ts");
  return createTestNextMachine();
}

async function createWasmMachine(artifact = productionOutput) {
  registerTsRuntime();
  const { ZxNextWasmV2Machine } = require("../src/emu/machines/zxNext/ZxNextWasmV2Machine.ts");
  const { FILE_PROVIDER } = require("../src/emu/machines/machine-props.ts");
  const { FileProvider } = require("../test/zxnext/FileProvider.ts");
  const machine = new ZxNextWasmV2Machine(
    undefined,
    undefined,
    undefined,
    {
      artifactName: "benchmark-zx-spectrum-next.wasm",
      readArtifact: async () => {
        waitForZxNextWasmBuildLock();
        return readFileSync(artifact);
      }
    }
  );
  machine.setMachineProperty(FILE_PROVIDER, new FileProvider());
  await machine.setup();
  machine.uploadWasmV2RomImages(readZxNextBootRomImages());
  return machine;
}

function registerTsRuntime() {
  if (tsRuntimeRegistered) return;
  installNodeDomShims();
  require("node:module").Module;
  installEsbuildTsHook();
  require("tsconfig-paths").register({
    baseUrl: root,
    paths: {
      "@abstractions/*": ["src/common/abstractions/*"],
      "@common/*": ["src/common/*"],
      "@styles/*": ["src/renderer/assets/styles/*"],
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
  installTsExtensionResolver();
  tsRuntimeRegistered = true;
}

function installEsbuildTsHook() {
  const esbuild = require("esbuild");
  const previousHook = require.extensions[".ts"];
  require.extensions[".ts"] = (module, filename) => {
    const source = readFileSync(filename, "utf8");
    const result = esbuild.transformSync(source, {
      format: "cjs",
      loader: "ts",
      platform: "node",
      sourcemap: "inline",
      target: "es2017",
      tsconfigRaw: {
        compilerOptions: {
          esModuleInterop: true,
          experimentalDecorators: true,
          jsx: "react",
          useDefineForClassFields: false
        }
      }
    });
    module._compile(result.code, filename);
  };
  require.extensions[".ts"].__previous = previousHook;
}

function installTsExtensionResolver() {
  const Module = require("node:module");
  const originalResolveFilename = Module._resolveFilename;
  if (originalResolveFilename.__zxnextWasmBenchmarkPatched) return;

  function resolveFilename(request, parent, isMain, options) {
    try {
      return originalResolveFilename.call(this, request, parent, isMain, options);
    } catch (error) {
      if (error?.code === "MODULE_NOT_FOUND" && request.startsWith(".") && parent?.filename) {
        const tsCandidate = resolve(dirname(parent.filename), `${request}.ts`);
        if (existsSync(tsCandidate)) return tsCandidate;
      }
      throw error;
    }
  }
  resolveFilename.__zxnextWasmBenchmarkPatched = true;
  Module._resolveFilename = resolveFilename;
}

function installNodeDomShims() {
  if (typeof global.window !== "undefined") return;
  const mockElement = {
    addEventListener() {},
    removeEventListener() {},
    appendChild() {},
    removeChild() {},
    append() {},
    remove() {},
    setAttribute() {},
    getAttribute() { return null; },
    style: {},
    className: "",
    innerHTML: "",
    textContent: "",
    id: "",
    offsetWidth: 0,
    offsetHeight: 0
  };
  const document = {
    body: { ...mockElement },
    documentElement: { ...mockElement },
    addEventListener() {},
    removeEventListener() {},
    createElement() { return { ...mockElement }; },
    createTextNode() { return {}; },
    querySelector() { return null; },
    querySelectorAll() { return []; },
    getElementById() { return null; },
    getElementsByClassName() { return []; },
    getElementsByTagName() { return []; },
    queryCommandSupported() { return false; },
    queryCommandEnabled() { return false; }
  };
  global.document = document;
  global.window = {
    navigator: { userAgent: "" },
    document,
    location: { href: "" },
    matchMedia: () => ({
      matches: false,
      addEventListener() {},
      removeEventListener() {},
      addListener() {},
      removeListener() {}
    }),
    addEventListener() {},
    removeEventListener() {},
    requestAnimationFrame: callback => callback(),
    cancelAnimationFrame() {},
    setTimeout: global.setTimeout,
    clearTimeout: global.clearTimeout
  };
}

function readZxNextBootRomImages() {
  const romRoot = resolve(root, "src/public/roms");
  return {
    nextRom: readFileSync(resolve(romRoot, "enNextZX.rom")),
    divMmcRom: readFileSync(resolve(romRoot, "enNxtmmc.rom")),
    multifaceRom: readFileSync(resolve(romRoot, "enNextMf.rom")),
    altRom: readFileSync(resolve(romRoot, "enAltZX.rom"))
  };
}

function createScenarioMap() {
  const scenarios = [
    {
      id: "nextzxos-idle",
      name: "NextZXOS boot/idle frames",
      unit: "frame",
      minWasmSpeedRatio: MIN_WASM_CONTROL_SPEED_RATIO_FOR_DEFAULT,
      setup(machine) {
        machine.reset();
      },
      run(machine, backend) {
        const termination = machine.executeMachineFrame();
        return stopReasonForMachine(machine, backend, termination);
      }
    },
    {
      id: "screen-heavy",
      name: "screen memory and render frames",
      unit: "frame",
      minWasmSpeedRatio: MIN_WASM_SPEED_RATIO_FOR_DEFAULT,
      setup(machine) {
        setupNopLoop(machine);
        seedScreenMemory(machine);
      },
      run(machine, backend, index) {
        machine.doWriteMemory(0x4000 + (index & 0x17ff), (index * 17) & 0xff);
        const termination = machine.executeMachineFrame();
        machine.renderInstantScreen();
        return stopReasonForMachine(machine, backend, termination);
      }
    },
    {
      id: "audio-heavy",
      name: "beeper and PSG frames",
      unit: "frame",
      minWasmSpeedRatio: MIN_WASM_SPEED_RATIO_FOR_DEFAULT,
      setup(machine) {
        setupNopLoop(machine);
        configurePsg(machine);
      },
      run(machine, backend, index) {
        machine.doWritePort(0x00fe, (index & 1) === 0 ? 0x18 : 0x00);
        writePsgRegister(machine, 0x08, 0x08 | (index & 0x07));
        const termination = machine.executeMachineFrame();
        return stopReasonForMachine(machine, backend, termination);
      }
    },
    {
      id: "storage-command",
      name: "SD storage command handoff",
      unit: "command",
      minWasmSpeedRatio: MIN_WASM_CONTROL_SPEED_RATIO_FOR_DEFAULT,
      setup(machine, backend) {
        setupNopLoop(machine);
        if (backend === "wasm") {
          machine.wasmV2Runtime.exports.zxnextSetSdCardInfo(0, 4096);
        } else {
          machine.sdCardDevice.setCardInfo(4096);
        }
      },
      run(machine, backend, index) {
        issueSdReadCommand(machine, index & 0x1f);
        const termination = machine.executeMachineFrame();
        clearStorageCommand(machine, backend);
        return stopReasonForMachine(machine, backend, termination);
      }
    },
    {
      id: "debug-step",
      name: "debugger step operations",
      unit: "step",
      minWasmSpeedRatio: MIN_WASM_CONTROL_SPEED_RATIO_FOR_DEFAULT,
      setup(machine) {
        setupNopLoop(machine);
        const { DebugStepMode } = require("../src/emu/abstractions/DebugStepMode.ts");
        const { DebugSupport } = require("../src/emu/machines/DebugSupport.ts");
        machine.executionContext.debugStepMode = DebugStepMode.StepInto;
        machine.executionContext.debugSupport = new DebugSupport(undefined, []);
      },
      run(machine, backend) {
        const termination = machine.executeMachineFrame();
        return stopReasonForMachine(machine, backend, termination);
      }
    }
  ];
  return new Map(scenarios.map(scenario => [scenario.id, scenario]));
}

function setupNopLoop(machine) {
  machine.reset();
  machine.pc = 0x8000;
  machine.sp = 0xfffe;
  for (let i = 0; i < 0x100; i++) {
    machine.doWriteMemory(0x8000 + i, 0x00);
  }
}

function seedScreenMemory(machine) {
  for (let i = 0; i < 0x1800; i++) {
    machine.doWriteMemory(0x4000 + i, (i * 13) & 0xff);
  }
  for (let i = 0; i < 0x300; i++) {
    machine.doWriteMemory(0x5800 + i, 0x38 | (i & 0x07));
  }
}

function configurePsg(machine) {
  writePsgRegister(machine, 0x00, 0x01);
  writePsgRegister(machine, 0x01, 0x00);
  writePsgRegister(machine, 0x06, 0x02);
  writePsgRegister(machine, 0x07, 0x38);
  writePsgRegister(machine, 0x08, 0x0f);
  writePsgRegister(machine, 0x09, 0x0c);
  writePsgRegister(machine, 0x0a, 0x08);
}

function writePsgRegister(machine, register, value) {
  machine.doWritePort(0xfffd, register & 0xff);
  machine.doWritePort(0xbffd, value & 0xff);
}

function issueSdReadCommand(machine, sector) {
  machine.doWritePort(0xe7, 0x02);
  for (const byte of [0x51, 0x00, 0x00, 0x00, sector & 0xff, 0xff]) {
    machine.doWritePort(0xeb, byte);
  }
}

function clearStorageCommand(machine, backend) {
  machine.setFrameCommand(null);
  if (backend === "wasm") {
    machine.wasmV2Runtime.exports.zxnextClearSdHostCommand();
  }
}

function stopReasonForMachine(machine, backend, termination) {
  if (backend === "wasm") {
    return machine.getWasmV2Diagnostics().lastWasmStopReason;
  }
  return FRAME_TERMINATION_NAMES[termination] ?? `Termination${termination}`;
}

function readAudioSampleCount(machine) {
  if (machine.wasmV2Runtime != null) {
    return machine.wasmV2Runtime.exports.zxnextGetAudioMixerSampleCount();
  }
  const mixer = machine.audioControlDevice?.getAudioMixerDevice?.();
  return typeof mixer?.getAudioSamples === "function" ? mixer.getAudioSamples().length : 0;
}

function summarizeRuns(runs) {
  return {
    framesAdvanced: median(runs.map(run => run.framesAdvanced)),
    operations: median(runs.map(run => run.operations)),
    operationsPerSecond: stats(runs.map(run => run.operationsPerSecond)),
    millisecondsPerOperation: stats(runs.map(run => run.millisecondsPerOperation)),
    millisecondsPerFrame: stats(runs.map(run => run.millisecondsPerOperation)),
    samplesPerOperation: median(runs.map(run => run.samplesPerOperation)),
    samplesPerFrame: median(runs.map(run => run.samplesPerOperation)),
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
  console.log(`ZX Spectrum Next WASM benchmark (${report.frames} operations/run, ${report.warmup} warmup, ${report.runs} runs)`);
  console.log(`  artifact: ${report.artifact}`);
  console.log(`  size: ${report.artifactBytes.toLocaleString("en-US")} bytes`);
  console.log(`  build profile: ${report.buildProfile.optimization} ${report.buildProfile.flags.join(" ")}`);
  console.log(`  default threshold: per-scenario speed floor (${report.threshold.met ? "met" : "not met"})`);
  for (const scenario of report.scenarios) {
    const tsMs = scenario.typescript.metrics.millisecondsPerOperation;
    const wasmMs = scenario.wasm.metrics.millisecondsPerOperation;
    console.log("");
    console.log(`${scenario.id} - ${scenario.name}`);
    console.log(`  TypeScript ms/${scenario.unit} median [min..max]: ${formatNumber(tsMs.median)} [${formatNumber(tsMs.min)}..${formatNumber(tsMs.max)}]`);
    console.log(`  WASM       ms/${scenario.unit} median [min..max]: ${formatNumber(wasmMs.median)} [${formatNumber(wasmMs.min)}..${formatNumber(wasmMs.max)}]`);
    console.log(`  WASM speed ratio: ${formatNumber(scenario.speedRatio)}x (${scenario.thresholdMet ? "met" : "below"} ${formatNumber(scenario.minWasmSpeedRatio)}x threshold)`);
    console.log(`  TypeScript stop reasons: ${JSON.stringify(scenario.typescript.stopReasons)}`);
    console.log(`  WASM stop reasons:       ${JSON.stringify(scenario.wasm.stopReasons)}`);
  }
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
  DEFAULT_SCENARIOS,
  MIN_WASM_CONTROL_SPEED_RATIO_FOR_DEFAULT,
  MIN_WASM_SPEED_RATIO_FOR_DEFAULT,
  SAFETY_GUARD_STOP_REASONS,
  assertNoSafetyGuardStops,
  benchmarkZxNextWasm,
  instantiateArtifact,
  parseArgs,
  prepareRawWasmFrame,
  runRawWasmFrames,
  summarizeRuns
};
