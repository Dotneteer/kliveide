const { existsSync, mkdirSync, unlinkSync, writeFileSync } = require("node:fs");
const { dirname, relative, resolve } = require("node:path");
const { spawnSync } = require("node:child_process");

const root = resolve(__dirname, "..");
const source = resolve(root, "src/emu/machines/zxSpectrum48/wasm/sp48_core.c");
const z80StateSource = resolve(root, "src/emu/z80/wasm/z80_state.c");
const z80TestBusStorageSource = resolve(root, "src/emu/z80/wasm/z80_test_bus_storage.c");
const fastZ80ReferenceSource = resolve(root, "src/emu/z80/wasm/reference/fast_z80_test_adapter.c");
const fastZ80Sp48Source = resolve(root, "src/emu/z80/wasm/reference/fast_z80_sp48_adapter.c");
const productionOutput = resolve(root, "src/emu/machines/zxSpectrum48/wasm/dist/zx-spectrum48.wasm");
const v2Source = resolve(root, "src/emu/machines/zxSpectrum48/wasm/v2/sp48/sp48.c");
const v2Output = resolve(root, "src/emu/machines/zxSpectrum48/wasm/dist/zx-spectrum48-v2.wasm");
const staleDistTestOutput = resolve(root, "src/emu/machines/zxSpectrum48/wasm/dist/zx-spectrum48-test.wasm");
const testOutput = resolve(root, "src/emu/machines/zxSpectrum48/wasm/test-dist/zx-spectrum48-test.wasm");
const fastZ80ReferenceOutput = resolve(root, "src/emu/machines/zxSpectrum48/wasm/test-dist/zx-spectrum48-fast-z80-reference.wasm");
const fastZ80TestOutput = resolve(root, "src/emu/machines/zxSpectrum48/wasm/test-dist/zx-spectrum48-fast-z80-test.wasm");
const output = productionOutput;
const layoutOutput = resolve(root, "src/emu/machines/zxSpectrum48/wasm/sp48-wasm-layout.generated.ts");
const wasmDistDirectory = resolve(root, "src/emu/machines/zxSpectrum48/wasm/dist");
const packagedResourceDirectory = "wasm/zxSpectrum48";
const packagedArtifactRelative = `${packagedResourceDirectory}/zx-spectrum48.wasm`;
const optimizationProfiles = {
  speed: ["-O3"],
  size: ["-Oz"],
  lto: ["-O3", "-flto"]
};

const layoutValues = {
  abiVersion: 1,
  layoutVersion: 2,
  machineStateBlockSize: 80,
  inputBlockSize: 64,
  resultBlockSize: 64,
  eventBufferSize: 6144,
  memorySize: 65536,
  dirtyRangeCapacity: 32,
  dirtyRangeRecordSize: 4,
  timingTableCapacity: 69888,
  floatingBusNone: 65535,
  borderTraceRecordSize: 8,
  borderTraceCapacity: 256,
  borderTraceOffset: 0,
  audioTraceRecordSize: 8,
  audioTraceCapacity: 256,
  audioTraceOffset: 2048,
  eventStatusAudioOverflowMask: 1,
  audioSampleRecordSize: 4,
  audioSampleCapacity: 2048,
  audioSampleScale: 32767,
  eventStatusAudioSampleOverflowMask: 4,
  tapeSaveTraceRecordSize: 8,
  tapeSaveTraceCapacity: 256,
  tapeSaveTraceOffset: 4096,
  tapeEarTableCapacity: 69888,
  eventStatusTapeSaveOverflowMask: 2,
  debugAccessLogCapacity: 256,
  debugAccessLogRecordSize: 4,
  machineStateCpuStateOffset: 0,
  machineStateFrameTactsOffset: 32,
  machineStateUlaPortOffset: 64,
  machineStateIs16KModelOffset: 65,
  machineStateBorderColorOffset: 66,
  machineStateEarLatchOffset: 67,
  machineStateMicLatchOffset: 68,
  inputKeyboardRowsOffset: 0,
  inputRunModeOffset: 16,
  inputTapeModeOffset: 17,
  inputTapeEarDefaultOffset: 18,
  inputTerminationPointOffset: 20,
  inputTerminationPointEnabledOffset: 22,
  resultTerminationOffset: 0,
  resultEventCountOffset: 4,
  resultDirtyRangeCountOffset: 8,
  resultInstructionCountOffset: 12,
  resultCpuStatusOffset: 16,
  resultBorderTraceCountOffset: 20,
  resultAudioTraceCountOffset: 24,
  resultEventStatusOffset: 28,
  resultTapeSaveTraceCountOffset: 32,
  resultAudioSampleCountOffset: 36
};

