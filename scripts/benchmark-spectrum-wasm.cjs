#!/usr/bin/env node

const { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, statSync } = require("node:fs");
const { tmpdir } = require("node:os");
const { dirname, relative, resolve } = require("node:path");
const { performance } = require("node:perf_hooks");
const { spawnSync } = require("node:child_process");

const {
  buildModes: sp48BuildModes,
  productionExports: sp48ProductionExports,
  productionOutput: sp48ProductionOutput,
  source: sp48Source
} = require("./build-sp48-wasm.cjs");
const {
  buildModes: sp128BuildModes,
  productionExports: sp128ProductionExports,
  productionOutput: sp128ProductionOutput,
  source: sp128Source
} = require("./build-sp128-wasm.cjs");

const root = resolve(__dirname, "..");
const buildProfiles = {
  o3: {
    label: "o3",
    flags: ["-O3"]
  },
  speed: {
    label: "speed",
    flags: ["-O3", "-Wl,--strip-all"]
  },
  size: {
    label: "size",
    flags: ["-Oz"]
  },
  lto: {
    label: "lto",
    flags: ["-O3", "-flto"]
  },
  "o3-gc": {
    label: "o3-gc",
    flags: ["-O3", "-ffunction-sections", "-fdata-sections", "-Wl,--gc-sections"]
  },
  "lto-strip": {
    label: "lto-strip",
    flags: ["-O3", "-flto", "-Wl,--strip-all"]
  },
  "lto-gc-strip": {
    label: "lto-gc-strip",
    flags: ["-O3", "-flto", "-ffunction-sections", "-fdata-sections", "-Wl,--gc-sections", "-Wl,--strip-all"]
  }
};
const matrixBuildProfileNames = ["o3", "lto", "size", "o3-gc", "lto-strip", "lto-gc-strip"];

const modelConfigs = {
  sp48: {
    label: "ZX Spectrum 48K",
    artifactName: "zx-spectrum48.wasm",
    buildModes: sp48BuildModes,
    exports: sp48ProductionExports,
    source: sp48Source,
    productionOutput: sp48ProductionOutput,
    prefix: "sp48",
    hardReset: wasm => wasm.sp48HardReset(0, 0),
    uploadRomByte: (wasm, offset, value) => wasm.sp48UploadRomByte(offset, value),
    writeMemory: (wasm, address, value) => wasm.sp48WriteMemory(address, value)
  },
  sp128: {
    label: "ZX Spectrum 128K",
    artifactName: "zx-spectrum128.wasm",
    buildModes: sp128BuildModes,
    exports: sp128ProductionExports,
    source: sp128Source,
    productionOutput: sp128ProductionOutput,
    prefix: "sp128",
    hardReset: wasm => wasm.sp128HardReset(),
    uploadRomByte: (wasm, offset, value) => wasm.sp128UploadRomByte(0, offset, value),
    writeMemory: (wasm, address, value) => wasm.sp128WriteMemory(address, value)
  }
};

const commonScenarios = [
  {
    id: "nop-loop",
    label: "NOP-heavy frame loop",
    program: [0x00, 0x00, 0x00, 0x00, 0x00, 0x18, 0xf9]
  },
  {
    id: "cpu-loop",
    label: "CPU-heavy loop",
    program: [0x06, 0x00, 0x3c, 0xa8, 0x10, 0xfc, 0x18, 0xf8]
  },
  {
    id: "screen-write-loop",
    label: "Screen-write-heavy loop",
    program: [0x21, 0x00, 0x40, 0x06, 0x00, 0x70, 0x2c, 0x10, 0xfc, 0x18, 0xf8]
  },
  {
    id: "border-out-loop",
    label: "Border-change-heavy loop",
    program: [0x3c, 0xd3, 0xfe, 0x18, 0xfb]
  },
  {
    id: "keyboard-read-loop",
    label: "Keyboard-port-read-heavy loop",
    program: [0xdb, 0xfe, 0x18, 0xfc]
  },
  {
    id: "tape-passive-port-read",
    label: "Tape passive port-read loop",
    program: [0xdb, 0xfe, 0x18, 0xfc],
    setup: (wasm, prefix) => wasm[`${prefix}TapeSetMode`](0)
  },
  {
    id: "tape-load-port-read",
    label: "Tape load port-read loop",
    program: [0xdb, 0xfe, 0x18, 0xfc],
    setup: (wasm, prefix) => {
      seedTinyTapeBlock(wasm, prefix);
      wasm[`${prefix}TapeSetMode`](1);
    }
  }
];

