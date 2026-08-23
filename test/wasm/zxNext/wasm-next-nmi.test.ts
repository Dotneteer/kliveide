import { describe, expect, it } from "vitest";

import { TestZxNextMachine } from "../../zxnext/TestNextMachine";
import { ZxNextWasmV2Machine } from "@emu/machines/zxNext/ZxNextWasmV2Machine";

import { createZxNextOracleHarness } from "./wasm-next-test-helpers";

type NmiMachine = TestZxNextMachine | ZxNextWasmV2Machine;

describe("ZX Spectrum Next WASM NMI and RETN parity", () => {
  it("matches TypeScript normal NMI stack, PC, and flip-flop effects", async () => {
    const { oracle, wasm } = await createZxNextOracleHarness();
    initializeNmiCase(oracle);
    initializeNmiCase(wasm);

    oracle.sigNMI = true;
    wasm.wasmV2Runtime!.exports.zxnextSetSignalNmi(1);
    executeOne(oracle);
    executeOne(wasm);

    expectNmiCpuState(wasm, oracle);
    expect(wasm.doReadMemory(wasm.sp)).toBe(oracle.doReadMemory(oracle.sp));
    expect(wasm.doReadMemory((wasm.sp + 1) & 0xffff)).toBe(oracle.doReadMemory((oracle.sp + 1) & 0xffff));
    expect(wasm.wasmV2Runtime!.exports.zxnextGetNmiCause()).toBe(1);
  });

  it("matches TypeScript stackless NMI and RETN return-address restoration", async () => {
    const { oracle, wasm } = await createZxNextOracleHarness();
    initializeNmiCase(oracle);
    initializeNmiCase(wasm);
    for (const machine of [oracle, wasm]) {
      writeNextReg(machine, 0xc0, 0x08);
      machine.doWriteMemory(0xc0fe, 0xaa);
      machine.doWriteMemory(0xc0ff, 0xbb);
    }

    oracle.sigNMI = true;
    wasm.wasmV2Runtime!.exports.zxnextSetSignalNmi(1);
    executeOne(oracle);
    executeOne(wasm);

    expectNmiCpuState(wasm, oracle);
    expect(readNextReg(wasm, 0xc2)).toBe(readNextReg(oracle, 0xc2));
    expect(readNextReg(wasm, 0xc3)).toBe(readNextReg(oracle, 0xc3));
    expect(wasm.doReadMemory(wasm.sp)).toBe(0xaa);
    expect(wasm.doReadMemory((wasm.sp + 1) & 0xffff)).toBe(0xbb);
    expect(wasm.wasmV2Runtime!.exports.zxnextGetStacklessNmiProcessed()).toBe(1);

    writeLoadedByte(oracle, 0x0066, 0xed);
    writeLoadedByte(oracle, 0x0067, 0x45);
    writeLoadedByte(wasm, 0x0066, 0xed);
    writeLoadedByte(wasm, 0x0067, 0x45);
    executeEdInstruction(oracle);
    executeEdInstruction(wasm);

    expect(wasm.pc).toBe(oracle.pc);
    expect(wasm.pc).toBe(0x8000);
    expect(wasm.wasmV2Runtime!.exports.zxnextGetStacklessNmiProcessed()).toBe(0);
    expect(wasm.wasmV2Runtime!.exports.zxnextGetNmiCause()).toBe(0);
  });
});

function initializeNmiCase(machine: NmiMachine): void {
  machine.hardReset();
  machine.pc = 0x8000;
  machine.sp = 0xc100;
  machine.iff1 = true;
  machine.iff2 = false;
  if (machine instanceof ZxNextWasmV2Machine) {
    machine.wasmV2Runtime!.exports.zxnextSetCpuIff1(1);
    machine.wasmV2Runtime!.exports.zxnextSetCpuIff2(0);
  }
  machine.doWriteMemory(0xc0fe, 0xaa);
  machine.doWriteMemory(0xc0ff, 0xbb);
}

function executeOne(machine: NmiMachine): void {
  if (machine instanceof ZxNextWasmV2Machine) {
    machine.executeWasmV2Instruction();
  } else {
    machine.executeCpuCycle();
  }
}

function executeEdInstruction(machine: NmiMachine): void {
  executeOne(machine);
  if (machine instanceof TestZxNextMachine) executeOne(machine);
}

function expectNmiCpuState(wasm: ZxNextWasmV2Machine, oracle: TestZxNextMachine): void {
  expect(wasm.pc).toBe(oracle.pc);
  expect(wasm.sp).toBe(oracle.sp);
  expect(wasm.iff1).toBe(oracle.iff1);
  expect(wasm.iff2).toBe(oracle.iff2);
  expect(wasm.wz).toBe(oracle.wz);
}

function writeNextReg(machine: NmiMachine, reg: number, value: number): void {
  machine.nextRegDevice.setNextRegisterIndex(reg);
  machine.nextRegDevice.setNextRegisterValue(value);
}

function readNextReg(machine: NmiMachine, reg: number): number {
  machine.nextRegDevice.setNextRegisterIndex(reg);
  return machine.nextRegDevice.getNextRegisterValue();
}

function writeLoadedByte(machine: NmiMachine, address: number, value: number): void {
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
