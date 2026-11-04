/* tslint:disable */
/* eslint-disable */

export class WasmTvc {
    free(): void;
    [Symbol.dispose](): void;
    addRom(name: string, data: Uint8Array): void;
    audioSampleRate(): number;
    focusChange(has_focus: boolean): void;
    framebufferLen(): number;
    framebufferPtr(): number;
    keyDown(code: number): boolean;
    keyPressText(text: string): void;
    keyUp(code: number): void;
    loadCartRom(data: Uint8Array): void;
    loadDisk(drive: number, name: string, data: Uint8Array): void;
    loadSnapshot(data: Uint8Array): void;
    constructor(is_plus: boolean);
    reset(): void;
    runFrame(): boolean;
    saveSnapshot(): Uint8Array;
    screenHeight(): number;
    screenWidth(): number;
    setVidModel(model: string): void;
    takeAudioSamples(): Float32Array;
    takeFrameComplete(): boolean;
    vidModel(): string;
}

export class WebHandle {
    free(): void;
    [Symbol.dispose](): void;
    constructor();
    start(canvas_id: string): void;
}

export type InitInput = RequestInfo | URL | Response | BufferSource | WebAssembly.Module;

export interface InitOutput {
    readonly memory: WebAssembly.Memory;
    readonly __wbg_wasmtvc_free: (a: number, b: number) => void;
    readonly __wbg_webhandle_free: (a: number, b: number) => void;
    readonly wasmtvc_addRom: (a: number, b: number, c: number, d: number, e: number) => void;
    readonly wasmtvc_audioSampleRate: (a: number) => number;
    readonly wasmtvc_focusChange: (a: number, b: number) => void;
    readonly wasmtvc_framebufferLen: (a: number) => number;
    readonly wasmtvc_framebufferPtr: (a: number) => number;
    readonly wasmtvc_keyDown: (a: number, b: number) => number;
    readonly wasmtvc_keyPressText: (a: number, b: number, c: number) => void;
    readonly wasmtvc_keyUp: (a: number, b: number) => void;
    readonly wasmtvc_loadCartRom: (a: number, b: number, c: number) => void;
    readonly wasmtvc_loadDisk: (a: number, b: number, c: number, d: number, e: number, f: number) => void;
    readonly wasmtvc_loadSnapshot: (a: number, b: number, c: number, d: number) => void;
    readonly wasmtvc_new: (a: number) => number;
    readonly wasmtvc_reset: (a: number) => void;
    readonly wasmtvc_runFrame: (a: number) => number;
    readonly wasmtvc_saveSnapshot: (a: number, b: number) => void;
    readonly wasmtvc_screenHeight: (a: number) => number;
    readonly wasmtvc_screenWidth: (a: number) => number;
    readonly wasmtvc_setVidModel: (a: number, b: number, c: number, d: number) => void;
    readonly wasmtvc_takeAudioSamples: (a: number, b: number) => void;
    readonly wasmtvc_takeFrameComplete: (a: number) => number;
    readonly wasmtvc_vidModel: (a: number, b: number) => void;
    readonly webhandle_new: () => number;
    readonly webhandle_start: (a: number, b: number, c: number, d: number) => void;
    readonly __wasm_bindgen_func_elem_4797: (a: number, b: number, c: number, d: number) => void;
    readonly __wasm_bindgen_func_elem_4817: (a: number, b: number, c: number, d: number) => void;
    readonly __wasm_bindgen_func_elem_1644: (a: number, b: number, c: number) => void;
    readonly __wasm_bindgen_func_elem_1644_2: (a: number, b: number, c: number) => void;
    readonly __wasm_bindgen_func_elem_1646: (a: number, b: number, c: number) => void;
    readonly __wasm_bindgen_func_elem_1356: (a: number, b: number) => void;
    readonly __wbindgen_export: (a: number, b: number) => number;
    readonly __wbindgen_export2: (a: number, b: number, c: number, d: number) => number;
    readonly __wbindgen_export3: (a: number) => void;
    readonly __wbindgen_export4: (a: number, b: number, c: number) => void;
    readonly __wbindgen_export5: (a: number, b: number) => void;
    readonly __wbindgen_add_to_stack_pointer: (a: number) => number;
}

export type SyncInitInput = BufferSource | WebAssembly.Module;

/**
 * Instantiates the given `module`, which can either be bytes or
 * a precompiled `WebAssembly.Module`.
 *
 * @param {{ module: SyncInitInput }} module - Passing `SyncInitInput` directly is deprecated.
 *
 * @returns {InitOutput}
 */
export function initSync(module: { module: SyncInitInput } | SyncInitInput): InitOutput;

/**
 * If `module_or_path` is {RequestInfo} or {URL}, makes a request and
 * for everything else, calls `WebAssembly.instantiate` directly.
 *
 * @param {{ module_or_path: InitInput | Promise<InitInput> }} module_or_path - Passing `InitInput` directly is deprecated.
 *
 * @returns {Promise<InitOutput>}
 */
export default function __wbg_init (module_or_path?: { module_or_path: InitInput | Promise<InitInput> } | InitInput | Promise<InitInput>): Promise<InitOutput>;
