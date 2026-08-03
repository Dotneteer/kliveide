import {
  SP48_WASM_ABI_VERSION,
  SP48_WASM_ARTIFACT_NAME,
  SP48_WASM_LAYOUT,
  SP48_WASM_LAYOUT_VALUE_ID,
  type Sp48WasmLayoutValueKey
} from "./sp48-wasm-layout.generated";

export type Sp48WasmExportFunction = (...args: number[]) => number;

export type Sp48WasmExports = WebAssembly.Exports & {
  memory: WebAssembly.Memory;
  sp48_abi_version: Sp48WasmExportFunction;
  sp48_layout_value: Sp48WasmExportFunction;
  sp48_machine_state_block_ptr: Sp48WasmExportFunction;
  sp48_input_block_ptr: Sp48WasmExportFunction;
  sp48_result_block_ptr: Sp48WasmExportFunction;
  sp48_event_buffer_ptr: Sp48WasmExportFunction;
  sp48_memory_ptr: Sp48WasmExportFunction;
  sp48_memory_size: Sp48WasmExportFunction;
  sp48_dirty_ranges_ptr: Sp48WasmExportFunction;
  sp48_contention_table_ptr: Sp48WasmExportFunction;
  sp48_floating_bus_table_ptr: Sp48WasmExportFunction;
  sp48_tape_ear_table_ptr: Sp48WasmExportFunction;
  sp48_timing_table_capacity: Sp48WasmExportFunction;
  sp48_dirty_range_count: Sp48WasmExportFunction;
  sp48_clear_dirty_ranges: Sp48WasmExportFunction;
  sp48_border_trace_count: Sp48WasmExportFunction;
  sp48_clear_border_trace: Sp48WasmExportFunction;
  sp48_audio_trace_count: Sp48WasmExportFunction;
  sp48_clear_audio_trace: Sp48WasmExportFunction;
  sp48_event_status: Sp48WasmExportFunction;
  sp48_tape_save_trace_count: Sp48WasmExportFunction;
  sp48_clear_tape_save_trace: Sp48WasmExportFunction;
  sp48_debug_memory_log_count: Sp48WasmExportFunction;
  sp48_debug_memory_log_ptr: Sp48WasmExportFunction;
  sp48_debug_io_log_count: Sp48WasmExportFunction;
  sp48_debug_io_log_ptr: Sp48WasmExportFunction;
  sp48_diagnostics_reset: Sp48WasmExportFunction;
  sp48_diagnostics_value: Sp48WasmExportFunction;
  sp48_set_16k_model: Sp48WasmExportFunction;
  sp48_import_state: Sp48WasmExportFunction;
  sp48_export_state: Sp48WasmExportFunction;
  sp48_import_snapshot: Sp48WasmExportFunction;
  sp48_export_snapshot: Sp48WasmExportFunction;
  sp48_execute_instructions: Sp48WasmExportFunction;
  sp48_create: Sp48WasmExportFunction;
  sp48_reset: Sp48WasmExportFunction;
  sp48_load_rom_byte: Sp48WasmExportFunction;
  sp48_read_memory: Sp48WasmExportFunction;
  sp48_write_memory: Sp48WasmExportFunction;
  sp48_patch_memory: Sp48WasmExportFunction;
  sp48_read_port: Sp48WasmExportFunction;
  sp48_write_port: Sp48WasmExportFunction;
  sp48_execute_frame: Sp48WasmExportFunction;
};

export type Sp48WasmInstance = {
  readonly exports: Sp48WasmExports;
};

export type Sp48WasmArtifactReader = () => Promise<BufferSource>;
export type Sp48WasmCompiler = (bytes: BufferSource) => Promise<WebAssembly.Module>;
export type Sp48WasmInstantiator = (module: WebAssembly.Module) => Promise<Sp48WasmInstance>;

export type Sp48WasmLoaderOptions = {
  readonly artifactName?: string;
  readonly readArtifact?: Sp48WasmArtifactReader;
  readonly compile?: Sp48WasmCompiler;
  readonly instantiate?: Sp48WasmInstantiator;
};

export type Sp48WasmRuntime = {
  readonly artifactName: string;
  readonly module: WebAssembly.Module;
  readonly instance: Sp48WasmInstance;
  readonly exports: Sp48WasmExports;
  readonly memory: Uint8Array;
  readonly machineState: DataView;
  readonly input: DataView;
  readonly result: DataView;
  readonly eventBuffer: Uint8Array;
  readonly eventBufferView: DataView;
  readonly dirtyRanges: DataView;
  readonly contentionTable: Uint8Array;
  readonly floatingBusTable: DataView;
  readonly tapeEarTable: Uint8Array;
  readonly debugMemoryLog: DataView;
  readonly debugIoLog: DataView;
};

let cachedModule: WebAssembly.Module | undefined;
let cachedArtifactName: string | undefined;

export function resetSp48WasmModuleCache(): void {
  cachedModule = undefined;
  cachedArtifactName = undefined;
}

export async function loadSp48Wasm(options: Sp48WasmLoaderOptions = {}): Promise<Sp48WasmRuntime> {
  const artifactName = options.artifactName ?? SP48_WASM_ARTIFACT_NAME;
  const module = await getCompiledModule(artifactName, options);
  const instantiate = options.instantiate ?? defaultInstantiate;
  const instance = await instantiate(module);
  const wasmExports = instance.exports;

  validateSp48WasmExports(wasmExports, artifactName);
  return {
    artifactName,
    module,
    instance,
    exports: wasmExports,
    ...createSp48WasmViews(wasmExports)
  };
}

