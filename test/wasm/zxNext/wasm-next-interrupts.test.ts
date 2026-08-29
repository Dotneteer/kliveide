import { describe, expect, it } from "vitest";

import { TestZxNextMachine } from "../../zxnext/TestNextMachine";
import { ZxNextWasmV2Machine } from "@emu/machines/zxNext/ZxNextWasmV2Machine";

import { createZxNextOracleHarness } from "./wasm-next-test-helpers";

type InterruptMachine = TestZxNextMachine | ZxNextWasmV2Machine;

describe("ZX Spectrum Next WASM interrupt parity", () => {
  it("matches TypeScript IM1 INT acknowledge stack and flip-flop effects", async () => {
    const { oracle, wasm } = await createZxNextOracleHarness();
    initializeInterruptCase(oracle);
    initializeInterruptCase(wasm);

    oracle.sigINT = true;
    wasm.wasmV2Runtime!.exports.zxnextSetSignalInt(1);
    executeOne(oracle);
    executeOne(wasm);

    expectCpuInterruptState(wasm, oracle);
    expect(wasm.doReadMemory(wasm.sp)).toBe(oracle.doReadMemory(oracle.sp));
    expect(wasm.doReadMemory((wasm.sp + 1) & 0xffff)).toBe(oracle.doReadMemory((oracle.sp + 1) & 0xffff));
  });

  it("matches TypeScript hardware IM2 vector acknowledge and RETI in-service cleanup", async () => {
    const { oracle, wasm } = await createZxNextOracleHarness();
    initializeInterruptCase(oracle);
    initializeInterruptCase(wasm);
    for (const machine of [oracle, wasm]) {
      machine.interruptMode = 2;
      machine.ir = 0x9000;
      if (machine instanceof ZxNextWasmV2Machine) {
        machine.wasmV2Runtime!.exports.zxnextSetCpuInterruptMode(2);
      }
      writeLoadedByte(machine, 0x90a0, 0x56);
      writeLoadedByte(machine, 0x90a1, 0x34);
    }

    oracle.interruptDevice.hwIm2Mode = true;
    oracle.interruptDevice.im2TopBits = 0xa0;
    oracle.interruptDevice.lineInterruptEnabled = true;
    oracle.interruptDevice.lineInterruptStatus = true;
    writeNextReg(wasm, 0xc0, 0xa1);
    wasm.wasmV2Runtime!.exports.zxnextSetDaisyEnabled(0, 1);
    wasm.wasmV2Runtime!.exports.zxnextSetDaisyStatus(0, 1);

    oracle.sigINT = true;
    executeOne(oracle);
    executeOne(wasm);

    expectCpuInterruptState(wasm, oracle);
    expect(wasm.wasmV2Runtime!.exports.zxnextGetLastInterruptVector()).toBe(0xa0);
    expect(wasm.wasmV2Runtime!.exports.zxnextGetDaisyInService(0)).toBe(1);
    expect(oracle.interruptDevice.daisyInService[0]).toBe(true);

    writeLoadedByte(oracle, oracle.pc, 0xed);
    writeLoadedByte(oracle, (oracle.pc + 1) & 0xffff, 0x4d);
    writeLoadedByte(wasm, wasm.pc, 0xed);
    writeLoadedByte(wasm, (wasm.pc + 1) & 0xffff, 0x4d);
    executeEdInstruction(oracle);
    executeEdInstruction(wasm);

    expect(wasm.pc).toBe(oracle.pc);
    expect(wasm.sp).toBe(oracle.sp);
    expect(wasm.wasmV2Runtime!.exports.zxnextGetDaisyInService(0)).toBe(0);
    expect(oracle.interruptDevice.daisyInService[0]).toBe(false);
  });
});

function initializeInterruptCase(machine: InterruptMachine): void {
  machine.hardReset();
  machine.pc = 0x8000;
  machine.sp = 0xc100;
  machine.iff1 = true;
  machine.iff2 = true;
  machine.interruptMode = 1;
  if (machine instanceof ZxNextWasmV2Machine) {
    machine.wasmV2Runtime!.exports.zxnextSetCpuIff1(1);
    machine.wasmV2Runtime!.exports.zxnextSetCpuIff2(1);
    machine.wasmV2Runtime!.exports.zxnextSetCpuInterruptMode(1);
  }
  machine.doWriteMemory(0xc0fe, 0xaa);
  machine.doWriteMemory(0xc0ff, 0xbb);
}

function executeOne(machine: InterruptMachine): void {
  if (machine instanceof ZxNextWasmV2Machine) {
    machine.executeWasmV2Instruction();
  } else {
    machine.executeCpuCycle();
  }
}

function executeEdInstruction(machine: InterruptMachine): void {
  executeOne(machine);
  if (machine instanceof TestZxNextMachine) executeOne(machine);
}

function expectCpuInterruptState(wasm: ZxNextWasmV2Machine, oracle: TestZxNextMachine): void {
  expect(wasm.pc).toBe(oracle.pc);
  expect(wasm.sp).toBe(oracle.sp);
  expect(wasm.iff1).toBe(oracle.iff1);
  expect(wasm.iff2).toBe(oracle.iff2);
  expect(wasm.wz).toBe(oracle.wz);
}

function writeNextReg(machine: InterruptMachine, reg: number, value: number): void {
  machine.nextRegDevice.setNextRegisterIndex(reg);
  machine.nextRegDevice.setNextRegisterValue(value);
}

function writeLoadedByte(machine: InterruptMachine, address: number, value: number): void {
  if (machine instanceof TestZxNextMachine) {
    const page = machine.memoryDevice.getPageInfo(address >>> 13);
    machine.memoryDevice.memory[page.readOffset + (address & 0x1fff)] = value;
    if (page.writeOffset != null) machine.memoryDevice.memory[page.writeOffset + (address & 0x1fff)] = value;
    return;
  }
  const partition = machine.getPartition(address);
  if (partition != null) {
    const pageIndex = address >>> 13;
    const memoryPartition = partition < 0 ? partition : partition * 2 + (pageIndex & 0x01);
    const bytes = machine.getMemoryPartition(memoryPartition);
    bytes[address & (partition < 0 ? 0x3fff : 0x1fff)] = value;
  } else {
    machine.doWriteMemory(address, value);
  }
}
