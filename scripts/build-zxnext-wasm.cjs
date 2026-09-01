const { closeSync, existsSync, mkdirSync, openSync, readFileSync, readdirSync, statSync, unlinkSync, writeSync } = require("node:fs");
const { dirname, relative, resolve } = require("node:path");
const { spawnSync } = require("node:child_process");

const root = resolve(__dirname, "..");
const source = resolve(root, "src/emu/machines/zxNext/wasm/zxnext/zxnext.c");
const productionOutput = resolve(root, "src/emu/machines/zxNext/wasm/dist/zx-spectrum-next.wasm");
const output = productionOutput;
const wasmDistDirectory = resolve(root, "src/emu/machines/zxNext/wasm/dist");
const buildLockPath = resolve(wasmDistDirectory, ".zx-spectrum-next.wasm.lock");
const packagedResourceDirectory = "wasm/zxNext";
const packagedArtifactRelative = `${packagedResourceDirectory}/zx-spectrum-next.wasm`;

const optimizationProfiles = {
  speed: ["-O3", "-Wl,--strip-all"],
  size: ["-Oz", "-Wl,--strip-all"],
  lto: ["-O3", "-flto"]
};

const productionExports = [
  "memory",
  "zxnextMemoryPtr",
  "zxnextPixelBufferPtr",
  "zxnextKeyboardLinesPtr",
  "zxnextNextRegsPtr",
  "zxnextReset",
  "zxnextHardReset",
  "zxnextExecuteFrame",
  "zxnextExecuteInstruction",
  "zxnextRenderInstantScreen",
  "zxnextReadMemory",
  "zxnextWriteMemory",
  "zxnextReadScreenMemoryOffset",
  "zxnextGetMemoryPageReadOffset",
  "zxnextGetMemoryPageWriteOffset",
  "zxnextGetMemoryPageBank16",
  "zxnextGetMemoryPageBank8",
  "zxnextGetMemorySelectedRomPage",
  "zxnextGetMemorySelectedRamBank",
  "zxnextSetKeyStatus",
  "zxnextGetKeyboardLine",
  "zxnextReadPort",
  "zxnextWritePort",
  "zxnextGetMemorySize",
  "zxnextGetFlatMemorySize",
  "zxnextGetKeyboardLineCount",
  "zxnextGetNextRegCount",
  "zxnextGetScreenWidth",
  "zxnextGetScreenHeight",
  "zxnextGetPixelBufferStartOffset",
  "zxnextGetFrames",
  "zxnextGetTacts",
  "zxnextGetCurrentFrameTact",
  "zxnextGetTactsInFrame",
  "zxnextGetFrameCompleted",
  "zxnextSetSignalNmi",
  "zxnextGetSignalNmi",
  "zxnextSetNmiCause",
  "zxnextGetNmiCause",
  "zxnextGetNmiReturnAddress",
  "zxnextGetStacklessNmiProcessed",
  "zxnextSetSignalInt",
  "zxnextGetSignalInt",
  "zxnextGetLastInterruptVector",
  "zxnextSetDaisyStatus",
  "zxnextSetDaisyEnabled",
  "zxnextGetDaisyInService",
  "zxnextSetTacts",
  "zxnextGetCpuAf",
  "zxnextSetCpuAf",
  "zxnextGetCpuBc",
  "zxnextSetCpuBc",
  "zxnextGetCpuDe",
  "zxnextSetCpuDe",
  "zxnextGetCpuHl",
  "zxnextSetCpuHl",
  "zxnextGetCpuAfAlt",
  "zxnextSetCpuAfAlt",
  "zxnextGetCpuBcAlt",
  "zxnextSetCpuBcAlt",
  "zxnextGetCpuDeAlt",
  "zxnextSetCpuDeAlt",
  "zxnextGetCpuHlAlt",
  "zxnextSetCpuHlAlt",
  "zxnextGetCpuIx",
  "zxnextSetCpuIx",
  "zxnextGetCpuIy",
  "zxnextSetCpuIy",
  "zxnextGetCpuIr",
  "zxnextSetCpuIr",
  "zxnextGetCpuWz",
  "zxnextSetCpuWz",
  "zxnextGetCpuPc",
  "zxnextSetCpuPc",
  "zxnextGetCpuSp",
  "zxnextSetCpuSp",
  "zxnextGetCpuHalted",
  "zxnextGetCpuPrefix",
  "zxnextGetCpuIff1",
  "zxnextSetCpuIff1",
  "zxnextGetCpuIff2",
  "zxnextSetCpuIff2",
  "zxnextGetCpuInterruptMode",
  "zxnextSetCpuInterruptMode",
  "zxnextGetSharedZ80NMode",
  "zxnextGetLastMemoryAddress",
  "zxnextGetLastMemoryValue",
  "zxnextGetLastMemoryAccessed",
  "zxnextGetLastMemoryIsWrite",
  "zxnextGetLastPortAddress",
  "zxnextGetLastPortValue",
  "zxnextGetLastPortAccessed",
  "zxnextGetLastPortIsWrite",
  "zxnextTraceGetStartOffset",
  "zxnextTraceGetHeaderSize",
  "zxnextTraceGetRecordSize",
  "zxnextTraceGetCapacity",
  "zxnextTraceGetCount",
  "zxnextTraceGetOverflow",
  "zxnextTraceClear",
  "zxnextTraceSetEnabled",
  "zxnextTraceFinishFrame",
  "zxnextSetNextRegisterIndex",
  "zxnextGetNextRegisterIndex",
  "zxnextSetNextRegisterValue",
  "zxnextGetNextRegisterValue",
  "zxnextGetNextRegisterDirect",
  "zxnextSetNextRegisterDirect",
  "zxnextGetPortFeValue",
  "zxnextGetBorderColor",
  "zxnextGetEarBit",
  "zxnextGetMicBit",
  "zxnextGetBeeperLevel",
  "zxnextGetDiagnosticFlags",
  "zxnextReadPhysicalMemory",
  "zxnextChecksumPhysicalMemory",
  "zxnextSetTapeMode",
  "zxnextGetTapeMode",
  "zxnextGetTapeEarBit",
  "zxnextGetTapeMicBit",
  "zxnextProcessTapeMicBit",
  "zxnextGetUlaFlashCounter",
  "zxnextGetUlaFlashFlag",
  "zxnextAdvanceUlaFrameState",
  "zxnextGetUlaScanlineForTact",
  "zxnextGetUlaColumnForTact",
  "zxnextGetUlaScrollX",
  "zxnextGetUlaScrollY",
  "zxnextGetUlaClip",
  "zxnextGetPaletteNextReg",
  "zxnextGetPaletteEntry",
  "zxnextGetPaletteCurrentEntry",
  "zxnextGetPaletteIndex",
  "zxnextGetPaletteControl",
  "zxnextGetPaletteSecondWrite",
  "zxnextGetPaletteStoredValue",
  "zxnextSetLayer2Enabled",
  "zxnextGetLayer2Enabled",
  "zxnextGetLayer2Resolution",
  "zxnextGetLayer2PaletteOffset",
  "zxnextGetLayer2ScrollX",
  "zxnextGetLayer2ScrollY",
  "zxnextGetLayer2Clip",
  "zxnextGetLoResEnabled",
  "zxnextGetLoResRadastanMode",
  "zxnextGetLoResPaletteOffset",
  "zxnextGetLoResScrollX",
  "zxnextGetLoResScrollY",
  "zxnextGetLoResStandardAddress",
  "zxnextGetLoResRadastanAddress",
  "zxnextComposeLayer2Sample",
  "zxnextGetTilemapNextReg",
  "zxnextGetTilemapClip",
  "zxnextGetTilemapEnabled",
  "zxnextGetTilemapPaletteOffset",
  "zxnextGetTilemapScrollX",
  "zxnextGetTilemapScrollY",
  "zxnextGetTilemapBaseAddressUseBank7",
  "zxnextGetTilemapBaseAddressMsb",
  "zxnextGetTilemapDefinitionAddressUseBank7",
  "zxnextGetTilemapDefinitionAddressMsb",
  "zxnextSpriteWritePort303b",
  "zxnextSpriteWritePort57",
  "zxnextSpriteWritePort5b",
  "zxnextSpriteReadPort303b",
  "zxnextGetSpriteClip",
  "zxnextGetSpriteTransparencyIndex",
  "zxnextGetSpriteIndex",
  "zxnextGetSpritePatternIndex",
  "zxnextGetSpritePatternSubIndex",
  "zxnextGetSpriteSubIndex",
  "zxnextGetSpriteAttribute",
  "zxnextGetSpritePatternByte8",
  "zxnextGetSpritePatternByte4",
  "zxnextGetLastVisibleSpriteIndex",
  "zxnextCopperTick",
  "zxnextCopperRead",
  "zxnextGetCopperNextReg",
  "zxnextGetCopperStartMode",
  "zxnextGetCopperInstructionAddress",
  "zxnextGetCopperListAddress",
  "zxnextGetCopperListData",
  "zxnextGetCopperDout",
  "zxnextGetCopperVerticalLineOffset",
  "zxnextSetBeeperOutput",
  "zxnextGetBeeperEar",
  "zxnextGetBeeperMic",
  "zxnextGetBeeperOutputLevelMilli",
  "zxnextGetBeeperSampleLeftMilli",
  "zxnextGetBeeperSampleRightMilli",
  "zxnextSetPsgTurbosoundEnabled",
  "zxnextSetPsgAyStereoMode",
  "zxnextSetPsgChipMonoMode",
  "zxnextSetPsgRegisterIndex",
  "zxnextWritePsgRegisterValue",
  "zxnextReadPsgRegisterValue",
  "zxnextGeneratePsgOutput",
  "zxnextAdvancePsgToFrameTact",
  "zxnextPreparePsgAudioSample",
  "zxnextGetPsgSampleLeft",
  "zxnextGetPsgSampleRight",
  "zxnextGetPsgSelectedChip",
  "zxnextGetPsgSelectedRegister",
  "zxnextGetPsgChipPanning",
  "zxnextGetPsgChipMonoMode",
  "zxnextGetPsgRegister",
  "zxnextGetPsgOutputA",
  "zxnextGetPsgOutputB",
  "zxnextGetPsgOutputC",
  "zxnextGetPsgStereoLeft",
  "zxnextGetPsgStereoRight",
  "zxnextGetPsgNoiseRng",
  "zxnextGetPsgEnvelopeStep",
  "zxnextGetDacChannel",
  "zxnextGetDacStereoLeft",
  "zxnextGetDacStereoRight",
  "zxnextSetAudioSampleRate",
  "zxnextGetAudioSampleRate",
  "zxnextSetAudioMixerEarLevelMilli",
  "zxnextSetAudioMixerMicLevelMilli",
  "zxnextSetAudioMixerPsgOutput",
  "zxnextSetAudioMixerVolumeScaleMilli",
  "zxnextGetAudioMixerMixedLeftWord",
  "zxnextGetAudioMixerMixedRightWord",
  "zxnextAppendAudioMixerCurrentSample",
  "zxnextGetAudioMixerSampleCount",
  "zxnextGetAudioMixerSampleLeft",
  "zxnextGetAudioMixerSampleRight",
  "zxnextDivMmcBeforeFetch",
  "zxnextDivMmcAfterFetch",
  "zxnextDivMmcArmNmi",
  "zxnextGetDivMmcPortE3Value",
  "zxnextGetDivMmcEnabled",
  "zxnextGetDivMmcEnableAutomap",
  "zxnextGetDivMmcConmem",
  "zxnextGetDivMmcMapram",
  "zxnextGetDivMmcBank",
  "zxnextGetDivMmcAutoMapActive",
  "zxnextGetDivMmcRequestAutomapOn",
  "zxnextGetDivMmcRequestAutomapOff",
  "zxnextGetDivMmcNmiHold",
  "zxnextSetSdCardInfo",
  "zxnextGetSdSelectedCard",
  "zxnextGetSdPortE7Value",
  "zxnextGetSdState",
  "zxnextGetSdCommandIndex",
  "zxnextGetSdLastCommand",
  "zxnextGetSdResponseReady",
  "zxnextGetSdResponseIndex",
  "zxnextGetSdHostCommand",
  "zxnextGetSdHostSector",
  "zxnextGetSdHostCard",
  "zxnextGetSdWriteBufferPtr",
  "zxnextGetSdWriteBufferLength",
  "zxnextClearSdHostCommand",
  "zxnextSetSdReadResponse",
  "zxnextSetSdWriteResponse",
  "zxnextCtcClock",
  "zxnextGetCtcState",
  "zxnextGetCtcControlReg",
  "zxnextGetCtcTimeConstant",
  "zxnextGetCtcCount",
  "zxnextGetCtcZcTo",
  "zxnextGetCtcIntEnabled",
  "zxnextGetCtcExpectingTimeConstant",
  "zxnextUartPushRxByte",
  "zxnextUartPopTxByte",
  "zxnextUartHasTxData",
  "zxnextUartDrainTxFifo",
  "zxnextUartSetBreakCondition",
  "zxnextUartSetFramingError",
  "zxnextGetUartSelected",
  "zxnextGetUartPrescaler",
  "zxnextGetUartFrameRegister",
  "zxnextGetUartRxCount",
  "zxnextGetUartTxCount",
  "zxnextI2cReadSclPort",
  "zxnextI2cReadSdaPort",
  "zxnextI2cWriteSclPort",
  "zxnextI2cWriteSdaPort",
  "zxnextGetI2cScl",
  "zxnextGetI2cSda",
  "zxnextSetJoystickModes",
  "zxnextSetJoystickLeftState",
  "zxnextSetJoystickRightState",
  "zxnextJoystickReadPort1f",
  "zxnextJoystickReadPort37",
  "zxnextMouseSetNextReg0A",
  "zxnextMouseAddDelta",
  "zxnextMouseAddWheelDelta",
  "zxnextMouseSetButtons",
  "zxnextMouseReadPortFbdf",
  "zxnextMouseReadPortFfdf",
  "zxnextMouseReadPortFadf",
  "zxnextGetMouseDpi",
  "zxnextGetMouseSwapButtons",
  "zxnextExpansionSetNextReg",
  "zxnextExpansionGetNextReg",
  "zxnextExpansionEffectivePortEnable",
  "zxnextExpansionShouldPropagateIo",
  "zxnextExpansionSetSignals",
  "zxnextExpansionIsRomcsClaimed",
  "zxnextExpansionIsNmiAsserted",
  "zxnextExpansionIsIntActive",
  "zxnextExpansionIsUlaOverride",
  "zxnextDmaSetMode",
  "zxnextDmaWritePort",
  "zxnextDmaExecuteTransfer",
  "zxnextDmaReadStatusByte",
  "zxnextGetDmaMode",
  "zxnextGetDmaStatus",
  "zxnextGetDmaReadMask",
  "zxnextGetDmaPortAStartAddress",
  "zxnextGetDmaPortBStartAddress",
  "zxnextGetDmaBlockLength",
  "zxnextGetDmaEnabled",
  "zxnextGetDmaByteCounter",
  "zxnextGetDmaDirectionAtoB",
  "zxnextGetDmaPortAConfig",
  "zxnextGetDmaPortBConfig",
  "zxnextGetDmaTransferMode",
  "zxnextGetDmaTransferredBytes",
  "zxnextFloppyReadMainStatusRegister",
  "zxnextFloppyReadDataRegister",
  "zxnextFloppyWriteDataRegister",
  "zxnextGetFloppyOperationPhase",
  "zxnextGetFloppyCommandRegister",
  "zxnextGetFloppyCommandBytesReceived",
  "zxnextGetFloppySr0",
  "zxnextGetFloppySr1",
  "zxnextGetFloppySr2",
  "zxnextGetFloppySr3",
  "zxnextGetFloppyStepRate",
  "zxnextGetFloppyHeadUnloadTime",
  "zxnextGetFloppyHeadLoadTime",
  "zxnextGetFloppyNonDmaMode"
];