const legacySp48Defines = [
  `-DSP48_ABI_VERSION=${layoutValues.abiVersion}`,
  `-DSP48_LAYOUT_VERSION=${layoutValues.layoutVersion}`,
  `-DSP48_MACHINE_STATE_BLOCK_SIZE=${layoutValues.machineStateBlockSize}`,
  `-DSP48_INPUT_BLOCK_SIZE=${layoutValues.inputBlockSize}`,
  `-DSP48_RESULT_BLOCK_SIZE=${layoutValues.resultBlockSize}`,
  `-DSP48_EVENT_BUFFER_SIZE=${layoutValues.eventBufferSize}`,
  `-DSP48_MEMORY_SIZE=${layoutValues.memorySize}`,
  `-DSP48_DIRTY_RANGE_CAPACITY=${layoutValues.dirtyRangeCapacity}`,
  `-DSP48_DIRTY_RANGE_RECORD_SIZE=${layoutValues.dirtyRangeRecordSize}`,
  `-DSP48_TIMING_TABLE_CAPACITY=${layoutValues.timingTableCapacity}`,
  `-DSP48_FLOATING_BUS_NONE=${layoutValues.floatingBusNone}`,
  `-DSP48_BORDER_TRACE_RECORD_SIZE=${layoutValues.borderTraceRecordSize}`,
  `-DSP48_BORDER_TRACE_CAPACITY=${layoutValues.borderTraceCapacity}`,
  `-DSP48_BORDER_TRACE_OFFSET=${layoutValues.borderTraceOffset}`,
  `-DSP48_AUDIO_TRACE_RECORD_SIZE=${layoutValues.audioTraceRecordSize}`,
  `-DSP48_AUDIO_TRACE_CAPACITY=${layoutValues.audioTraceCapacity}`,
  `-DSP48_AUDIO_TRACE_OFFSET=${layoutValues.audioTraceOffset}`,
  `-DSP48_EVENT_STATUS_AUDIO_OVERFLOW_MASK=${layoutValues.eventStatusAudioOverflowMask}`,
  `-DSP48_AUDIO_SAMPLE_RECORD_SIZE=${layoutValues.audioSampleRecordSize}`,
  `-DSP48_AUDIO_SAMPLE_CAPACITY=${layoutValues.audioSampleCapacity}`,
  `-DSP48_AUDIO_SAMPLE_SCALE=${layoutValues.audioSampleScale}`,
  `-DSP48_EVENT_STATUS_AUDIO_SAMPLE_OVERFLOW_MASK=${layoutValues.eventStatusAudioSampleOverflowMask}`,
  `-DSP48_TAPE_SAVE_TRACE_RECORD_SIZE=${layoutValues.tapeSaveTraceRecordSize}`,
  `-DSP48_TAPE_SAVE_TRACE_CAPACITY=${layoutValues.tapeSaveTraceCapacity}`,
  `-DSP48_TAPE_SAVE_TRACE_OFFSET=${layoutValues.tapeSaveTraceOffset}`,
  `-DSP48_TAPE_EAR_TABLE_CAPACITY=${layoutValues.tapeEarTableCapacity}`,
  `-DSP48_EVENT_STATUS_TAPE_SAVE_OVERFLOW_MASK=${layoutValues.eventStatusTapeSaveOverflowMask}`,
  `-DSP48_DEBUG_ACCESS_LOG_CAPACITY=${layoutValues.debugAccessLogCapacity}`,
  `-DSP48_DEBUG_ACCESS_LOG_RECORD_SIZE=${layoutValues.debugAccessLogRecordSize}`,
  `-DSP48_MACHINE_STATE_CPU_STATE_OFFSET=${layoutValues.machineStateCpuStateOffset}`,
  `-DSP48_MACHINE_STATE_FRAME_TACTS_OFFSET=${layoutValues.machineStateFrameTactsOffset}`,
  `-DSP48_MACHINE_STATE_ULA_PORT_OFFSET=${layoutValues.machineStateUlaPortOffset}`,
  `-DSP48_MACHINE_STATE_IS_16K_MODEL_OFFSET=${layoutValues.machineStateIs16KModelOffset}`,
  `-DSP48_MACHINE_STATE_BORDER_COLOR_OFFSET=${layoutValues.machineStateBorderColorOffset}`,
  `-DSP48_MACHINE_STATE_EAR_LATCH_OFFSET=${layoutValues.machineStateEarLatchOffset}`,
  `-DSP48_MACHINE_STATE_MIC_LATCH_OFFSET=${layoutValues.machineStateMicLatchOffset}`,
  `-DSP48_INPUT_KEYBOARD_ROWS_OFFSET=${layoutValues.inputKeyboardRowsOffset}`,
  `-DSP48_INPUT_RUN_MODE_OFFSET=${layoutValues.inputRunModeOffset}`,
  `-DSP48_INPUT_TAPE_MODE_OFFSET=${layoutValues.inputTapeModeOffset}`,
  `-DSP48_INPUT_TAPE_EAR_DEFAULT_OFFSET=${layoutValues.inputTapeEarDefaultOffset}`,
  `-DSP48_INPUT_TERMINATION_POINT_OFFSET=${layoutValues.inputTerminationPointOffset}`,
  `-DSP48_INPUT_TERMINATION_POINT_ENABLED_OFFSET=${layoutValues.inputTerminationPointEnabledOffset}`,
  `-DSP48_RESULT_TERMINATION_OFFSET=${layoutValues.resultTerminationOffset}`,
  `-DSP48_RESULT_EVENT_COUNT_OFFSET=${layoutValues.resultEventCountOffset}`,
  `-DSP48_RESULT_DIRTY_RANGE_COUNT_OFFSET=${layoutValues.resultDirtyRangeCountOffset}`,
  `-DSP48_RESULT_INSTRUCTION_COUNT_OFFSET=${layoutValues.resultInstructionCountOffset}`,
  `-DSP48_RESULT_CPU_STATUS_OFFSET=${layoutValues.resultCpuStatusOffset}`,
  `-DSP48_RESULT_BORDER_TRACE_COUNT_OFFSET=${layoutValues.resultBorderTraceCountOffset}`,
  `-DSP48_RESULT_AUDIO_TRACE_COUNT_OFFSET=${layoutValues.resultAudioTraceCountOffset}`,
  `-DSP48_RESULT_EVENT_STATUS_OFFSET=${layoutValues.resultEventStatusOffset}`,
  `-DSP48_RESULT_TAPE_SAVE_TRACE_COUNT_OFFSET=${layoutValues.resultTapeSaveTraceCountOffset}`,
  `-DSP48_RESULT_AUDIO_SAMPLE_COUNT_OFFSET=${layoutValues.resultAudioSampleCountOffset}`
];

