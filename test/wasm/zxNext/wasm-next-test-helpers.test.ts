import { FrameTerminationMode } from "@emu/abstractions/FrameTerminationMode";
import { MemorySectionType } from "@abstractions/MemorySection";
import {
  createOracleZxNextMachine,
  createTestZxNextWasmMachine,
  createZxNextOracleComparison,
  createZxNextOracleHarness,
  ZXNEXT_ORACLE_MIGRATED_SURFACES
} from "./wasm-next-test-helpers";
import { TestZxNextMachine } from "../../zxnext/TestNextMachine";
import { describe, expect, it } from "vitest";
import { ZxNextWasmV2Machine } from "@emu/machines/zxNext/ZxNextWasmV2Machine";

describe("ZX Spectrum Next WASM oracle test helpers", () => {
  it("creates a TypeScript oracle and explicit WASM migration machine", async () => {
    const oracle = await createOracleZxNextMachine();
    const wasm = await createTestZxNextWasmMachine();
    const harness = await createZxNextOracleHarness();

    expect(oracle).toBeInstanceOf(TestZxNextMachine);
    expect(wasm).toBeInstanceOf(ZxNextWasmV2Machine);
    expect(wasm.implementation).toBe("wasm");
    expect(harness.oracle).toBeInstanceOf(TestZxNextMachine);
    expect(harness.wasm).toBeInstanceOf(ZxNextWasmV2Machine);
  });

  it("captures the TypeScript oracle before exposing WASM assertions", async () => {
    const comparison = await createZxNextOracleComparison();

    expect(comparison.snapshotOrder).toEqual(["typescript", "wasm"]);
    expect(comparison.oracle.backend).toBe("typescript");
    expect(comparison.wasm.backend).toBe("wasm");
    expect(comparison.oracle.coveredSurfaces).toEqual(ZXNEXT_ORACLE_MIGRATED_SURFACES);
    expect(comparison.wasm.coveredSurfaces).toEqual(ZXNEXT_ORACLE_MIGRATED_SURFACES);

    expect(comparison.oracle.cpu).toMatchObject({
      sp: expect.any(Number),
      pc: expect.any(Number),
      iff1: expect.any(Boolean),
      iff2: expect.any(Boolean),
      interruptMode: expect.any(Number),
      tacts: expect.any(Number),
      frames: expect.any(Number)
    });
    expect(comparison.oracle.memory.mappedReads.map(read => read.address)).toEqual([
      0x0000,
      0x4000,
      0x8000,
      0xc000
    ]);
    expect(comparison.oracle.memory.mappedReads.find(read => read.address === 0x4000)).toMatchObject({
      value: 0x5a
    });
    expect(comparison.oracle.ports).toMatchObject({
      writeAddress: 0x00fe,
      writeValue: 0x18,
      readAddress: 0x00fe,
      readValue: expect.any(Number)
    });
    expect(comparison.oracle.nextRegs).toMatchObject({
      selectedRegister: 0x12,
      selectedLastWrite: 0x34,
      lastRegisterIndex: 0x12
    });
    expect(comparison.oracle.debug).toMatchObject({
      termination: FrameTerminationMode.DebugEvent,
      lastTerminationReason: FrameTerminationMode.DebugEvent,
      breakpointCount: 1
    });
    expect(comparison.oracle.debug.disassemblySections).toContainEqual({
      startAddress: 0x0000,
      endAddress: 0xffff,
      sectionType: MemorySectionType.Disassemble
    });
    expect(comparison.oracle.debug.disassemblyPreview).toHaveLength(4);

    expect(comparison.wasmDiagnostics.defaultReady).toBe(true);
    expect(comparison.wasmDiagnostics.defaultBlockers).toEqual([]);
    expect(comparison.wasmDiagnostics.migratedSurfaces).toEqual(ZXNEXT_ORACLE_MIGRATED_SURFACES);
  });
});
