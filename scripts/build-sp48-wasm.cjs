const { mkdirSync, writeFileSync } = require("node:fs");
const { dirname, relative, resolve } = require("node:path");
const { spawnSync } = require("node:child_process");

const root = resolve(__dirname, "..");
const source = resolve(root, "src/emu/machines/zxSpectrum48/wasm/sp48_core.c");
const z80Source = resolve(root, "src/emu/z80/wasm/z80_abi.c");
const z80CpuSource = resolve(root, "src/emu/z80/wasm/z80_cpu.c");
const output = resolve(root, "src/emu/machines/zxSpectrum48/wasm/dist/zx-spectrum48.wasm");
const layoutOutput = resolve(root, "src/emu/machines/zxSpectrum48/wasm/sp48-wasm-layout.generated.ts");
const wasmDistDirectory = resolve(root, "src/emu/machines/zxSpectrum48/wasm/dist");
const packagedResourceDirectory = "wasm/zxSpectrum48";

const layoutValues = {
  abiVersion: 1,
  layoutVersion: 1,
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
  resultTapeSaveTraceCountOffset: 32
};

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
  resultTapeSaveTraceCountOffset: 45
};

const productionExports = [
  "memory",
  "sp48_abi_version",
  "sp48_layout_value",
  "sp48_machine_state_block_ptr",
  "sp48_input_block_ptr",
  "sp48_result_block_ptr",
  "sp48_event_buffer_ptr",
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
  "sp48_write_port"
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

function buildSp48Wasm({ compiler = process.env.SP48_WASM_CC || "clang", run = spawnSync } = {}) {
  mkdirSync(dirname(output), { recursive: true });
  writeLayoutConstants();
  const args = [
    "--target=wasm32",
    "-std=c11",
    "-O3",
    "-nostdlib",
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
    "-Wl,--no-entry",
    "-Wl,--export-memory",
    "-Wl,--initial-memory=786432",
    "-Wl,--max-memory=786432",
    ...testExports.filter(name => name !== "memory").map(name => `-Wl,--export=${name}`),
    source,
    z80Source,
    z80CpuSource,
    "-o",
    output
  ];
  const result = run(compiler, args, { cwd: root, stdio: "inherit" });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`ZX Spectrum 48K WASM compilation failed (${result.status}).`);
  return { compiler, args, source, output };
}

if (require.main === module) buildSp48Wasm();

module.exports = {
  buildSp48Wasm,
  layoutOutput,
  layoutValueIds,
  layoutValues,
  output,
  packagedResourceDirectory,
  productionExports,
  source,
  testExports,
  wasmDistDirectory,
  z80CpuSource,
  z80Source,
  outputRelative: relative(root, output),
  wasmDistDirectoryRelative: relative(root, wasmDistDirectory)
};
