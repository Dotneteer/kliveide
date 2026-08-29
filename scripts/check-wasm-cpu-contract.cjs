const { existsSync, readFileSync, statSync } = require("node:fs");
const { relative, resolve } = require("node:path");

const root = resolve(__dirname, "..");
const sharedCpuSource = resolve(root, "src/emu/z80/wasm/z80.c");
const sharedSpectrumDeviceSources = {
  ula: resolve(root, "src/emu/machines/zxSpectrum/wasm/common/zx-spectrum-ula.c"),
  keyboard: resolve(root, "src/emu/machines/zxSpectrum/wasm/common/zx-spectrum-keyboard.c"),
  beeper: resolve(root, "src/emu/machines/zxSpectrum/wasm/common/zx-spectrum-beeper.c"),
  ports: resolve(root, "src/emu/machines/zxSpectrum/wasm/common/zx-spectrum-ports.c"),
  tape: resolve(root, "src/emu/machines/zxSpectrum/wasm/common/zx-spectrum-tape.c"),
  psg: resolve(root, "src/emu/machines/zxSpectrum/wasm/common/zx-spectrum-psg.c")
};

const spectrumWasmCpuContract = [
  {
    id: "sp48",
    label: "ZX Spectrum 48K",
    mode: "z80",
    buildScript: resolve(root, "scripts/build-sp48-wasm.cjs"),
    buildEntrySource: resolve(root, "src/emu/machines/zxSpectrum48/wasm/sp48/sp48.c"),
    cpuAdapterSource: resolve(root, "src/emu/machines/zxSpectrum48/wasm/sp48/sp48.c"),
    artifact: resolve(root, "src/emu/machines/zxSpectrum48/wasm/dist/zx-spectrum48.wasm"),
    include: '#include "../../../../z80/wasm/z80.c"',
    sharedDeviceIncludes: [
      '#include "../../../zxSpectrum/wasm/common/zx-spectrum-ula.c"',
      '#include "../../../zxSpectrum/wasm/common/zx-spectrum-keyboard.c"',
      '#include "../../../zxSpectrum/wasm/common/zx-spectrum-beeper.c"',
      '#include "../../../zxSpectrum/wasm/common/zx-spectrum-ports.c"',
      '#include "../../../zxSpectrum/wasm/common/zx-spectrum-tape.c"'
    ],
    requiredExports: ["sp48GetCpuAf", "sp48GetCpuBc", "sp48GetCpuDe", "sp48GetCpuHl", "sp48GetCpuPc", "sp48GetCpuSp"]
  },
  {
    id: "sp128",
    label: "ZX Spectrum 128K",
    mode: "z80",
    buildScript: resolve(root, "scripts/build-sp128-wasm.cjs"),
    buildEntrySource: resolve(root, "src/emu/machines/zxSpectrum128/wasm/sp128/sp128.c"),
    cpuAdapterSource: resolve(root, "src/emu/machines/zxSpectrum128/wasm/sp128/sp128.c"),
    artifact: resolve(root, "src/emu/machines/zxSpectrum128/wasm/dist/zx-spectrum128.wasm"),
    include: '#include "../../../../z80/wasm/z80.c"',
    sharedDeviceIncludes: [
      '#include "../../../zxSpectrum/wasm/common/zx-spectrum-ula.c"',
      '#include "../../../zxSpectrum/wasm/common/zx-spectrum-keyboard.c"',
      '#include "../../../zxSpectrum/wasm/common/zx-spectrum-psg.c"',
      '#include "../../../zxSpectrum/wasm/common/zx-spectrum-beeper.c"',
      '#include "../../../zxSpectrum/wasm/common/zx-spectrum-ports.c"',
      '#include "../../../zxSpectrum/wasm/common/zx-spectrum-tape.c"'
    ],
    requiredExports: ["sp128GetCpuAf", "sp128GetCpuBc", "sp128GetCpuDe", "sp128GetCpuHl", "sp128GetCpuPc", "sp128GetCpuSp"]
  },
  {
    id: "spp3e",
    label: "ZX Spectrum +3E",
    mode: "z80",
    buildScript: resolve(root, "scripts/build-spp3e-wasm.cjs"),
    buildEntrySource: resolve(root, "src/emu/machines/zxSpectrumP3e/wasm/spp3e/spp3e.c"),
    cpuAdapterSource: resolve(root, "src/emu/machines/zxSpectrumP3e/wasm/spp3e/spp3e.c"),
    artifact: resolve(root, "src/emu/machines/zxSpectrumP3e/wasm/dist/zx-spectrum-p3e.wasm"),
    include: '#include "../../../../z80/wasm/z80.c"',
    sharedDeviceIncludes: [
      '#include "../../../zxSpectrum/wasm/common/zx-spectrum-ula.c"',
      '#include "../../../zxSpectrum/wasm/common/zx-spectrum-keyboard.c"',
      '#include "../../../zxSpectrum/wasm/common/zx-spectrum-psg.c"',
      '#include "../../../zxSpectrum/wasm/common/zx-spectrum-beeper.c"',
      '#include "../../../zxSpectrum/wasm/common/zx-spectrum-tape.c"'
    ],
    requiredExports: ["spp3eGetCpuAf", "spp3eGetCpuBc", "spp3eGetCpuDe", "spp3eGetCpuHl", "spp3eGetCpuPc", "spp3eGetCpuSp"]
  },
  {
    id: "zxnext",
    label: "ZX Spectrum Next",
    mode: "z80n",
    buildScript: resolve(root, "scripts/build-zxnext-wasm.cjs"),
    buildEntrySource: resolve(root, "src/emu/machines/zxNext/wasm/zxnext/zxnext.c"),
    cpuAdapterSource: resolve(root, "src/emu/machines/zxNext/wasm/zxnext/zxnext-cpu.c"),
    artifact: resolve(root, "src/emu/machines/zxNext/wasm/dist/zx-spectrum-next.wasm"),
    include: '#include "../../../../z80/wasm/z80.c"',
    requiredExports: [
      "zxnextGetCpuAf",
      "zxnextGetCpuBc",
      "zxnextGetCpuDe",
      "zxnextGetCpuHl",
      "zxnextGetCpuPc",
      "zxnextGetCpuSp",
      "zxnextGetSharedZ80NMode"
    ]
  }
];