const layoutValueIds = {
  layoutVersion: 0,
  machineStateBlockSize: 1,
  inputBlockSize: 2,
  resultBlockSize: 3,
  eventBufferSize: 4,
  memorySize: 5,
  dirtyRangeCapacity: 6,
  dirtyRangeRecordSize: 7,
  timingTableCapacity: 8,
  floatingBusNone: 9,
  borderTraceRecordSize: 10,
  borderTraceCapacity: 11,
  borderTraceOffset: 12,
  audioTraceRecordSize: 13,
  audioTraceCapacity: 14,
  audioTraceOffset: 15,
  eventStatusAudioOverflowMask: 16,
  tapeSaveTraceRecordSize: 17,
  tapeSaveTraceCapacity: 18,
  tapeSaveTraceOffset: 19,
  tapeEarTableCapacity: 20,
  eventStatusTapeSaveOverflowMask: 21,
  debugAccessLogCapacity: 22,
  debugAccessLogRecordSize: 23,
  machineStateCpuStateOffset: 24,
  machineStateFrameTactsOffset: 25,
  machineStateUlaPortOffset: 26,
  machineStateIs16KModelOffset: 27,
  machineStateBorderColorOffset: 28,
  machineStateEarLatchOffset: 29,
  machineStateMicLatchOffset: 30,
  inputKeyboardRowsOffset: 31,
  inputRunModeOffset: 32,
  inputTapeModeOffset: 33,
  inputTapeEarDefaultOffset: 34,
  inputTerminationPointOffset: 35,
  inputTerminationPointEnabledOffset: 36,
  resultTerminationOffset: 37,
  resultEventCountOffset: 38,
  resultDirtyRangeCountOffset: 39,
  resultInstructionCountOffset: 40,
  resultCpuStatusOffset: 41,
  resultBorderTraceCountOffset: 42,
  resultAudioTraceCountOffset: 43,
  resultEventStatusOffset: 44,
  resultTapeSaveTraceCountOffset: 45,
  audioSampleRecordSize: 46,
  audioSampleCapacity: 47,
  audioSampleScale: 48,
  eventStatusAudioSampleOverflowMask: 49,
  resultAudioSampleCountOffset: 50
};

