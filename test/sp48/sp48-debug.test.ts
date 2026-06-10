import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { MachineControllerState } from "@abstractions/MachineControllerState";
import { createSp48MachineController } from "@emu/sp48/Sp48MachineController";

async function createController() {
  const wasmPath = resolve(process.cwd(), "public/wasm/sp48.wasm");
  const romPath = resolve(process.cwd(), "src/public/roms/sp48.rom");
  return createSp48MachineController(async (path) => {
    if (path === "roms/sp48.rom") {
      return new Uint8Array(readFileSync(romPath));
    }
    return new Uint8Array(readFileSync(resolve(process.cwd(), path)));
  }, {
    wasmBytes: readFileSync(wasmPath)
  });
}

function uploadProgram(controller: Awaited<ReturnType<typeof createController>>, bytes: number[], address = 0x8000): void {
  bytes.forEach((byte, index) => controller.machine.writeMemory(address + index, byte));
  controller.machine.setCpuPc(address);
  controller.machine.setCpuSp(0x9000);
  controller.machine.setCpuIff1(false);
  controller.machine.setTacts(1_000);
}

describe("SP48 Wasm debug and tooling compatibility", () => {
  it("stepInto executes exactly one Z80 instruction", async () => {
    const controller = await createController();
    uploadProgram(controller, [
      0xcd, 0x10, 0x80, // CALL $8010
      0x76,             // HALT
      ...Array(12).fill(0x00),
      0x3e, 0x03,       // LD A,3
      0xc9              // RET
    ]);

    const state = controller.issueMachineCommand("stepInto");

    expect(state).toBe(MachineControllerState.Paused);
    expect(controller.machine.getCpuPc()).toBe(0x8010);
    expect(controller.machine.getCpuSp()).toBe(0x8ffe);
    expect(controller.machine.readMemory(0x8ffe)).toBe(0x03);
    expect(controller.machine.readMemory(0x8fff)).toBe(0x80);
  });

  it("stepOver runs a CALL and stops at the caller return address", async () => {
    const controller = await createController();
    uploadProgram(controller, [
      0xcd, 0x10, 0x80, // CALL $8010
      0x76,             // HALT
      ...Array(12).fill(0x00),
      0x3e, 0x03,       // LD A,3
      0xc9              // RET
    ]);

    controller.issueMachineCommand("stepOver");

    expect(controller.machine.getCpuPc()).toBe(0x8003);
    expect(controller.machine.getCpuAf() >> 8).toBe(0x03);
    expect(controller.machine.getCpuSp()).toBe(0x9000);
    expect(controller.machine.getCpuRetExecuted()).toBe(true);
  });

  it("stepOut runs until the current subroutine returns", async () => {
    const controller = await createController();
    uploadProgram(controller, [
      0xcd, 0x10, 0x80, // CALL $8010
      0x76,             // HALT
      ...Array(12).fill(0x00),
      0x3e, 0x04,       // LD A,4
      0xc9              // RET
    ]);
    controller.machine.setCpuPc(0x8010);
    controller.machine.writeMemory(0x9000, 0x03);
    controller.machine.writeMemory(0x9001, 0x80);

    controller.issueMachineCommand("stepOut");

    expect(controller.machine.getCpuPc()).toBe(0x8003);
    expect(controller.machine.getCpuAf() >> 8).toBe(0x04);
    expect(controller.machine.getCpuSp()).toBe(0x9002);
  });

  it("debug running stops on a controller breakpoint", async () => {
    const controller = await createController();
    uploadProgram(controller, [
      0xcd, 0x10, 0x80, // CALL $8010
      0x76,             // HALT
      ...Array(12).fill(0x00),
      0x3e, 0x05,       // LD A,5
      0xc9              // RET
    ]);
    controller.addBreakpoint(0x8003);

    expect(controller.issueMachineCommand("debug")).toBe(MachineControllerState.Running);
    expect(controller.tickFrame()).toBe(true);

    expect(controller.machineState).toBe(MachineControllerState.Paused);
    expect(controller.machine.getCpuPc()).toBe(0x8003);
    expect(controller.machine.getCpuAf() >> 8).toBe(0x05);
    expect(controller.getBreakpoints()).toEqual([0x8003]);
  });

  it("exposes CPU snapshots and last memory/port access events", async () => {
    const controller = await createController();
    uploadProgram(controller, [
      0x3e, 0x03,       // LD A,3
      0xd3, 0xfe,       // OUT ($FE),A
      0x32, 0x00, 0x40, // LD ($4000),A
      0x76              // HALT
    ]);

    controller.executeInstructionStep();
    controller.executeInstructionStep();
    expect(controller.getLastPortAccess()).toEqual({
      address: 0x03fe,
      value: 0x03,
      isWrite: true
    });

    controller.executeInstructionStep();
    expect(controller.getLastMemoryAccess()).toEqual({
      address: 0x4000,
      value: 0x03,
      isWrite: true
    });

    const cpu = controller.getCpuState();
    expect(cpu.pc).toBe(0x8007);
    expect(cpu.af >> 8).toBe(0x03);
    expect(cpu.sp).toBe(0x9000);
    expect(cpu.ix).toBe(0x0000);
    expect(cpu.iy).toBe(0x0000);
    expect(cpu.halted).toBe(false);
  });
});
