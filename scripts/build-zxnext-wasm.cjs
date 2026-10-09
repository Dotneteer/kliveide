const { closeSync, existsSync, mkdirSync, openSync, readFileSync, readdirSync, statSync, unlinkSync, writeSync } = require("node:fs");
const { dirname, relative, resolve, sep } = require("node:path");
const { spawnSync } = require("node:child_process");
const {
  discardWasmOutput,
  layoutMapArgs,
  layoutMapPath,
  publishWasmOutput,
  stagingWasmOutput,
  stampWasmLayout
} = require("./wasm-layout.cjs");
const { cpuExports, debugLoopExports, debugLoopVolatileSymbols, Z80_ACCESS_LOG_VOLATILE_SYMBOLS } = require("./z80-cpu-exports.cjs");
const { Z80_CONDITION_EXPORTS, Z80_CONDITION_VOLATILE_SYMBOLS } = require("./z80-condition-exports.cjs");
const { Z80_HISTORY_EXPORTS, Z80_HISTORY_VOLATILE_SYMBOLS } = require("./z80-history-exports.cjs");
const { Z80_PROFILE_EXPORTS, Z80_PROFILE_VOLATILE_SYMBOLS } = require("./z80-profile-exports.cjs");

/**
 * Statics a Klive state file leaves out (`.plans/SNAPSHOT_SAVING_AND_STATE_FILES_PLAN.md` trap 10):
 * debugging state and buffers the core rewrites before it reads them, so a restore keeps the live
 * core's bytes there.
 */
/*
 * Frame-boundary scratch (`.plans/REVERSE_DEBUGGING_PLAN.md` T5): the ULA/sprite coverage map, which
 * the core rewrites before it reads it. Keyframes taken at a frame boundary leave it out; the T5 proof
 * in `test/wasm/reverse/journal-replay-determinism.test.ts` checks every keyframe interval. Not
 * scratch: the picture and the four layer buffers, which a step back shows half drawn (D18) and the
 * layer views read, and the beeper's transition buffer, whose pending transitions carry over.
 */
const ZXNEXT_SCRATCH_SYMBOLS = ["zxnextUlaSpriteCoverage"];

