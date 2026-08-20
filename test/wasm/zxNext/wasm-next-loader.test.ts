import {
  createZxNextWasmV2Views,
  validateZxNextWasmV2Exports,
  ZXNEXT_WASM_V2_FLAT_MEMORY_SIZE,
  ZXNEXT_WASM_V2_KEYBOARD_LINE_COUNT,
  ZXNEXT_WASM_V2_MEMORY_SIZE,
  ZXNEXT_WASM_V2_NEXT_REG_COUNT,
  ZXNEXT_WASM_V2_SCREEN_HEIGHT,
  ZXNEXT_WASM_V2_SCREEN_WIDTH,
  type ZxNextWasmV2Exports
} from "@emu/machines/zxNext/wasm/ZxNextWasmV2Loader";
import { OFFS_ERR_PAGE } from "@emu/machines/zxNext/MemoryDevice";
import { describe, expect, it } from "vitest";

describe("ZX Spectrum Next WASM v2 loader", () => {
  it("rejects incomplete scaffold artifacts", () => {
    expect(() => validateZxNextWasmV2Exports({
      memory: new WebAssembly.Memory({ initial: 1 })
    })).toThrow(/missing export 'zxnextMemoryPtr'/);
  });

  it("creates typed views using ZX Next-sized constants", () => {
    const memory = new WebAssembly.Memory({ initial: 128 });
    const pixelOffset = ZXNEXT_WASM_V2_MEMORY_SIZE;
    const keyboardOffset = pixelOffset + ZXNEXT_WASM_V2_SCREEN_WIDTH * ZXNEXT_WASM_V2_SCREEN_HEIGHT * 4;
    const nextRegsOffset = keyboardOffset + ZXNEXT_WASM_V2_KEYBOARD_LINE_COUNT;
    const exports = createViewExports(memory, {
      memoryOffset: 0,
      pixelOffset,
      keyboardOffset,
      nextRegsOffset
    });

    const views = createZxNextWasmV2Views(exports, "test-zxnext.wasm");

    expect(ZXNEXT_WASM_V2_MEMORY_SIZE).toBe(OFFS_ERR_PAGE + 0x2000);
    expect(views.memory.byteLength).toBe(ZXNEXT_WASM_V2_MEMORY_SIZE);
    expect(views.flatMemory.byteLength).toBe(ZXNEXT_WASM_V2_FLAT_MEMORY_SIZE);
    expect(views.pixelBuffer.length).toBe(ZXNEXT_WASM_V2_SCREEN_WIDTH * ZXNEXT_WASM_V2_SCREEN_HEIGHT);
    expect(views.pixelBufferBytes.byteLength).toBe(views.pixelBuffer.length * 4);
    expect(views.keyboardLines.byteLength).toBe(ZXNEXT_WASM_V2_KEYBOARD_LINE_COUNT);
    expect(views.nextRegs.byteLength).toBe(ZXNEXT_WASM_V2_NEXT_REG_COUNT);
  });

  it("rejects wrong reported sizes instead of silently creating Spectrum-sized views", () => {
    const memory = new WebAssembly.Memory({ initial: 2 });
    const exports = createViewExports(memory, {
      memoryOffset: 0,
      pixelOffset: 0x10000,
      keyboardOffset: 0x10000,
      nextRegsOffset: 0x10008,
      memorySize: 0x10000
    });

    expect(() => createZxNextWasmV2Views(exports, "bad-zxnext.wasm")).toThrow(/memory size 65536/);
  });
});