const buildModes = {
  production: {
    output: productionOutput,
    exports: productionExports,
    sources: [source],
    initialMemory: 32 * 1024 * 1024
  }
};

function normalizeBuildMode(mode = process.env.ZXNEXT_WASM_BUILD_MODE || "production") {
  if (buildModes[mode] == null) {
    throw new Error(`Unknown ZX Spectrum Next WASM build mode '${mode}'. Expected: production.`);
  }
  return mode;
}

function normalizeOptimization(optimization = process.env.ZXNEXT_WASM_OPTIMIZATION || "speed") {
  if (optimizationProfiles[optimization] == null) {
    throw new Error(
      `Unknown ZX Spectrum Next WASM optimization profile '${optimization}'. Expected one of: ${Object.keys(optimizationProfiles).join(", ")}.`
    );
  }
  return optimization;
}

function buildZxNextWasm({
  compiler = process.env.ZXNEXT_WASM_CC || "clang",
  mode = process.env.ZXNEXT_WASM_BUILD_MODE || "production",
  optimization = process.env.ZXNEXT_WASM_OPTIMIZATION || "speed",
  outputPath,
  run = spawnSync
} = {}) {
  const buildMode = normalizeBuildMode(mode);
  const optimizationProfile = normalizeOptimization(optimization);
  const selected = buildModes[buildMode];
  const selectedOutput = outputPath ?? selected.output;
  const releaseBuildLock = selectedOutput === productionOutput
    ? acquireZxNextWasmBuildLock()
    : () => {};
  try {
    if (existsSync(wasmDistDirectory) && dirname(selectedOutput) === wasmDistDirectory) {
      for (const entry of readdirSync(wasmDistDirectory)) {
        const candidate = resolve(wasmDistDirectory, entry);
        if (entry.endsWith(".wasm") && candidate !== selectedOutput) {
          unlinkSync(candidate);
        }
      }
    }
    mkdirSync(dirname(selectedOutput), { recursive: true });
    const args = [
      "--target=wasm32",
      "-std=c11",
      ...optimizationProfiles[optimizationProfile],
      "-ffreestanding",
      "-fno-builtin",
      "-nostdlib",
      "-Wl,--no-entry",
      "-Wl,--export-memory",
      `-Wl,--initial-memory=${selected.initialMemory}`,
      `-Wl,--max-memory=${selected.initialMemory}`,
      ...selected.exports.filter(name => name !== "memory").map(name => `-Wl,--export=${name}`),
      ...selected.sources,
      "-o",
      selectedOutput
    ];
    const result = run(compiler, args, { cwd: root, stdio: "inherit" });
    if (result.error) throw result.error;
    if (result.status !== 0) throw new Error(`ZX Spectrum Next WASM compilation failed (${result.status}).`);
    if (!existsSync(selectedOutput) || statSync(selectedOutput).size === 0) {
      throw new Error(
        `ZX Spectrum Next WASM compilation reported success (compiler: '${compiler}'), but '${selectedOutput}' is missing or empty. ` +
        `The build must not continue - packaging this app would ship a broken emulator.`
      );
    }
    return {
      compiler,
      args,
      mode: buildMode,
      optimization: optimizationProfile,
      exports: selected.exports,
      source: selected.sources[0],
      sources: selected.sources,
      output: selectedOutput
    };
  } finally {
    releaseBuildLock();
  }
}