const productionExports = [
  "memory",
  "sp48_abi_version",
  "sp48_layout_value",
  "sp48_machine_state_block_ptr",
  "sp48_input_block_ptr",
  "sp48_result_block_ptr",
  "sp48_event_buffer_ptr",
  "sp48_keyboard_lines_ptr",
  "sp48_audio_samples_ptr",
  "sp48_audio_sample_count",
  "sp48_audio_sample_capacity",
  "sp48_set_audio_sample_rate",
  "sp48_memory_ptr",
  "sp48_memory_size",
  "sp48_dirty_ranges_ptr",
  "sp48_contention_table_ptr",
  "sp48_floating_bus_table_ptr",
  "sp48_tape_ear_table_ptr",
  "sp48_timing_table_capacity",
  "sp48_dirty_range_count",
  "sp48_clear_dirty_ranges",
  "sp48_border_trace_count",
  "sp48_clear_border_trace",
  "sp48_audio_trace_count",
  "sp48_clear_audio_trace",
  "sp48_event_status",
  "sp48_tape_save_trace_count",
  "sp48_clear_tape_save_trace",
  "sp48_debug_memory_log_count",
  "sp48_debug_memory_log_ptr",
  "sp48_debug_io_log_count",
  "sp48_debug_io_log_ptr",
  "sp48_diagnostics_reset",
  "sp48_diagnostics_value",
  "sp48_set_16k_model",
  "sp48_import_state",
  "sp48_export_state",
  "sp48_import_snapshot",
  "sp48_export_snapshot",
  "sp48_patch_memory",
  "sp48_execute_instructions",
  "sp48_execute_frame",
  "sp48_create",
  "sp48_reset",
  "sp48_load_rom_byte",
  "sp48_read_memory",
  "sp48_write_memory",
  "sp48_read_port",
  "sp48_write_port",
  "sp48_set_key_status",
  "sp48_get_keyboard_line"
];