const sp128OnlyScenarios = [
  {
    id: "paging-loop",
    label: "SP128 paging-heavy loop",
    model: "sp128",
    program: [0xaf, 0xd3, 0xfd, 0x3c, 0xe6, 0x07, 0x18, 0xf9]
  },
  {
    id: "psg-write-loop",
    label: "SP128 PSG-write-heavy loop",
    model: "sp128",
    program: [0x01, 0xfd, 0xff, 0x3e, 0x08, 0xed, 0x79, 0x01, 0xfd, 0xbf, 0x3c, 0xed, 0x79, 0x18, 0xfb]
  },
  {
    id: "psg-audio-loop",
    label: "SP128 PSG-audio-heavy loop",
    model: "sp128",
    program: [0x00, 0x00, 0x00, 0x00, 0x00, 0x18, 0xf9],
    setup: wasm => {
      wasm.sp128SetPsgRegisterIndex(0);
      wasm.sp128WritePsgRegisterValue(64);
      wasm.sp128SetPsgRegisterIndex(1);
      wasm.sp128WritePsgRegisterValue(0);
      wasm.sp128SetPsgRegisterIndex(7);
      wasm.sp128WritePsgRegisterValue(0xfe);
      wasm.sp128SetPsgRegisterIndex(8);
      wasm.sp128WritePsgRegisterValue(0x0f);
    }
  }
];

function parseArgs(argv) {
  const options = {
    audioRate: 44100,
    build: false,
    compiler: null,
    frames: 120,
    keepTemp: false,
    json: false,
    matrix: false,
    model: "all",
    profile: "speed",
    runs: 7,
    scenario: null,
    warmup: 20
  };

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    switch (arg) {
      case "--audio-rate":
        options.audioRate = parsePositiveInteger(argv[++i], "--audio-rate");
        break;
      case "--build":
        options.build = true;
        break;
      case "--compiler":
        options.compiler = requireValue(argv[++i], "--compiler");
        break;
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
      case "--keep-temp":
        options.keepTemp = true;
        break;
      case "--matrix":
        options.matrix = true;
        options.build = true;
        break;
      case "--model":
        options.model = requireValue(argv[++i], "--model");
        break;
      case "--profile":
        options.profile = requireValue(argv[++i], "--profile");
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

  if (!["all", ...Object.keys(modelConfigs)].includes(options.model)) {
    throw new Error(`Unknown model '${options.model}'. Expected one of: all, sp48, sp128.`);
  }
  if (buildProfiles[options.profile] == null) {
    throw new Error(`Unknown profile '${options.profile}'. Expected one of: ${Object.keys(buildProfiles).join(", ")}.`);
  }
  return options;
}

function requireValue(value, flag) {
  if (value == null || value.startsWith("--")) {
    throw new Error(`${flag} requires a value.`);
  }
  return value;
}

function parsePositiveInteger(value, flag) {
  const numeric = Number.parseInt(requireValue(value, flag), 10);
  if (!Number.isFinite(numeric) || numeric <= 0) {
    throw new Error(`${flag} must be a positive integer.`);
  }
  return numeric;
}

function printHelp() {
  console.log(`Usage: node scripts/benchmark-spectrum-wasm.cjs [options]

Options:
  --build              Build benchmark artifacts into a temporary directory.
  --profile <name>     Optimization profile for --build. Default: speed.
  --matrix             Build and benchmark all planned switch-matrix profiles.
  --compiler <path>    C compiler to use with --build. Defaults to SP48/SP128_WASM_CC or clang.
  --model <name>       Model to benchmark: all, sp48, sp128. Default: all.
  --scenario <id>      Run one scenario by id.
  --frames <count>     Measured frames per run. Default: 120.
  --warmup <count>     Warmup frames before each run. Default: 20.
  --runs <count>       Repeated measurements per scenario. Default: 7.
  --audio-rate <hz>    Audio sample rate to set before each scenario. Default: 44100.
  --json               Print JSON instead of a table.
  --keep-temp          Keep temporary --build artifacts.
  --help               Show this help text.

Scenario ids:
  ${allScenarioIds().join(", ")}`);
  console.log(`
Build profiles:
  ${Object.keys(buildProfiles).join(", ")}`);
}

function allScenarioIds() {
  return [...commonScenarios, ...sp128OnlyScenarios].map(scenario => scenario.id);
}

function selectedModels(options) {
  return options.model === "all" ? Object.keys(modelConfigs) : [options.model];
}

function scenariosForModel(model, scenarioId) {
  const scenarios = [
    ...commonScenarios,
    ...sp128OnlyScenarios.filter(scenario => scenario.model === model)
  ];
  return scenarioId == null ? scenarios : scenarios.filter(scenario => scenario.id === scenarioId);
}

function selectedProfileNames(options) {
  return options.matrix ? matrixBuildProfileNames : [options.profile];
}

function buildWasmArtifact(model, config, profileName, options, tempDir) {
  const profile = buildProfiles[profileName];
  const output = resolve(tempDir, profileName, model, config.artifactName);
  const selected = config.buildModes.production;
  const compiler = options.compiler ?? process.env[`${config.prefix.toUpperCase()}_WASM_CC`] ?? "clang";
  mkdirSync(dirname(output), { recursive: true });
  const args = [
    "--target=wasm32",
    "-std=c11",
    ...profile.flags,
    "-ffreestanding",
    "-fno-builtin",
    "-nostdlib",
    "-Wl,--no-entry",
    "-Wl,--export-memory",
    `-Wl,--initial-memory=${selected.initialMemory}`,
    `-Wl,--max-memory=${selected.initialMemory}`,
    ...config.exports.filter(name => name !== "memory").map(name => `-Wl,--export=${name}`),
    config.source,
    "-o",
    output
  ];

  const result = spawnSync(compiler, args, { cwd: root, stdio: "inherit" });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`${config.label} benchmark WASM compilation failed (${result.status}).`);
  }
  return {
    compiler,
    flags: profile.flags,
    profile: profile.label,
    source: relative(root, config.source),
    path: output,
    sourceKind: "temporary-build"
  };
}

