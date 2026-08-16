import { describe, expect, it } from "vitest";

import {
  createOracleZxNextMachine,
  createTestZxNextWasmMachine,
  executeOneInstruction,
  expectSameCpuRegisters,
  expectSameMemoryReads,
  initCodeBytes
} from "./wasm-next-test-helpers";

describe("ZX Spectrum Next WASM Z80N CPU baseline", () => {
  it("executes NOP with TypeScript-visible register parity", async () => {
    const { wasmMachine, oracleMachine } = await createPair([0x00]);

    executeOneInstruction(wasmMachine);
    executeOneInstruction(oracleMachine);

    expectSameCpuRegisters(wasmMachine, oracleMachine, ["pc", "sp", "af", "bc", "de", "hl", "tacts"]);
    expect(wasmMachine.getCpuState().pc).toBe(0x8001);
  });

  it("executes LD A,N and JP NN with TypeScript-visible register parity", async () => {
    const { wasmMachine, oracleMachine } = await createPair([0x3e, 0x42, 0xc3, 0x00, 0x80]);

    executeOneInstruction(wasmMachine);
    executeOneInstruction(oracleMachine);
    expectSameCpuRegisters(wasmMachine, oracleMachine, ["pc", "af", "tacts"]);

    executeOneInstruction(wasmMachine);
    executeOneInstruction(oracleMachine);
    expectSameCpuRegisters(wasmMachine, oracleMachine, ["pc", "af", "tacts"]);
    expect(wasmMachine.getTestCpuRegisters().pc).toBe(0x8000);
  });

  it("records memory writes through the ZX Next memory callback", async () => {
    const { wasmMachine, oracleMachine } = await createPair([0x3e, 0xaa, 0x32, 0x00, 0x90]);

    executeOneInstruction(wasmMachine);
    executeOneInstruction(oracleMachine);
    executeOneInstruction(wasmMachine);
    executeOneInstruction(oracleMachine);

    expectSameCpuRegisters(wasmMachine, oracleMachine, ["pc", "af", "tacts"]);
    expectSameMemoryReads(wasmMachine, oracleMachine, [0x9000]);
    expect(wasmMachine.wasmV2Runtime?.exports.zxnextGetLastMemoryAddress()).toBe(0x9000);
    expect(wasmMachine.wasmV2Runtime?.exports.zxnextGetLastMemoryValue()).toBe(0xaa);
    expect(wasmMachine.wasmV2Runtime?.exports.zxnextGetLastMemoryIsWrite()).toBe(1);
  });

  it("records CPU port writes through the ZX Next port callback", async () => {
    const { wasmMachine } = await createPair([0x3e, 0x47, 0xd3, 0xfd]);

    executeOneInstruction(wasmMachine);
    executeOneInstruction(wasmMachine);

    expect(wasmMachine.wasmV2Runtime?.exports.zxnextGetLastPortAddress()).toBe(0x47fd);
    expect(wasmMachine.wasmV2Runtime?.exports.zxnextGetLastPortValue()).toBe(0x47);
    expect(wasmMachine.wasmV2Runtime?.exports.zxnextGetLastPortIsWrite()).toBe(1);
    expect(wasmMachine.getCpuState().lastIoWritePort).toBe(0x47fd);
  });

  it("executes NEXTREG N,N and mirrors the TBBlue event into NextReg state", async () => {
    const { wasmMachine } = await createPair([0xed, 0x91, 0x13, 0xac]);

    executeOneInstruction(wasmMachine);

    expect(wasmMachine.readNextReg(0x13)).toBe(0xac);
    expect(wasmMachine.wasmV2Runtime?.exports.zxnextGetLastTbBlueAddress()).toBe(0x13);
    expect(wasmMachine.wasmV2Runtime?.exports.zxnextGetLastTbBlueValue()).toBe(0xac);
    expect(wasmMachine.wasmV2Runtime?.exports.zxnextGetLastTbBlueIsWrite()).toBe(1);
  });

  it("executes NEXTREG N,A and mirrors A into NextReg state", async () => {
    const { wasmMachine } = await createPair([0xed, 0x92, 0x42]);
    wasmMachine.setTestCpuRegisters({ af: 0x5a00 });

    executeOneInstruction(wasmMachine);

    expect(wasmMachine.readNextReg(0x42)).toBe(0x5a);
  });

  it("executes OUTINB through memory and port callbacks", async () => {
    const { wasmMachine } = await createPair([0xed, 0x90]);
    wasmMachine.writeTestMemory(0x9000, 0x77);
    wasmMachine.setTestCpuRegisters({ bc: 0x1234, hl: 0x9000 });

    executeOneInstruction(wasmMachine);

    expect(wasmMachine.getTestCpuRegisters().hl).toBe(0x9001);
    expect(wasmMachine.wasmV2Runtime?.exports.zxnextGetLastPortAddress()).toBe(0x1234);
    expect(wasmMachine.wasmV2Runtime?.exports.zxnextGetLastPortValue()).toBe(0x77);
    expect(wasmMachine.wasmV2Runtime?.exports.zxnextGetLastPortIsWrite()).toBe(1);
  });

  it("executes JP (C) through the port read callback", async () => {
    const { wasmMachine } = await createPair([0xed, 0x98]);
    wasmMachine.setTestCpuRegisters({ bc: 0x1234, pc: 0x8000 });
    wasmMachine.setPortReadValue(0x21);

    executeOneInstruction(wasmMachine);

    expect(wasmMachine.getTestCpuRegisters().pc).toBe(0x8840);
    expect(wasmMachine.wasmV2Runtime?.exports.zxnextGetLastPortAddress()).toBe(0x1234);
    expect(wasmMachine.wasmV2Runtime?.exports.zxnextGetLastPortIsWrite()).toBe(0);
  });

  it("executes LDIRX through repeated memory callbacks", async () => {
    const { wasmMachine } = await createPair([0xed, 0xb4]);
    wasmMachine.writeTestMemory(0x9000, 0x11);
    wasmMachine.writeTestMemory(0x9001, 0x22);
    wasmMachine.setTestCpuRegisters({ af: 0xff00, bc: 0x0002, de: 0x9100, hl: 0x9000 });

    executeOneInstruction(wasmMachine);
    executeOneInstruction(wasmMachine);

    expect(wasmMachine.readTestMemory(0x9100)).toBe(0x11);
    expect(wasmMachine.readTestMemory(0x9101)).toBe(0x22);
    expect(wasmMachine.getTestCpuRegisters().bc).toBe(0);
    expect(wasmMachine.getTestCpuRegisters().hl).toBe(0x9002);
    expect(wasmMachine.getTestCpuRegisters().de).toBe(0x9102);
  });
});

async function createPair(code: number[]): Promise<{
  wasmMachine: Awaited<ReturnType<typeof createTestZxNextWasmMachine>>;
  oracleMachine: Awaited<ReturnType<typeof createOracleZxNextMachine>>;
}> {
  const wasmMachine = await createTestZxNextWasmMachine();
  const oracleMachine = await createOracleZxNextMachine();
  initCodeBytes(wasmMachine, code, 0x8000);
  initCodeBytes(oracleMachine, code, 0x8000);
  return { wasmMachine, oracleMachine };
}