const testExports = [
  ...productionExports,
  "z80_abi_version",
  "z80_reset",
  "z80_state_block_ptr",
  "z80_state_block_size",
  "z80_state_export",
  "z80_state_import",
  "z80_execute_instruction",
  "z80_test_memory_ptr",
  "z80_test_memory_size",
  "z80_test_memory_log_capacity",
  "z80_test_io_log_capacity",
  "z80_test_tbblue_log_capacity",
  "z80_test_memory_log_count",
  "z80_test_memory_log_ptr",
  "z80_test_io_log_count",
  "z80_test_io_log_ptr",
  "z80_test_tbblue_log_count",
  "z80_test_tbblue_log_ptr",
  "z80_test_io_input_ptr",
  "z80_test_io_input_count_set",
  "z80_test_bus_reset"
];

const fastZ80ReferenceExports = [
  "memory",
  "fast_z80_abi_version",
  "fast_z80_reset",
  "fast_z80_state_block_ptr",
  "fast_z80_state_block_size",
  "fast_z80_state_export",
  "fast_z80_state_import",
  "fast_z80_execute_instruction",
  "fast_z80_test_memory_ptr",
  "fast_z80_test_memory_size",
  "fast_z80_test_memory_log_capacity",
  "fast_z80_test_io_log_capacity",
  "fast_z80_test_tbblue_log_capacity",
  "fast_z80_test_memory_log_count",
  "fast_z80_test_memory_log_ptr",
  "fast_z80_test_io_log_count",
  "fast_z80_test_io_log_ptr",
  "fast_z80_test_tbblue_log_count",
  "fast_z80_test_tbblue_log_ptr",
  "fast_z80_test_io_input_ptr",
  "fast_z80_test_io_input_count_set",
  "fast_z80_test_bus_reset"
];

const standaloneZ80TestExports = [
  "memory",
  "z80_abi_version",
  "z80_reset",
  "z80_state_block_ptr",
  "z80_state_block_size",
  "z80_state_export",
  "z80_state_import",
  "z80_execute_instruction",
  "z80_test_memory_ptr",
  "z80_test_memory_size",
  "z80_test_memory_log_capacity",
  "z80_test_io_log_capacity",
  "z80_test_tbblue_log_capacity",
  "z80_test_memory_log_count",
  "z80_test_memory_log_ptr",
  "z80_test_io_log_count",
  "z80_test_io_log_ptr",
  "z80_test_tbblue_log_count",
  "z80_test_tbblue_log_ptr",
  "z80_test_io_input_ptr",
  "z80_test_io_input_count_set",
  "z80_test_bus_reset"
];

