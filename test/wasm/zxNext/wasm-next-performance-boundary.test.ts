import { existsSync, statSync } from "node:fs";

import { describe, expect, it } from "vitest";

import {
  ZXNEXT_WASM_V2_FLAT_MEMORY_SIZE,
  ZXNEXT_WASM_V2_KEYBOARD_LINE_COUNT,
  ZXNEXT_WASM_V2_MEMORY_SIZE,
  ZXNEXT_WASM_V2_NEXT_REG_COUNT,
  ZXNEXT_WASM_V2_SCREEN_HEIGHT,
  ZXNEXT_WASM_V2_SCREEN_WIDTH
} from "@emu/machines/zxNext/wasm/ZxNextWasmV2Loader";
import { createTestNextMachine } from "../../zxnext/TestNextMachine";
import { createTestZxNextWasmMachine } from "./wasm-next-test-helpers";
import { checkZxNextWasmSize, DEFAULT_MAX_BYTES } from "../../../scripts/check-zxnext-wasm-size.cjs";
import {
  assertNoSafetyGuardStops,
  benchmarkZxNextWasm,
  summarizeRuns
} from "../../../scripts/benchmark-zxnext-wasm.cjs";

describe("ZX Spectrum Next WASM performance and boundary audit", () => {
  it("keeps exported memory views inside the fixed production layout with stable backing buffers", async () => {
    const machine = await createTestZxNextWasmMachine();
    const runtime = machine.wasmV2Runtime!;
    const pixelBytes = ZXNEXT_WASM_V2_SCREEN_WIDTH * ZXNEXT_WASM_V2_SCREEN_HEIGHT * 4;

    expect(runtime.memory.byteLength).toBe(ZXNEXT_WASM_V2_MEMORY_SIZE);
    expect(runtime.flatMemory.byteLength).toBe(ZXNEXT_WASM_V2_FLAT_MEMORY_SIZE);
    expect(runtime.pixelBuffer.length).toBe(ZXNEXT_WASM_V2_SCREEN_WIDTH * ZXNEXT_WASM_V2_SCREEN_HEIGHT);
    expect(runtime.pixelBufferBytes.byteLength).toBe(pixelBytes);
    expect(runtime.keyboardLines.byteLength).toBe(ZXNEXT_WASM_V2_KEYBOARD_LINE_COUNT);
    expect(runtime.nextRegs.byteLength).toBe(ZXNEXT_WASM_V2_NEXT_REG_COUNT);
    expect(runtime.memory.buffer).toBe(runtime.memoryBuffer);
    expect(runtime.flatMemory.buffer).toBe(runtime.memoryBuffer);
    expect(runtime.pixelBuffer.buffer).toBe(runtime.memoryBuffer);
    expect(runtime.pixelBufferBytes.buffer).toBe(runtime.memoryBuffer);
    expect(runtime.keyboardLines.buffer).toBe(runtime.memoryBuffer);
    expect(runtime.nextRegs.buffer).toBe(runtime.memoryBuffer);

    const ranges = [
      [runtime.exports.zxnextMemoryPtr(), runtime.memory.byteLength],
      [runtime.exports.zxnextPixelBufferPtr(), runtime.pixelBufferBytes.byteLength],
      [runtime.exports.zxnextKeyboardLinesPtr(), runtime.keyboardLines.byteLength],
      [runtime.exports.zxnextNextRegsPtr(), runtime.nextRegs.byteLength]
    ];
    for (const [offset, length] of ranges) {
      expect(offset).toBeGreaterThanOrEqual(0);
      expect(offset + length).toBeLessThanOrEqual(runtime.memoryBuffer.byteLength);
    }
  });

  it("keeps the package artifact present and under the measured size guard", () => {
    const report = checkZxNextWasmSize();

    expect(existsSync(report.artifact)).toBe(true);
    expect(statSync(report.artifact).size).toBe(report.actualBytes);
    expect(report.maxBytes).toBe(DEFAULT_MAX_BYTES);
    expect(report.withinLimit).toBe(true);
  });

  it("compares TypeScript and WASM frame timing shape while rejecting safety-guard stop reasons", async () => {
    const oracle = await createTestNextMachine();
    const wasm = await createTestZxNextWasmMachine();
    const oracleMetrics = measureMachineFrames(oracle, 3);
    const wasmMetrics = measureMachineFrames(wasm, 3);
    const diagnostics = wasm.getWasmV2Diagnostics();

    expect(oracleMetrics.framesAdvanced).toBe(3);
    expect(wasmMetrics.framesAdvanced).toBe(3);
    expect(oracleMetrics.elapsedMs).toBeGreaterThanOrEqual(0);
    expect(wasmMetrics.elapsedMs).toBeGreaterThanOrEqual(0);
    expect(diagnostics.lastScaffoldStopReason).toBe("wasmFrameComplete");
    expect(diagnostics.normalFrames).toBeGreaterThanOrEqual(3);
    assertNoSafetyGuardStops({ [diagnostics.lastScaffoldStopReason]: diagnostics.normalFrames });
    expect(() => assertNoSafetyGuardStops({ safetyGuard: 1 })).toThrow(/safety guard/);
  });

  it("emits benchmark metrics with frame stop reason distribution", async () => {
    const report = await benchmarkZxNextWasm({ frames: 2, runs: 1, warmup: 1 });

    expect(report.artifactBytes).toBeGreaterThan(0);
    expect(report.metrics.framesAdvanced).toBe(2);
    expect(report.metrics.tactsAdvanced).toBeGreaterThan(0);
    expect(report.metrics.millisecondsPerFrame.median).toBeGreaterThanOrEqual(0);
    expect(report.stopReasons).toEqual({ wasmFrameComplete: 2 });
  });

  it("summarizes repeated timing runs deterministically", () => {
    expect(summarizeRuns([
      { elapsedMs: 3, framesAdvanced: 2, framesPerSecond: 666.66, millisecondsPerFrame: 1.5, samplesPerFrame: 0, tactsAdvanced: 10 },
      { elapsedMs: 1, framesAdvanced: 2, framesPerSecond: 2000, millisecondsPerFrame: 0.5, samplesPerFrame: 0, tactsAdvanced: 10 },
      { elapsedMs: 2, framesAdvanced: 2, framesPerSecond: 1000, millisecondsPerFrame: 1, samplesPerFrame: 0, tactsAdvanced: 10 }
    ])).toMatchObject({
      framesAdvanced: 2,
      millisecondsPerFrame: {
        median: 1,
        min: 0.5,
        max: 1.5
      },
      samplesPerFrame: 0,
      tactsAdvanced: 10
    });
  });
});

function measureMachineFrames(machine: { frames: number; executeMachineFrame: () => unknown }, frames: number): {
  elapsedMs: number;
  framesAdvanced: number;
} {
  const startFrames = machine.frames;
  const start = performance.now();
  for (let i = 0; i < frames; i++) {
    machine.executeMachineFrame();
  }
  return {
    elapsedMs: performance.now() - start,
    framesAdvanced: machine.frames - startFrames
  };
}