const ZXNEXT_VOLATILE_SYMBOLS = [
  // --- The IDE's breakpoint conditions and the per-instruction access log they read: debugging
  // --- state, not machine state, so a restore never brings back old breakpoints
  ...Z80_CONDITION_VOLATILE_SYMBOLS,
  ...debugLoopVolatileSymbols("zxnext"),
  ...Z80_ACCESS_LOG_VOLATILE_SYMBOLS,
  "zxnextNextRegWatch",
  "zxnextNextRegHit",
  "zxnextNextRegHitOrigin",
  "zxnextNextRegHitNew",
  "zxnextNextRegHitOld",
  "zxnextNextRegHitReg",
  "zxnextCopperWatch",
  "zxnextCopperWatchArmed",
  "zxnextCopperWatchAny",
  "zxnextCopperHit",
  "zxnextSpriteWatch",
  "zxnextSpriteWatchArmed",
  "zxnextSpriteHit",
  "zxnextSpriteWriteFromDma",
  // --- The Sprite Inspector's resolve buffer (SPRITE_INSPECTOR_PLAN trap T3)
  "zxnextIdeResolvedSprites",
  "zxnextIdeResolveScratch",
  "zxnextFrameTrace",
  "zxnextTraceEnabled",
  "zxnextTraceCount",
  "zxnextTraceOverflow",
  // --- Layer debugging: the mask, the capture, the preview and the probe (LAYER_COMPOSITION_PLAN
  // --- D2, T8), and the raster's scratch picture, which every span renders before it reads it
  "zxnextLayerDebugMask",
  "zxnextLayerDebugSolo",
  "zxnextLayerDebugFlags",
  "zxnextLayerCaptureOn",
  "zxnextCapUla",
  "zxnextCapTm",
  "zxnextCapL2",
  "zxnextCapSpr",
  "zxnextCapSpans",
  "zxnextCapSpanCount",
  "zxnextCapSpanOverflow",
  "zxnextCapSpanComplete",
  "zxnextCapCurrent",
  "zxnextLayerPreview",
  "zxnextLayerProbe",
  "zxnextLastMixParams",
  "zxnextDebugMixParams",
  "zxnextLayerAtSpanStart",
  "zxnextLayerThumb",
  "zxnextRasterScratch",
  // --- The beam position overlay's preview (BEAM_POSITION_OVERLAY_PLAN T2): the save area it restores
  // --- the renderers' statics from, and the info block it reports the beam in
  "zxnextBeamSaveUla",
  "zxnextBeamSaveTm",
  "zxnextBeamSaveL2",
  "zxnextBeamSaveSpr",
  "zxnextBeamSaveLineCut",
  "zxnextBeamSaveResolved",
  "zxnextBeamSaveShown",
  "zxnextBeamLatchesDone",
  "zxnextBeamInfo",
  // --- The execution-history ring (EXECUTION_HISTORY_VIEWER_PLAN D7)
  ...Z80_HISTORY_VOLATILE_SYMBOLS,
  // --- The access profile: flags, counters, time and its never-wrapping 28 MHz clock
  // --- (CODE_COVERAGE_AND_HEAT_MAP_PLAN T4, T7, D8)
  ...Z80_PROFILE_VOLATILE_SYMBOLS,
  "zxnextProfileTicks28"
];

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
  // --- Breakpoint condition evaluator (`src/emu/z80/wasm/z80-condition.c`)
  ...Z80_CONDITION_EXPORTS,
  // --- Execution history recorder (`src/emu/z80/wasm/z80-history.c`)
  ...Z80_HISTORY_EXPORTS,
  // --- Access profile (`src/emu/z80/wasm/z80-profile.c`)
  ...Z80_PROFILE_EXPORTS,
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
  "zxnextGetMemoryPort7ffd",
  "zxnextGetMemoryPortDffd",
  "zxnextGetMemoryPort1ffd",
  "zxnextGetMemoryPortEff7",
  "zxnextGetMemoryPageBank16",
  "zxnextGetMemoryPageBank8",
  "zxnextGetPartitionOfPage",
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
  "zxnextGetTimingTotalHc",
  "zxnextGetCpuSigInt",
  "zxnextGetCpuHeldByDma",
  "zxnextBeginAudioFrame",
  "zxnextGetTimingTotalVc",
  "zxnextGetTotalContentionDelaySinceStart",
  "zxnextGetContentionDelaySincePause",
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
  ...cpuExports("zxnext", { accessLog: true, accessLogOverflows: true, lastPort: true }),
  // --- The debugger's in-core loop (`z80-debug-loop.c`)
  ...debugLoopExports("zxnext"),
  "zxnextGetSharedZ80NMode",
  "zxnextGetLastPortAccessed",
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
  "zxnextWriteNextRegister",
  "zxnextGetNextRegisterLastWrite",
  "zxnextPeekNextRegister",
  "zxnextGetResetRequest",
  "zxnextTakeResetRequest",
  "zxnextPressMultifaceNmiButton",
  "zxnextPressDivMmcNmiButton",
  "zxnextGetNextRegisterValue",
  "zxnextGetNextRegisterDirect",
  "zxnextSetNextRegisterDirect",
  "zxnextNextRegWatchPtr",
  "zxnextClearNextRegWatch",
  "zxnextTakeNextRegHit",
  "zxnextCopperWatchPtr",
  "zxnextSetCopperWatchMode",
  "zxnextTakeCopperHit",
  "zxnextSpriteWatchPtr",
  "zxnextSetSpriteWatchArmed",
  "zxnextTakeSpriteHit",
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
  "zxnextSetLayerDebug",
  "zxnextGetLayerDebug",
  "zxnextSetLayerCapture",
  "zxnextRecomposeForDebug",
  "zxnextLayerPreviewPtr",
  "zxnextProbePixel",
  "zxnextRenderLayerComposite",
  "zxnextLayerBufferPtr",
  "zxnextGetLayerCaptureStatus",
  "zxnextGetRasterPixel",
  "zxnextGetBeamInfo",
  "zxnextRenderPreviewToBeam",
  "zxnextGetRgbaForRgb333",
  "zxnextGetLayer2ActiveBank",
  "zxnextGetLayer2ShadowBank",
  "zxnextGetLayer2Port123BPeek",
  "zxnextGetLayer2BankOffset",
  "zxnextGetLayer2ClipIndex",
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
  "zxnextGetTilemapControl",
  "zxnextGetTilemapDefaultAttr",
  "zxnextGetTilemapTransparencyIndex",
  "zxnextGetTilemapClipIndex",
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
  "zxnextSpriteAttributesPtr",
  "zxnextSpritePatternMemory8Ptr",
  "zxnextResolveSpritesForIde",
  "zxnextGetSpriteControl",
  "zxnextGetSpriteStatusPeek",
  "zxnextGetSpriteMirrorIndex",
  "zxnextGetSpriteClipIndex",
  "zxnextCopperTick",
  "zxnextCopperRead",
  "zxnextGetCopperNextReg",
  "zxnextGetCopperStartMode",
  "zxnextGetCopperInstructionAddress",
  "zxnextGetCopperListAddress",
  "zxnextGetCopperListData",
  "zxnextGetCopperDout",
  "zxnextGetCopperVerticalLineOffset",
  "zxnextCopperMemoryPtr",
  "zxnextGetCopperBeam",
  "zxnextGetCopperTiming",
  "zxnextGetCopperUpperBorder",
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
  "zxnextUartPeerSend",
  "zxnextUartPeerBreak",
  "zxnextUartPeerSetCts",
  "zxnextUartPeerSetLoopback",
  "zxnextUartPeerReadyToReceive",
  "zxnextUartPeerOutputCount",
  "zxnextUartPeerOutputByte",
  "zxnextI2cReadSclPort",
  "zxnextI2cReadSdaPort",
  "zxnextI2cWriteSclPort",
  "zxnextI2cWriteSdaPort",
  "zxnextRtcSetTime",
  "zxnextSetJoystickLeftState",
  "zxnextSetJoystickRightState",
  "zxnextJoystickReadPort1f",
  "zxnextJoystickReadPort37",
  "zxnextMousePacket",
  "zxnextMouseReadPortFbdf",
  "zxnextMouseReadPortFfdf",
  "zxnextMouseReadPortFadf",
  "zxnextMousePortReadCount",
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
  "zxnextDmaReadStatusByte",
  "zxnextGetDmaMode",
  "zxnextGetDmaByteCounter",
  "zxnextGetDmaAddressA",
  "zxnextGetDmaAddressB",
  "zxnextGetDmaSeq",
];