const v2Exports = [
  "memory",
  "sp48MemoryPtr",
  "sp48PixelBufferPtr",
  "sp48AudioSamplesPtr",
  "sp48KeyboardLinesPtr",
  "sp48TapeDataPtr",
  "sp48TapeSaveDataPtr",
  "sp48TapeFileNamePtr",
  "sp48Reset",
  "sp48HardReset",
  "sp48ExecuteFrame",
  "sp48ExecuteInstruction",
  "sp48RenderInstantScreen",
  "sp48DelayAddressBusAccess",
  "sp48DelayPortAccess",
  "sp48DelayPortRead",
  "sp48DelayPortWrite",
  "sp48ResetContentionCounters",
  "sp48SetTacts",
  "sp48UploadRomByte",
  "sp48ReadMemory",
  "sp48WriteMemory",
  "sp48ReadScreenMemoryOffset",
  "sp48SetKeyStatus",
  "sp48ReadPort",
  "sp48ReadFloatingBus",
  "sp48WritePort",
  "sp48SetAudioSampleRate",
  "sp48GetScreenWidth",
  "sp48GetScreenHeight",
  "sp48GetPixelBufferStartOffset",
  "sp48GetRomSize",
  "sp48GetRomUploadCount",
  "sp48GetRomChecksum",
  "sp48GetAudioSampleCount",
  "sp48GetAudioSampleCapacity",
  "sp48GetTactsInFrame",
  "sp48SetTargetClockMultiplier",
  "sp48GetClockMultiplier",
  "sp48GetTargetClockMultiplier",
  "sp48GetTactsInCurrentFrame",
  "sp48GetBaseClockFrequency",
  "sp48GetFrames",
  "sp48GetTacts",
  "sp48GetCurrentFrameTact",
  "sp48GetRasterLines",
  "sp48GetScreenLineTime",
  "sp48GetTimingScreenWidth",
  "sp48GetTimingScreenLines",
  "sp48GetFirstDisplayLine",
  "sp48GetFirstVisibleLine",
  "sp48GetFirstVisibleBorderTact",
  "sp48GetContentionValue",
  "sp48GetRenderingPhase",
  "sp48GetRenderingPixelAddress",
  "sp48GetRenderingAttributeAddress",
  "sp48GetRenderingPixelIndex",
  "sp48GetTotalContentionDelaySinceStart",
  "sp48GetContentionDelaySincePause",
  "sp48GetNextFrameStartTact",
  "sp48GetFrameCompleted",
  "sp48GetInterruptsRaised",
  "sp48GetInterruptLineActive",
  "sp48GetCpuInstructionsExecuted",
  "sp48GetCpuFrameSliceInstructions",
  "sp48GetCpuTacts",
  "sp48GetCpuAf",
  "sp48SetCpuAf",
  "sp48GetCpuBc",
  "sp48SetCpuBc",
  "sp48GetCpuDe",
  "sp48SetCpuDe",
  "sp48GetCpuHl",
  "sp48SetCpuHl",
  "sp48GetCpuIx",
  "sp48SetCpuIx",
  "sp48GetCpuIy",
  "sp48SetCpuIy",
  "sp48GetCpuAfAlt",
  "sp48SetCpuAfAlt",
  "sp48GetCpuBcAlt",
  "sp48GetCpuDeAlt",
  "sp48GetCpuHlAlt",
  "sp48GetCpuIr",
  "sp48GetCpuWz",
  "sp48GetCpuPc",
  "sp48SetCpuPc",
  "sp48GetCpuSp",
  "sp48SetCpuSp",
  "sp48TapeClear",
  "sp48TapeSetFileNameByte",
  "sp48TapeBeginUpload",
  "sp48TapeSetBlock",
  "sp48TapeWriteData",
  "sp48TapeFinishUpload",
  "sp48TapeRewind",
  "sp48TapeSetMode",
  "sp48TapeSetFastLoad",
  "sp48TapeGetFastLoad",
  "sp48TapeGetMaxBlocks",
  "sp48TapeGetDataCapacity",
  "sp48TapeGetFileNameCapacity",
  "sp48TapeGetBlockCount",
  "sp48TapeGetDataLength",
  "sp48TapeGetCurrentBlockIndex",
  "sp48TapeGetLoaded",
  "sp48TapeGetEof",
  "sp48TapeGetUploadActive",
  "sp48TapeGetMode",
  "sp48TapeGetPlayPhase",
  "sp48TapeGetCurrentEarBit",
  "sp48TapeGetCurrentDataIndex",
  "sp48TapeGetCurrentBitMask",
  "sp48TapeGetStartTact",
  "sp48TapeGetModeChangeCount",
  "sp48TapeGetLastModeChangeTact",
  "sp48TapeGetLastModeChangePc",
  "sp48TapeGetLoadStartCount",
  "sp48TapeGetSaveStartCount",
  "sp48TapeClassifySavePulse",
  "sp48TapeGetSavePhase",
  "sp48TapeGetSaveLastPulse",
  "sp48TapeGetSaveMicBit",
  "sp48TapeGetSaveLastMicBitTact",
  "sp48TapeGetSavePilotPulseCount",
  "sp48TapeGetSavedBlockCount",
  "sp48TapeGetSavedDataLength",
  "sp48TapeGetSavedRevision",
  "sp48TapeGetSaveDataCapacity",
  "sp48TapeGetSaveMaxBlocks",
  "sp48TapeGetSavedBlockOffset",
  "sp48TapeGetSavedBlockLength",
  "sp48TapeClearSavedBlocks",
  "sp48TapeGetEarBit",
  "sp48TapeGetBlockOffset",
  "sp48TapeGetBlockLength",
  "sp48TapeGetBlockPauseAfter",
  "sp48TapeGetBlockPilotPulseLength",
  "sp48TapeGetBlockSync1PulseLength",
  "sp48TapeGetBlockSync2PulseLength",
  "sp48TapeGetBlockZeroBitPulseLength",
  "sp48TapeGetBlockOneBitPulseLength",
  "sp48TapeGetBlockEndSyncPulseLength",
  "sp48TapeGetBlockLastByteUsedBits",
  "sp48TapeGetBlockPilotPulseCount",
  "sp48GetCpuHalted",
  "sp48GetCpuPrefix",
  "sp48GetCpuIff1",
  "sp48SetCpuIff1",
  "sp48GetCpuInterruptMode",
  "sp48SetCpuInterruptMode",
  "sp48GetCpuRetExecuted",
  "sp48GetCpuRetnExecuted",
  "sp48GetLastMemoryAddress",
  "sp48GetLastMemoryValue",
  "sp48GetLastMemoryIsWrite",
  "sp48GetLastPortAddress",
  "sp48GetLastPortValue",
  "sp48GetLastPortIsWrite",
  "sp48GetKeyboardLine",
  "sp48GetPortFeValue",
  "sp48GetBorderColor",
  "sp48GetEarBit",
  "sp48GetMicBit",
  "sp48GetBeeperLevel",
  "sp48GetEarBitChangedFrom0Tacts",
  "sp48GetEarBitChangedFrom1Tacts",
  "sp48GetDiagnosticFlags"
];

