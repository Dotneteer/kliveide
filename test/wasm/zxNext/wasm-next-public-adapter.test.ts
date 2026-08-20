import { describe, expect, it } from "vitest";

import { DebugStepMode } from "@emu/abstractions/DebugStepMode";
import { DebugSupport } from "@emu/machines/DebugSupport";
import { FrameTerminationMode } from "@emu/abstractions/FrameTerminationMode";
import { MemorySectionType } from "@abstractions/MemorySection";
import { createZxNextMachine } from "@emu/machines/zxNext/ZxNextMachineFactory";
import {
  DEFAULT_ZXNEXT_IMPLEMENTATION,
  ZXNEXT_IMPLEMENTATION
} from "@emu/machines/zxNext/ZxNextImplementation";
import { ZxNextMachine } from "@emu/machines/zxNext/ZxNextMachine";
import { ZxNextWasmV2Machine } from "@emu/machines/zxNext/ZxNextWasmV2Machine";

import { createTestZxNextWasmMachine } from "./wasm-next-test-helpers";

const MIGRATED_SURFACES = ["registers", "memory", "disassembly", "ULA", "screen", "debug"];

describe("ZX Spectrum Next WASM public adapter", () => {
  it("keeps the factory default on TypeScript while WASM remains explicit", () => {
    expect(DEFAULT_ZXNEXT_IMPLEMENTATION).toBe("typescript");
    expect(createZxNextMachine()).toBeInstanceOf(ZxNextMachine);
    expect(createZxNextMachine()).not.toBeInstanceOf(ZxNextWasmV2Machine);
    expect(createZxNextMachine(undefined, { [ZXNEXT_IMPLEMENTATION]: "wasm" })).toBeInstanceOf(
      ZxNextWasmV2Machine
    );
  });

  it("does not report migrated public adapter surfaces as scaffolded", async () => {
    const machine = await createTestZxNextWasmMachine();
    const diagnostics = machine.getWasmV2Diagnostics();

    expect(diagnostics.implementationIncomplete).toBe(true);
    expect(diagnostics.scaffoldSurfaces).toEqual(["frame"]);
    for (const surface of MIGRATED_SURFACES) {
      expect(diagnostics.scaffoldSurfaces).not.toContain(surface);
    }
  });

  it("reads register, memory, NextReg, screen, and disassembly views from WASM-owned state", async () => {
    const machine = await createTestZxNextWasmMachine();
    const runtime = machine.wasmV2Runtime!;

    runtime.exports.zxnextSetCpuAf(0xabcd);
    runtime.exports.zxnextSetCpuPc(0x4567);
    runtime.exports.zxnextSetCpuSp(0xcdef);
    expect(machine.getCpuState()).toMatchObject({
      af: 0xabcd,
      pc: 0x4567,
      sp: 0xcdef
    });

    machine.memoryDevice.writeMemory(0x4000, 0x12);
    expect(machine.doReadMemory(0x4000)).toBe(0x12);
    expect(machine.get64KFlatMemory()[0x4000]).toBe(0x12);
    expect(machine.memoryDevice.readMemory(0x4000)).toBe(0x12);
    runtime.memory[0x040000 + 0x0a * 0x2000] = 0x34;
    expect(machine.memoryDevice.getMemoryPartition(0x0a)[0]).toBe(0x34);

    machine.tbblueOut(0x12, 0x56);
    expect(machine.nextRegDevice.getNextRegisterIndex()).toBe(0x12);
    expect(machine.nextRegDevice.getNextRegisterValue()).toBe(0x56);
    expect(machine.nextRegDevice.getNextRegDeviceState().regs.find(reg => reg.id === 0x12)).toMatchObject({
      value: 0x56,
      lastWrite: 0x56
    });

    machine.doWritePort(0x00fe, 0x1f);
    expect(machine.getWasmV2UlaState()).toMatchObject({
      bor: 7,
      ear: true,
      mic: true
    });
    expect(machine.floatingBusDevice.readFloatingBus()).toBe(machine.doReadPort(0xffff));
    expect(machine.renderInstantScreen().length).toBe(machine.screenWidthInPixels * machine.screenHeightInPixels);
    expect(machine.getPixelBufferBytes().byteLength).toBe(machine.getPixelBuffer().byteLength);

    expect(machine.getDisassemblySections({ ram: true, screen: true })).toContainEqual({
      startAddress: 0x0000,
      endAddress: 0xffff,
      sectionType: MemorySectionType.Disassemble
    });
  });

  it("uses WASM-owned debug stepping and breakpoint plumbing", async () => {
    const machine = await createTestZxNextWasmMachine();

    machine.pc = 0x8000;
    machine.memoryDevice.getMemoryPartition(0)[0] = 0x00;
    machine.memoryDevice.getMemoryPartition(0)[1] = 0x00;
    machine.executionContext.debugStepMode = DebugStepMode.StopAtBreakpoint;
    machine.executionContext.frameTerminationMode = FrameTerminationMode.Normal;
    machine.executionContext.debugSupport = new DebugSupport(undefined, [{ address: 0x8001, exec: true }]);

    expect(machine.executeMachineFrame()).toBe(FrameTerminationMode.DebugEvent);
    expect(machine.pc).toBe(0x8001);
    expect(machine.getWasmV2Diagnostics()).toMatchObject({
      debugSteps: 1,
      lastScaffoldStopReason: "scaffoldDebugStep"
    });
  });
});
