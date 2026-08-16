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

  it("reports skeleton diagnostics and reset state", async () => {
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

  it("creates the WASM skeleton only for explicit WASM factory selection", () => {
    expect(createZxNextMachine()).toBeInstanceOf(ZxNextMachine);
    expect(createZxNextMachine()).not.toBeInstanceOf(ZxNextWasmV2Machine);
    expect(createZxNextMachine(undefined, { [ZXNEXT_IMPLEMENTATION]: "wasm" })).toBeInstanceOf(
      ZxNextWasmV2Machine
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