const buildModes = {
  production: {
    output: productionOutput,
    exports: productionExports,
    sources: [source, z80StateSource, z80TestBusStorageSource, fastZ80Sp48Source]
  },
  test: {
    output: testOutput,
    exports: testExports,
    sources: [source, z80StateSource, z80TestBusStorageSource, fastZ80Sp48Source, fastZ80ReferenceSource]
  },
  "fast-z80-reference": {
    output: fastZ80ReferenceOutput,
    exports: fastZ80ReferenceExports,
    sources: [fastZ80ReferenceSource]
  },
  "fast-z80-test": {
    output: fastZ80TestOutput,
    exports: standaloneZ80TestExports,
    sources: [fastZ80ReferenceSource]
  },
  v2: {
    output: v2Output,
    exports: v2Exports,
    sources: [v2Source],
    initialMemory: 8 * 1024 * 1024
  }
};

function writeLayoutConstants() {
  mkdirSync(dirname(layoutOutput), { recursive: true });
  writeFileSync(layoutOutput, `// Generated by scripts/build-sp48-wasm.cjs. Do not edit by hand.

export const SP48_WASM_ARTIFACT_NAME = "zx-spectrum48.wasm";
export const SP48_WASM_ABI_VERSION = ${layoutValues.abiVersion} as const;
export const SP48_WASM_LAYOUT = ${JSON.stringify(layoutValues, null, 2)} as const;
export const SP48_WASM_LAYOUT_VALUE_ID = ${JSON.stringify(layoutValueIds, null, 2)} as const;

export type Sp48WasmLayoutValueKey = keyof typeof SP48_WASM_LAYOUT_VALUE_ID;
`);
}

