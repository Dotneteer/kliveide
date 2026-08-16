import { describe, expect, it } from "vitest";

import { createTestSpp3eWasmMachine, testRom, type TestSpp3eWasmMachine } from "./wasm-test-helpers";

describe("ZX Spectrum +3E WASM disk and FDC parity", () => {
  it("returns 0xff from FDC ports when no floppy drive is enabled", async () => {
    const machine = await createMachine();

    callWasmExport(machine, "spp3eSetFdcEnabledDriveCount")(0);

    expect(callWasmExport(machine, "spp3eGetFdcEnabledDriveCount")()).toBe(0);
    expect(machine.readTestPort(0x2ffd)).toBe(0xff);
    expect(machine.readTestPort(0x3ffd)).toBe(0xff);
    expect(callWasmExport(machine, "spp3eFdcGetMainStatusRegister")()).toBe(0xff);
  });

  it("exposes reset, result phase, and data register state", async () => {
    const machine = await createMachine();

    expect(callWasmExport(machine, "spp3eGetDiskDriveCount")()).toBe(2);
    expect(callWasmExport(machine, "spp3eGetFdcEnabledDriveCount")()).toBe(2);
    expect(callWasmExport(machine, "spp3eFdcGetMainStatusRegister")()).toBe(0x80);
    expect(callWasmExport(machine, "spp3eFdcGetOperationPhase")()).toBe(0);
    expect(callWasmExport(machine, "spp3eFdcGetCurrentDrive")()).toBe(0);
    expect(machine.readTestPort(0x2ffd)).toBe(0x80);
    expect(machine.readTestPort(0x3ffd)).toBe(0xff);

    callWasmExport(machine, "spp3eFdcSetResultPhase")(1, 0x5a);

    expect(callWasmExport(machine, "spp3eFdcGetMainStatusRegister")()).toBe(0xd0);
    expect(callWasmExport(machine, "spp3eFdcGetOperationPhase")()).toBe(2);
    expect(callWasmExport(machine, "spp3eFdcGetResultBytesLeft")()).toBe(1);
    expect(callWasmExport(machine, "spp3eFdcGetResultRegister")(0)).toBe(0x5a);
    expect(machine.readTestPort(0x3ffd)).toBe(0x5a);
    expect(callWasmExport(machine, "spp3eFdcGetOperationPhase")()).toBe(0);
    expect(callWasmExport(machine, "spp3eFdcGetMainStatusRegister")()).toBe(0x80);

    machine.writeTestPort(0x3ffd, 0xa9);

    expect(callWasmExport(machine, "spp3eFdcGetCommandRegister")()).toBe(0xa9);
    expect(callWasmExport(machine, "spp3eFdcGetCommandId")()).toBe(10);
    expect(callWasmExport(machine, "spp3eFdcGetMainStatusRegister")()).toBe(0xd0);
    expect(machine.readTestPort(0x3ffd)).toBe(0x80);
  });

  it("uploads and ejects drive B media with write-protect state", async () => {
    const machine = await createMachine();
    const runtime = machine.wasmV2Runtime!;

    callWasmExport(machine, "spp3eSetFdcEnabledDriveCount")(2);
    const startRevision = callWasmExport(machine, "spp3eDiskGetRevision")(1);

    expect(callWasmExport(machine, "spp3eDiskBeginUpload")(1, 4, 1, 40, 1)).toBe(1);
    for (const [offset, value] of [0x44, 0x53, 0x4b, 0x21].entries()) {
      expect(callWasmExport(machine, "spp3eDiskWriteData")(1, offset, value)).toBe(1);
    }
    expect(callWasmExport(machine, "spp3eDiskFinishUpload")(1)).toBe(1);

    expect(Array.from(runtime.diskBData.slice(0, 4))).toEqual([0x44, 0x53, 0x4b, 0x21]);
    expect(callWasmExport(machine, "spp3eDiskReadData")(1, 2)).toBe(0x4b);
    expect(callWasmExport(machine, "spp3eDiskGetLoaded")(1)).toBe(1);
    expect(callWasmExport(machine, "spp3eDiskGetLength")(1)).toBe(4);
    expect(callWasmExport(machine, "spp3eDiskGetWriteProtected")(1)).toBe(1);
    expect(callWasmExport(machine, "spp3eDiskGetHasTwoHeads")(1)).toBe(0);
    expect(callWasmExport(machine, "spp3eDiskGetMaxCylinders")(1)).toBe(40);
    expect(callWasmExport(machine, "spp3eDiskGetRevision")(1)).toBe(startRevision + 1);

    callWasmExport(machine, "spp3eDiskSetWriteProtected")(1, 0);
    expect(callWasmExport(machine, "spp3eDiskGetWriteProtected")(1)).toBe(0);
    expect(callWasmExport(machine, "spp3eDiskGetRevision")(1)).toBe(startRevision + 2);

    callWasmExport(machine, "spp3eDiskEject")(1);
    expect(callWasmExport(machine, "spp3eDiskGetLoaded")(1)).toBe(0);
    expect(callWasmExport(machine, "spp3eDiskGetReady")(1)).toBe(0);
    expect(callWasmExport(machine, "spp3eDiskGetWriteProtected")(1)).toBe(0);
  });

  it("tracks drive selection, head load, motor speed, and ready state", async () => {
    const machine = await createMachine();

    callWasmExport(machine, "spp3eSetFdcEnabledDriveCount")(2);
    expect(callWasmExport(machine, "spp3eDiskBeginUpload")(0, 1, 0, 42, 2)).toBe(1);
    expect(callWasmExport(machine, "spp3eDiskWriteData")(0, 0, 0xee)).toBe(1);
    expect(callWasmExport(machine, "spp3eDiskFinishUpload")(0)).toBe(1);

    callWasmExport(machine, "spp3eFdcSelectDrive")(0, 1);

    expect(callWasmExport(machine, "spp3eFdcGetCurrentDrive")()).toBe(0);
    expect(callWasmExport(machine, "spp3eDiskGetSelected")(0)).toBe(1);
    expect(callWasmExport(machine, "spp3eDiskGetSelected")(1)).toBe(0);
    expect(callWasmExport(machine, "spp3eDiskGetCurrentHead")(0)).toBe(1);
    expect(callWasmExport(machine, "spp3eDiskGetHeadLoaded")(0)).toBe(1);
    expect(callWasmExport(machine, "spp3eDiskGetTrack0")(0)).toBe(1);
    expect(callWasmExport(machine, "spp3eFdcGetStatusRegister3")() & 0x5c).toBe(0x1c);

    machine.writeTestPort(0x1ffd, 0x08);
    expect(callWasmExport(machine, "spp3eGetDiskMotorOn")()).toBe(1);
    expect(callWasmExport(machine, "spp3eDiskGetMotorOn")(0)).toBe(1);

    machine.executeMachineFrame();
    expect(callWasmExport(machine, "spp3eDiskGetMotorSpeed")(0)).toBe(2);
    expect(callWasmExport(machine, "spp3eDiskGetReady")(0)).toBe(0);

    for (let i = 0; i < 49; i++) {
      machine.executeMachineFrame();
    }

    expect(callWasmExport(machine, "spp3eDiskGetMotorSpeed")(0)).toBe(100);
    expect(callWasmExport(machine, "spp3eDiskGetReady")(0)).toBe(1);
    expect(callWasmExport(machine, "spp3eFdcGetStatusRegister3")() & 0x20).toBe(0x20);

    machine.writeTestPort(0x1ffd, 0x00);
    machine.executeMachineFrame();

    expect(callWasmExport(machine, "spp3eGetDiskMotorOn")()).toBe(0);
    expect(callWasmExport(machine, "spp3eDiskGetMotorOn")(0)).toBe(0);
    expect(callWasmExport(machine, "spp3eDiskGetMotorSpeed")(0)).toBe(98);
    expect(callWasmExport(machine, "spp3eDiskGetReady")(0)).toBe(0);
  });

  it("executes representative specify, sense drive, seek, and sense interrupt commands", async () => {
    const machine = await createMachine();

    callWasmExport(machine, "spp3eSetFdcEnabledDriveCount")(2);
    expect(callWasmExport(machine, "spp3eDiskBeginUpload")(1, 1, 1, 42, 2)).toBe(1);
    expect(callWasmExport(machine, "spp3eDiskWriteData")(1, 0, 0xee)).toBe(1);
    expect(callWasmExport(machine, "spp3eDiskFinishUpload")(1)).toBe(1);

    writeData(machine, [0x03, 0xdf, 0x03]);

    expect(callWasmExport(machine, "spp3eFdcGetCommandId")()).toBe(7);
    expect(callWasmExport(machine, "spp3eFdcGetStepRate")()).toBe(3);
    expect(callWasmExport(machine, "spp3eFdcGetHeadUnloadTime")()).toBe(240);
    expect(callWasmExport(machine, "spp3eFdcGetHeadLoadTime")()).toBe(1);
    expect(callWasmExport(machine, "spp3eFdcGetNonDmaMode")()).toBe(1);
    expect(callWasmExport(machine, "spp3eFdcGetMainStatusRegister")()).toBe(0x80);

    writeData(machine, [0x04, 0x05]);
    expect(callWasmExport(machine, "spp3eFdcGetCommandId")()).toBe(8);
    expect(callWasmExport(machine, "spp3eFdcGetCurrentDrive")()).toBe(1);
    expect(callWasmExport(machine, "spp3eFdcGetOperationPhase")()).toBe(2);
    expect(machine.readTestPort(0x3ffd)).toBe(0x5d);

    writeData(machine, [0x0f, 0x01, 0x12]);
    expect(callWasmExport(machine, "spp3eFdcGetCommandId")()).toBe(9);
    expect(callWasmExport(machine, "spp3eDiskGetCurrentCylinder")(1)).toBe(0x12);
    expect(callWasmExport(machine, "spp3eDiskGetTrack0")(1)).toBe(0);
    expect(callWasmExport(machine, "spp3eFdcGetOperationPhase")()).toBe(0);

    machine.writeTestPort(0x3ffd, 0x08);
    expect(callWasmExport(machine, "spp3eFdcGetCommandId")()).toBe(6);
    expect(machine.readTestPort(0x3ffd)).toBe(0x21);
    expect(machine.readTestPort(0x3ffd)).toBe(0x12);
    expect(callWasmExport(machine, "spp3eFdcGetOperationPhase")()).toBe(0);
  });

  it("transfers synthetic FDC read/write data and journals dirty ranges", async () => {
    const machine = await createMachine();
    const runtime = machine.wasmV2Runtime!;

    expect(callWasmExport(machine, "spp3eDiskBeginUpload")(0, 128, 0, 42, 2)).toBe(1);
    expect(callWasmExport(machine, "spp3eDiskWriteData")(0, 0, 0x9a)).toBe(1);
    expect(callWasmExport(machine, "spp3eDiskFinishUpload")(0)).toBe(1);
    machine.writeTestPort(0x1ffd, 0x08);
    for (let i = 0; i < 50; i++) {
      machine.executeMachineFrame();
    }

    writeData(machine, [0x46, 0x00, 0x00, 0x00, 0x01, 0x00, 0x01, 0x1b, 0xff]);

    expect(callWasmExport(machine, "spp3eFdcGetCommandId")()).toBe(0);
    expect(callWasmExport(machine, "spp3eFdcGetOperationPhase")()).toBe(1);
    expect(callWasmExport(machine, "spp3eFdcGetMainStatusRegister")()).toBe(0xf0);
    expect(machine.readTestPort(0x3ffd)).toBe(0x9a);
    for (let i = 1; i < 128; i++) {
      machine.readTestPort(0x3ffd);
    }
    expect(callWasmExport(machine, "spp3eFdcGetOperationPhase")()).toBe(2);
    expect(machine.readTestPort(0x3ffd)).toBe(0x00);
    for (let i = 1; i < 7; i++) {
      machine.readTestPort(0x3ffd);
    }

    writeData(machine, [0x45, 0x00, 0x00, 0x00, 0x01, 0x00, 0x01, 0x1b, 0xff]);

    const revision = callWasmExport(machine, "spp3eFdcGetDirtyRevision")();
    expect(callWasmExport(machine, "spp3eFdcGetCommandId")()).toBe(1);
    expect(callWasmExport(machine, "spp3eFdcGetOperationPhase")()).toBe(1);
    machine.writeTestPort(0x3ffd, 0x77);
    for (let i = 1; i < 128; i++) {
      machine.writeTestPort(0x3ffd, 0x00);
    }

    expect(callWasmExport(machine, "spp3eDiskReadData")(0, 0)).toBe(0x77);
    expect(callWasmExport(machine, "spp3eFdcGetDirtyDrive")()).toBe(0);
    expect(callWasmExport(machine, "spp3eFdcGetDirtyOffset")()).toBe(0);
    expect(callWasmExport(machine, "spp3eFdcGetDirtyLength")()).toBe(128);
    expect(callWasmExport(machine, "spp3eFdcGetDirtyRevision")()).toBe(revision + 1);
    expect(Array.from(runtime.diskChanges.slice(0, 8))).toEqual([0, 0, 0, 0, 128, 0, 0, 0]);
    expect(callWasmExport(machine, "spp3eFdcGetOperationPhase")()).toBe(2);
    expect(machine.readTestPort(0x3ffd)).toBe(0x00);
  });
});

async function createMachine(): Promise<TestSpp3eWasmMachine> {
  return createTestSpp3eWasmMachine([testRom([]), testRom([]), testRom([]), testRom([])]);
}

function writeData(machine: TestSpp3eWasmMachine, bytes: number[]): void {
  for (const byte of bytes) {
    machine.writeTestPort(0x3ffd, byte);
  }
}

function callWasmExport(machine: TestSpp3eWasmMachine, name: string): (...args: number[]) => number {
  const fn = (machine.wasmV2Runtime?.exports as Record<string, unknown> | undefined)?.[name];
  if (typeof fn !== "function") {
    throw new Error(`WASM export '${name}' is not available.`);
  }
  return fn as (...args: number[]) => number;
}