function relativeToRoot(path) {
  return relative(root, path);
}

function readText(path) {
  return readFileSync(path, "utf8");
}

function validateSharedCpuSource() {
  const source = readText(sharedCpuSource);
  const errors = [];
  if (!source.includes("typedef struct Z80State")) {
    errors.push("shared CPU source does not declare the Z80Cpu state contract");
  }
  if (!source.includes("z80nMode")) {
    errors.push("shared CPU source does not expose a Z80N mode state");
  }
  if (!source.includes("uint32_t z80GetZ80NMode(void)")) {
    errors.push("shared CPU source does not export the Z80N mode getter");
  }
  return {
    path: sharedCpuSource,
    relativePath: relativeToRoot(sharedCpuSource),
    ok: errors.length === 0,
    errors
  };
}

function validateSharedSpectrumDeviceSources() {
  return Object.entries(sharedSpectrumDeviceSources).map(([id, path]) => ({
    id,
    path,
    relativePath: relativeToRoot(path),
    ok: existsSync(path),
    errors: existsSync(path) ? [] : [`shared Spectrum WASM ${id} source is missing at ${relativeToRoot(path)}`]
  }));
}

function validateModelContract(entry) {
  const errors = [];
  const sourceText = readText(entry.cpuAdapterSource);
  const build = require(entry.buildScript);

  if (!sourceText.includes(entry.include)) {
    errors.push(`${relativeToRoot(entry.cpuAdapterSource)} does not include the shared Z80/Z80N source '${entry.include}'`);
  }
  for (const include of entry.sharedDeviceIncludes ?? []) {
    if (!sourceText.includes(include)) {
      errors.push(`${relativeToRoot(entry.cpuAdapterSource)} does not include shared Spectrum device source '${include}'`);
    }
  }
  if (!sourceText.includes("#define Z80_EXTERNAL_BUS 1")) {
    errors.push(`${relativeToRoot(entry.cpuAdapterSource)} does not declare the external Z80 bus adapter`);
  }
  if (entry.mode === "z80n" && !sourceText.includes("z80SetZ80NMode(1")) {
    errors.push(`${relativeToRoot(entry.cpuAdapterSource)} does not enable Z80N mode`);
  }
  if (entry.mode === "z80" && sourceText.includes("z80SetZ80NMode(1")) {
    errors.push(`${relativeToRoot(entry.cpuAdapterSource)} unexpectedly enables Z80N mode`);
  }
  if (build.productionOutput !== entry.artifact) {
    errors.push(
      `${relativeToRoot(entry.buildScript)} productionOutput is ${relativeToRoot(build.productionOutput)}; expected ${relativeToRoot(entry.artifact)}`
    );
  }
  if (build.source !== undefined && build.source !== entry.buildEntrySource) {
    errors.push(
      `${relativeToRoot(entry.buildScript)} source is ${relativeToRoot(build.source)}; expected ${relativeToRoot(entry.buildEntrySource)}`
    );
  }
  for (const exportName of entry.requiredExports) {
    if (!build.productionExports.includes(exportName)) {
      errors.push(`${relativeToRoot(entry.buildScript)} does not export required CPU contract symbol '${exportName}'`);
    }
  }
  if (!existsSync(entry.artifact)) {
    errors.push(`${relativeToRoot(entry.artifact)} is missing; run the model WASM build first`);
  }

  return {
    id: entry.id,
    label: entry.label,
    mode: entry.mode,
    buildEntrySource: relativeToRoot(entry.buildEntrySource),
    cpuAdapterSource: relativeToRoot(entry.cpuAdapterSource),
    artifact: relativeToRoot(entry.artifact),
    artifactBytes: existsSync(entry.artifact) ? statSync(entry.artifact).size : 0,
    sharedCpuSource: relativeToRoot(sharedCpuSource),
    sharedDeviceIncludes: entry.sharedDeviceIncludes ?? [],
    ok: errors.length === 0,
    errors
  };
}

function validateWasmCpuContract() {
  const shared = validateSharedCpuSource();
  const sharedSpectrumDevices = validateSharedSpectrumDeviceSources();
  const models = spectrumWasmCpuContract.map(validateModelContract);
  const errors = [
    ...shared.errors,
    ...sharedSpectrumDevices.flatMap(device => device.errors),
    ...models.flatMap(model => model.errors)
  ];
  return {
    shared,
    sharedSpectrumDevices,
    models,
    ok: errors.length === 0,
    errors
  };
}

function checkWasmCpuContract() {
  const report = validateWasmCpuContract();
  console.log(JSON.stringify(report, null, 2));
  if (!report.ok) {
    throw new Error(`Spectrum WASM CPU contract failed with ${report.errors.length} issue(s).`);
  }
  return report;
}

if (require.main === module) {
  checkWasmCpuContract();
}

module.exports = {
  checkWasmCpuContract,
  sharedCpuSource,
  sharedSpectrumDeviceSources,
  spectrumWasmCpuContract,
  validateWasmCpuContract
};
