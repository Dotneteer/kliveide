import { readFileSync } from "node:fs";

import { buildZxNextWasm, productionOutput } from "../../scripts/build-zxnext-wasm.cjs";
import { createZxNextMachine } from "@emu/machines/zxNext/ZxNextMachineFactory";
import { ZXNEXT_IMPLEMENTATION } from "@emu/machines/zxNext/ZxNextImplementation";
import { ZxNextMachine } from "@emu/machines/zxNext/ZxNextMachine";
import { ZxNextWasmV2Machine } from "@emu/machines/zxNext/ZxNextWasmV2Machine";
import { describe, expect, it } from "vitest";

class TestZxNextWasmV2Machine extends ZxNextWasmV2Machine {
  constructor(private readonly roms: Record<string, Uint8Array>) {
    super(undefined, undefined, {
      artifactName: "machine-zxnext-v2.wasm",
      readArtifact: async () => readFileSync(productionOutput)
    });
  }

  protected override async loadRomFromFile(filename: string): Promise<Uint8Array> {
    const rom = this.roms[filename];
    if (rom == null) {
      throw new Error(`Unexpected ROM request '${filename}'.`);
    }
    return rom;
  }
}

describe("ZX Spectrum Next WASM v2 machine adapter", () => {
  it("sets up the v2 runtime and uploads the four Next ROM resources", async () => {
    buildZxNextWasm();
    const machine = createTestMachine();

    await machine.setup();

    expect(machine.implementation).toBe("wasm");
    expect(machine.wasmV2Runtime?.artifactName).toBe("machine-zxnext-v2.wasm");
    expect(machine.wasmV2Runtime?.exports.zxnextReadRomByte(0, 0)).toBe(0x10);
    expect(machine.wasmV2Runtime?.exports.zxnextReadRomByte(1, 0)).toBe(0x20);
    expect(machine.wasmV2Runtime?.exports.zxnextReadRomByte(2, 0)).toBe(0x30);
    expect(machine.wasmV2Runtime?.exports.zxnextReadRomByte(3, 0)).toBe(0x40);
    expect(machine.memoryDevice.memory[0]).toBe(0x10);
    expect(machine.memoryDevice.memory[0x01_0000]).toBe(0x20);
    expect(machine.memoryDevice.memory[0x01_4000]).toBe(0x30);
    expect(machine.memoryDevice.memory[0x01_8000]).toBe(0x40);
  });

  it("reports runtime diagnostics and reset state", async () => {
    buildZxNextWasm();
    const machine = createTestMachine();

    await machine.setup();
    const diagnostics = machine.getWasmV2Diagnostics();

    expect(diagnostics.backend).toBe("wasm");
    expect(diagnostics.engine).toBe("v2");
    expect(diagnostics.artifactName).toBe("machine-zxnext-v2.wasm");
    expect(diagnostics.frames).toBe(0);
    expect(diagnostics.tacts).toBe(0);
    expect(diagnostics.cpuPc).toBe(0);
    expect(diagnostics.cpuSp).toBe(0xffff);
    expect(diagnostics.sramSize).toBe(4 * 1024 * 1024);
    expect(diagnostics.romSize).toBe(0x20000);
    expect(diagnostics.uploadedRomMask).toBe(0x0f);
    expect(diagnostics.romUploads).toBe(totalRomBytes());
    expect(diagnostics).toMatchObject({
      wasmReadMemoryCalls: 0,
      wasmWriteMemoryCalls: 0,
      wasmReadPortCalls: 0,
      wasmWritePortCalls: 0,
      wasmExecuteFrameCalls: 0,
      wasmExecuteInstructionCalls: 0,
      wasmKeyboardSyncWrites: 0,
      wasmExtendedKeyboardSyncWrites: 0,
      wasmJoystickSyncWrites: 0,
      wasmMouseSyncWrites: 0,
      wasmI2cCmosSyncWrites: 0x40,
      wasmNextRegReadCalls: 0,
      wasmNextRegWriteCalls: 0,
      wasmRomReplayBytes: totalRomBytes(),
      wasmCpuRegisterSyncs: 0,
      wasmAudioFrameSampleCalls: 0,
      wasmAudioSampleCopies: 0,
      wasmSdFrameCommandSyncs: 0,
      wasmSdFrameCommandsPublished: 0,
      wasmFullBufferCopyBytes: 0,
      wasmMemoryPartitionCopyCalls: 0
    });
  });

  it("keeps normal frame execution inside WASM with bounded adapter syncs", async () => {
    buildZxNextWasm();
    const machine = createTestMachine();

    await machine.setup();
    machine.keyboardDevice.setKeyStatus(0, true);
    machine.joystickDevice.setLeftState(0x1f);
    machine.mouseDevice.addDelta(3, 4);

    machine.executeMachineFrame();
    const diagnostics = machine.getWasmV2Diagnostics();

    expect(diagnostics.wasmExecuteFrameCalls).toBe(1);
    expect(diagnostics.wasmExecuteInstructionCalls).toBe(0);
    expect(diagnostics.frameCallCount).toBe(1);
    expect(diagnostics.wasmLastFrameReadMemoryCrossings).toBe(0);
    expect(diagnostics.wasmLastFrameWriteMemoryCrossings).toBe(0);
    expect(diagnostics.wasmLastFrameReadPortCrossings).toBe(0);
    expect(diagnostics.wasmLastFrameWritePortCrossings).toBe(0);
    expect(diagnostics.wasmLastFrameCpuRegisterSyncs).toBe(0);
    expect(diagnostics.wasmLastFrameAudioFrameSampleCalls).toBe(0);
    expect(diagnostics.wasmLastFrameSdFrameCommandSyncs).toBe(1);
    expect(diagnostics.wasmLastFrameKeyboardSyncWrites).toBeGreaterThan(0);
    expect(diagnostics.wasmLastFrameKeyboardSyncWrites).toBeLessThanOrEqual(8);
    expect(diagnostics.wasmLastFrameExtendedKeyboardSyncWrites).toBeLessThanOrEqual(3);
    expect(diagnostics.wasmLastFrameJoystickSyncWrites).toBeLessThanOrEqual(1);
    expect(diagnostics.wasmLastFrameMouseSyncWrites).toBeLessThanOrEqual(1);
    expect(diagnostics.unsupportedPortReadCount).toBe(0);
    expect(diagnostics.unsupportedPortWriteCount).toBe(0);
  });

  it("tracks public adapter crossings and preserves delegated FDC bus inspection", async () => {
    buildZxNextWasm();
    const machine = createTestMachine();

    await machine.setup();
    machine.doWriteMemory(0x8000, 0x5a);
    expect(machine.doReadMemory(0x8000)).toBe(0x5a);
    machine.doWritePort(0x00fe, 0x03);
    expect(machine.doReadPort(0x00fe)).toBeGreaterThanOrEqual(0);
    machine.nextRegDevice.directSetRegValue(0x52, 0x12);
    expect(machine.nextRegDevice.directGetRegValue(0x52)).toBe(0x12);

    machine.doWritePort(0x3ffd, 0x03);
    expect(machine.getCpuState()).toMatchObject({
      lastIoWritePort: 0x3ffd,
      lastIoWriteValue: 0x03
    });
    machine.doReadPort(0x2ffd);
    expect(machine.getCpuState().lastIoReadPort).toBe(0x2ffd);

    const diagnostics = machine.getWasmV2Diagnostics();
    expect(diagnostics.wasmReadMemoryCalls).toBe(1);
    expect(diagnostics.wasmWriteMemoryCalls).toBe(1);
    expect(diagnostics.wasmReadPortCalls).toBe(1);
    expect(diagnostics.wasmWritePortCalls).toBe(1);
    expect(diagnostics.wasmNextRegReadCalls).toBeGreaterThan(0);
    expect(diagnostics.wasmNextRegWriteCalls).toBeGreaterThan(0);
    expect(diagnostics.unsupportedPortReadCount).toBe(0);
    expect(diagnostics.unsupportedPortWriteCount).toBe(0);
  });

  it("replays uploaded ROM bytes after reset and hard reset", async () => {
    buildZxNextWasm();
    const machine = createTestMachine();

    await machine.setup();
    machine.wasmV2Runtime?.exports.zxnextUploadRomByte(0, 0, 0xaa);
    expect(machine.wasmV2Runtime?.exports.zxnextReadRomByte(0, 0)).toBe(0xaa);

    machine.reset();
    expect(machine.wasmV2Runtime?.exports.zxnextReadRomByte(0, 0)).toBe(0x10);

    machine.wasmV2Runtime?.exports.zxnextUploadRomByte(1, 0, 0xbb);
    machine.hardReset();
    expect(machine.wasmV2Runtime?.exports.zxnextReadRomByte(1, 0)).toBe(0x20);
    expect(machine.getWasmV2Diagnostics().hardResets).toBeGreaterThanOrEqual(2);
  });

  it("uses WASM by default and keeps an explicit TypeScript fallback", () => {
    expect(createZxNextMachine()).toBeInstanceOf(ZxNextWasmV2Machine);
    expect(createZxNextMachine(undefined, { [ZXNEXT_IMPLEMENTATION]: "wasm" })).toBeInstanceOf(
      ZxNextWasmV2Machine
    );
    expect(createZxNextMachine(undefined, { [ZXNEXT_IMPLEMENTATION]: "typescript" })).toBeInstanceOf(
      ZxNextMachine
    );
  });
});

function createTestMachine(): TestZxNextWasmV2Machine {
  return new TestZxNextWasmV2Machine({
    "roms/enNextZX.rom": new Uint8Array([0x10, 0x11, 0x12]),
    "roms/enNxtmmc.rom": new Uint8Array([0x20, 0x21]),
    "roms/enNextMf.rom": new Uint8Array([0x30, 0x31, 0x32, 0x33]),
    "roms/enAltZX.rom": new Uint8Array([0x40])
  });
}

function totalRomBytes(): number {
  return 3 + 2 + 4 + 1;
}