function resolveArtifact(model, config, profileName, options, tempDir) {
  if (options.build || !existsSync(config.productionOutput)) {
    return buildWasmArtifact(model, config, profileName, options, tempDir);
  }
  return {
    compiler: null,
    flags: [],
    profile: "existing-artifact",
    source: relative(root, config.source),
    path: config.productionOutput,
    sourceKind: "existing-production-artifact"
  };
}

async function instantiateArtifact(artifactPath) {
  const bytes = readFileSync(artifactPath);
  const { instance } = await WebAssembly.instantiate(bytes);
  return instance.exports;
}

function uploadProgram(config, wasm, address, program) {
  for (let i = 0; i < program.length; i++) {
    const target = address + i;
    if (target < 0x4000) {
      config.uploadRomByte(wasm, target, program[i]);
    } else {
      config.writeMemory(wasm, target, program[i]);
    }
  }
}

function setupScenario(config, wasm, scenario, options) {
  config.hardReset(wasm);
  wasm[`${config.prefix}SetAudioSampleRate`](options.audioRate);
  uploadProgram(config, wasm, 0x8000, scenario.program);
  wasm[`${config.prefix}SetCpuPc`](0x8000);
  wasm[`${config.prefix}SetCpuSp`](0xfffe);
  if (scenario.setup != null) {
    scenario.setup(wasm, config.prefix);
  }
}

function seedTinyTapeBlock(wasm, prefix) {
  const beginOk = wasm[`${prefix}TapeBeginUpload`](1, 1);
  const blockOk = wasm[`${prefix}TapeSetBlock`](0, 0, 1, 1000, 10, 4, 4, 6, 12, 5, 8, 2);
  const writeOk = wasm[`${prefix}TapeWriteData`](0, 0x00);
  const finishOk = wasm[`${prefix}TapeFinishUpload`]();
  if (beginOk === 0 || blockOk === 0 || writeOk === 0 || finishOk === 0) {
    throw new Error(`${prefix} could not seed the tape-load benchmark block.`);
  }
}

function runFrames(wasm, prefix, frameCount) {
  for (let i = 0; i < frameCount; i++) {
    wasm[`${prefix}ExecuteFrame`]();
  }
}