const buildModes = {
  production: {
    output: productionOutput,
    exports: productionExports,
    sources: [source],
    // --- 40 MB: the 8 MB execution-history ring did not fit beside the frame trace in 32 MB
    // --- (EXECUTION_HISTORY_VIEWER_PLAN T9, Q6). 56 MB: the access profile adds its 2 MB of flags
    // --- and its 12 MB counter pool (CODE_COVERAGE_AND_HEAT_MAP_PLAN D5)
    initialMemory: 56 * 1024 * 1024
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
  // --- A real build is staged and renamed into place (see `publishWasmOutput`)
  const compiledOutput = stagingWasmOutput(selectedOutput, run === spawnSync);
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
      compiledOutput
    ];
    const layoutMap = layoutMapPath(selectedOutput);
    const result = run(compiler, [...args, ...layoutMapArgs(layoutMap)], { cwd: root, stdio: "inherit" });
    if (result.error || result.status !== 0) discardWasmOutput(compiledOutput, selectedOutput);
    if (result.error) throw result.error;
    if (result.status !== 0) throw new Error(`ZX Spectrum Next WASM compilation failed (${result.status}).`);
    if (!existsSync(compiledOutput) || statSync(compiledOutput).size === 0) {
      throw new Error(
        `ZX Spectrum Next WASM compilation reported success (compiler: '${compiler}'), but '${selectedOutput}' is missing or empty. ` +
        `The build must not continue - packaging this app would ship a broken emulator.`
      );
    }
    // --- The memory layout a Klive state file depends on (scripts/wasm-layout.cjs)
    const layout = stampWasmLayout(compiledOutput, layoutMap, ZXNEXT_VOLATILE_SYMBOLS, ZXNEXT_SCRATCH_SYMBOLS);
    publishWasmOutput(compiledOutput, selectedOutput);
    return {
      layout,
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

// --- electron-builder resource paths and package.json config use forward slashes on
// --- every platform, so never leak Windows backslashes from path.relative().
function toPosixRelative(from, to) {
  return relative(from, to).split(sep).join("/");
}

module.exports = {
  ZXNEXT_VOLATILE_SYMBOLS,
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
  outputRelative: toPosixRelative(root, output),
  productionOutputRelative: toPosixRelative(root, productionOutput),
  wasmDistDirectoryRelative: toPosixRelative(root, wasmDistDirectory)
};
