import { readFileSync } from "node:fs";

import { FrameTerminationMode } from "@emu/abstractions/FrameTerminationMode";
import { MemorySectionType } from "@abstractions/MemorySection";
import { ZxNextMachine } from "@emu/machines/zxNext/ZxNextMachine";
import {
  ZXNEXT_WASM_V2_DEFAULT_BLOCKERS,
  ZXNEXT_WASM_V2_MIGRATED_SURFACES,
  ZxNextWasmV2Machine
} from "@emu/machines/zxNext/ZxNextWasmV2Machine";
import {
  ZXNEXT_WASM_V2_FLAT_MEMORY_SIZE,
  ZXNEXT_WASM_V2_MEMORY_SIZE,
  ZXNEXT_WASM_V2_SCREEN_HEIGHT,
  ZXNEXT_WASM_V2_SCREEN_WIDTH
} from "@emu/machines/zxNext/wasm/ZxNextWasmV2Loader";
import { buildZxNextWasm, productionOutput } from "../../../scripts/build-zxnext-wasm.cjs";
import { describe, expect, it } from "vitest";

describe("ZX Spectrum Next WASM v2 IDE integration", () => {
  it("exposes WASM-backed IDE surfaces", async () => {
    buildZxNextWasm();
    const machine = new ZxNextWasmV2Machine(
      undefined,
      undefined,
      undefined,
      {
        artifactName: "test-zx-spectrum-next.wasm",
        readArtifact: async () => readFileSync(productionOutput)
      }
    );

    await machine.setup();

    const diagnostics = machine.getWasmV2Diagnostics();
    expect(diagnostics).toMatchObject({
      backend: "wasm",
      engine: "v2",
      defaultReady: true,
      memoryBytes: ZXNEXT_WASM_V2_MEMORY_SIZE,
      flatMemoryBytes: ZXNEXT_WASM_V2_FLAT_MEMORY_SIZE,
      screenWidth: ZXNEXT_WASM_V2_SCREEN_WIDTH,
      screenHeight: ZXNEXT_WASM_V2_SCREEN_HEIGHT
    });
    expect(diagnostics.defaultBlockers).toEqual(ZXNEXT_WASM_V2_DEFAULT_BLOCKERS);
    expect(diagnostics.migratedSurfaces).toEqual(ZXNEXT_WASM_V2_MIGRATED_SURFACES);
    expect(diagnostics.migratedSurfaces).toEqual(expect.arrayContaining([
      "registers",
      "memory",
      "disassembly",
      "ULA",
      "screen",
      "debug",
      "frame"
    ]));

    const oracle = new ZxNextMachine();
    expect(machine.screenWidthInPixels).toBe(oracle.screenWidthInPixels);
    expect(machine.screenHeightInPixels).toBe(oracle.screenHeightInPixels);
    expect(machine.getAspectRatio()).toEqual(oracle.getAspectRatio());

    const cpu = machine.getCpuState();
    expect(cpu.pc).toBe(0x0000);
    expect(cpu.sp).toBe(0xffff);
    machine.pc = 0x2345;
    machine.af = 0xabcd;
    expect(machine.getCpuState()).toMatchObject({
      pc: 0x2345,
      af: 0xabcd
    });

    machine.memoryDevice.writeMemory(0x4000, 0x11);
    machine.doWriteMemory(0x4000, 0x5a);
    expect(machine.doReadMemory(0x4000)).toBe(0x5a);
    expect(machine.get64KFlatMemory()[0x4000]).toBe(0x5a);
    expect(machine.memoryDevice.readMemory(0x4000)).toBe(0x5a);

    const sections = machine.getDisassemblySections({ ram: true, screen: true });
    expect(sections).toContainEqual({
      startAddress: 0x0000,
      endAddress: 0xffff,
      sectionType: MemorySectionType.Disassemble
    });

    machine.tbblueOut(0x12, 0x34);
    expect(machine.nextRegDevice.getNextRegisterIndex()).toBe(0x12);
    const nextRegState = machine.nextRegDevice.getNextRegDeviceState();
    expect(nextRegState.regs.find(reg => reg.id === 0x12)).toMatchObject({
      id: 0x12,
      value: 0x34,
      lastWrite: 0x34
    });

    machine.doWritePort(0xfe, 0x18);
    expect(machine.getWasmV2UlaState()).toMatchObject({
      bor: 0,
      ear: true,
      mic: true,
      flo: 0xff
    });
    expect(machine.renderInstantScreen().length).toBe(ZXNEXT_WASM_V2_SCREEN_WIDTH * ZXNEXT_WASM_V2_SCREEN_HEIGHT);
    expect(machine.getPixelBufferBytes().byteLength).toBe(ZXNEXT_WASM_V2_SCREEN_WIDTH * ZXNEXT_WASM_V2_SCREEN_HEIGHT * 4);

    expect(machine.executeMachineFrame()).toBe(FrameTerminationMode.Normal);
    expect(machine.executeWasmV2DebugStep()).toBe(FrameTerminationMode.DebugEvent);
    expect(machine.getWasmV2Diagnostics()).toMatchObject({
      defaultReady: true,
      normalFrames: 1,
      debugSteps: 1
    });
  });
});