function createViewExports(
  memory: WebAssembly.Memory,
  options: {
    memoryOffset: number;
    pixelOffset: number;
    keyboardOffset: number;
    nextRegsOffset: number;
    memorySize?: number;
  }
): ZxNextWasmV2Exports {
  const fn = () => 0;
  return {
    memory,
    zxnextMemoryPtr: () => options.memoryOffset,
    zxnextPixelBufferPtr: () => options.pixelOffset,
    zxnextKeyboardLinesPtr: () => options.keyboardOffset,
    zxnextNextRegsPtr: () => options.nextRegsOffset,
    zxnextReset: fn,
    zxnextHardReset: fn,
    zxnextExecuteFrame: fn,
    zxnextExecuteInstruction: fn,
    zxnextRenderInstantScreen: fn,
    zxnextReadMemory: fn,
    zxnextWriteMemory: fn,
    zxnextReadScreenMemoryOffset: fn,
    zxnextSetKeyStatus: fn,
    zxnextGetKeyboardLine: fn,
    zxnextReadPort: fn,
    zxnextWritePort: fn,
    zxnextGetMemorySize: () => options.memorySize ?? ZXNEXT_WASM_V2_MEMORY_SIZE,
    zxnextGetFlatMemorySize: () => ZXNEXT_WASM_V2_FLAT_MEMORY_SIZE,
    zxnextGetKeyboardLineCount: () => ZXNEXT_WASM_V2_KEYBOARD_LINE_COUNT,
    zxnextGetNextRegCount: () => ZXNEXT_WASM_V2_NEXT_REG_COUNT,
    zxnextGetScreenWidth: () => ZXNEXT_WASM_V2_SCREEN_WIDTH,
    zxnextGetScreenHeight: () => ZXNEXT_WASM_V2_SCREEN_HEIGHT,
    zxnextGetPixelBufferStartOffset: fn,
    zxnextGetFrames: fn,
    zxnextGetTacts: fn,
    zxnextGetCurrentFrameTact: fn,
    zxnextGetTactsInFrame: fn,
    zxnextGetFrameCompleted: fn,
    zxnextSetTacts: fn,
    zxnextGetCpuAf: fn,
    zxnextSetCpuAf: fn,
    zxnextGetCpuBc: fn,
    zxnextSetCpuBc: fn,
    zxnextGetCpuDe: fn,
    zxnextSetCpuDe: fn,
    zxnextGetCpuHl: fn,
    zxnextSetCpuHl: fn,
    zxnextGetCpuAfAlt: fn,
    zxnextSetCpuAfAlt: fn,
    zxnextGetCpuBcAlt: fn,
    zxnextSetCpuBcAlt: fn,
    zxnextGetCpuDeAlt: fn,
    zxnextSetCpuDeAlt: fn,
    zxnextGetCpuHlAlt: fn,
    zxnextSetCpuHlAlt: fn,
    zxnextGetCpuIx: fn,
    zxnextSetCpuIx: fn,
    zxnextGetCpuIy: fn,
    zxnextSetCpuIy: fn,
    zxnextGetCpuIr: fn,
    zxnextSetCpuIr: fn,
    zxnextGetCpuWz: fn,
    zxnextSetCpuWz: fn,
    zxnextGetCpuPc: fn,
    zxnextSetCpuPc: fn,
    zxnextGetCpuSp: fn,
    zxnextSetCpuSp: fn,
    zxnextGetCpuHalted: fn,
    zxnextGetCpuPrefix: fn,
    zxnextGetCpuIff1: fn,
    zxnextSetCpuIff1: fn,
    zxnextGetCpuIff2: fn,
    zxnextSetCpuIff2: fn,
    zxnextGetCpuInterruptMode: fn,
    zxnextSetCpuInterruptMode: fn,
    zxnextGetLastMemoryAddress: fn,
    zxnextGetLastMemoryValue: fn,
    zxnextGetLastMemoryIsWrite: fn,
    zxnextGetLastPortAddress: fn,
    zxnextGetLastPortValue: fn,
    zxnextGetLastPortIsWrite: fn,
    zxnextSetNextRegisterIndex: fn,
    zxnextGetNextRegisterIndex: fn,
    zxnextSetNextRegisterValue: fn,
    zxnextGetNextRegisterValue: fn,
    zxnextGetNextRegisterDirect: fn,
    zxnextSetNextRegisterDirect: fn,
    zxnextGetPortFeValue: fn,
    zxnextGetBorderColor: fn,
    zxnextGetEarBit: fn,
    zxnextGetMicBit: fn,
    zxnextGetBeeperLevel: fn,
    zxnextGetDiagnosticFlags: fn,
    zxnextReadPhysicalMemory: fn,
    zxnextChecksumPhysicalMemory: fn
  } as ZxNextWasmV2Exports;
}
