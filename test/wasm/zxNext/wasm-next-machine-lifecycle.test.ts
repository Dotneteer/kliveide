import { describe, expect, it } from "vitest";

import { FrameTerminationMode } from "@emu/abstractions/FrameTerminationMode";

import { createTestZxNextWasmMachine } from "./wasm-next-test-helpers";

describe("ZX Spectrum Next WASM machine lifecycle", () => {
  it("setup initializes the WASM runtime and public dimensions", async () => {
    const machine = await createTestZxNextWasmMachine();
    const diagnostics = machine.getWasmV2Diagnostics();

    expect(machine.implementation).toBe("wasm");
    expect(machine.wasmV2Runtime).toBeDefined();
    expect(machine.screenWidthInPixels).toBe(diagnostics.screenWidth);
    expect(machine.screenHeightInPixels).toBe(diagnostics.screenHeight);
    expect(machine.getPixelBuffer().length).toBe(diagnostics.screenWidth * diagnostics.screenHeight);
    expect(machine.getCpuState()).toMatchObject({
      pc: 0x0000,
      sp: 0xffff,
      tacts: 0
    });
  });

  it("hard reset clears WASM-owned memory and frame/debug counters", async () => {
    const machine = await createTestZxNextWasmMachine();

    machine.doWriteMemory(0x4000, 0x5a);
    machine.pc = 0x1234;
    machine.sp = 0x4567;
    machine.setTacts(12345);
    machine.executeWasmV2DebugStep();

    machine.hardReset();

    expect(machine.doReadMemory(0x4000)).toBe(0x00);
    expect(machine.getCpuState()).toMatchObject({
      pc: 0x0000,
      sp: 0xffff,
      tacts: 0
    });
    expect(machine.getWasmV2Diagnostics()).toMatchObject({
      normalFrames: 0,
      debugSteps: 0,
      lastWasmStopReason: "reset"
    });
  });

  it("soft reset preserves WASM-owned RAM while resetting CPU counters", async () => {
    const machine = await createTestZxNextWasmMachine();

    machine.doWriteMemory(0x4000, 0x6b);
    machine.pc = 0x2345;
    machine.setTacts(99);

    machine.reset();

    expect(machine.doReadMemory(0x4000)).toBe(0x6b);
    expect(machine.getCpuState()).toMatchObject({
      pc: 0x0000,
      sp: 0xffff,
      tacts: 0
    });
  });

  it("normal frame execution reports the WASM frame runner", async () => {
    const machine = await createTestZxNextWasmMachine();

    expect(machine.executeMachineFrame()).toBe(FrameTerminationMode.Normal);
    expect(machine.getWasmV2Diagnostics()).toMatchObject({
      defaultReady: true,
      defaultBlockers: [],
      normalFrames: 1,
      lastWasmStopReason: "wasmFrameComplete"
    });
  });
});