function normalizeBuildMode(mode = process.env.SP48_WASM_BUILD_MODE || "production") {
  if (buildModes[mode] == null) {
    throw new Error(`Unknown ZX Spectrum 48K WASM build mode '${mode}'. Expected one of: ${Object.keys(buildModes).join(", ")}.`);
  }
  return mode;
}

function normalizeOptimization(optimization = process.env.SP48_WASM_OPTIMIZATION || "speed") {
  if (optimizationProfiles[optimization] == null) {
    throw new Error(`Unknown ZX Spectrum 48K WASM optimization profile '${optimization}'. Expected one of: ${Object.keys(optimizationProfiles).join(", ")}.`);
  }
  return optimization;
}

function buildSp48Wasm({
  compiler = process.env.SP48_WASM_CC || "clang",
  mode = process.env.SP48_WASM_BUILD_MODE || "production",
  optimization = process.env.SP48_WASM_OPTIMIZATION || "speed",
  outputPath,
  run = spawnSync
} = {}) {
  const buildMode = normalizeBuildMode(mode);
  const optimizationProfile = normalizeOptimization(optimization);
  const selectedExports = buildModes[buildMode].exports;
  const selectedOutput = outputPath ?? buildModes[buildMode].output;
  const selectedSources = buildModes[buildMode].sources;
  const selectedInitialMemory = buildModes[buildMode].initialMemory ?? 786432;
  const selectedDefines = buildMode === "v2" ? [] : legacySp48Defines;
  if (buildMode === "production" && existsSync(staleDistTestOutput)) {
    unlinkSync(staleDistTestOutput);
  }
  mkdirSync(dirname(selectedOutput), { recursive: true });
  writeLayoutConstants();
  const args = [
    "--target=wasm32",
    "-std=c11",
    ...optimizationProfiles[optimizationProfile],
    "-ffreestanding",
    "-fno-builtin",
    "-nostdlib",
    ...selectedDefines,
    "-Wl,--no-entry",
    "-Wl,--export-memory",
    `-Wl,--initial-memory=${selectedInitialMemory}`,
    `-Wl,--max-memory=${selectedInitialMemory}`,
    ...selectedExports.filter(name => name !== "memory").map(name => `-Wl,--export=${name}`),
    ...selectedSources,
    "-o",
    selectedOutput
  ];
  const result = run(compiler, args, { cwd: root, stdio: "inherit" });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`ZX Spectrum 48K WASM compilation failed (${result.status}).`);
  return {
    compiler,
    args,
    mode: buildMode,
    optimization: optimizationProfile,
    exports: selectedExports,
    source: selectedSources[0],
    sources: selectedSources,
    output: selectedOutput
  };
}

function buildAllSp48Wasm(options = {}) {
  return [
    buildSp48Wasm({ ...options, mode: "production" }),
    buildSp48Wasm({ ...options, mode: "v2" })
  ];
}

if (require.main === module) buildAllSp48Wasm();

module.exports = {
  buildSp48Wasm,
  buildAllSp48Wasm,
  buildModes,
  fastZ80ReferenceExports,
  fastZ80ReferenceOutput,
  fastZ80ReferenceSource,
  fastZ80Sp48Source,
  fastZ80TestOutput,
  layoutOutput,
  layoutValueIds,
  layoutValues,
  output,
  productionOutput,
  packagedArtifactRelative,
  packagedResourceDirectory,
  productionExports,
  source,
  standaloneZ80TestExports,
  testExports,
  testOutput,
  v2Exports,
  v2Output,
  v2Source,
  wasmDistDirectory,
  z80StateSource,
  z80TestBusStorageSource,
  outputRelative: relative(root, output),
  productionOutputRelative: relative(root, productionOutput),
  testOutputRelative: relative(root, testOutput),
  v2OutputRelative: relative(root, v2Output),
  wasmDistDirectoryRelative: relative(root, wasmDistDirectory)
};