function measureScenario(config, wasm, scenario, options) {
  const runs = [];
  for (let i = 0; i < options.runs; i++) {
    setupScenario(config, wasm, scenario, options);
    runFrames(wasm, config.prefix, options.warmup);

    const startInstructions = wasm[`${config.prefix}GetCpuInstructionsExecuted`]();
    const start = performance.now();
    runFrames(wasm, config.prefix, options.frames);
    const elapsedMs = performance.now() - start;
    const endInstructions = wasm[`${config.prefix}GetCpuInstructionsExecuted`]();

    runs.push({
      audioSamplesPerFrame: wasm[`${config.prefix}GetAudioSampleCount`](),
      framesPerSecond: options.frames * 1000 / elapsedMs,
      instructionsPerFrame: (endInstructions - startInstructions) / options.frames,
      millisecondsPerFrame: elapsedMs / options.frames
    });
  }
  return summarizeRuns(runs);
}

function summarizeRuns(runs) {
  return {
    audioSamplesPerFrame: median(runs.map(run => run.audioSamplesPerFrame)),
    framesPerSecond: stats(runs.map(run => run.framesPerSecond)),
    instructionsPerFrame: median(runs.map(run => run.instructionsPerFrame)),
    millisecondsPerFrame: stats(runs.map(run => run.millisecondsPerFrame))
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

function printTable(results, options) {
  console.log(`Spectrum WASM benchmark (${options.frames} frames/run, ${options.warmup} warmup, ${options.runs} runs)`);
  for (const group of results) {
    console.log("");
    console.log(`${group.modelLabel}`);
    console.log(`  artifact: ${relative(root, group.artifactPath)}`);
    console.log(`  source: ${group.artifactSourceKind}, profile: ${group.profile}, size: ${formatInteger(group.artifactBytes)} bytes`);
    if (group.flags.length > 0) {
      console.log(`  flags: ${group.flags.join(" ")}`);
    }
    console.log("  scenario                    ms/frame median [min..max]    fps median [min..max]      instr/frame    audio/frame");
    for (const result of group.scenarios) {
      const ms = result.metrics.millisecondsPerFrame;
      const fps = result.metrics.framesPerSecond;
      console.log(`  ${result.scenarioId.padEnd(27)} ${formatNumber(ms.median).padStart(8)} [${formatNumber(ms.min)}..${formatNumber(ms.max)}]    ${formatNumber(fps.median).padStart(8)} [${formatNumber(fps.min)}..${formatNumber(fps.max)}]    ${formatInteger(result.metrics.instructionsPerFrame).padStart(11)}    ${formatInteger(result.metrics.audioSamplesPerFrame).padStart(11)}`);
    }
  }
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    printHelp();
    return;
  }

  const tempDir = mkdtempSync(resolve(tmpdir(), "klive-spectrum-wasm-bench-"));
  const results = [];
  try {
    for (const model of selectedModels(options)) {
      const config = modelConfigs[model];
      const scenarios = scenariosForModel(model, options.scenario);
      if (scenarios.length === 0) {
        throw new Error(`Scenario '${options.scenario}' is not available for ${model}. Available ids: ${scenariosForModel(model).map(scenario => scenario.id).join(", ")}.`);
      }

      for (const profileName of selectedProfileNames(options)) {
        const artifact = resolveArtifact(model, config, profileName, options, tempDir);
        const wasm = await instantiateArtifact(artifact.path);
        const group = {
          artifactBytes: statSync(artifact.path).size,
          artifactPath: artifact.path,
          artifactSourceKind: artifact.sourceKind,
          compiler: artifact.compiler,
          flags: artifact.flags,
          model,
          modelLabel: `${config.label} / ${artifact.profile}`,
          profile: artifact.profile,
          source: artifact.source,
          scenarios: []
        };

        for (const scenario of scenarios) {
          group.scenarios.push({
            label: scenario.label,
            scenarioId: scenario.id,
            metrics: measureScenario(config, wasm, scenario, options)
          });
        }
        results.push(group);
      }
    }

    if (options.json) {
      console.log(JSON.stringify({ options, results }, null, 2));
    } else {
      printTable(results, options);
    }
  } finally {
    if (!options.keepTemp) {
      rmSync(tempDir, { recursive: true, force: true });
    }
  }
}

main().catch(error => {
  console.error(error.stack ?? error.message);
  process.exitCode = 1;
});