export function validateSp48WasmExports(exports: Sp48WasmExports, artifactName = SP48_WASM_ARTIFACT_NAME): void {
  const abiVersion = exports.sp48_abi_version?.();
  if (abiVersion !== SP48_WASM_ABI_VERSION) {
    throw new Error(
      `ZX Spectrum 48K WASM artifact '${artifactName}' has ABI version ${abiVersion ?? "unknown"}; expected ${SP48_WASM_ABI_VERSION}.`
    );
  }

  for (const key of Object.keys(SP48_WASM_LAYOUT_VALUE_ID) as Sp48WasmLayoutValueKey[]) {
    const actual = exports.sp48_layout_value(SP48_WASM_LAYOUT_VALUE_ID[key]);
    const expected = SP48_WASM_LAYOUT[key];
    if (actual !== expected) {
      throw new Error(
        `ZX Spectrum 48K WASM artifact '${artifactName}' layout mismatch for ${key}: got ${actual}, expected ${expected}.`
      );
    }
  }
}

export function createSp48WasmViews(exports: Sp48WasmExports) {
  const memoryBuffer = exports.memory.buffer;
  const memoryStart = exports.sp48_memory_ptr();
  const memorySize = exports.sp48_memory_size();
  const machineStateStart = exports.sp48_machine_state_block_ptr();
  const inputStart = exports.sp48_input_block_ptr();
  const resultStart = exports.sp48_result_block_ptr();
  const eventBufferStart = exports.sp48_event_buffer_ptr();
  const dirtyRangesStart = exports.sp48_dirty_ranges_ptr();
  const contentionTableStart = exports.sp48_contention_table_ptr();
  const floatingBusTableStart = exports.sp48_floating_bus_table_ptr();
  const tapeEarTableStart = exports.sp48_tape_ear_table_ptr();
  const debugMemoryLogStart = exports.sp48_debug_memory_log_ptr();
  const debugIoLogStart = exports.sp48_debug_io_log_ptr();
  const timingTableCapacity = exports.sp48_timing_table_capacity();

  return {
    memory: new Uint8Array(memoryBuffer, memoryStart, memorySize),
    machineState: new DataView(memoryBuffer, machineStateStart, SP48_WASM_LAYOUT.machineStateBlockSize),
    input: new DataView(memoryBuffer, inputStart, SP48_WASM_LAYOUT.inputBlockSize),
    result: new DataView(memoryBuffer, resultStart, SP48_WASM_LAYOUT.resultBlockSize),
    eventBuffer: new Uint8Array(memoryBuffer, eventBufferStart, SP48_WASM_LAYOUT.eventBufferSize),
    eventBufferView: new DataView(memoryBuffer, eventBufferStart, SP48_WASM_LAYOUT.eventBufferSize),
    dirtyRanges: new DataView(
      memoryBuffer,
      dirtyRangesStart,
      SP48_WASM_LAYOUT.dirtyRangeCapacity * SP48_WASM_LAYOUT.dirtyRangeRecordSize
    ),
    contentionTable: new Uint8Array(memoryBuffer, contentionTableStart, timingTableCapacity),
    floatingBusTable: new DataView(memoryBuffer, floatingBusTableStart, timingTableCapacity * 2),
    tapeEarTable: new Uint8Array(memoryBuffer, tapeEarTableStart, SP48_WASM_LAYOUT.tapeEarTableCapacity),
    debugMemoryLog: new DataView(
      memoryBuffer,
      debugMemoryLogStart,
      SP48_WASM_LAYOUT.debugAccessLogCapacity * SP48_WASM_LAYOUT.debugAccessLogRecordSize
    ),
    debugIoLog: new DataView(
      memoryBuffer,
      debugIoLogStart,
      SP48_WASM_LAYOUT.debugAccessLogCapacity * SP48_WASM_LAYOUT.debugAccessLogRecordSize
    )
  };
}

async function getCompiledModule(artifactName: string, options: Sp48WasmLoaderOptions): Promise<WebAssembly.Module> {
  if (cachedModule != null && cachedArtifactName === artifactName) {
    return cachedModule;
  }

  const readArtifact = options.readArtifact ?? (() => defaultReadArtifact(artifactName));
  const compile = options.compile ?? WebAssembly.compile;
  const bytes = await readArtifact();
  const module = await compile(bytes);

  cachedModule = module;
  cachedArtifactName = artifactName;
  return module;
}

async function defaultReadArtifact(artifactName: string): Promise<ArrayBuffer> {
  const artifactUrl = new URL(`./dist/${artifactName}`, import.meta.url);
  const response = await fetch(artifactUrl);
  if (!response.ok) {
    throw new Error(`Cannot load ZX Spectrum 48K WASM artifact from ${artifactUrl.toString()} (${response.status} ${response.statusText}).`);
  }
  return response.arrayBuffer();
}

async function defaultInstantiate(module: WebAssembly.Module): Promise<Sp48WasmInstance> {
  const instance = await WebAssembly.instantiate(module, {});
  return { exports: instance.exports as Sp48WasmExports };
}