function acquireZxNextWasmBuildLock(timeoutMs = 120000) {
  mkdirSync(wasmDistDirectory, { recursive: true });
  const started = Date.now();
  while (true) {
    try {
      const fd = openSync(buildLockPath, "wx");
      writeSync(fd, `${process.pid}\n${Date.now()}\n`);
      return () => {
        closeSync(fd);
        if (existsSync(buildLockPath)) unlinkSync(buildLockPath);
      };
    } catch (error) {
      if (error?.code !== "EEXIST") throw error;
      clearStaleZxNextWasmBuildLock(started, timeoutMs);
      sleepSync(50);
    }
  }
}

function waitForZxNextWasmBuildLock(timeoutMs = 120000) {
  const started = Date.now();
  while (existsSync(buildLockPath)) {
    clearStaleZxNextWasmBuildLock(started, timeoutMs);
    sleepSync(50);
  }
}

function clearStaleZxNextWasmBuildLock(started, timeoutMs) {
  if (Date.now() - started > timeoutMs) {
    throw new Error(`Timed out waiting for ZX Spectrum Next WASM build lock: ${buildLockPath}`);
  }
  try {
    const stat = statSync(buildLockPath);
    const ageMs = Date.now() - stat.mtimeMs;
    const owner = readZxNextWasmBuildLockOwner();
    if (owner?.pid != null && !isProcessAlive(owner.pid)) {
      unlinkSync(buildLockPath);
      return;
    }
    if (owner == null && ageMs > 1000) {
      unlinkSync(buildLockPath);
      return;
    }
    if (ageMs > timeoutMs) unlinkSync(buildLockPath);
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
  }
}

function readZxNextWasmBuildLockOwner() {
  try {
    const [pidLine] = readFileSync(buildLockPath, "utf8").split(/\r?\n/);
    const pid = Number.parseInt(pidLine, 10);
    if (!Number.isInteger(pid) || pid <= 0) return undefined;
    return { pid };
  } catch (error) {
    if (error?.code === "ENOENT") return undefined;
    throw error;
  }
}

function isProcessAlive(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return error?.code === "EPERM";
  }
}

function sleepSync(ms) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

function buildAllZxNextWasm(options = {}) {
  return [buildZxNextWasm(options)];
}

if (require.main === module) buildAllZxNextWasm();

module.exports = {
  buildZxNextWasm,
  buildAllZxNextWasm,
  buildModes,
  buildLockPath,
  optimizationProfiles,
  output,
  productionOutput,
  waitForZxNextWasmBuildLock,
  packagedArtifactRelative,
  packagedResourceDirectory,
  productionExports,
  source,
  wasmDistDirectory,
  outputRelative: relative(root, output),
  productionOutputRelative: relative(root, productionOutput),
  wasmDistDirectoryRelative: relative(root, wasmDistDirectory)
};
